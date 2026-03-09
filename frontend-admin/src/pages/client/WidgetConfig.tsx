import { useState, useEffect } from 'react';
import { clientApi } from '../../services/api';
import WidgetPreview from '../../components/common/WidgetPreview';
import CodeSnippet from '../../components/common/CodeSnippet';

interface WidgetConfigData {
  widget_position: string;
  widget_color: string;
  welcome_message: string;
  widget_enabled: boolean;
  widget_secondary_color: string;
  widget_accent_color: string;
  widget_button_size: number;
  widget_button_style: string;
  widget_show_pulse: boolean;
  widget_chat_width: number;
  widget_chat_height: number;
  widget_subtitle: string;
  widget_placeholder: string;
  widget_avatar: string;
  widget_show_promo_message: boolean;
  widget_show_cart: boolean;
  widget_show_contact: boolean;
  retell_agent_id: string;
  retell_from_number: string;
  widget_enable_animations: boolean;
  widget_theme: string;
  widget_brand_name: string;
}

function WidgetConfig() {
  const [config, setConfig] = useState<WidgetConfigData>({
    widget_position: 'bottom-right',
    widget_color: '#6d5cff',
    welcome_message: '',
    widget_enabled: true,
    widget_secondary_color: '#212120',
    widget_accent_color: '#cf795e',
    widget_button_size: 72,
    widget_button_style: 'circle',
    widget_show_pulse: true,
    widget_chat_width: 420,
    widget_chat_height: 600,
    widget_subtitle: 'Asistente de compras con IA',
    widget_placeholder: 'Escribe tu mensaje...',
    widget_avatar: '🌿',
    widget_show_promo_message: true,
    widget_show_cart: true,
    widget_show_contact: false,
    retell_agent_id: '',
    retell_from_number: '',
    widget_enable_animations: true,
    widget_theme: 'light',
    widget_brand_name: 'Kova',
  });
  const [widgetCode, setWidgetCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'appearance' | 'content' | 'features'>('appearance');

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
        setConfig((prev) => ({ ...prev, ...configResponse.data }));
      }
      if (codeResponse.data?.code) {
        setWidgetCode(codeResponse.data.code);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar configuración');
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
        widgetSecondaryColor: config.widget_secondary_color,
        widgetAccentColor: config.widget_accent_color,
        widgetButtonSize: config.widget_button_size,
        widgetButtonStyle: config.widget_button_style,
        widgetShowPulse: config.widget_show_pulse,
        widgetChatWidth: config.widget_chat_width,
        widgetChatHeight: config.widget_chat_height,
        widgetSubtitle: config.widget_subtitle,
        widgetPlaceholder: config.widget_placeholder,
        widgetAvatar: config.widget_avatar,
        widgetShowPromoMessage: config.widget_show_promo_message,
        widgetShowCart: config.widget_show_cart,
        widgetShowContact: config.widget_show_contact,
        retellAgentId: config.retell_agent_id,
        retellFromNumber: config.retell_from_number,
        widgetEnableAnimations: config.widget_enable_animations,
        widgetTheme: config.widget_theme,
        widgetBrandName: config.widget_brand_name,
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

  const buttonStyles = [
    { value: 'circle', label: 'Circular' },
    { value: 'rounded', label: 'Redondeado' },
    { value: 'square', label: 'Cuadrado' },
  ];

  const themes = [
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
  ];

  if (loading) {
    return (
      <>
        <header className="page-header">
          <div className="page-header-content">
            <div>
              <h1 className="page-title">Configuración del Widget</h1>
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
            <h1 className="page-title">Configuración del Widget</h1>
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
              <div className="alert-message">Configuración guardada exitosamente</div>
            </div>
          </div>
        )}

        {/* Widget Enable Toggle */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>Estado del Widget</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                {config.widget_enabled ? 'El widget está visible en tu tienda' : 'El widget está oculto'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn ${config.widget_enabled ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setConfig({ ...config, widget_enabled: true })}
              >
                Activo
              </button>
              <button
                className={`btn ${!config.widget_enabled ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setConfig({ ...config, widget_enabled: false })}
              >
                Inactivo
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            className={`btn ${activeTab === 'appearance' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('appearance')}
          >
            Apariencia
          </button>
          <button
            className={`btn ${activeTab === 'content' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('content')}
          >
            Contenido
          </button>
          <button
            className={`btn ${activeTab === 'features' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('features')}
          >
            Funcionalidades
          </button>
        </div>

        <div className="widget-preview-container">
          <div className="card">
            {activeTab === 'appearance' && (
              <>
                <div className="card-header">
                  <h3 className="card-title">Apariencia</h3>
                </div>

                <div className="form-group">
                  <label className="form-label">Tema</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {themes.map((theme) => (
                      <button
                        key={theme.value}
                        className={`btn ${config.widget_theme === theme.value ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setConfig({ ...config, widget_theme: theme.value })}
                        style={{ flex: 1 }}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Color primario</label>
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
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Color principal del botón y acentos
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Color secundario</label>
                  <div className="color-picker-wrapper">
                    <input
                      type="color"
                      className="color-picker-input"
                      value={config.widget_secondary_color}
                      onChange={(e) => setConfig({ ...config, widget_secondary_color: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-input"
                      value={config.widget_secondary_color}
                      onChange={(e) => setConfig({ ...config, widget_secondary_color: e.target.value })}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Color de textos y elementos secundarios
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Color de acento</label>
                  <div className="color-picker-wrapper">
                    <input
                      type="color"
                      className="color-picker-input"
                      value={config.widget_accent_color}
                      onChange={(e) => setConfig({ ...config, widget_accent_color: e.target.value })}
                    />
                    <input
                      type="text"
                      className="form-input"
                      value={config.widget_accent_color}
                      onChange={(e) => setConfig({ ...config, widget_accent_color: e.target.value })}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Color para destacados y acciones
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Posición del widget</label>
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
                  <label className="form-label">Estilo del botón</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {buttonStyles.map((style) => (
                      <button
                        key={style.value}
                        className={`btn ${config.widget_button_style === style.value ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setConfig({ ...config, widget_button_style: style.value })}
                        style={{ flex: 1 }}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Tamaño del botón: {config.widget_button_size}px</label>
                  <input
                    type="range"
                    min="56"
                    max="80"
                    step="4"
                    value={config.widget_button_size}
                    onChange={(e) => setConfig({ ...config, widget_button_size: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Ancho del chat: {config.widget_chat_width}px</label>
                  <input
                    type="range"
                    min="320"
                    max="500"
                    step="20"
                    value={config.widget_chat_width}
                    onChange={(e) => setConfig({ ...config, widget_chat_width: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Alto del chat: {config.widget_chat_height}px</label>
                  <input
                    type="range"
                    min="400"
                    max="700"
                    step="20"
                    value={config.widget_chat_height}
                    onChange={(e) => setConfig({ ...config, widget_chat_height: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>
              </>
            )}

            {activeTab === 'content' && (
              <>
                <div className="card-header">
                  <h3 className="card-title">Contenido</h3>
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre de marca</label>
                  <input
                    type="text"
                    className="form-input"
                    value={config.widget_brand_name}
                    onChange={(e) => setConfig({ ...config, widget_brand_name: e.target.value })}
                    placeholder="Kova"
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Se mostrará en el header del chat
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Avatar / Emoji</label>
                  <input
                    type="text"
                    className="form-input"
                    value={config.widget_avatar}
                    onChange={(e) => setConfig({ ...config, widget_avatar: e.target.value })}
                    placeholder="🌿"
                    maxLength={4}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Emoji o texto para el avatar del asistente
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Mensaje de bienvenida</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={config.welcome_message}
                    onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
                    placeholder="Necesitas ayuda para tu compra? Habla aquí!"
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Texto del mensaje promocional junto al botón
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Subtitulo</label>
                  <input
                    type="text"
                    className="form-input"
                    value={config.widget_subtitle}
                    onChange={(e) => setConfig({ ...config, widget_subtitle: e.target.value })}
                    placeholder="Asistente de compras con IA"
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Texto debajo del nombre de marca
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Placeholder del input</label>
                  <input
                    type="text"
                    className="form-input"
                    value={config.widget_placeholder}
                    onChange={(e) => setConfig({ ...config, widget_placeholder: e.target.value })}
                    placeholder="Escribe tu mensaje..."
                  />
                </div>
              </>
            )}

            {activeTab === 'features' && (
              <>
                <div className="card-header">
                  <h3 className="card-title">Funcionalidades</h3>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.widget_show_pulse}
                      onChange={(e) => setConfig({ ...config, widget_show_pulse: e.target.checked })}
                      style={{ width: '20px', height: '20px' }}
                    />
                    <div>
                      <span style={{ fontWeight: '500' }}>Animación de pulso</span>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Efecto de pulso para llamar la atención
                      </p>
                    </div>
                  </label>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.widget_show_promo_message}
                      onChange={(e) => setConfig({ ...config, widget_show_promo_message: e.target.checked })}
                      style={{ width: '20px', height: '20px' }}
                    />
                    <div>
                      <span style={{ fontWeight: '500' }}>Mostrar mensaje promocional</span>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Muestra el mensaje de bienvenida junto al botón
                      </p>
                    </div>
                  </label>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.widget_show_cart}
                      onChange={(e) => setConfig({ ...config, widget_show_cart: e.target.checked })}
                      style={{ width: '20px', height: '20px' }}
                    />
                    <div>
                      <span style={{ fontWeight: '500' }}>Carrito integrado</span>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Permite agregar productos al carrito desde el chat
                      </p>
                    </div>
                  </label>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.widget_show_contact}
                      onChange={(e) => setConfig({ ...config, widget_show_contact: e.target.checked })}
                      style={{ width: '20px', height: '20px' }}
                    />
                    <div>
                      <span style={{ fontWeight: '500' }}>Contacto telefónico</span>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Permite solicitar una llamada desde el chat
                      </p>
                    </div>
                  </label>
                  {config.widget_show_contact && (
                    <div style={{ marginTop: '0.75rem', paddingLeft: '2.75rem' }}>
                      <label className="form-label" style={{ fontSize: '0.85rem' }}>Retell Agent ID</label>
                      <input
                        type="text"
                        className="form-input"
                        value={config.retell_agent_id}
                        onChange={(e) => setConfig({ ...config, retell_agent_id: e.target.value })}
                        placeholder="agent_xxxxxxxxxxxxxxxx"
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        ID del agente en Retell AI para las llamadas
                      </span>
                      <label className="form-label" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Retell From Number</label>
                      <input
                        type="text"
                        className="form-input"
                        value={config.retell_from_number}
                        onChange={(e) => setConfig({ ...config, retell_from_number: e.target.value })}
                        placeholder="+1234567890"
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Número de teléfono desde el cual se realizará la llamada
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.widget_enable_animations}
                      onChange={(e) => setConfig({ ...config, widget_enable_animations: e.target.checked })}
                      style={{ width: '20px', height: '20px' }}
                    />
                    <div>
                      <span style={{ fontWeight: '500' }}>Animaciones</span>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Transiciones y efectos visuales
                      </p>
                    </div>
                  </label>
                </div>
              </>
            )}

          </div>

          <WidgetPreview
            color={config.widget_color}
            welcomeMessage={config.welcome_message}
            position={config.widget_position}
          />
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Código de Instalación</h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
            Copia este código y pégalo en tu tema de Shopify antes del cierre de {'</body>'}.
          </p>
          {widgetCode ? (
            <CodeSnippet code={widgetCode} />
          ) : (
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '10px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Conecta tu tienda para obtener el código
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default WidgetConfig;
