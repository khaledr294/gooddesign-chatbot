# دليل التشغيل الكامل - Good Design Chatbot
> آخر تحديث: أبريل 2026

---

## نظرة سريعة

قبل البدء، تحتاج للحصول على بيانات من 4 مصادر:
1. **Docker** - لتشغيل قاعدة البيانات
2. **Meta (WhatsApp)** - للبوت على واتساب
3. **سلة (Salla)** - لمزامنة المنتجات والطلبات
4. **S3 Storage** - لرفع الصور (AWS أو MinIO)

---

## المرحلة الأولى: تجهيز الجهاز

### 1.1 تثبيت المتطلبات

| البرنامج | الإصدار | رابط التحميل |
|---------|---------|-------------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm i -g pnpm` |
| Docker Desktop | آخر إصدار | https://docker.com/products/docker-desktop |
| Git | أي إصدار | https://git-scm.com |

للتحقق من التثبيت:
```bash
node -v       # يجب أن يظهر v20+
pnpm -v       # يجب أن يظهر 9+
docker -v     # يجب أن يظهر Docker version...
```

### 1.2 تثبيت مكتبات المشروع
```bash
cd "d:\Chatbot"
pnpm install
```

---

## المرحلة الثانية: إعداد ملف .env

انسخ ملف المتغيرات البيئية:
```bash
cd "d:\Chatbot"
copy .env.example .env
```

ثم افتح ملف `.env` وابدأ بتعبئته حسب الخطوات التالية.

---

## المرحلة الثالثة: تهيئة قاعدة البيانات (Docker)

هذا الجزء **لا يحتاج أي حسابات خارجية** - يعمل على جهازك مباشرة.

### 3.1 اختر كلمات مرور

في ملف `.env` غيّر هذه القيم:
```env
DB_PASSWORD=اختر_كلمة_مرور_قوية_هنا
REDIS_PASSWORD=اختر_كلمة_مرور_قوية_أخرى_هنا
```

> ⚠️ لا تستخدم `changeme` في الإنتاج

### 3.2 اختر JWT_SECRET

يجب أن يكون **32 حرفاً على الأقل**، يمكنك توليده:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
انسخ الناتج وضعه في `.env`:
```env
JWT_SECRET=الناتج_من_الأمر_أعلاه
```

### 3.3 تشغيل قاعدة البيانات
```bash
cd "d:\Chatbot"
docker compose up postgres redis -d
```

انتظر 10 ثوانٍ ثم تحقق:
```bash
docker compose ps
# يجب أن يظهر postgres و redis بحالة "healthy"
```

### 3.4 تشغيل Migration قاعدة البيانات
```bash
cd "d:\Chatbot\packages\backend"
pnpm exec prisma migrate deploy
```

### 3.5 إنشاء حساب المشرف الأول
```bash
cd "d:\Chatbot\packages\backend"
pnpm exec ts-node src/seed-admin.ts
```

> سيتم إنشاء حساب بالبريد: `admin@gddsn.com` وكلمة المرور: `admin123`  
> **يجب تغيير كلمة المرور بعد أول تسجيل دخول**

---

## المرحلة الرابعة: إعداد WhatsApp Business API

### 4.1 إنشاء حساب Meta Developer

1. اذهب إلى https://developers.facebook.com
2. سجّل دخول بحساب Facebook
3. اضغط **"My Apps"** ثم **"Create App"**
4. اختر نوع التطبيق: **"Business"**
5. أدخل اسم التطبيق (مثل: `gooddesign-bot`) وبريدك الإلكتروني

### 4.2 إضافة WhatsApp للتطبيق

1. في لوحة التحكم اضغط **"Add Product"**
2. ابحث عن **WhatsApp** واضغط **"Set Up"**
3. اختر أو أنشئ **Business Portfolio** (حساب أعمال Meta)

### 4.3 الحصول على رقم الهاتف

**للاختبار (مجاني):**
- يُعطيك Meta رقم اختبار مجاني تلقائياً
- ابحث عن **"API Setup"** في قسم WhatsApp
- ستجد **"Test phone number"** جاهز للاستخدام

**للإنتاج:**
1. اضغط **"Add phone number"**
2. أدخل رقم هاتف حقيقي (يقبل رسائل SMS أو مكالمة للتحقق)
3. أدخل رمز التحقق الذي يصل للرقم

### 4.4 جمع البيانات المطلوبة

في صفحة **"API Setup"** ستجد:

```
WHATSAPP_PHONE_ID = Phone number ID (رقم مثل: 123456789012345)
```

للحصول على **Access Token الدائم**:
1. اذهب إلى **Business Settings** > **Users** > **System Users**
2. أنشئ System User جديد (Admin)
3. اضغط **"Generate Token"**
4. اختر تطبيقك وفعّل صلاحية `whatsapp_business_messaging`
5. انسخ التوكن - **احفظه فوراً، لن يظهر مرة أخرى**

```env
WHATSAPP_TOKEN=توكن_النظام_هنا
WHATSAPP_PHONE_ID=رقم_Phone_ID_هنا
WHATSAPP_VERIFY_TOKEN=اكتب_كلمة_سر_عشوائية_أنت_تختارها
```

> `WHATSAPP_VERIFY_TOKEN` تختاره أنت بنفسك (أي كلمة)، ستستخدمه لاحقاً عند إعداد الـ Webhook

### 4.5 إعداد Webhook (يتطلب رابط عام)

> ⚠️ هذه الخطوة تتطلب أن يكون السيرفر متاحاً على الإنترنت. إذا كنت تعمل محلياً، استخدم **ngrok** مؤقتاً (راجع الملاحق).

1. في قسم WhatsApp اضغط **"Configuration"**
2. في **Webhook** اضغط **"Edit"**
3. أدخل:
   - **Callback URL**: `https://your-domain.com/webhooks/whatsapp`
   - **Verify Token**: نفس قيمة `WHATSAPP_VERIFY_TOKEN` التي اخترتها
