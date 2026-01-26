interface WidgetPreviewProps {
  color: string;
  welcomeMessage: string;
  position: string;
}

function WidgetPreview({ color, welcomeMessage, position }: WidgetPreviewProps) {
  return (
    <div className="widget-preview-wrapper">
      <div
        className="widget-preview"
        style={{
          position: 'absolute',
          [position.includes('bottom') ? 'bottom' : 'top']: '20px',
          [position.includes('right') ? 'right' : 'left']: '20px',
        }}
      >
        <div className="widget-preview-header" style={{ background: color }}>
          <div className="widget-preview-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <div className="widget-preview-title">Asistente</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>En linea</div>
          </div>
        </div>
        <div className="widget-preview-body">
          <div className="widget-preview-message">
            {welcomeMessage || 'Hola! Como puedo ayudarte?'}
          </div>
        </div>
        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
          <div
            style={{
              background: 'var(--color-bg)',
              borderRadius: '100px',
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              color: 'var(--color-text-muted)',
            }}
          >
            Escribe un mensaje...
          </div>
        </div>
      </div>
    </div>
  );
}

export default WidgetPreview;
