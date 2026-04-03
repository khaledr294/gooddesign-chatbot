import {
  FlowState,
  type IncomingMessage,
  type SessionData,
  type FlowResult,
} from '@gooddesign/shared';
import { MSG } from '@gooddesign/shared';
import { buildMainMenuResult, buttonsMsg, textMsg } from './engine.js';

export async function faqFlow(
  message: IncomingMessage,
  session: SessionData,
): Promise<FlowResult> {
  const choice = message.buttonReplyId || message.text?.trim();

  if (choice === 'back_to_menu') return buildMainMenuResult();

  // Check if user selected a FAQ topic
  if (choice && choice in MSG.FAQ_ANSWERS) {
    const answer = MSG.FAQ_ANSWERS[choice];
    return {
      messages: [
        textMsg(answer),
        buttonsMsg('', [
          { id: 'back_faq', title: '❓ أسئلة أخرى' },
          { id: 'back_to_menu', title: MSG.BACK_TO_MENU },
        ]),
      ],
      newState: FlowState.FAQ,
    };
  }

  if (choice === 'back_faq') {
    // Fall through to show FAQ menu
  }

  // Show FAQ menu
  const faqButtons = Object.values(MSG.FAQ_TOPICS);

  return {
    messages: [
      buttonsMsg(MSG.FAQ_MENU, faqButtons.slice(0, 3)),
      buttonsMsg('المزيد:', [
        ...faqButtons.slice(3),
        { id: 'back_to_menu', title: MSG.BACK_TO_MENU },
      ]),
    ],
    newState: FlowState.FAQ,
  };
}
