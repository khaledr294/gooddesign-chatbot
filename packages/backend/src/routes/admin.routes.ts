import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { reassignAgent } from '../services/handoff.service.js';
import { queueNotification } from '../services/notification.service.js';
import { syncProducts } from '../services/salla.service.js';
import crypto from 'node:crypto';
import { config } from '../config.js';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // Simple JWT auth check (middleware)
  app.addHook('onRequest', async (request, reply) => {
    // Skip auth for login route
    if (request.url.endsWith('/login')) return;

    const token = (request.headers.authorization || '').replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    try {
      // Simple HMAC-based token verification
      const [payload, sig] = token.split('.');
      const expected = crypto.createHmac('sha256', config.JWT_SECRET).update(payload).digest('base64url');
      if (sig !== expected) throw new Error('Invalid token');

      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      (request as any).agentId = data.agentId;
      (request as any).agentRole = data.role;
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });

  // ===== Auth =====
  app.post('/login', async (request) => {
    const { email, password } = request.body as { email: string; password: string };
    const agent = await prisma.agent.findUnique({ where: { email } });
    if (!agent) throw { statusCode: 401, message: 'بيانات الدخول غير صحيحة' };

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (hash !== agent.passwordHash) throw { statusCode: 401, message: 'بيانات الدخول غير صحيحة' };

    const payload = Buffer.from(JSON.stringify({ agentId: agent.id, role: agent.role })).toString('base64url');
    const sig = crypto.createHmac('sha256', config.JWT_SECRET).update(payload).digest('base64url');

    return {
      token: `${payload}.${sig}`,
      agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role },
    };
  });

  // ===== Conversations =====
  app.get('/conversations', async (request) => {
    const { status, agentId, page = '1', limit = '20' } = request.query as Record<string, string>;
    const requestingAgentId = (request as any).agentId;
    const requestingRole = (request as any).agentRole;

    const where: any = {};
    if (status) where.status = status;

    // Agents can only see their own conversations (unless admin)
    if (requestingRole !== 'ADMIN') {
      where.assignedAgentId = requestingAgentId;
    } else if (agentId) {
      where.assignedAgentId = agentId;
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true } },
          assignedAgent: { select: { id: true, name: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.conversation.count({ where }),
    ]);

    return { data: conversations, total, page: parseInt(page), limit: parseInt(limit) };
  });

  app.get('/conversations/:id', async (request) => {
    const { id } = request.params as { id: string };
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        user: true,
        assignedAgent: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  });

  app.post('/conversations/:id/reassign', async (request) => {
    const { id } = request.params as { id: string };
    const { agentId } = request.body as { agentId: string };
    return reassignAgent(id, agentId);
  });

  // ===== Orders =====
  app.get('/orders', async (request) => {
    const { status, page = '1', limit = '20' } = request.query as Record<string, string>;
    const where: any = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { name: true, phone: true } },
          items: { include: { product: { select: { name: true, imageUrl: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.order.count({ where }),
    ]);

    return { data: orders, total, page: parseInt(page), limit: parseInt(limit) };
  });

  app.get('/orders/:id', async (request) => {
    const { id } = request.params as { id: string };
    return prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: { include: { product: true } },
        conversation: { select: { id: true, channel: true } },
      },
    });
  });

  app.patch('/orders/:id/status', async (request) => {
    const { id } = request.params as { id: string };
    const { status, trackingUrl } = request.body as { status: string; trackingUrl?: string };

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: status as any,
        shippingTrackingUrl: trackingUrl || undefined,
      },
    });

    // Queue notification
    await queueNotification(order.id, status);

    return order;
  });

  app.post('/orders/:id/confirm-payment', async (request) => {
    const { id } = request.params as { id: string };
    const order = await prisma.order.update({
      where: { id },
      data: { status: 'PAYMENT_RECEIVED' },
    });

    await queueNotification(order.id, 'PAYMENT_RECEIVED');
    return order;
  });

  // ===== Agents =====
  app.get('/agents', async () => {
    return prisma.agent.findMany({
      include: {
        categories: { include: { category: { select: { id: true, name: true } } } },
        _count: {
          select: { conversations: { where: { status: { in: ['WAITING_AGENT', 'WITH_AGENT'] } } } },
        },
      },
    });
  });

  app.post('/agents', async (request) => {
    const { name, phone, email, password, role, categoryIds, maxConcurrentChats } = request.body as any;
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    const agent = await prisma.agent.create({
      data: {
        name,
        phone,
        email,
        passwordHash,
        role: role || 'AGENT',
        maxConcurrentChats: maxConcurrentChats || 5,
        categories: categoryIds?.length
          ? { create: categoryIds.map((catId: string) => ({ categoryId: catId })) }
          : undefined,
      },
    });

    return agent;
  });

  app.patch('/agents/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { name, phone, email, role, categoryIds, maxConcurrentChats } = request.body as any;

    // Update agent
    const agent = await prisma.agent.update({
      where: { id },
      data: { name, phone, email, role, maxConcurrentChats },
    });

    // Update category assignments if provided
    if (categoryIds) {
      await prisma.agentCategory.deleteMany({ where: { agentId: id } });
      if (categoryIds.length > 0) {
        await prisma.agentCategory.createMany({
          data: categoryIds.map((catId: string) => ({ agentId: id, categoryId: catId })),
        });
      }
    }

    return agent;
  });

  app.delete('/agents/:id', async (request) => {
    const { id } = request.params as { id: string };
    await prisma.agent.delete({ where: { id } });
    return { success: true };
  });

  // ===== Stats =====
  app.get('/stats', async (request) => {
    const { period = '7d' } = request.query as { period?: string };
    const days = period === '30d' ? 30 : period === '1d' ? 1 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalConversations,
      totalOrders,
      conversationsByStatus,
      ordersByStatus,
      topProducts,
      agentStats,
    ] = await Promise.all([
      prisma.conversation.count({ where: { createdAt: { gte: since } } }),
      prisma.order.count({ where: { createdAt: { gte: since } } }),
      prisma.conversation.groupBy({ by: ['status'], _count: true, where: { createdAt: { gte: since } } }),
      prisma.order.groupBy({ by: ['status'], _count: true, where: { createdAt: { gte: since } } }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
        where: { order: { createdAt: { gte: since } } },
      }),
      prisma.agent.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              conversations: { where: { createdAt: { gte: since } } },
              messages: { where: { createdAt: { gte: since } } },
            },
          },
        },
      }),
    ]);

    // Resolve product names for topProducts
    const productIds = topProducts.map((tp) => tp.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    const topProductsWithNames = topProducts.map((tp) => ({
      productId: tp.productId,
      productName: productMap.get(tp.productId) || 'Unknown',
      totalQuantity: tp._sum.quantity || 0,
    }));

    return {
      period: days,
      totalConversations,
      totalOrders,
      conversionRate: totalConversations > 0 ? (totalOrders / totalConversations * 100).toFixed(1) : '0',
      conversationsByStatus,
      ordersByStatus,
      topProducts: topProductsWithNames,
      agentStats,
    };
  });

  // ===== Settings =====
  app.get('/settings', async () => {
    const settings = await prisma.setting.findMany();
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  });

  app.put('/settings', async (request) => {
    const body = request.body as Record<string, string>;
    for (const [key, value] of Object.entries(body)) {
      await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    return { success: true };
  });

  // ===== Manual Sync =====
  app.post('/sync-products', async () => {
    syncProducts(); // Fire and forget
    return { message: 'Product sync started' };
  });

  // ===== Categories =====
  app.get('/categories', async () => {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  });
};
