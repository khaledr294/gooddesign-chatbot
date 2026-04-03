import type { FastifyPluginAsync } from 'fastify';

export const widgetRoutes: FastifyPluginAsync = async (app) => {
  // Widget config endpoint - returns public configuration
  app.get('/config', async () => {
    return {
      appName: 'Good Design',
      welcomeMessage: 'أهلاً وسهلاً! كيف نقدر نخدمك؟ 👋',
      primaryColor: '#1a1a2e',
      accentColor: '#e94560',
      position: 'bottom-left', // RTL
      language: 'ar',
    };
  });

  // File upload for widget (images)
  app.post('/upload', async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: 'No file uploaded' });

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return reply.status(400).send({ error: 'نوع الملف غير مدعوم' });
    }

    const buffer = await file.toBuffer();
    const { uploadBuffer } = await import('../services/storage.service.js');
    const key = `widget/uploads/${Date.now()}-${file.filename}`;
    const url = await uploadBuffer(buffer, key, file.mimetype);

    return { url };
  });
};
