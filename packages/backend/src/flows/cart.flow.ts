import {
  FlowState,
  type IncomingMessage,
  type SessionData,
  type FlowResult,
} from '@gooddesign/shared';
import { MSG } from '@gooddesign/shared';
import { buildMainMenuResult, buttonsMsg, textMsg } from './engine.js';

export async function cartFlow(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  const choice = message.buttonReplyId || message.text?.trim();
  const cartItems = session.cartItems || [];

  // Handle remove item
  if (choice && choice.startsWith('rm_')) {
    const index = parseInt(choice.replace('rm_', ''), 10);
    if (!isNaN(index) && index >= 0 && index < cartItems.length) {
      const removed = cartItems[index];
      const newCart = [...cartItems];
      newCart.splice(index, 1);
      return {
        messages: [textMsg(`🗑 تم حذف *${removed.productName}* من السلة.`)],
        newState: FlowState.CART_REVIEW,
        sessionUpdates: { cartItems: newCart },
      };
    }
  }

  if (choice === 'clear_cart') {
    return {
      messages: [textMsg('🗑 تم تفريغ السلة.')],
      newState: FlowState.MAIN_MENU,
      sessionUpdates: { cartItems: [] },
    };
  }

  if (choice === 'checkout') {
    if (cartItems.length === 0) {
      return {
        messages: [textMsg(MSG.CART_EMPTY)],
        newState: FlowState.MAIN_MENU,
      };
    }
    return {
      messages: [textMsg(MSG.PAYMENT_SELECT)],
      newState: FlowState.PAYMENT_SELECT,
    };
  }

  if (choice === 'back_to_menu' || choice === 'continue_shopping') {
    return buildMainMenuResult();
  }

  // Display cart
  if (cartItems.length === 0) {
    return {
      messages: [
        textMsg(MSG.CART_EMPTY),
        buttonsMsg('', [{ id: 'menu_products', title: '🛍 استعراض المنتجات' }]),
      ],
      newState: FlowState.MAIN_MENU,
    };
  }

  let itemsText = '';
  let total = 0;
  cartItems.forEach((item, i) => {
    const lineTotal = item.price * item.quantity;
    total += lineTotal;
    itemsText += `${i + 1}. ${item.productName}`;
    if (item.customization?.name) itemsText += ` (${item.customization.name})`;
    itemsText += `\n   ${item.quantity} × ${item.price} = ${lineTotal} ر.س\n`;
  });

  return {
    messages: [
      textMsg(MSG.CART_SUMMARY(itemsText, total)),
      buttonsMsg('', [
        { id: 'checkout', title: '💳 إتمام الطلب' },
        { id: 'continue_shopping', title: '🛍 تابع التسوق' },
        { id: 'clear_cart', title: '🗑 تفريغ السلة' },
      ]),
    ],
    newState: FlowState.CART_REVIEW,
  };
}
