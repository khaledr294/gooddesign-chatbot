import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { Server } from 'socket.io';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { logger } from './lib/logger.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { widgetRoutes } from './routes/widget.routes.js';
import { setupSocketIO } from './channels/widget.handler.js';
import { startProductSync } from './services/salla.service.js';

async function main() {
  const app = Fastify({ logger: false });

  // Plugins
  await app.register(cors, { origin: config.CORS_ORIGIN, credentials: true });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

  // Routes
  await app.register(webhookRoutes, { prefix: '/webhook' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(widgetRoutes, { prefix: '/api/widget' });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Start server
  const address = await app.listen({ port: config.PORT, host: config.HOST });
  logger.info(`🚀 Server running at ${address}`);

  // Socket.IO for widget real-time + dashboard
  const io = new Server(app.server, {
    cors: { origin: config.CORS_ORIGIN, credentials: true },
    path: '/ws',
  });
  setupSocketIO(io);

  // Connect Redis
  await redis.connect();

  // Start periodic product sync from Salla
  startProductSync();

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await app.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
