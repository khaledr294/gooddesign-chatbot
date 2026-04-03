export const APP_NAME = 'Good Design';
export const APP_NAME_AR = 'قود ديزاين';
export const WHATSAPP_NUMBER = '+966594114040';
export const SUPPORT_EMAIL = 'info@gddsn.com';
export const WEBSITE_URL = 'https://gddsn.com';

export const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours
export const PRODUCTS_SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
export const MAX_PRODUCTS_PER_PAGE = 10;
export const MAX_CART_ITEMS = 20;

// ===== Arabic Messages =====

export const MSG = {
  WELCOME: `أهلاً وسهلاً بك في *${APP_NAME_AR}* 👋\nكيف نقدر نخدمك اليوم؟`,

  MAIN_MENU: 'اختر من القائمة:',

  MAIN_MENU_BUTTONS: {
    PRODUCTS: { id: 'menu_products', title: '🛍 استعراض المنتجات' },
    CART: { id: 'menu_cart', title: '🛒 سلتي' },
    TRACK: { id: 'menu_track', title: '📦 تتبع طلبي' },
    AGENT: { id: 'menu_agent', title: '💬 تحدث مع موظف' },
    FAQ: { id: 'menu_faq', title: '❓ أسئلة شائعة' },
  },

  CATEGORY_SELECT: 'اختر التصنيف:',
  PRODUCT_LIST: 'اختر المنتج لعرض التفاصيل:',
  PRODUCT_DETAIL: (name: string, price: number, desc: string) =>
    `*${name}*\n💰 السعر: ${price} ر.س\n\n${desc}`,

  CUSTOMIZATION_START: 'رائع! هل تريد اختيار من القوالب الجاهزة أم تخصيص خاص؟',
  CUSTOMIZATION_TEMPLATE: 'اختر القالب المناسب:',
  CUSTOMIZATION_NAME: 'أدخل الاسم المطلوب على المنتج:',
  CUSTOMIZATION_IMAGE: 'أرسل الصورة المطلوبة:',
  CUSTOMIZATION_TEXT: 'هل تريد إضافة نص آخر؟ (أرسل النص أو اكتب "لا")',
  CUSTOMIZATION_CONFIRM: (summary: string) =>
    `ملخص التخصيص:\n${summary}\n\nهل التخصيص صحيح؟`,

  ADDED_TO_CART: (name: string) => `✅ تم إضافة *${name}* إلى السلة`,
  CART_EMPTY: '🛒 السلة فارغة\nاستعرض منتجاتنا واختر ما يناسبك!',
  CART_SUMMARY: (items: string, total: number) =>
    `🛒 *سلتك:*\n${items}\n\n💰 *المجموع: ${total} ر.س*`,

  PAYMENT_SELECT: 'اختر طريقة الدفع:',
  PAYMENT_TRANSFER_INFO: (bankName: string, iban: string, accountName: string) =>
    `🏦 *بيانات التحويل البنكي:*\n\nالبنك: ${bankName}\nرقم الآيبان: ${iban}\nاسم الحساب: ${accountName}\n\nبعد التحويل، أرسل صورة إيصال التحويل هنا.`,
  PAYMENT_RECEIPT_RECEIVED: '✅ تم استلام إيصال التحويل.\nسيتم مراجعته وتأكيد الطلب قريباً.',
  PAYMENT_SALLA_LINK: (url: string) =>
    `💳 أكمل الدفع عبر الرابط التالي:\n${url}`,

  ORDER_CONFIRMED: (orderId: string) =>
    `🎉 *تم تأكيد طلبك!*\nرقم الطلب: *${orderId}*\nسنبدأ بالعمل عليه فوراً.`,

  TRACK_INPUT: 'أدخل رقم الطلب أو رقم الجوال:',
  TRACK_STATUS: (orderId: string, status: string) =>
    `📦 *حالة الطلب ${orderId}:*\n${status}`,
  TRACK_NOT_FOUND: '❌ لم نجد طلباً بهذا الرقم. تأكد من الرقم وحاول مرة أخرى.',

  HANDOFF_CONNECTING: 'جاري تحويلك لأحد موظفينا... ⏳',
  HANDOFF_CONNECTED: (agentName: string) =>
    `تم توصيلك مع *${agentName}* 👤\nيمكنك التحدث معه مباشرة.`,
  HANDOFF_NO_AGENTS: 'عذراً، جميع الموظفين مشغولون حالياً.\nسيتم الرد عليك في أقرب وقت ممكن. 🙏',
  HANDOFF_END: 'تم إنهاء المحادثة مع الموظف.\nهل تحتاج مساعدة أخرى؟',

  FAQ_MENU: 'اختر السؤال:',
  FAQ_TOPICS: {
    SHIPPING: { id: 'faq_shipping', title: '🚚 الشحن والتوصيل' },
    RETURN: { id: 'faq_return', title: '🔄 الاسترجاع والاستبدال' },
    PAYMENT: { id: 'faq_payment', title: '💳 طرق الدفع' },
    HOURS: { id: 'faq_hours', title: '🕐 أوقات العمل' },
    AREAS: { id: 'faq_areas', title: '📍 مناطق التوصيل' },
  },
  FAQ_ANSWERS: {
    faq_shipping: '🚚 *الشحن والتوصيل:*\nنوفر توصيل لجميع مناطق المملكة.\nمدة التوصيل: 3-7 أيام عمل حسب المنطقة.\nالتوصيل مجاني!',
    faq_return: '🔄 *الاسترجاع والاستبدال:*\nيمكنك الاسترجاع أو الاستبدال خلال 7 أيام من استلام الطلب.\nالمنتجات المخصصة (بالاسم أو الصورة) لا يمكن استرجاعها.',
    faq_payment: '💳 *طرق الدفع:*\n- مدى\n- فيزا / ماستركارد\n- تحويل بنكي\n- Apple Pay\n- الدفع عند الاستلام (غير متاح حالياً)',
    faq_hours: '🕐 *أوقات العمل:*\nيومياً من 9 صباحاً إلى 11 مساءً\nنستقبل الطلبات على مدار الساعة عبر المتجر.',
    faq_areas: '📍 *مناطق التوصيل:*\nنوصل لجميع مناطق المملكة العربية السعودية.\nالتوصيل مجاني لجميع المناطق!',
  } as Record<string, string>,

  BACK: '🔙 رجوع',
  BACK_TO_MENU: '🏠 القائمة الرئيسية',
  INVALID_INPUT: 'عذراً، لم أفهم اختيارك. حاول مرة أخرى أو اختر من الخيارات المتاحة.',
  ERROR: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى لاحقاً.',

  OUT_OF_STOCK: '⚠️ عذراً، هذا المنتج غير متوفر حالياً.',
  QUANTITY_ASK: 'كم عدد القطع المطلوبة؟',

  // Notification templates
  NOTIF_ORDER_CONFIRMED: (orderId: string) =>
    `✅ تم تأكيد طلبك رقم *${orderId}*.\nسنبدأ العمل عليه فوراً!`,
  NOTIF_ORDER_SHIPPED: (orderId: string, trackingUrl?: string) =>
    `📦 تم شحن طلبك رقم *${orderId}*!${trackingUrl ? `\n🔗 تتبع الشحنة: ${trackingUrl}` : ''}`,
  NOTIF_ORDER_DELIVERED: (orderId: string) =>
    `🎉 تم توصيل طلبك رقم *${orderId}* بنجاح!\nنتمنى أن ينال إعجابك. ⭐`,
} as const;

// ===== Bank Transfer Info =====
export const BANK_INFO = {
  bankName: 'بنك الراجحي', // يتم تعديله من الإعدادات
  iban: 'SA0000000000000000000000', // يتم تعديله من الإعدادات
  accountName: 'مؤسسة قود ديزاين للدعاية والإعلان',
};

// ===== Order Status Labels =====
export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: '🟡 قيد الانتظار',
  AWAITING_PAYMENT: '🟠 بانتظار الدفع',
  PAYMENT_RECEIVED: '🟢 تم استلام الدفع',
  IN_DESIGN: '🎨 قيد التصميم',
  IN_PRODUCTION: '🏭 قيد التصنيع',
  SHIPPED: '🚚 تم الشحن',
  DELIVERED: '✅ تم التوصيل',
  CANCELLED: '❌ ملغي',
};
