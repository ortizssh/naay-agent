import { useState, useEffect } from 'react';
import { clientApi } from '../../services/api';
import WidgetPreview from '../../components/common/WidgetPreview';
import CodeSnippet from '../../components/common/CodeSnippet';

interface WidgetConfigData {
  widget_position: string;
  widget_color: string;
  welcome_message: string;
  widget_enabled: boolean;
}

function WidgetConfig() {
  const [config, setConfig] = useState<WidgetConfigData>({
    widget_position: 'bottom-right',
    widget_color: '#6d5cff',
    welcome_message: 'Hola! Como puedo ayudarte?',
    widget_enabled: true,
  });
  const [widgetCode, setWidgetCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const [configResponse, codeResponse] = await Promise.all([
        clientApi.getWidgetConfig(),
        clientApi.getWidgetCode(),
      ]);
      if (configResponse.data) {
        setConfig(configResponse.data);
      }
      if (codeResponse.data?.code) {
        setWidgetCode(codeResponse.data.code);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar configuracion');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await clientApi.updateWidgetConfig({
        widgetPosition: config.widget_position,
        widgetColor: config.widget_color,
        welcomeMessage: config.welcome_message,
        widgetEnabled: config.widget_enabled,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      // Reload widget code with new config
      const codeResponse = await clientApi.getWidgetCode();
      if (codeResponse.data?.code) {
        setWidgetCode(codeResponse.data.code);
      }
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const positions = [
    { value: 'bottom-right', label: 'Abajo Derecha' },
    { value: 'bottom-left', label: 'Abajo Izquierda' },
    { value: 'top-right', label: 'Arriba Derecha' },
    { value: 'top-left', label: 'Arriba Izquierda' },
  ];

  if (loading) {
    return (
      <>
        <header className="page-header">
          <div className="page-header-content">
            <div>
              <h1 className="page-title">Configuracion del Widget</h1>
              <p className="page-subtitle">Personaliza tu asistente de chat</p>
            </div>
          </div>
        </header>
        <div className="page-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Cargando...</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">Configuracion del Widget</h1>
            <p className="page-subtitle">Personaliza tu asistente de chat</p>
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
                Guardando...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="alert alert-error">
            <div className="alert-content">
              <div className="alert-message">{error}</div>
            </div>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <div className="alert-content">
              <div className="alert-message">Configuracion guardada exitosamente</div>
            </div>
          </div>
        )}

        <div className="widget-preview-container">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Apariencia</h3>
            </div>

            <div className="form-group">
              <label className="form-label">Widget Activo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  className={`btn ${config.widget_enabled ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setConfig({ ...config, widget_enabled: true })}
                  style={{ flex: 1 }}
                >
                  Activo
                </button>
                <button
                  className={`btn ${!config.widget_enabled ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => setConfig({ ...config, widget_enabled: false })}
                  style={{ flex: 1 }}
                >
                  Inactivo
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Color principal</label>
              <div className="color-picker-wrapper">
                <input
                  type="color"
                  className="color-picker-input"
                  value={config.widget_color}
                  onChange={(e) => setConfig({ ...config, widget_color: e.target.value })}
                />
                <input
                  type="text"
                  className="form-input"
                  value={config.widget_color}
                  onChange={(e) => setConfig({ ...config, widget_color: e.target.value })}
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
                    className={`position-option ${config.widget_position === pos.value ? 'selected' : ''}`}
                    onClick={() => setConfig({ ...config, widget_position: pos.value })}
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
                value={config.welcome_message}
                onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
                placeholder="Hola! Como puedo ayudarte?"
              />
            </div>
          </div>

          <WidgetPreview
            color={config.widget_color}
            welcomeMessage={config.welcome_message}
            position={config.widget_position}
          />
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Codigo de Instalacion</h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
            Copia este codigo y pegalo en tu tema de Shopify antes del cierre de {'</body>'}.
          </p>
          {widgetCode ? (
            <CodeSnippet code={widgetCode} />
          ) : (
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '10px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Conecta tu tienda para obtener el codigo
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default WidgetConfig;
