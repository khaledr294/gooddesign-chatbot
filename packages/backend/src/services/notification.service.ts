import { Queue, Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { MSG } from '@gooddesign/shared';
import { sendWhatsAppTemplate } from '../channels/whatsapp.client.js';

const QUEUE_NAME = 'notifications';

const notificationQueue = new Queue(QUEUE_NAME, {
  connection: redis,
});

// Worker to process notification jobs
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { orderId, status } = job.data as { orderId: string; status: string };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) return;

    const phone = order.user.phone;

    // Only send WhatsApp notifications if phone is a real phone number (not widget session)
    if (!phone.startsWith('+') && !phone.match(/^\d{10,15}$/)) return;

    try {
      switch (status) {
        case 'PAYMENT_RECEIVED':
          await sendWhatsAppTemplate(phone, 'order_confirmation', 'ar', [order.orderNumber]);
          break;

        case 'SHIPPED':
          await sendWhatsAppTemplate(phone, 'shipping_notification', 'ar', [
            order.orderNumber,
            order.shippingTrackingUrl || '',
          ]);
          break;

        case 'DELIVERED':
          await sendWhatsAppTemplate(phone, 'order_delivered', 'ar', [order.orderNumber]);
          break;
      }

      logger.info({ orderId, status, phone }, 'Notification sent');
    } catch (err) {
      logger.error({ err, orderId, status }, 'Notification failed');
      throw err; // BullMQ will retry
    }
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }, // Rate limit: 10/sec
  },
);

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Notification job failed');
});

/**
 * Queue a notification for an order status change
 */
export async function queueNotification(orderId: string, status: string): Promise<void> {
  await notificationQueue.add(
    'order_notification',
    { orderId, status },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}
