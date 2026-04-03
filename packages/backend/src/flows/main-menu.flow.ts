import {
  FlowState,
  type IncomingMessage,
  type SessionData,
  type FlowResult,
  MessageType,
} from '@gooddesign/shared';
import { MSG } from '@gooddesign/shared';
import { buildMainMenuResult } from './engine.js';

export async function mainMenuFlow(
  message: IncomingMessage,
  _session: SessionData,
): Promise<FlowResult> {
  const choice = message.buttonReplyId || message.text?.trim();

  switch (choice) {
    case MSG.MAIN_MENU_BUTTONS.PRODUCTS.id:
    case 'menu_products':
    case '1':
      return {
        messages: [{ type: MessageType.TEXT, text: MSG.CATEGORY_SELECT }],
        newState: FlowState.CATEGORY_SELECT,
      };

    case MSG.MAIN_MENU_BUTTONS.CART.id:
    case 'menu_cart':
    case '2':
      return {
        messages: [],
        newState: FlowState.CART_REVIEW,
      };

    case MSG.MAIN_MENU_BUTTONS.TRACK.id:
    case 'menu_track':
    case '3':
      return {
        messages: [{ type: MessageType.TEXT, text: MSG.TRACK_INPUT }],
        newState: FlowState.ORDER_TRACKING_INPUT,
      };

    case MSG.MAIN_MENU_BUTTONS.AGENT.id:
    case 'menu_agent':
    case '4':
      return {
        messages: [{ type: MessageType.TEXT, text: MSG.HANDOFF_CONNECTING }],
        newState: FlowState.HUMAN_HANDOFF,
      };

    case MSG.MAIN_MENU_BUTTONS.FAQ.id:
    case 'menu_faq':
    case '5':
      return {
        messages: [],
        newState: FlowState.FAQ,
      };

    default:
      return buildMainMenuResult();
  }
}
