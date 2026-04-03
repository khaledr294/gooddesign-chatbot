# Good Design Chatbot - دليل التشغيل

## نظرة عامة
شاتبوت آلي متكامل لشركة Good Design للدعاية والطباعة، يعمل على واتساب وويدجت الموقع مع لوحة تحكم للإدارة.

## المتطلبات
- Node.js 20+
- pnpm 9+
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose (للنشر)

## التشغيل المحلي

### 1. تثبيت التبعيات
```bash
pnpm install
```

### 2. إعداد المتغيرات البيئية
```bash
cp .env.example .env
# عدّل ملف .env بالقيم الصحيحة
```

### 3. إعداد قاعدة البيانات
```bash
cd packages/backend
npx prisma migrate dev
npx prisma db seed  # إذا وجد seeder
```

### 4. تشغيل المشروع
```bash
# من المجلد الرئيسي
pnpm dev
```

## التشغيل بـ Docker

```bash
cp .env.example .env
# عدّل ملف .env

docker compose up -d
```

## هيكل المشروع
```
packages/
├── shared/      # أنواع TypeScript ومتغيرات مشتركة
├── backend/     # خادم Fastify + WhatsApp + Flows
├── widget/      # ويدجت محادثة Preact
└── dashboard/   # لوحة تحكم Next.js
```

## الخدمات
| الخدمة | المنفذ | الوصف |
|--------|--------|-------|
| Backend | 3000 | API + WebSocket + Webhooks |
| Dashboard | 3001 | لوحة تحكم الإدارة |
| PostgreSQL | 5432 | قاعدة البيانات |
| Redis | 6379 | الجلسات والكاش |

## إعداد واتساب
1. أنشئ تطبيق في [Meta for Developers](https://developers.facebook.com)
2. فعّل WhatsApp Business API
3. أضف رقم الهاتف واحصل على Token
4. اضبط Webhook URL: `https://your-domain.com/webhooks/whatsapp`
5. استخدم WHATSAPP_VERIFY_TOKEN للتحقق

## إعداد سلة
1. أنشئ تطبيق في [شركاء سلة](https://salla.partners)
2. احصل على Access Token و Client ID/Secret
3. اضبط Webhook URL: `https://your-domain.com/webhooks/salla`
4. فعّل الإشعارات: product.updated, order.status.updated

## الموظفون
- النظام يدعم 3 موظفين مع تخصيص فئات لكل موظف
- التوجيه التلقائي حسب فئة المنتج
- اللجوء للموظف الأقل انشغالاً عند عدم التطابق
- إدارة الموظفين من لوحة التحكم > الإعدادات

## إضافة الويدجت للموقع
```html
<script src="https://your-domain.com/widget/widget.js" data-server="https://your-domain.com"></script>
```
