import { useState, useRef, useEffect } from 'preact/hooks';
import { io, Socket } from 'socket.io-client';
import { MessageBubble } from './components/MessageBubble';
import { ButtonGroup } from './components/ButtonGroup';
import { styles } from './styles';

interface ChatMessage {
  id: string;
  direction: 'in' | 'out';
  type: string;
  text?: string;
  imageUrl?: string;
  buttons?: { id: string; title: string }[];
  listSections?: { title: string; rows: { id: string; title: string; description?: string }[] }[];
  timestamp: number;
}

interface WidgetProps {
  serverUrl: string;
}

export function Widget({ serverUrl }: WidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sessionId = localStorage.getItem('gd_chat_session') || undefined;

    const socket = io(`${serverUrl}/widget`, {
      path: '/ws',
      query: { sessionId },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('session', (data: { sessionId: string }) => {
      localStorage.setItem('gd_chat_session', data.sessionId);
    });

    socket.on('bot_message', (msg: any) => {
      const chatMsg: ChatMessage = {
        id: `bot_${Date.now()}_${Math.random()}`,
        direction: 'in',
        type: msg.type,
        text: msg.text,
        imageUrl: msg.imageUrl,
        buttons: msg.buttons,
        listSections: msg.listSections,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, chatMsg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim() || !socketRef.current) return;

    const chatMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      direction: 'out',
      type: 'TEXT',
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, chatMsg]);
    socketRef.current.emit('message', { text });
    setInput('');
  };

  const handleButtonClick = (id: string, title: string) => {
    const chatMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      direction: 'out',
      type: 'TEXT',
      text: title,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, chatMsg]);
    socketRef.current?.emit('message', { text: id });
  };

  const handleFileUpload = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${serverUrl}/api/widget/upload`, {
        method: 'POST',
        body: formData,
      });
      const { url } = await res.json();

      const chatMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        direction: 'out',
        type: 'IMAGE',
        imageUrl: url,
        text: '📷 صورة',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, chatMsg]);
      socketRef.current?.emit('message', { type: 'image', mediaUrl: url });
    } catch {
      // Upload failed silently
    }
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div dir="rtl" style={styles.container}>
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} style={styles.toggleBtn}>
          💬
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={styles.chatWindow}>
          {/* Header */}
          <div style={styles.header}>
            <span style={styles.headerTitle}>Good Design 💬</span>
            <div style={styles.headerActions}>
              <span style={{ ...styles.statusDot, background: connected ? '#4ade80' : '#f87171' }} />
              <button onClick={() => setIsOpen(false)} style={styles.closeBtn}>✕</button>
            </div>
          </div>

          {/* Messages */}
          <div style={styles.messagesArea}>
            {messages.map((msg) => (
              <div key={msg.id}>
                <MessageBubble message={msg} />
                {msg.direction === 'in' && msg.buttons && (
                  <ButtonGroup buttons={msg.buttons} onClick={handleButtonClick} />
                )}
                {msg.direction === 'in' && msg.listSections && (
                  <div style={styles.listContainer}>
                    {msg.listSections.map((section) =>
                      section.rows.map((row) => (
                        <button
                          key={row.id}
                          onClick={() => handleButtonClick(row.id, row.title)}
                          style={styles.listItem}
                        >
                          <strong>{row.title}</strong>
                          {row.description && <small style={styles.listDesc}>{row.description}</small>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} style={styles.inputArea}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} style={styles.attachBtn}>
              📎
            </button>
            <input
              type="text"
              value={input}
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
              placeholder="اكتب رسالتك..."
              style={styles.textInput}
            />
            <button type="submit" style={styles.sendBtn}>➤</button>
          </form>
        </div>
      )}
    </div>
  );
}
