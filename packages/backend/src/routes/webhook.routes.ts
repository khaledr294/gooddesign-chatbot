import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';
import { handleWhatsAppMessage } from '../channels/whatsapp.handler.js';
import { handleSallaWebhook } from '../services/salla.service.js';
import { logger } from '../lib/logger.js';
import crypto from 'node:crypto';

export const webhookRoutes: FastifyPluginAsync = async (app) => {

  // ===== WhatsApp Webhook Verification (GET) =====
  app.get('/whatsapp', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === config.WHATSAPP_VERIFY_TOKEN) {
      logger.info('WhatsApp webhook verified');
      return reply.send(challenge);
    }

    return reply.status(403).send('Forbidden');
  });

  // ===== WhatsApp Webhook Messages (POST) =====
  app.post('/whatsapp', async (request, reply) => {
    const body = request.body as any;

    // Process asynchronously
    handleWhatsAppMessage(body).catch((err) => {
      logger.error(err, 'WhatsApp webhook processing error');
    });

    // Always respond 200 quickly to Meta
    return reply.send('OK');
  });

  // ===== Salla Webhook (POST) =====
  app.post('/salla', async (request, reply) => {
    const body = request.body as any;

    // Verify signature if secret is configured
    if (config.SALLA_WEBHOOK_SECRET) {
      const signature = (request.headers['x-salla-signature'] as string) || '';
      const expected = crypto
        .createHmac('sha256', config.SALLA_WEBHOOK_SECRET)
        .update(JSON.stringify(body))
        .digest('hex');

      if (signature !== expected) {
        logger.warn('Salla webhook signature mismatch');
        return reply.status(401).send('Invalid signature');
      }
    }

    const event = body.event;
    const data = body.data;

    handleSallaWebhook(event, data).catch((err) => {
      logger.error(err, 'Salla webhook processing error');
    });

    return reply.send({ success: true });
  });
};
