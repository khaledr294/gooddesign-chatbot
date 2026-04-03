import axios from 'axios';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { PRODUCTS_SYNC_INTERVAL_MS } from '@gooddesign/shared';
import type { SallaOrderPayload } from '@gooddesign/shared';

const SALLA_API = 'https://api.salla.dev/admin/v2';

const sallaApi = axios.create({
  baseURL: SALLA_API,
  headers: { Authorization: `Bearer ${config.SALLA_ACCESS_TOKEN}` },
});

// Auto-refresh token on 401
sallaApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        await refreshSallaToken();
        error.config.headers.Authorization = `Bearer ${config.SALLA_ACCESS_TOKEN}`;
        return sallaApi(error.config);
      } catch (refreshErr) {
        logger.error(refreshErr, 'Salla token refresh failed');
      }
    }
    throw error;
  },
);

async function refreshSallaToken(): Promise<void> {
  const { data } = await axios.post('https://accounts.salla.sa/oauth2/token', {
    grant_type: 'refresh_token',
    client_id: config.SALLA_CLIENT_ID,
    client_secret: config.SALLA_CLIENT_SECRET,
    refresh_token: config.SALLA_REFRESH_TOKEN,
  });

  // Update in-memory config (in production, persist to DB/env)
  (config as any).SALLA_ACCESS_TOKEN = data.access_token;
  if (data.refresh_token) {
    (config as any).SALLA_REFRESH_TOKEN = data.refresh_token;
  }

  logger.info('Salla token refreshed');
}

/**
 * Sync all products and categories from Salla to local DB
 */
export async function syncProducts(): Promise<void> {
  logger.info('Starting Salla products sync...');

  try {
    // Sync categories
    const { data: catData } = await sallaApi.get('/categories', { params: { per_page: 100 } });
    const categories = catData.data || [];

    for (const cat of categories) {
      await prisma.category.upsert({
        where: { sallaId: cat.id },
        create: {
          sallaId: cat.id,
          name: cat.name,
          imageUrl: cat.image?.url || null,
        },
        update: {
          name: cat.name,
          imageUrl: cat.image?.url || null,
        },
      });
    }

    // Sync products (paginated)
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { data: prodData } = await sallaApi.get('/products', {
        params: { per_page: 50, page, status: 'sale' },
      });

      const products = prodData.data || [];
      if (products.length === 0) {
        hasMore = false;
        break;
      }

      for (const prod of products) {
        const images = (prod.images || []).map((img: { url: string }) => img.url);
        const mainImage = images[0] || prod.image?.url || null;
        const price = prod.price?.amount || 0;
        const salePrice = prod.sale_price?.amount || null;
        const prodCategories = prod.categories || [];

        const dbProduct = await prisma.product.upsert({
          where: { sallaId: prod.id },
          create: {
            sallaId: prod.id,
            name: prod.name,
            description: prod.description || '',
            price,
            salePrice,
            imageUrl: mainImage,
            images,
            quantity: prod.quantity ?? 0,
            isActive: prod.status === 'sale',
          },
          update: {
            name: prod.name,
            description: prod.description || '',
            price,
            salePrice,
            imageUrl: mainImage,
            images,
            quantity: prod.quantity ?? 0,
            isActive: prod.status === 'sale',
          },
        });

        // Link product to categories
        for (const cat of prodCategories) {
          const dbCat = await prisma.category.findUnique({ where: { sallaId: cat.id } });
          if (dbCat) {
            await prisma.productCategory.upsert({
              where: { productId_categoryId: { productId: dbProduct.id, categoryId: dbCat.id } },
              create: { productId: dbProduct.id, categoryId: dbCat.id },
              update: {},
            });
          }
        }
      }

      page++;
      if (page > (prodData.pagination?.totalPages || 1)) hasMore = false;
    }

    logger.info('Salla products sync completed');
  } catch (err) {
    logger.error(err, 'Salla products sync failed');
  }
}

/**
 * Create order in Salla
 */
export async function createSallaOrder(
  payload: SallaOrderPayload,
): Promise<{ orderId: number; checkoutUrl: string }> {
  const { data } = await sallaApi.post('/orders', payload);

  return {
    orderId: data.data.id,
    checkoutUrl: data.data.urls?.checkout || data.data.urls?.invoice || '',
  };
}

/**
 * Get order status from Salla
 */
export async function getSallaOrderStatus(orderId: number): Promise<string> {
  const { data } = await sallaApi.get(`/orders/${orderId}`);
  return data.data.status?.name || 'unknown';
}

/**
 * Start periodic product sync
 */
export function startProductSync(): void {
  // Initial sync
  syncProducts();

  // Periodic sync
  setInterval(syncProducts, PRODUCTS_SYNC_INTERVAL_MS);
  logger.info(`Product sync scheduled every ${PRODUCTS_SYNC_INTERVAL_MS / 60000} minutes`);
}

/**
 * Handle Salla webhook events
 */
export async function handleSallaWebhook(event: string, data: any): Promise<void> {
  logger.info({ event }, 'Salla webhook received');

  switch (event) {
    case 'product.updated':
    case 'product.created':
      await syncProducts(); // Re-sync all (could optimize to sync single product)
      break;

    case 'order.updated':
    case 'order.status.updated': {
      const sallaOrderId = data.id;
      const newStatus = data.status?.customized?.name || data.status?.name;

      // Map Salla status to our status
      const statusMap: Record<string, string> = {
        'جديد': 'PENDING',
        'قيد التنفيذ': 'IN_PRODUCTION',
        'تم الشحن': 'SHIPPED',
        'تم التوصيل': 'DELIVERED',
        'ملغي': 'CANCELLED',
      };

      const mappedStatus = statusMap[newStatus] || 'PENDING';

      const order = await prisma.order.findUnique({ where: { sallaOrderId } });
      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: mappedStatus as any },
        });

        // Trigger notification (handled by notification service)
        const { queueNotification } = await import('./notification.service.js');
        await queueNotification(order.id, mappedStatus);
      }
      break;
    }
  }
}