4. اضغط **"Verify and Save"**
5. بعد التحقق، اضغط **"Manage"** وفعّل:
   - `messages`

---

## المرحلة الخامسة: إعداد سلة (Salla)

### 5.1 إنشاء تطبيق في شركاء سلة

1. اذهب إلى https://salla.partners
2. سجّل دخول بحساب المتجر أو أنشئ حساباً جديداً
3. اضغط **"التطبيقات"** > **"إنشاء تطبيق جديد"**
4. أدخل اسم التطبيق واختر النوع: **Private App** (للاستخدام الخاص)

### 5.2 الحصول على Client ID و Client Secret

بعد إنشاء التطبيق:
```
SALLA_CLIENT_ID = يظهر في صفحة التطبيق
SALLA_CLIENT_SECRET = يظهر في صفحة التطبيق (اضغط "Show")
```

### 5.3 الحصول على Access Token و Refresh Token

**الطريقة الأسهل (Direct Token):**
1. في صفحة التطبيق اضغط **"OAuth 2.0"**
2. اضغط **"Generate Token"** واختر متجرك
3. ستحصل على:
```
SALLA_ACCESS_TOKEN = الـ Access Token
SALLA_REFRESH_TOKEN = الـ Refresh Token
```

> ملاحظة: الـ Access Token ينتهي صلاحيته، لكن النظام يجدده تلقائياً باستخدام الـ Refresh Token

### 5.4 إعداد Webhook سلة

1. في لوحة التحكم > التطبيق > **Webhooks**
2. أضف Webhook URL: `https://your-domain.com/webhooks/salla`
3. فعّل الأحداث:
   - `app.installed`
   - `order.status.updated`
   - `product.updated`

### 5.5 Webhook Secret

```
SALLA_WEBHOOK_SECRET = أي نص عشوائي تختاره (يستخدم للتحقق من الطلبات الواردة)
```

```env
SALLA_CLIENT_ID=xxxxxxxx
SALLA_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SALLA_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SALLA_REFRESH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SALLA_WEBHOOK_SECRET=كلمة_سر_عشوائية
```

---

## المرحلة السادسة: إعداد التخزين (S3)

### الخيار أ: AWS S3 (موصى به للإنتاج)

1. اذهب إلى https://aws.amazon.com وسجّل دخول
2. ابحث عن **S3** > **Create bucket**
3. اختر اسماً للـ Bucket (مثل: `gooddesign-uploads`)
4. اختر المنطقة: **Middle East (Bahrain) - me-south-1**
5. في **Block Public Access**: **ألغِ** تحديد الخيار الأول فقط (للسماح بالوصول العام للصور)

للحصول على المفاتيح:
1. اذهب إلى **IAM** > **Users** > **Create User**
2. أعطه صلاحية `AmazonS3FullAccess`
3. اضغط **"Create access key"** > اختر **"Application running outside AWS"**
4. انسخ المفاتيح:

```env
S3_BUCKET=gooddesign-uploads
S3_REGION=me-south-1
S3_ACCESS_KEY=AKIAXXXXXXXXXXXXXXXX
S3_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
S3_ENDPOINT=
```

### الخيار ب: MinIO (مجاني على سيرفرك)

إضافة لـ `docker-compose.yml`:
```yaml
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: changeme123
    volumes:
      - miniodata:/data

volumes:
  miniodata:
```

```env
S3_BUCKET=gooddesign-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY=admin
S3_SECRET_KEY=changeme123
S3_ENDPOINT=http://localhost:9000
```

---

## المرحلة السابعة: تشغيل المشروع كاملاً

### للتطوير المحلي:
```bash
cd "d:\Chatbot"

# تشغيل قاعدة البيانات (إذا لم تكن شغّالة)
docker compose up postgres redis -d

# تشغيل جميع الحزم معاً
pnpm dev
```

