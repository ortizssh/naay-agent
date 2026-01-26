import WidgetPreview from '../../../components/common/WidgetPreview';

interface ConfigureWidgetProps {
  config: {
    position: string;
    color: string;
    welcomeMessage: string;
  };
  onConfigChange: (key: string, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}

function ConfigureWidget({ config, onConfigChange, onBack, onNext }: ConfigureWidgetProps) {
  const positions = [
    { value: 'bottom-right', label: 'Abajo Derecha' },
    { value: 'bottom-left', label: 'Abajo Izquierda' },
    { value: 'top-right', label: 'Arriba Derecha' },
    { value: 'top-left', label: 'Arriba Izquierda' },
  ];

  return (
    <>
      <h2 className="onboarding-title">Configura tu widget</h2>
      <p className="onboarding-subtitle">
        Personaliza la apariencia del asistente en tu tienda
      </p>

      <div className="widget-preview-container">
        <div className="widget-config-form">
          <div className="form-group">
            <label className="form-label">Color principal</label>
            <div className="color-picker-wrapper">
              <input
                type="color"
                className="color-picker-input"
                value={config.color}
                onChange={(e) => onConfigChange('color', e.target.value)}
              />
              <input
                type="text"
                className="form-input"
                value={config.color}
                onChange={(e) => onConfigChange('color', e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Posicion del widget</label>
            <div className="position-grid">
              {positions.map((pos) => (
                <button
                  key={pos.value}
                  className={`position-option ${config.position === pos.value ? 'selected' : ''}`}
                  onClick={() => onConfigChange('position', pos.value)}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mensaje de bienvenida</label>
            <textarea
              className="form-input"
              rows={3}
              value={config.welcomeMessage}
              onChange={(e) => onConfigChange('welcomeMessage', e.target.value)}
              placeholder="Hola! Como puedo ayudarte?"
            />
            <div className="form-hint">
              Este mensaje aparecera cuando el usuario abra el chat
            </div>
          </div>
        </div>

        <WidgetPreview
          color={config.color}
          welcomeMessage={config.welcomeMessage}
          position={config.position}
        />
      </div>

      <div className="onboarding-nav">
        <button className="btn btn-secondary" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Atras
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Continuar
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </>
  );
}

export default ConfigureWidget;
