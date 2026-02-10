import { useState, useEffect } from 'react';
import { clientApi, AiConfig } from '../../services/api';

function AiConfigPage() {
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    chat_mode: 'internal',
    ai_model: 'gpt-4.1-mini',
    agent_name: null,
    agent_tone: 'friendly',
    brand_description: null,
    agent_instructions: null,
    agent_language: 'es',
    chatbot_endpoint: null,
  });
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
      const res = await clientApi.getAiConfig();
      if (res.data) {
        setAiConfig(res.data);
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
      await clientApi.updateAiConfig({
        chatMode: aiConfig.chat_mode,
        aiModel: aiConfig.ai_model,
        agentName: aiConfig.agent_name || '',
        agentTone: aiConfig.agent_tone,
        brandDescription: aiConfig.brand_description || '',
        agentInstructions: aiConfig.agent_instructions || '',
        agentLanguage: aiConfig.agent_language,
        chatbotEndpoint: aiConfig.chatbot_endpoint || '',
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar configuracion de IA');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <div className="page-header-content">
            <div>
              <h1 className="page-title">Configuracion de IA</h1>
              <p className="page-subtitle">Personaliza el comportamiento de tu asistente</p>
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
            <h1 className="page-title">Configuracion de IA</h1>
            <p className="page-subtitle">Personaliza el comportamiento de tu asistente</p>
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

        <div className="card">
          {/* Chat Mode Selector */}
          <div className="form-group">
            <label className="form-label">Modo de chat</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn ${aiConfig.chat_mode === 'internal' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAiConfig({ ...aiConfig, chat_mode: 'internal' })}
                style={{ flex: 1, textAlign: 'left', padding: '0.75rem' }}
              >
                <div style={{ fontWeight: 600 }}>IA Interna (Kova)</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>Motor de IA integrado con busqueda de productos y knowledge base</div>
              </button>
              <button
                className={`btn ${aiConfig.chat_mode === 'external' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAiConfig({ ...aiConfig, chat_mode: 'external' })}
                style={{ flex: 1, textAlign: 'left', padding: '0.75rem' }}
              >
                <div style={{ fontWeight: 600 }}>Endpoint Externo</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>Conecta con un servicio externo (n8n, custom API, etc.)</div>
              </button>
            </div>
          </div>

          {aiConfig.chat_mode === 'internal' ? (
            <>
              <div className="form-group">
                <label className="form-label">Nombre del Agente</label>
                <input
                  type="text"
                  className="form-input"
                  value={aiConfig.agent_name || ''}
                  onChange={(e) => setAiConfig({ ...aiConfig, agent_name: e.target.value || null })}
                  placeholder="Ej: Mi Asistente, Asesor de Belleza"
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Como se presentara el asistente al cliente
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Descripcion de Marca</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={aiConfig.brand_description || ''}
                  onChange={(e) => setAiConfig({ ...aiConfig, brand_description: e.target.value || null })}
                  placeholder="Describe tu negocio para que el AI entienda el contexto..."
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  El AI usara esta informacion como contexto en sus respuestas
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Tono</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { value: 'friendly', label: 'Cercano y amigable' },
                    { value: 'formal', label: 'Formal y profesional' },
                    { value: 'casual', label: 'Casual' },
                    { value: 'professional', label: 'Profesional' },
                  ].map(tone => (
                    <button
                      key={tone.value}
                      className={`btn ${aiConfig.agent_tone === tone.value ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setAiConfig({ ...aiConfig, agent_tone: tone.value })}
                    >
                      {tone.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Idioma</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[
                    { value: 'es', label: 'Espanol' },
                    { value: 'en', label: 'English' },
                    { value: 'pt', label: 'Portugues' },
                  ].map(lang => (
                    <button
                      key={lang.value}
                      className={`btn ${aiConfig.agent_language === lang.value ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setAiConfig({ ...aiConfig, agent_language: lang.value })}
                      style={{ flex: 1 }}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Instrucciones adicionales</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={aiConfig.agent_instructions || ''}
                  onChange={(e) => setAiConfig({ ...aiConfig, agent_instructions: e.target.value || null })}
                  placeholder="Reglas especificas, restricciones, comportamiento..."
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Instrucciones que el AI seguira en cada conversacion
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Modelo IA</label>
                <select
                  className="form-input"
                  value={aiConfig.ai_model}
                  onChange={(e) => setAiConfig({ ...aiConfig, ai_model: e.target.value })}
                >
                  <option value="gpt-4.1-mini">GPT-4.1 Mini (Recomendado)</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">URL del Endpoint *</label>
                <input
                  type="url"
                  className="form-input"
                  value={aiConfig.chatbot_endpoint || ''}
                  onChange={(e) => setAiConfig({ ...aiConfig, chatbot_endpoint: e.target.value || null })}
                  placeholder="https://n8n.example.com/webhook/mi-chat"
                  required
                />
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Los mensajes se enviaran directamente a este endpoint. Asegurate de que acepte POST con <code>{`{message, shop, session_id}`}</code>.
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default AiConfigPage;
