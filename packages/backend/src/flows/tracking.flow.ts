import {
  FlowState,
  type IncomingMessage,
  type SessionData,
  type FlowResult,
} from '@gooddesign/shared';
import { MSG, ORDER_STATUS_LABELS } from '@gooddesign/shared';
import { prisma } from '../lib/prisma.js';
import { buildMainMenuResult, buttonsMsg, textMsg } from './engine.js';

export async function trackingFlow(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  switch (session.flowState) {
    case FlowState.ORDER_TRACKING:
    case FlowState.ORDER_TRACKING_INPUT:
      return handleTrackingInput(message, session);
    default:
      return buildMainMenuResult();
  }
}

async function handleTrackingInput(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  const input = message.text?.trim();

  if (!input) {
    return {
      messages: [textMsg(MSG.TRACK_INPUT)],
      newState: FlowState.ORDER_TRACKING_INPUT,
    };
  }

  if (input === 'back_to_menu' || message.buttonReplyId === 'back_to_menu') {
    return buildMainMenuResult();
  }

  // Search by order number or phone
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { orderNumber: { equals: input, mode: 'insensitive' } },
        { user: { phone: input } },
      ],
    },
    include: {
      items: { include: { product: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!order) {
    return {
      messages: [
        textMsg(MSG.TRACK_NOT_FOUND),
        buttonsMsg('', [
          { id: 'retry_track', title: '🔄 حاول مرة أخرى' },
          { id: 'back_to_menu', title: MSG.BACK_TO_MENU },
        ]),
      ],
      newState: FlowState.ORDER_TRACKING_INPUT,
    };
  }

  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
  let details = MSG.TRACK_STATUS(order.orderNumber, statusLabel) + '\n\n';
  details += `📅 تاريخ الطلب: ${order.createdAt.toLocaleDateString('ar-SA')}\n`;
  details += `💰 المجموع: ${order.total} ر.س\n\n`;
  details += `📋 *المنتجات:*\n`;
  order.items.forEach((item, i) => {
    details += `${i + 1}. ${item.product.name} × ${item.quantity}\n`;
  });

  if (order.shippingTrackingUrl) {
    details += `\n🔗 تتبع الشحنة: ${order.shippingTrackingUrl}`;
  }

  return {
    messages: [
      textMsg(details),
      buttonsMsg('', [
        { id: 'retry_track', title: '📦 تتبع طلب آخر' },
        { id: 'back_to_menu', title: MSG.BACK_TO_MENU },
      ]),
    ],
    newState: FlowState.ORDER_TRACKING_INPUT,
  };
}
