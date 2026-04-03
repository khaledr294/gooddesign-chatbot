import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { Channel, FlowState, SESSION_TTL_SECONDS, type SessionData } from '@gooddesign/shared';

const SESSION_PREFIX = 'session:';

/**
 * Get or create a session for the given sender
 */
export async function getOrCreateSession(
  senderId: string,
  channel: Channel,
  userId: string,
): Promise<SessionData> {
  const key = SESSION_PREFIX + senderId;

  // Try Redis first
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached) as SessionData;
  }

  // Check for existing active conversation in DB
  const existing = await prisma.conversation.findFirst({
    where: { userId, channel: channel as any, status: { not: 'CLOSED' } },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    const session: SessionData = {
      conversationId: existing.id,
      userId,
      channel,
      flowState: existing.flowState as FlowState,
      assignedAgentId: existing.assignedAgentId || undefined,
      cartItems: [],
    };

    await redis.setex(key, SESSION_TTL_SECONDS, JSON.stringify(session));
    return session;
  }

  // Create new conversation
  const conversation = await prisma.conversation.create({
    data: {
      userId,
      channel: channel as any,
      status: 'ACTIVE',
      flowState: FlowState.WELCOME,
    },
  });

  const session: SessionData = {
    conversationId: conversation.id,
    userId,
    channel,
    flowState: FlowState.WELCOME,
    cartItems: [],
  };

  await redis.setex(key, SESSION_TTL_SECONDS, JSON.stringify(session));
  return session;
}

/**
 * Save session to Redis
 */
export async function saveSession(senderId: string, session: SessionData): Promise<void> {
  const key = SESSION_PREFIX + senderId;
  await redis.setex(key, SESSION_TTL_SECONDS, JSON.stringify(session));
}

/**
 * Delete session
 */
export async function deleteSession(senderId: string): Promise<void> {
  await redis.del(SESSION_PREFIX + senderId);
}

/**
 * Get session by sender ID (returns null if not found)
 */
export async function getSession(senderId: string): Promise<SessionData | null> {
  const cached = await redis.get(SESSION_PREFIX + senderId);
  return cached ? JSON.parse(cached) : null;
}
