import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import type { BotMessage } from '@gooddesign/shared';
import { MessageType } from '@gooddesign/shared';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

const api = axios.create({
  baseURL: `${GRAPH_API}/${config.WHATSAPP_PHONE_NUMBER_ID}`,
  headers: { Authorization: `Bearer ${config.WHATSAPP_TOKEN}` },
});

/**
 * Send a bot message to WhatsApp user
 */
export async function sendWhatsAppMessage(to: string, msg: BotMessage): Promise<void> {
  try {
    switch (msg.type) {
      case MessageType.TEXT:
        await sendText(to, msg.text || '');
        break;

      case MessageType.IMAGE:
        if (msg.imageUrl) {
          await sendImage(to, msg.imageUrl, msg.text);
        } else if (msg.text) {
          await sendText(to, msg.text);
        }
        break;

      case MessageType.BUTTONS:
        if (msg.buttons && msg.buttons.length > 0) {
          await sendInteractiveButtons(to, msg.text || '', msg.buttons);
        } else {
          await sendText(to, msg.text || '');
        }
        break;

      case MessageType.LIST:
        if (msg.listSections) {
          await sendInteractiveList(to, msg.text || '', msg.listButtonText || 'اختر', msg.listSections);
        }
        break;

      default:
        await sendText(to, msg.text || '');
    }
  } catch (err: any) {
    logger.error({ err: err.response?.data || err.message, to, type: msg.type }, 'WhatsApp send error');
    throw err;
  }
}

async function sendText(to: string, text: string) {
  await api.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  });
}

async function sendImage(to: string, imageUrl: string, caption?: string) {
  await api.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl, caption },
  });
}

async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
) {
  await api.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.substring(0, 20) },
        })),
      },
    },
  });
}

async function sendInteractiveList(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
) {
  await api.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonText.substring(0, 20),
        sections: sections.map((s) => ({
          title: s.title.substring(0, 24),
          rows: s.rows.map((r) => ({
            id: r.id,
            title: r.title.substring(0, 24),
            description: r.description?.substring(0, 72),
          })),
        })),
      },
    },
  });
}

/**
 * Send a WhatsApp Template message (for notifications)
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  parameters: string[],
): Promise<void> {
  await api.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: parameters.length > 0
        ? [{
            type: 'body',
            parameters: parameters.map((p) => ({ type: 'text', text: p })),
          }]
        : undefined,
    },
  });
}

/**
 * Download media from WhatsApp
 */
export async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer> {
  // Step 1: Get media URL
  const { data: mediaInfo } = await axios.get(`${GRAPH_API}/${mediaId}`, {
    headers: { Authorization: `Bearer ${config.WHATSAPP_TOKEN}` },
  });

  // Step 2: Download the actual file
  const { data: fileBuffer } = await axios.get(mediaInfo.url, {
    headers: { Authorization: `Bearer ${config.WHATSAPP_TOKEN}` },
    responseType: 'arraybuffer',
  });

  return Buffer.from(fileBuffer);
}

/**
 * Parse incoming WhatsApp webhook message
 */
export function parseWhatsAppWebhook(body: any) {
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages?.[0]) return null;

  const msg = value.messages[0];
  const contact = value.contacts?.[0];

  const result: {
    from: string;
    name?: string;
    messageType: 'text' | 'image' | 'document' | 'button_reply' | 'list_reply';
    text?: string;
    buttonReplyId?: string;
    listReplyId?: string;
    mediaId?: string;
    timestamp: number;
  } = {
    from: msg.from,
    name: contact?.profile?.name,
    messageType: 'text',
    timestamp: parseInt(msg.timestamp, 10) * 1000,
  };

  switch (msg.type) {
    case 'text':
      result.messageType = 'text';
      result.text = msg.text.body;
      break;

    case 'interactive':
      if (msg.interactive.type === 'button_reply') {
        result.messageType = 'button_reply';
        result.buttonReplyId = msg.interactive.button_reply.id;
        result.text = msg.interactive.button_reply.title;
      } else if (msg.interactive.type === 'list_reply') {
        result.messageType = 'list_reply';
        result.listReplyId = msg.interactive.list_reply.id;
        result.text = msg.interactive.list_reply.title;
      }
      break;

    case 'image':
      result.messageType = 'image';
      result.mediaId = msg.image.id;
      result.text = msg.image.caption;
      break;

    case 'document':
      result.messageType = 'document';
      result.mediaId = msg.document.id;
      result.text = msg.document.caption;
      break;
  }

  return result;
}
