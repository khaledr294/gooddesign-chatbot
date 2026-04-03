import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { AssignmentResult } from '@gooddesign/shared';
import { getIO } from '../channels/widget.handler.js';

/**
 * Assign the best available agent to a conversation based on category routing
 */
export async function assignAgent(
  conversationId: string,
  categoryId?: string,
): Promise<AssignmentResult> {
  try {
    // Step 1: Find agents assigned to this category
    let candidateAgents: any[] = [];

    if (categoryId) {
      candidateAgents = await prisma.agent.findMany({
        where: {
          isOnline: true,
          categories: { some: { categoryId } },
        },
        include: {
          _count: {
            select: {
              conversations: {
                where: { status: { in: ['WAITING_AGENT', 'WITH_AGENT'] } },
              },
            },
          },
        },
      });
    }

    // Step 2: Fallback - any available agent
    if (candidateAgents.length === 0) {
      candidateAgents = await prisma.agent.findMany({
        where: { isOnline: true },
        include: {
          _count: {
            select: {
              conversations: {
                where: { status: { in: ['WAITING_AGENT', 'WITH_AGENT'] } },
              },
            },
          },
        },
      });
    }

    // Step 3: Filter by max concurrent chats + sort by least active chats
    const available = candidateAgents
      .filter((a) => a._count.conversations < a.maxConcurrentChats)
      .sort((a, b) => a._count.conversations - b._count.conversations);

    if (available.length === 0) {
      // No agents available - mark conversation as waiting
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'WAITING_AGENT', lastCategoryId: categoryId || null },
      });

      // Notify all agents
      const io = getIO();
      io?.of('/dashboard').to('dashboard').emit('unassigned_conversation', { conversationId });

      return {
        assigned: false,
        reason: candidateAgents.length === 0 ? 'no_agents_online' : 'all_busy',
      };
    }

    // Step 4: Assign the best agent (least busy)
    const agent = available[0];

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'WITH_AGENT',
        assignedAgentId: agent.id,
        lastCategoryId: categoryId || null,
      },
    });

    // Notify the assigned agent
    const io = getIO();
    io?.of('/dashboard').to(`agent_${agent.id}`).emit('new_assignment', { conversationId });

    logger.info({ agentId: agent.id, conversationId, categoryId }, 'Agent assigned');

    return {
      assigned: true,
      agentId: agent.id,
      agentName: agent.name,
    };
  } catch (err) {
    logger.error(err, 'Agent assignment failed');
    return { assigned: false, reason: 'error' };
  }
}

/**
 * Reassign a conversation to a different agent (used by admin)
 */
export async function reassignAgent(
  conversationId: string,
  newAgentId: string,
): Promise<AssignmentResult> {
  const agent = await prisma.agent.findUnique({ where: { id: newAgentId } });
  if (!agent) return { assigned: false, reason: 'agent_not_found' };

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedAgentId: newAgentId, status: 'WITH_AGENT' },
  });

  const io = getIO();
  io?.of('/dashboard').to(`agent_${newAgentId}`).emit('new_assignment', { conversationId });

  return { assigned: true, agentId: agent.id, agentName: agent.name };
}
