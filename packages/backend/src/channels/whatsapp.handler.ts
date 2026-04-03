import { Channel, FlowState, type IncomingMessage } from '@gooddesign/shared';
import { parseWhatsAppWebhook, sendWhatsAppMessage, downloadWhatsAppMedia } from './whatsapp.client.js';
import { getOrCreateSession, saveSession } from '../services/session.service.js';
import { processMessage } from '../flows/engine.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { uploadBuffer } from '../services/storage.service.js';
import { getIO } from './widget.handler.js';

/**
 * Handle incoming WhatsApp webhook POST
 */
export async function handleWhatsAppMessage(body: any): Promise<void> {
  const parsed = parseWhatsAppWebhook(body);
  if (!parsed) return;

  const { from, name, messageType, text, buttonReplyId, listReplyId, mediaId, timestamp } = parsed;

  logger.info({ from, messageType, text }, 'WhatsApp message received');

  // Handle media (images)
  let mediaUrl: string | undefined;
  if (mediaId) {
    try {
      const buffer = await downloadWhatsAppMedia(mediaId);
      mediaUrl = await uploadBuffer(buffer, `whatsapp/${from}/${Date.now()}.jpg`, 'image/jpeg');
    } catch (err) {
      logger.error(err, 'Failed to download/upload WhatsApp media');
    }
  }

  // Get or create user
  let user = await prisma.user.findUnique({ where: { phone: from } });
  if (!user) {
    user = await prisma.user.create({
      data: { phone: from, name: name || undefined },
    });
  }

  // Get or create session
  const session = await getOrCreateSession(from, Channel.WHATSAPP, user.id);

  // Build incoming message
  const incoming: IncomingMessage = {
    channel: Channel.WHATSAPP,
    senderId: from,
    senderName: name,
    messageType,
    text,
    buttonReplyId,
    listReplyId,
    mediaUrl,
    timestamp,
  };

  // Save inbound message to DB
  await prisma.message.create({
    data: {
      conversationId: session.conversationId,
      direction: 'INBOUND',
      type: mediaUrl ? 'IMAGE' : 'TEXT',
      content: text || '[media]',
      metadata: mediaUrl ? { mediaUrl } : undefined,
    },
  });

  // If in HUMAN_CHAT mode, forward to agent via Socket.IO (don't process flow)
  if (session.flowState === FlowState.HUMAN_CHAT && session.assignedAgentId) {
    const io = getIO();
    if (io) {
      io.to(`agent_${session.assignedAgentId}`).emit('customer_message', {
        conversationId: session.conversationId,
        message: incoming,
      });
    }
    return;
  }

  // Process through flow engine
  const result = await processMessage(incoming, session);

  // Update session
  const updatedSession = {
    ...session,
    ...result.sessionUpdates,
    flowState: result.newState,
  };
  await saveSession(from, updatedSession);

  // Update conversation state in DB
  await prisma.conversation.update({
    where: { id: session.conversationId },
    data: {
      flowState: result.newState,
      ...(result.newState === FlowState.HUMAN_HANDOFF || result.newState === FlowState.HUMAN_CHAT
        ? { status: 'WAITING_AGENT' }
        : result.newState === FlowState.MAIN_MENU
          ? { status: 'ACTIVE' }
          : {}),
    },
  });

  // Send response messages
  for (const msg of result.messages) {
    await sendWhatsAppMessage(from, msg);

    // Save outbound message
    await prisma.message.create({
      data: {
        conversationId: session.conversationId,
        direction: 'OUTBOUND',
        type: msg.type,
        content: msg.text || JSON.stringify(msg),
      },
    });
  }

  // Notify dashboard via Socket.IO
  const io = getIO();
  if (io) {
    io.to('dashboard').emit('conversation_updated', {
      conversationId: session.conversationId,
      flowState: result.newState,
    });
  }
}
