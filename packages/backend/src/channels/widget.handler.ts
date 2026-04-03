import { Server, Socket } from 'socket.io';
import { Channel, FlowState, type IncomingMessage, type BotMessage, MessageType } from '@gooddesign/shared';
import { MSG } from '@gooddesign/shared';
import { getOrCreateSession, saveSession } from '../services/session.service.js';
import { processMessage } from '../flows/engine.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { nanoid } from 'nanoid';

let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export function setupSocketIO(io: Server): void {
  ioInstance = io;

  // Widget namespace - for customers
  const widgetNs = io.of('/widget');
  widgetNs.on('connection', (socket) => handleWidgetConnection(socket));

  // Dashboard namespace - for agents
  const dashNs = io.of('/dashboard');
  dashNs.on('connection', (socket) => handleDashboardConnection(socket));

  logger.info('✅ Socket.IO initialized');
}

// ===== Widget (Customer) Connections =====

async function handleWidgetConnection(socket: Socket) {
  const sessionId = (socket.handshake.query.sessionId as string) || `widget_${nanoid(12)}`;
  logger.info({ sessionId }, 'Widget client connected');

  // Send session ID back to client
  socket.emit('session', { sessionId });

  // Get or create user + session
  let user = await prisma.user.findUnique({ where: { phone: sessionId } });
  if (!user) {
    user = await prisma.user.create({
      data: { phone: sessionId, name: 'زائر الموقع' },
    });
  }

  const session = await getOrCreateSession(sessionId, Channel.WIDGET, user.id);

  // Send welcome if new session
  if (session.flowState === FlowState.WELCOME) {
    const result = await processMessage(
      {
        channel: Channel.WIDGET,
        senderId: sessionId,
        messageType: 'text',
        text: '',
        timestamp: Date.now(),
      },
      session,
    );

    const updated = { ...session, ...result.sessionUpdates, flowState: result.newState };
    await saveSession(sessionId, updated);

    for (const msg of result.messages) {
      socket.emit('bot_message', msg);
    }
  }

  // Handle incoming messages from widget
  socket.on('message', async (data: { text?: string; type?: string; mediaUrl?: string }) => {
    try {
      const currentSession = await getOrCreateSession(sessionId, Channel.WIDGET, user!.id);

      const incoming: IncomingMessage = {
        channel: Channel.WIDGET,
        senderId: sessionId,
        messageType: data.type === 'image' ? 'image' : 'text',
        text: data.text,
        buttonReplyId: data.text?.startsWith('btn_') ? data.text : undefined,
        listReplyId: data.text?.startsWith('cat_') || data.text?.startsWith('prod_') ? data.text : undefined,
        mediaUrl: data.mediaUrl,
        timestamp: Date.now(),
      };

      // Save inbound message
      await prisma.message.create({
        data: {
          conversationId: currentSession.conversationId,
          direction: 'INBOUND',
          type: data.mediaUrl ? 'IMAGE' : 'TEXT',
          content: data.text || '[media]',
          metadata: data.mediaUrl ? { mediaUrl: data.mediaUrl } : undefined,
        },
      });

      // Forward to agent if in human chat
      if (currentSession.flowState === FlowState.HUMAN_CHAT && currentSession.assignedAgentId) {
        const dashNs = ioInstance?.of('/dashboard');
        dashNs?.to(`agent_${currentSession.assignedAgentId}`).emit('customer_message', {
          conversationId: currentSession.conversationId,
          message: incoming,
        });
        return;
      }

      // Process flow
      const result = await processMessage(incoming, currentSession);
      const updatedSession = {
        ...currentSession,
        ...result.sessionUpdates,
        flowState: result.newState,
      };
      await saveSession(sessionId, updatedSession);

      // Send responses
      for (const msg of result.messages) {
        socket.emit('bot_message', msg);

        await prisma.message.create({
          data: {
            conversationId: currentSession.conversationId,
            direction: 'OUTBOUND',
            type: msg.type,
            content: msg.text || JSON.stringify(msg),
          },
        });
      }

      // Notify dashboard
      ioInstance?.of('/dashboard').to('dashboard').emit('conversation_updated', {
        conversationId: currentSession.conversationId,
        flowState: result.newState,
      });
    } catch (err) {
      logger.error(err, 'Widget message processing error');
      socket.emit('bot_message', { type: MessageType.TEXT, text: MSG.ERROR });
    }
  });

  socket.on('disconnect', () => {
    logger.debug({ sessionId }, 'Widget client disconnected');
  });
}

// ===== Dashboard (Agent) Connections =====

async function handleDashboardConnection(socket: Socket) {
  const agentId = socket.handshake.auth?.agentId as string;
  if (!agentId) {
    socket.disconnect();
    return;
  }

  logger.info({ agentId }, 'Agent connected to dashboard');

  // Join agent-specific room + global dashboard room
  socket.join(`agent_${agentId}`);
  socket.join('dashboard');

  // Mark agent online
  await prisma.agent.update({
    where: { id: agentId },
    data: { isOnline: true },
  });

  // Handle agent sending message to customer
  socket.on('agent_message', async (data: { conversationId: string; text: string }) => {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: data.conversationId },
        include: { user: true },
      });
      if (!conversation) return;

      // Save message
      await prisma.message.create({
        data: {
          conversationId: data.conversationId,
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: data.text,
          agentId,
        },
      });

      // Send to customer based on channel
      if (conversation.channel === 'WHATSAPP') {
        const { sendWhatsAppMessage } = await import('./whatsapp.client.js');
        await sendWhatsAppMessage(conversation.user.phone, {
          type: MessageType.TEXT,
          text: data.text,
        });
      } else {
        // Widget: emit to the widget session
        ioInstance?.of('/widget').to(conversation.user.phone).emit('bot_message', {
          type: MessageType.TEXT,
          text: data.text,
        });
      }
    } catch (err) {
      logger.error(err, 'Agent message send error');
    }
  });

  // Handle agent ending handoff
  socket.on('end_handoff', async (data: { conversationId: string }) => {
    try {
      await prisma.conversation.update({
        where: { id: data.conversationId },
        data: { status: 'ACTIVE', assignedAgentId: null, flowState: FlowState.MAIN_MENU },
      });

      const conversation = await prisma.conversation.findUnique({
        where: { id: data.conversationId },
        include: { user: true },
      });
      if (!conversation) return;

      const sessionId = conversation.user.phone;
      const session = await getOrCreateSession(sessionId, conversation.channel as Channel, conversation.userId);
      session.flowState = FlowState.MAIN_MENU;
      session.assignedAgentId = undefined;
      await saveSession(sessionId, session);

      // Notify customer
      const endMsg: BotMessage = { type: MessageType.TEXT, text: MSG.HANDOFF_END };
      if (conversation.channel === 'WHATSAPP') {
        const { sendWhatsAppMessage } = await import('./whatsapp.client.js');
        await sendWhatsAppMessage(sessionId, endMsg);
      } else {
        ioInstance?.of('/widget').to(sessionId).emit('bot_message', endMsg);
      }
    } catch (err) {
      logger.error(err, 'End handoff error');
    }
  });

  socket.on('disconnect', async () => {
    logger.info({ agentId }, 'Agent disconnected');
    await prisma.agent.update({
      where: { id: agentId },
      data: { isOnline: false },
    });
  });
}
