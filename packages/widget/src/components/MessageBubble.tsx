interface MessageProps {
  message: {
    direction: 'in' | 'out';
    type: string;
    text?: string;
    imageUrl?: string;
  };
}

export function MessageBubble({ message }: MessageProps) {
  const isBot = message.direction === 'in';

  const bubbleStyle: Record<string, string> = {
    maxWidth: '80%',
    padding: '10px 14px',
    borderRadius: '16px',
    marginBottom: '4px',
    fontSize: '14px',
    lineHeight: '1.5',
    wordBreak: 'break-word',
    alignSelf: isBot ? 'flex-start' : 'flex-end',
    background: isBot ? '#f3f4f6' : '#1a1a2e',
    color: isBot ? '#1f2937' : '#ffffff',
    borderBottomRight: isBot ? '16px' : '4px',
    borderBottomLeft: isBot ? '4px' : '16px',
  };

  return (
    <div style={{ display: 'flex', justifyContent: isBot ? 'flex-start' : 'flex-end', marginBottom: '8px' }}>
      <div style={bubbleStyle}>
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt=""
            style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: message.text ? '8px' : '0' }}
          />
        )}
        {message.text && (
          <div
            dangerouslySetInnerHTML={{
              __html: message.text
                .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br/>'),
            }}
          />
        )}
      </div>
    </div>
  );
}
