'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { apiFetch, getAgent } from '@/lib/api';
import { useSocket } from '@/lib/socket';

interface Conversation {
  id: string;
  status: string;
  channel: string;
  updatedAt: string;
  user: { id: string; name: string | null; phone: string };
  assignedAgent: { id: string; name: string } | null;
  messages: { content: string }[];
  _count: { messages: number };
}

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  content: string;
  metadata: any;
  agentId: string | null;
  createdAt: string;
}

interface ConversationsResponse {
  data: Conversation[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'نشط',
  WAITING_AGENT: 'بانتظار موظف',
  WITH_AGENT: 'مع موظف',
  CLOSED: 'مغلق',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-gray-600/20 text-gray-400',
  WAITING_AGENT: 'bg-yellow-600/20 text-yellow-400',
  WITH_AGENT: 'bg-green-600/20 text-green-400',
  CLOSED: 'bg-red-600/20 text-red-400',
};

export default function ConversationsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [reply, setReply] = useState('');
  const { socket } = useSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: convResponse } = useSWR<ConversationsResponse>(
    `/conversations${filter ? `?status=${filter}` : ''}`,
    apiFetch,
    { refreshInterval: 10000 }
  );
  const conversations: Conversation[] = convResponse?.data ?? [];

  const { data: detail } = useSWR(
    selected ? `/conversations/${selected}` : null,
    apiFetch
  );

  const messages: Message[] = detail?.messages ?? [];

  // Real-time new messages
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      mutate(`/conversations${filter ? `?status=${filter}` : ''}`);
      if (selected) mutate(`/conversations/${selected}`);
    };
    socket.on('new_message', handler);
    socket.on('conversation_assigned', handler);
    socket.on('conversation_updated', handler);
    return () => {
      socket.off('new_message', handler);
      socket.off('conversation_assigned', handler);
      socket.off('conversation_updated', handler);
    };
  }, [socket, filter, selected]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleReply() {
    if (!reply.trim() || !selected) return;
    const agent = getAgent();
    socket?.emit('agent_message', {
      conversationId: selected,
      text: reply,
      agentId: agent?.id,
    });
    setReply('');
    setTimeout(() => mutate(`/conversations/${selected}`), 500);
  }

  async function handleEndChat() {
    if (!selected) return;
    socket?.emit('end_handoff', { conversationId: selected });
    setTimeout(() => {
      mutate(`/conversations${filter ? `?status=${filter}` : ''}`);
      mutate(`/conversations/${selected}`);
    }, 500);
  }

  return (
    <div className="flex h-screen">
      {/* Conversation List */}
      <div className="w-80 border-l border-gray-800 flex flex-col">
        <div className="p-3 border-b border-gray-800">
          <h2 className="text-lg font-bold mb-2">المحادثات</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white"
          >
            <option value="">الكل</option>
            <option value="ACTIVE">نشط</option>
            <option value="WAITING_AGENT">بانتظار موظف</option>
            <option value="WITH_AGENT">مع موظف</option>
            <option value="CLOSED">مغلق</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full border-b border-gray-800/50 p-3 text-right transition-colors hover:bg-gray-800 ${
                selected === c.id ? 'bg-gray-800' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[c.status] || ''}`}>
                  {STATUS_LABELS[c.status] || c.status}
                </span>
                <span className="text-sm font-medium">{c.user?.name || c.user?.phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {new Date(c.updatedAt).toLocaleDateString('ar-SA')}
                </span>
                <span className="truncate text-xs text-gray-400 max-w-[180px]">
                  {c.messages?.[0]?.content || '—'}
                </span>
              </div>
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="p-4 text-center text-sm text-gray-500">لا توجد محادثات</p>
          )}
        </div>
      </div>

      {/* Chat View */}
      <div className="flex flex-1 flex-col">
        {selected && detail ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div className="flex items-center gap-2">
                {detail.status === 'WITH_AGENT' && (
                  <button
                    onClick={handleEndChat}
                    className="rounded-lg bg-red-600/20 px-3 py-1 text-xs text-red-400 hover:bg-red-600/30"
                  >
                    إنهاء المحادثة
                  </button>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[detail.status] || ''}`}>
                  {STATUS_LABELS[detail.status] || detail.status}
                </span>
              </div>
              <div className="text-right">
                <p className="font-medium">{detail.user?.name || detail.user?.phone}</p>
                <p className="text-xs text-gray-400">{detail.user?.phone} • {detail.channel}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => {
                const isOutbound = m.direction === 'OUTBOUND';
                const isAgent = isOutbound && !!m.agentId;
                const isBot = isOutbound && !m.agentId;
                const mediaUrl = m.metadata?.mediaUrl;
                return (
                  <div key={m.id} className={`flex ${isOutbound ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-md rounded-xl px-4 py-2 text-sm ${
                        isAgent
                          ? 'bg-blue-600/20 text-blue-100'
                          : isBot
                          ? 'bg-gray-800 text-gray-300'
                          : 'bg-green-600/20 text-green-100'
                      }`}
                    >
                      {mediaUrl && (
                        <img src={mediaUrl} alt="" className="mb-1 max-w-[200px] rounded-lg" />
                      )}
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      <p className="mt-1 text-xs opacity-50">
                        {new Date(m.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Input */}
            {(detail.status === 'WITH_AGENT' || detail.status === 'WAITING_AGENT') && (
              <div className="border-t border-gray-800 p-3 flex gap-2">
                <button
                  onClick={handleReply}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  إرسال
                </button>
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                  placeholder="اكتب ردك..."
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            اختر محادثة للعرض
          </div>
        )}
      </div>
    </div>
  );
}
