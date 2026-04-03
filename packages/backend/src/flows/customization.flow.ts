import {
  FlowState,
  type IncomingMessage,
  type SessionData,
  type FlowResult,
  MessageType,
} from '@gooddesign/shared';
import { MSG } from '@gooddesign/shared';
import { prisma } from '../lib/prisma.js';
import { buildMainMenuResult, buttonsMsg, textMsg } from './engine.js';

export async function customizationFlow(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  switch (session.flowState) {
    case FlowState.CUSTOMIZATION:
      return handleCustomizationStart(message, session);
    case FlowState.CUSTOMIZATION_TEMPLATE:
      return handleTemplateSelect(message, session);
    case FlowState.CUSTOMIZATION_NAME:
      return handleNameInput(message, session);
    case FlowState.CUSTOMIZATION_IMAGE:
      return handleImageUpload(message, session);
    case FlowState.CUSTOMIZATION_TEXT:
      return handleTextInput(message, session);
    case FlowState.CUSTOMIZATION_CONFIRM:
      return handleConfirm(message, session);
    default:
      return buildMainMenuResult();
  }
}

async function handleCustomizationStart(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  const choice = message.buttonReplyId || message.text?.trim();
  const productId = session.customization?.productId;
  if (!productId) return buildMainMenuResult();

  // Check if product has templates
  const templates = await prisma.productTemplate.findMany({
    where: { productId, isActive: true },
  });

  if (choice === 'custom_template' && templates.length > 0) {
    const rows = templates.map((t) => ({
      id: `tpl_${t.id}`,
      title: t.name,
    }));
    return {
      messages: [
        buttonsMsg(MSG.CUSTOMIZATION_TEMPLATE, rows.slice(0, 3)),
      ],
      newState: FlowState.CUSTOMIZATION_TEMPLATE,
    };
  }

  if (choice === 'custom_free' || templates.length === 0) {
    // Go to name input
    const product = await prisma.product.findUnique({ where: { id: productId } });
    const fields = product?.customizationFields || ['name'];
    if (fields.includes('name')) {
      return {
        messages: [textMsg(MSG.CUSTOMIZATION_NAME)],
        newState: FlowState.CUSTOMIZATION_NAME,
      };
    }
    if (fields.includes('image')) {
      return {
        messages: [textMsg(MSG.CUSTOMIZATION_IMAGE)],
        newState: FlowState.CUSTOMIZATION_IMAGE,
      };
    }
    return {
      messages: [textMsg(MSG.CUSTOMIZATION_TEXT)],
      newState: FlowState.CUSTOMIZATION_TEXT,
    };
  }

  // Initial display: show options
  const buttons = [];
  if (templates.length > 0) {
    buttons.push({ id: 'custom_template', title: '📋 قوالب جاهزة' });
  }
  buttons.push({ id: 'custom_free', title: '✏️ تخصيص حر' });

  return {
    messages: [buttonsMsg(MSG.CUSTOMIZATION_START, buttons)],
    newState: FlowState.CUSTOMIZATION,
  };
}

async function handleTemplateSelect(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  const choice = message.buttonReplyId || message.text?.trim();
  if (!choice?.startsWith('tpl_')) {
    return {
      messages: [textMsg('اختر قالباً من القائمة أعلاه.')],
      newState: FlowState.CUSTOMIZATION_TEMPLATE,
    };
  }

  const templateId = choice.replace('tpl_', '');
  const template = await prisma.productTemplate.findUnique({ where: { id: templateId } });

  if (!template) {
    return {
      messages: [textMsg('القالب غير متوفر. اختر قالباً آخر.')],
      newState: FlowState.CUSTOMIZATION_TEMPLATE,
    };
  }

  const customization = {
    ...session.customization!,
    templateId: template.id,
  };

  // After selecting template, go to name input
  return {
    messages: [
      { type: MessageType.IMAGE, imageUrl: template.imageUrl, text: `قالب: *${template.name}*` },
      textMsg(MSG.CUSTOMIZATION_NAME),
    ],
    newState: FlowState.CUSTOMIZATION_NAME,
    sessionUpdates: { customization },
  };
}