الخدمات ستكون متاحة على:
- **Backend API**: http://localhost:3000
- **Dashboard**: http://localhost:3001
- **Health Check**: http://localhost:3000/health

### للإنتاج (Docker كامل):
```bash
cd "d:\Chatbot"
docker compose up -d --build
```

---

## المرحلة الثامنة: أول تسجيل دخول

1. افتح المتصفح على: http://localhost:3001
2. سجّل دخول بـ:
   - البريد: `admin@gddsn.com`
   - كلمة المرور: `admin123`
3. اذهب إلى **الإعدادات** وغيّر كلمة المرور فوراً
4. أضف الموظفين (Agents) من قسم الإعدادات
5. تحقق من مزامنة المنتجات من سلة

---

## المرحلة التاسعة: إضافة الويدجت للموقع

بعد رفع المشروع على السيرفر، أضف هذا الكود قبل `</body>` في موقعك:

```html
<script 
  src="https://your-domain.com/widget/widget.js" 
  data-server="https://your-domain.com">
</script>
```

---

## ملف .env النهائي (مثال مكتمل)

```env
# ── Database ──────────────────────────────────
DB_PASSWORD=MyStr0ng#Pass2025
DATABASE_URL=postgresql://gd_user:MyStr0ng#Pass2025@localhost:5435/gooddesign

# ── Redis ─────────────────────────────────────
REDIS_PASSWORD=Redis#Secret2025
REDIS_URL=redis://:Redis#Secret2025@localhost:6379

# ── JWT ───────────────────────────────────────
JWT_SECRET=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6

# ── WhatsApp (Meta Cloud API) ─────────────────
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_PHONE_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=my_secret_verify_word

# ── Salla API ─────────────────────────────────
SALLA_API_URL=https://api.salla.dev/admin/v2
SALLA_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SALLA_REFRESH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SALLA_CLIENT_ID=xxxxxxxx
SALLA_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SALLA_WEBHOOK_SECRET=salla_webhook_secret_word

# ── S3 Storage ────────────────────────────────
S3_BUCKET=gooddesign-uploads
S3_REGION=me-south-1
S3_ACCESS_KEY=AKIAXXXXXXXXXXXXXXXX
S3_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
S3_ENDPOINT=

# ── Dashboard ─────────────────────────────────
DASHBOARD_API_URL=http://localhost:3000/api/admin
DASHBOARD_SOCKET_URL=http://localhost:3000
```

> ⚠️ في الإنتاج: غيّر `localhost` إلى الدومين الحقيقي

---

## الملاحق

### ملحق أ: استخدام ngrok للاختبار المحلي

إذا أردت اختبار Webhooks على جهازك بدون سيرفر:

```bash
# تثبيت ngrok
npm install -g ngrok

# تشغيله
ngrok http 3000
```

سيعطيك رابطاً مثل: `https://abc123.ngrok.io`  
استخدمه كـ Webhook URL مؤقتاً في Meta وسلة.

---

### ملحق ب: قائمة التحقق النهائية قبل الإطلاق

```
[ ] تم تثبيت Node.js و pnpm و Docker
[ ] تم إنشاء ملف .env وتعبئته
[ ] قاعدة البيانات شغّالة وتظهر "healthy"
[ ] تم تشغيل prisma migrate
[ ] تم إنشاء حساب المشرف (seed-admin)
[ ] WhatsApp Token محفوظ ورقم الهاتف مضاف
[ ] Webhook واتساب مربوط ومتحقق منه
[ ] بيانات سلة (Token + Webhook) مضافة
[ ] S3 Bucket منشأ والمفاتيح صحيحة
[ ] تم تسجيل الدخول للوحة التحكم
[ ] تم تغيير كلمة مرور المشرف
[ ] تم إضافة الموظفين من لوحة التحكم
[ ] تمت مزامنة المنتجات من سلة
[ ] تم اختبار محادثة واتساب كاملة
[ ] تم تضمين الويدجت في الموقع
```

---

### ملحق ج: حل المشكلات الشائعة

**مشكلة: `prisma migrate` يفشل**
```bash
# تأكد أن postgres شغّال أولاً
docker compose ps
# ثم جرب مرة أخرى بعد 15 ثانية
```

**مشكلة: WhatsApp Webhook لا يتحقق**
- تأكد أن `WHATSAPP_VERIFY_TOKEN` في `.env` يطابق ما أدخلته في لوحة Meta
- تأكد أن السيرفر يعمل ومتاح من الإنترنت

**مشكلة: سلة لا تزامن المنتجات**
- تحقق من صلاحية الـ Access Token
- راجع الـ logs: `docker compose logs backend`

**مشكلة: لوحة التحكم لا تفتح**
```bash
# تحقق من تشغيل الـ dashboard
docker compose logs dashboard
```
