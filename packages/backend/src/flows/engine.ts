import {
  FlowState,
  type IncomingMessage,
  type SessionData,
  type FlowResult,
  type BotMessage,
  MessageType,
} from '@gooddesign/shared';
import { MSG } from '@gooddesign/shared';
import { mainMenuFlow } from './main-menu.flow.js';
import { productsFlow } from './products.flow.js';
import { customizationFlow } from './customization.flow.js';
import { cartFlow } from './cart.flow.js';
import { paymentFlow } from './payment.flow.js';
import { trackingFlow } from './tracking.flow.js';
import { faqFlow } from './faq.flow.js';
import { handoffFlow } from './handoff.flow.js';
import { logger } from '../lib/logger.js';

export type FlowHandler = (
  message: IncomingMessage,
  session: SessionData,
) => Promise<FlowResult>;

const flowHandlers: Record<string, FlowHandler> = {
  [FlowState.WELCOME]: welcomeHandler,
  [FlowState.MAIN_MENU]: mainMenuFlow,

  // Products
  [FlowState.CATEGORY_SELECT]: productsFlow,
  [FlowState.PRODUCT_LIST]: productsFlow,
  [FlowState.PRODUCT_DETAIL]: productsFlow,

  // Customization
  [FlowState.CUSTOMIZATION]: customizationFlow,
  [FlowState.CUSTOMIZATION_NAME]: customizationFlow,
  [FlowState.CUSTOMIZATION_IMAGE]: customizationFlow,
  [FlowState.CUSTOMIZATION_TEXT]: customizationFlow,
  [FlowState.CUSTOMIZATION_TEMPLATE]: customizationFlow,
  [FlowState.CUSTOMIZATION_CONFIRM]: customizationFlow,

  // Cart & Payment
  [FlowState.CART_REVIEW]: cartFlow,
  [FlowState.PAYMENT_SELECT]: paymentFlow,
  [FlowState.PAYMENT_TRANSFER]: paymentFlow,
  [FlowState.PAYMENT_TRANSFER_RECEIPT]: paymentFlow,
  [FlowState.PAYMENT_SALLA]: paymentFlow,
  [FlowState.ORDER_CONFIRM]: paymentFlow,

  // Tracking
  [FlowState.ORDER_TRACKING]: trackingFlow,
  [FlowState.ORDER_TRACKING_INPUT]: trackingFlow,

  // FAQ
  [FlowState.FAQ]: faqFlow,
  [FlowState.FAQ_DETAIL]: faqFlow,

  // Human Handoff
  [FlowState.HUMAN_HANDOFF]: handoffFlow,
  [FlowState.HUMAN_CHAT]: handoffFlow,
};

/**
 * Main flow engine - processes an incoming message based on current session state
 */
export async function processMessage(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  // Check for global commands (back to menu)
  if (
    message.text === '0' ||
    message.buttonReplyId === 'back_to_menu' ||
    message.text === 'القائمة' ||
    message.text === 'قائمة'
  ) {
    return buildMainMenuResult();
  }

  const handler = flowHandlers[session.flowState];

  if (!handler) {
    logger.warn({ state: session.flowState }, 'No handler found for state');
    return buildMainMenuResult();
  }

  try {
    return await handler(message, session);
  } catch (err) {
    logger.error(err, 'Error processing flow');
    return {
      messages: [{ type: MessageType.TEXT, text: MSG.ERROR }],
      newState: FlowState.MAIN_MENU,
    };
  }
}

async function welcomeHandler(
  _message: IncomingMessage,
  _session: SessionData,
): Promise<FlowResult> {
  return {
    messages: [
      { type: MessageType.TEXT, text: MSG.WELCOME },
      {
        type: MessageType.BUTTONS,
        text: MSG.MAIN_MENU,
        buttons: [
          MSG.MAIN_MENU_BUTTONS.PRODUCTS,
          MSG.MAIN_MENU_BUTTONS.CART,
          MSG.MAIN_MENU_BUTTONS.TRACK,
        ],
      },
      {
        type: MessageType.BUTTONS,
        text: 'المزيد:',
        buttons: [
          MSG.MAIN_MENU_BUTTONS.AGENT,
          MSG.MAIN_MENU_BUTTONS.FAQ,
        ],
      },
    ],
    newState: FlowState.MAIN_MENU,
  };
}

export function buildMainMenuResult(): FlowResult {
  return {
    messages: [
      {
        type: MessageType.BUTTONS,
        text: MSG.MAIN_MENU,
        buttons: [
          MSG.MAIN_MENU_BUTTONS.PRODUCTS,
          MSG.MAIN_MENU_BUTTONS.CART,
          MSG.MAIN_MENU_BUTTONS.TRACK,
        ],
      },
      {
        type: MessageType.BUTTONS,
        text: 'المزيد:',
        buttons: [
          MSG.MAIN_MENU_BUTTONS.AGENT,
          MSG.MAIN_MENU_BUTTONS.FAQ,
        ],
      },
    ],
    newState: FlowState.MAIN_MENU,
  };
}

export function textMsg(text: string): BotMessage {
  return { type: MessageType.TEXT, text };
}

export function buttonsMsg(text: string, buttons: { id: string; title: string }[]): BotMessage {
  return { type: MessageType.BUTTONS, text, buttons };
}

export function listMsg(
  text: string,
  buttonText: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
): BotMessage {
  return { type: MessageType.LIST, text, listButtonText: buttonText, listSections: sections };
}
