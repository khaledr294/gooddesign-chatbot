import {
  FlowState,
  type IncomingMessage,
  type SessionData,
  type FlowResult,
  PaymentMethod,
} from '@gooddesign/shared';
import { MSG, BANK_INFO } from '@gooddesign/shared';
import { prisma } from '../lib/prisma.js';
import { createSallaOrder } from '../services/salla.service.js';
import { buildMainMenuResult, buttonsMsg, textMsg } from './engine.js';
import { nanoid } from 'nanoid';

export async function paymentFlow(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  switch (session.flowState) {
    case FlowState.PAYMENT_SELECT:
      return handlePaymentSelect(message, session);
    case FlowState.PAYMENT_TRANSFER:
      return handleTransfer(message, session);
    case FlowState.PAYMENT_TRANSFER_RECEIPT:
      return handleReceipt(message, session);
    case FlowState.PAYMENT_SALLA:
      return handleSallaPayment(message, session);
    case FlowState.ORDER_CONFIRM:
      return buildMainMenuResult();
    default:
      return buildMainMenuResult();
  }
}

async function handlePaymentSelect(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  const choice = message.buttonReplyId || message.text?.trim();

  if (choice === 'pay_transfer' || choice === '1') {
    // Load bank info from settings or use defaults
    const bankSettings = await prisma.setting.findMany({
      where: { key: { in: ['bank_name', 'bank_iban', 'bank_account_name'] } },
    });
    const bankName = bankSettings.find((s) => s.key === 'bank_name')?.value || BANK_INFO.bankName;
    const iban = bankSettings.find((s) => s.key === 'bank_iban')?.value || BANK_INFO.iban;
    const accountName = bankSettings.find((s) => s.key === 'bank_account_name')?.value || BANK_INFO.accountName;

    return {
      messages: [textMsg(MSG.PAYMENT_TRANSFER_INFO(bankName, iban, accountName))],
      newState: FlowState.PAYMENT_TRANSFER_RECEIPT,
    };
  }

  if (choice === 'pay_salla' || choice === '2') {
    return {
      messages: [textMsg('جاري إنشاء رابط الدفع... ⏳')],
      newState: FlowState.PAYMENT_SALLA,
    };
  }

  // Show options
  return {
    messages: [
      buttonsMsg(MSG.PAYMENT_SELECT, [
        { id: 'pay_transfer', title: '🏦 تحويل بنكي' },
        { id: 'pay_salla', title: '💳 دفع إلكتروني (سلة)' },
      ]),
    ],
    newState: FlowState.PAYMENT_SELECT,
  };
}

async function handleTransfer(
  _message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  return {
    messages: [textMsg('أرسل صورة إيصال التحويل هنا:')],
    newState: FlowState.PAYMENT_TRANSFER_RECEIPT,
  };
}

async function handleReceipt(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  if (message.messageType !== 'image' || !message.mediaUrl) {
    return {
      messages: [textMsg('يرجى إرسال صورة إيصال التحويل:')],
      newState: FlowState.PAYMENT_TRANSFER_RECEIPT,
    };
  }

  // Create order
  const orderNumber = `GD-${nanoid(8).toUpperCase()}`;
  const cartItems = session.cartItems || [];
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: session.userId,
      conversationId: session.conversationId,
      status: 'AWAITING_PAYMENT',
      paymentMethod: 'BANK_TRANSFER',
      paymentReceiptUrl: message.mediaUrl,
      subtotal: total,
      total,
      items: {
        create: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
          customName: item.customization?.name,
          customImageUrl: item.customization?.imageUrl,
          customText: item.customization?.additionalText,
          templateId: item.customization?.templateId,
        })),
      },
    },
  });

  return {
    messages: [
      textMsg(MSG.PAYMENT_RECEIPT_RECEIVED),
      textMsg(MSG.ORDER_CONFIRMED(order.orderNumber)),
    ],
    newState: FlowState.MAIN_MENU,
    sessionUpdates: { cartItems: [] },
  };
}

async function handleSallaPayment(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  const cartItems = session.cartItems || [];
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Get user info
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return buildMainMenuResult();

  const orderNumber = `GD-${nanoid(8).toUpperCase()}`;

  try {
    // Create order in Salla
    const sallaResult = await createSallaOrder({
      customer: {
        first_name: user.name || 'عميل',
        last_name: '',
        phone: user.phone,
        email: user.email || undefined,
      },
      items: cartItems.map((item) => ({
        product_id: parseInt(item.productId, 10), // sallaId
        quantity: item.quantity,
        note: item.customization?.name
          ? `الاسم: ${item.customization.name}${item.customization.additionalText ? ` | نص: ${item.customization.additionalText}` : ''}`
          : undefined,
      })),
    });

    // Create local order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: session.userId,
        conversationId: session.conversationId,
        sallaOrderId: sallaResult.orderId,
        status: 'AWAITING_PAYMENT',
        paymentMethod: 'SALLA_CHECKOUT',
        subtotal: total,
        total,
        items: {
          create: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity,
            customName: item.customization?.name,
            customImageUrl: item.customization?.imageUrl,
            customText: item.customization?.additionalText,
            templateId: item.customization?.templateId,
          })),
        },
      },
    });

    return {
      messages: [
        textMsg(MSG.PAYMENT_SALLA_LINK(sallaResult.checkoutUrl)),
        textMsg(`رقم طلبك: *${order.orderNumber}*`),
      ],
      newState: FlowState.MAIN_MENU,
      sessionUpdates: { cartItems: [] },
    };
  } catch (err) {
    // Fallback: offer bank transfer
    return {
      messages: [
        textMsg('عذراً، حدث خطأ أثناء إنشاء رابط الدفع.'),
        buttonsMsg('هل تريد الدفع عبر تحويل بنكي بدلاً من ذلك؟', [
          { id: 'pay_transfer', title: '🏦 تحويل بنكي' },
          { id: 'back_to_menu', title: MSG.BACK_TO_MENU },
        ]),
      ],
      newState: FlowState.PAYMENT_SELECT,
    };
  }
}
