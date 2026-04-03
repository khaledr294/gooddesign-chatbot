import {
  FlowState,
  type IncomingMessage,
  type SessionData,
  type FlowResult,
} from '@gooddesign/shared';
import { MSG } from '@gooddesign/shared';
import { assignAgent } from '../services/handoff.service.js';
import { buildMainMenuResult, buttonsMsg, textMsg } from './engine.js';

export async function handoffFlow(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  switch (session.flowState) {
    case FlowState.HUMAN_HANDOFF:
      return handleHandoffRequest(message, session);
    case FlowState.HUMAN_CHAT:
      return handleHumanChat(message, session);
    default:
      return buildMainMenuResult();
  }
}

async function handleHandoffRequest(
  _message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  // Determine category from cart or last browsed product
  const categoryId = session.selectedCategoryId || session.cartItems?.[0]?.productId;

  const result = await assignAgent(session.conversationId, categoryId);

  if (result.assigned && result.agentName) {
    return {
      messages: [textMsg(MSG.HANDOFF_CONNECTED(result.agentName))],
      newState: FlowState.HUMAN_CHAT,
      sessionUpdates: { assignedAgentId: result.agentId },
    };
  }

  return {
    messages: [
      textMsg(MSG.HANDOFF_NO_AGENTS),
      buttonsMsg('', [
        { id: 'retry_handoff', title: '🔄 حاول مرة أخرى' },
        { id: 'back_to_menu', title: MSG.BACK_TO_MENU },
      ]),
    ],
    newState: FlowState.HUMAN_HANDOFF,
  };
}

async function handleHumanChat(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  const choice = message.buttonReplyId;

  if (choice === 'end_chat') {
    return {
      messages: [textMsg(MSG.HANDOFF_END)],
      newState: FlowState.MAIN_MENU,
      sessionUpdates: { assignedAgentId: undefined },
    };
  }

  // In HUMAN_CHAT state, messages are forwarded to the agent via Socket.IO
  // The flow engine doesn't generate bot replies - the agent replies directly
  // This return is a no-op; the message handler will forward to the agent
  return {
    messages: [],
    newState: FlowState.HUMAN_CHAT,
  };
}
