import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  WHATSAPP_TOKEN: z.string(),
  WHATSAPP_PHONE_NUMBER_ID: z.string(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string(),
  WHATSAPP_VERIFY_TOKEN: z.string(),

  SALLA_CLIENT_ID: z.string(),
  SALLA_CLIENT_SECRET: z.string(),
  SALLA_ACCESS_TOKEN: z.string(),
  SALLA_REFRESH_TOKEN: z.string(),
  SALLA_WEBHOOK_SECRET: z.string().default(''),

  S3_ENDPOINT: z.string().default(''),
  S3_REGION: z.string().default('me-south-1'),
  S3_BUCKET: z.string().default('gooddesign-chatbot'),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),

  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  JWT_SECRET: z.string().min(32),

  DASHBOARD_URL: z.string().default('http://localhost:3001'),
});

export type Env = z.infer<typeof envSchema>;

export function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
