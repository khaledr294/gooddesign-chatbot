interface ButtonGroupProps {
  buttons: { id: string; title: string }[];
  onClick: (id: string, title: string) => void;
}

export function ButtonGroup({ buttons, onClick }: ButtonGroupProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', paddingRight: '8px' }}>
      {buttons.map((btn) => (
        <button
          key={btn.id}
          onClick={() => onClick(btn.id, btn.title)}
          style={{
            padding: '8px 14px',
            borderRadius: '20px',
            border: '1.5px solid #1a1a2e',
            background: '#ffffff',
            color: '#1a1a2e',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = '#1a1a2e';
            (e.target as HTMLElement).style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = '#ffffff';
            (e.target as HTMLElement).style.color = '#1a1a2e';
          }}
        >
          {btn.title}
        </button>
      ))}
    </div>
  );
}