async function handleNameInput(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  if (!message.text || message.text.trim().length === 0) {
    return {
      messages: [textMsg('يرجى إدخال الاسم المطلوب:')],
      newState: FlowState.CUSTOMIZATION_NAME,
    };
  }

  const customization = {
    ...session.customization!,
    name: message.text.trim(),
  };

  // Check if product needs image
  const product = await prisma.product.findUnique({
    where: { id: session.customization!.productId },
  });
  const fields = product?.customizationFields || ['name'];

  if (fields.includes('image')) {
    return {
      messages: [textMsg(MSG.CUSTOMIZATION_IMAGE)],
      newState: FlowState.CUSTOMIZATION_IMAGE,
      sessionUpdates: { customization },
    };
  }

  if (fields.includes('text')) {
    return {
      messages: [textMsg(MSG.CUSTOMIZATION_TEXT)],
      newState: FlowState.CUSTOMIZATION_TEXT,
      sessionUpdates: { customization },
    };
  }

  // Go directly to confirm
  return buildConfirmation(customization, product!.name, product!.salePrice || product!.price);
}

async function handleImageUpload(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  if (message.messageType !== 'image' || !message.mediaUrl) {
    return {
      messages: [textMsg('يرجى إرسال صورة (من المعرض أو الكاميرا):')],
      newState: FlowState.CUSTOMIZATION_IMAGE,
    };
  }

  const customization = {
    ...session.customization!,
    imageUrl: message.mediaUrl,
  };

  const product = await prisma.product.findUnique({
    where: { id: session.customization!.productId },
  });
  const fields = product?.customizationFields || ['name'];

  if (fields.includes('text')) {
    return {
      messages: [textMsg('✅ تم استلام الصورة.\n' + MSG.CUSTOMIZATION_TEXT)],
      newState: FlowState.CUSTOMIZATION_TEXT,
      sessionUpdates: { customization },
    };
  }

  return buildConfirmation(customization, product!.name, product!.salePrice || product!.price);
}

async function handleTextInput(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  const text = message.text?.trim();
  const customization = { ...session.customization! };

  if (text && text !== 'لا' && text !== 'no') {
    customization.additionalText = text;
  }

  const product = await prisma.product.findUnique({
    where: { id: session.customization!.productId },
  });

  return buildConfirmation(customization, product!.name, product!.salePrice || product!.price);
}

async function handleConfirm(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  const choice = message.buttonReplyId || message.text?.trim();

  if (choice === 'confirm_custom' || choice === 'نعم' || choice === '1') {
    const product = await prisma.product.findUnique({
      where: { id: session.customization!.productId },
    });
    if (!product) return buildMainMenuResult();

    const cartItem = {
      productId: product.id,
      productName: product.name,
      price: product.salePrice || product.price,
      quantity: 1,
      customization: { ...session.customization!, confirmed: true },
      imageUrl: product.imageUrl || undefined,
    };

    const cartItems = [...(session.cartItems || []), cartItem];

    return {
      messages: [
        textMsg(MSG.ADDED_TO_CART(product.name)),
        buttonsMsg('ماذا تريد أن تفعل؟', [
          { id: 'menu_products', title: '🛍 تابع التسوق' },
          { id: 'menu_cart', title: '🛒 عرض السلة' },
        ]),
      ],
      newState: FlowState.MAIN_MENU,
      sessionUpdates: { cartItems, customization: undefined },
    };
  }

  if (choice === 'redo_custom' || choice === 'لا' || choice === '2') {
    return {
      messages: [textMsg(MSG.CUSTOMIZATION_START)],
      newState: FlowState.CUSTOMIZATION,
    };
  }

  return {
    messages: [buttonsMsg('هل التخصيص صحيح؟', [
      { id: 'confirm_custom', title: '✅ نعم، أضف للسلة' },
      { id: 'redo_custom', title: '🔄 إعادة التخصيص' },
    ])],
    newState: FlowState.CUSTOMIZATION_CONFIRM,
  };
}

function buildConfirmation(
  customization: NonNullable<SessionData['customization']>,
  productName: string,
  price: number,
): FlowResult {
  let summary = `المنتج: *${productName}*\n💰 السعر: ${price} ر.س\n`;
  if (customization.templateId) summary += `القالب: محدد ✅\n`;
  if (customization.name) summary += `الاسم: ${customization.name}\n`;
  if (customization.imageUrl) summary += `الصورة: مرفقة ✅\n`;
  if (customization.additionalText) summary += `نص إضافي: ${customization.additionalText}\n`;

  return {
    messages: [
      textMsg(MSG.CUSTOMIZATION_CONFIRM(summary)),
      buttonsMsg('', [
        { id: 'confirm_custom', title: '✅ نعم، أضف للسلة' },
        { id: 'redo_custom', title: '🔄 إعادة التخصيص' },
      ]),
    ],
    newState: FlowState.CUSTOMIZATION_CONFIRM,
    sessionUpdates: { customization },
  };
}
