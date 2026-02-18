import { useState, useEffect, useRef, useCallback } from 'react';
import { clientApi, VoiceAgentConfig, RetellVoice, VoiceCallLog } from '../../services/api';

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'multi', label: 'Multilingual' },
];

const MODEL_OPTIONS = [
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'claude-4.5-sonnet', label: 'Claude 4.5 Sonnet' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
];

const AMBIENT_SOUND_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'coffee-shop', label: 'Coffee Shop' },
  { value: 'convention-hall', label: 'Convention Hall' },
  { value: 'summer-outdoor', label: 'Summer Outdoor' },
  { value: 'mountain-outdoor', label: 'Mountain Outdoor' },
  { value: 'static-noise', label: 'Static Noise' },
  { value: 'call-center', label: 'Call Center' },
];

function VoiceAgent() {
  const [config, setConfig] = useState<VoiceAgentConfig | null>(null);
  const [voices, setVoices] = useState<RetellVoice[]>([]);
  const [calls, setCalls] = useState<VoiceCallLog[]>([]);
  const [callsPagination, setCallsPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [testCallNumber, setTestCallNumber] = useState('');
  const [testCalling, setTestCalling] = useState(false);
  const [testCallResult, setTestCallResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state
  const [form, setForm] = useState({
    voiceId: 'custom_voice_68e03fc0f0b966ec686aa8d758',
    language: 'en-US',
    voiceSpeed: 1.0,
    voiceTemperature: 1.0,
    responsiveness: 0.7,
    interruptionSensitivity: 0.5,
    enableBackchannel: true,
    ambientSound: '',
    maxCallDurationMs: 1800000,
    endCallAfterSilenceMs: 30000,
    boostedKeywords: [] as string[],
    prompt: '',
    beginMessage: '',
    model: 'gpt-4.1-mini',
    modelTemperature: 0.7,
  });

  const loadConfig = useCallback(async () => {
    try {
      const res = await clientApi.getVoiceAgentConfig();
      if (res.success && res.data) {
        setConfig(res.data);
        setForm({
          voiceId: res.data.voiceId || '',
          language: res.data.language || 'en-US',
          voiceSpeed: res.data.voiceSpeed ?? 1.0,
          voiceTemperature: res.data.voiceTemperature ?? 1.0,
          responsiveness: res.data.responsiveness ?? 0.7,
          interruptionSensitivity: res.data.interruptionSensitivity ?? 0.5,
          enableBackchannel: res.data.enableBackchannel ?? true,
          ambientSound: res.data.ambientSound || '',
          maxCallDurationMs: res.data.maxCallDurationMs ?? 1800000,
          endCallAfterSilenceMs: res.data.endCallAfterSilenceMs ?? 30000,
          boostedKeywords: res.data.boostedKeywords || [],
          prompt: res.data.prompt || '',
          beginMessage: res.data.beginMessage || '',
          model: res.data.model || 'gpt-4.1-mini',
          modelTemperature: res.data.modelTemperature ?? 0.7,
        });
        setKeywordsInput((res.data.boostedKeywords || []).join(', '));
      }
    } catch (e: any) {
      setError(e.message || 'Error loading config');
    }
  }, []);

  const loadVoices = useCallback(async () => {
    try {
      const res = await clientApi.getVoices();
      if (res.success) setVoices(res.data || []);
    } catch {
      // Non-critical
    }
  }, []);

  const loadCalls = useCallback(async (page = 1) => {
    try {
      const res = await clientApi.getVoiceCallHistory(page, 10);
      if (res.success) {
        setCalls(res.data || []);
        setCallsPagination(res.pagination);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadConfig(), loadVoices()]);
      setLoading(false);
    };
    init();
  }, [loadConfig, loadVoices]);

  useEffect(() => {
    if (config?.voiceAgentEnabled) {
      loadCalls(1);
    }
  }, [config?.voiceAgentEnabled, loadCalls]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const keywords = keywordsInput
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);

      await clientApi.updateVoiceAgentConfig({
        ...form,
        boostedKeywords: keywords,
        ambientSound: form.ambientSound || null,
      });
      setSuccess('Configuration saved');
      setTimeout(() => setSuccess(''), 3000);
      await loadConfig();
    } catch (e: any) {
      setError(e.message || 'Error saving config');
    } finally {
      setSaving(false);
    }
  };

  const handleEnable = async () => {
    setEnabling(true);
    setError('');
    setShowEnableConfirm(false);
    try {
      await clientApi.enableVoiceAgent();
      setSuccess('Voice agent enabled! A phone number has been purchased.');
      setTimeout(() => setSuccess(''), 5000);
      await loadConfig();
    } catch (e: any) {
      setError(e.message || 'Error enabling voice agent');
    } finally {
      setEnabling(false);
    }
  };

  const handleDisable = async () => {
    setDisabling(true);
    setError('');
    setShowDisableConfirm(false);
    try {
      await clientApi.disableVoiceAgent();
      setSuccess('Voice agent disabled. Phone number released.');
      setTimeout(() => setSuccess(''), 5000);
      await loadConfig();
    } catch (e: any) {
      setError(e.message || 'Error disabling voice agent');
    } finally {
      setDisabling(false);
    }
  };

  const handleTestCall = async () => {
    if (!testCallNumber.trim()) return;
    setTestCalling(true);
    setTestCallResult(null);
    try {
      const res = await clientApi.makeTestCall(testCallNumber.trim());
      if (res.success) {
        setTestCallResult({ type: 'success', message: `Call initiated! You should receive a call shortly.` });
        setTimeout(() => setTestCallResult(null), 8000);
      }
    } catch (e: any) {
      setTestCallResult({ type: 'error', message: e.message || 'Failed to initiate test call' });
    } finally {
      setTestCalling(false);
    }
  };

  const playVoicePreview = (voiceId: string, url?: string) => {
    if (!url) return;
    if (playingVoiceId === voiceId) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingVoiceId(voiceId);
    audio.play();
    audio.onended = () => setPlayingVoiceId(null);
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null;
    const colors: Record<string, string> = {
      positive: '#22c55e',
      negative: '#ef4444',
      neutral: '#6b7280',
    };
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 600,
        color: '#fff',
        background: colors[sentiment.toLowerCase()] || '#6b7280',
      }}>
        {sentiment}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span className="loading-text">Loading...</span>
        </div>
      </div>
    );
  }

  // Plan gate
  if (config && !config.planAllowsVoiceAgent) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h1>Voice Agent</h1>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%)',
          borderRadius: '16px',
          padding: '48px 32px',
          textAlign: 'center',
          border: '1px solid #dde4f0',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6b5afc" strokeWidth="1.5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '24px', color: '#1a1a2e' }}>
            Voice Agent
          </h2>
          <p style={{ color: '#64748b', marginBottom: '24px', maxWidth: '480px', margin: '0 auto 24px' }}>
            Automate phone calls with an AI voice agent. Available on Professional and Enterprise plans.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.hash = 'subscription'}
            style={{ padding: '12px 32px', fontSize: '15px' }}
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">Voice Agent</h1>
            <p className="page-subtitle">Configure your AI-powered phone agent</p>
          </div>
          {config?.voiceAgentEnabled && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
                  Saving...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          )}
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '16px' }}>
            <div className="alert-content">
              <div className="alert-message">{error}</div>
            </div>
          </div>
        )}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: '16px' }}>
            <div className="alert-content">
              <div className="alert-message">{success}</div>
            </div>
          </div>
        )}

      {/* Enable/Disable Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">Voice Agent Status</h3>
        </div>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 500 }}>
              {config?.voiceAgentEnabled ? 'Voice Agent is active' : 'Voice Agent is inactive'}
            </p>
            {config?.voiceAgentEnabled && config?.retellPhoneNumber && (
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
                Phone number: <strong>{config.retellPhoneNumber}</strong>
              </p>
            )}
            {config?.voiceAgentEnabled && config?.voiceCallsLimit !== undefined && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Monthly calls</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    {config.voiceCallsUsed} / {config.voiceCallsLimit === -1 ? 'Unlimited' : config.voiceCallsLimit}
                  </span>
                </div>
                {config.voiceCallsLimit !== -1 && (
                  <div style={{ height: '6px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      borderRadius: '3px',
                      width: `${Math.min(100, (config.voiceCallsUsed / config.voiceCallsLimit) * 100)}%`,
                      background: config.voiceCallsUsed >= config.voiceCallsLimit ? '#ef4444' : 'var(--color-primary)',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                )}
              </div>
            )}
          </div>
          {config?.voiceAgentEnabled ? (
            <button
              className="btn"
              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 20px' }}
              onClick={() => setShowDisableConfirm(true)}
              disabled={disabling}
            >
              {disabling ? 'Disabling...' : 'Disable'}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setShowEnableConfirm(true)}
              disabled={enabling}
            >
              {enabling ? 'Enabling...' : 'Enable Voice Agent'}
            </button>
          )}
        </div>
      </div>

      {/* Enable confirmation dialog */}
      {showEnableConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '440px', width: '90%' }}>
            <h3 style={{ margin: '0 0 12px' }}>Enable Voice Agent?</h3>
            <p style={{ color: '#64748b', margin: '0 0 24px' }}>
              This will create an AI voice agent and purchase a dedicated phone number for your store. The number will be used for inbound and outbound calls.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowEnableConfirm(false)} style={{ background: '#f1f5f9', border: 'none' }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEnable} disabled={enabling}>
                {enabling ? 'Enabling...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable confirmation dialog */}
      {showDisableConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '440px', width: '90%' }}>
            <h3 style={{ margin: '0 0 12px', color: '#dc2626' }}>Disable Voice Agent?</h3>
            <p style={{ color: '#64748b', margin: '0 0 24px' }}>
              This will release your phone number and delete the voice agent. Your call history will be preserved. You can re-enable later, but a new number will be assigned.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowDisableConfirm(false)} style={{ background: '#f1f5f9', border: 'none' }}>Cancel</button>
              <button className="btn" onClick={handleDisable} disabled={disabling} style={{ background: '#dc2626', color: '#fff', border: 'none' }}>
                {disabling ? 'Disabling...' : 'Confirm Disable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {config?.voiceAgentEnabled && (
        <>
          {/* Test Call */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--color-success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <div>
                <h3 className="card-title">Test Call</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Make a test call to hear how your agent sounds</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', margin: '16px 0', padding: 0 }} />

            <div style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="tel"
                    className="form-input"
                    value={testCallNumber}
                    onChange={e => setTestCallNumber(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    style={{ flex: 1 }}
                    onKeyDown={e => { if (e.key === 'Enter' && !testCalling) handleTestCall(); }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleTestCall}
                    disabled={testCalling || !testCallNumber.trim()}
                    style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {testCalling ? (
                      <>
                        <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                        Calling...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        Test Call
                      </>
                    )}
                  </button>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '6px' }}>
                  Enter your phone number in international format. The agent will call you using the number {config?.retellPhoneNumber}.
                </span>
                {testCallResult && (
                  <div style={{
                    marginTop: '10px', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem',
                    background: testCallResult.type === 'success' ? 'var(--color-success-soft)' : 'var(--color-error-soft)',
                    color: testCallResult.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
                  }}>
                    {testCallResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Voice Configuration */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--color-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
              <div>
                <h3 className="card-title">Voice Configuration</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Configure the voice, language and behavior of your agent</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', margin: '16px 0', padding: 0 }} />

            {/* Voice + Language row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '8px' }}>
              <div className="form-group">
                <label className="form-label">Voice</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'start' }}>
                  <select
                    className="form-input"
                    value={form.voiceId}
                    onChange={e => setForm(f => ({ ...f, voiceId: e.target.value }))}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select voice...</option>
                    {voices.map(v => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.voice_name} ({v.gender}{v.accent ? `, ${v.accent}` : ''}) — {v.provider}
                      </option>
                    ))}
                  </select>
                  {form.voiceId && (() => {
                    const selectedVoice = voices.find(v => v.voice_id === form.voiceId);
                    if (selectedVoice?.preview_audio_url) {
                      return (
                        <button
                          onClick={() => playVoicePreview(selectedVoice.voice_id, selectedVoice.preview_audio_url)}
                          style={{
                            background: playingVoiceId === selectedVoice.voice_id ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '10px',
                            padding: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px',
                            color: 'var(--color-primary)',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            height: '44px',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={playingVoiceId === selectedVoice.voice_id ? 'var(--color-primary)' : 'none'} stroke="var(--color-primary)" strokeWidth="2">
                            {playingVoiceId === selectedVoice.voice_id
                              ? <rect x="6" y="4" width="12" height="16" rx="1" />
                              : <polygon points="5 3 19 12 5 21 5 3" />}
                          </svg>
                          {playingVoiceId === selectedVoice.voice_id ? 'Stop' : 'Preview'}
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>The voice your agent will use during calls</span>
              </div>

              <div className="form-group">
                <label className="form-label">Language</label>
                <select
                  className="form-input"
                  value={form.language}
                  onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                >
                  {LANGUAGE_OPTIONS.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Primary language for speech recognition</span>
              </div>
            </div>

            {/* Sliders grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '8px' }}>
              {[
                { label: 'Voice Speed', key: 'voiceSpeed' as const, min: 0.5, max: 2, step: 0.1, hint: 'How fast the agent speaks' },
                { label: 'Voice Temperature', key: 'voiceTemperature' as const, min: 0, max: 2, step: 0.1, hint: 'Higher = more expressive and varied' },
                { label: 'Responsiveness', key: 'responsiveness' as const, min: 0, max: 1, step: 0.1, hint: 'How quickly the agent responds' },
                { label: 'Interruption Sensitivity', key: 'interruptionSensitivity' as const, min: 0, max: 1, step: 0.1, hint: 'How easily the caller can interrupt' },
              ].map(slider => (
                <div className="form-group" key={slider.key} style={{ marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{slider.label}</span>
                    <span style={{
                      background: 'var(--color-primary-soft)',
                      color: 'var(--color-primary)',
                      padding: '2px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      minWidth: '40px',
                      textAlign: 'center',
                    }}>
                      {(form[slider.key] as number).toFixed(1)}
                    </span>
                  </label>
                  <input
                    type="range" min={slider.min} max={slider.max} step={slider.step}
                    value={form[slider.key]}
                    onChange={e => setForm(f => ({ ...f, [slider.key]: parseFloat(e.target.value) }))}
                    style={{
                      width: '100%', height: '6px', borderRadius: '3px',
                      appearance: 'none', WebkitAppearance: 'none',
                      background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${((form[slider.key] as number) - slider.min) / (slider.max - slider.min) * 100}%, var(--color-border) ${((form[slider.key] as number) - slider.min) / (slider.max - slider.min) * 100}%, var(--color-border) 100%)`,
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{slider.hint}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Backchannel + Ambient Sound */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Backchannel</label>
                <div
                  onClick={() => setForm(f => ({ ...f, enableBackchannel: !f.enableBackchannel }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                    border: `1px solid ${form.enableBackchannel ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: form.enableBackchannel ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: '36px', height: '20px', borderRadius: '10px', position: 'relative',
                    background: form.enableBackchannel ? 'var(--color-primary)' : '#cbd5e1',
                    transition: 'background 0.2s ease', flexShrink: 0,
                  }}>
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: '2px',
                      left: form.enableBackchannel ? '18px' : '2px',
                      transition: 'left 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {form.enableBackchannel ? 'Enabled' : 'Disabled'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Agent says "uh-huh", "I see", etc. while listening
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ambient Sound</label>
                <select className="form-input" value={form.ambientSound}
                  onChange={e => setForm(f => ({ ...f, ambientSound: e.target.value }))}>
                  {AMBIENT_SOUND_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Background noise to make the agent sound more natural</span>
              </div>
            </div>
          </div>

          {/* Prompt & Model */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                  <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
                  <circle cx="12" cy="15" r="2" />
                </svg>
              </div>
              <div>
                <h3 className="card-title">Prompt & Model</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Define the personality, instructions and AI model for your agent</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', margin: '16px 0', padding: 0 }} />

            <div className="form-group">
              <label className="form-label">System Prompt</label>
              <textarea
                className="form-input"
                rows={6}
                value={form.prompt}
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                placeholder="You are a helpful customer service agent for our store. You help customers with product inquiries, orders, and general questions..."
                style={{ resize: 'vertical', lineHeight: '1.6' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>The main instructions that define your agent's behavior and personality</span>
            </div>

            <div className="form-group">
              <label className="form-label">Begin Message</label>
              <input
                type="text"
                className="form-input"
                value={form.beginMessage}
                onChange={e => setForm(f => ({ ...f, beginMessage: e.target.value }))}
                placeholder="Hello! Thank you for calling. How can I help you today?"
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>First thing the agent says when answering. Leave empty for a dynamic greeting.</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Model</label>
                <select className="form-input" value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}>
                  {MODEL_OPTIONS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>AI model powering the agent's responses</span>
              </div>

              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Model Temperature</span>
                  <span style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    color: '#f59e0b',
                    padding: '2px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    minWidth: '40px',
                    textAlign: 'center',
                  }}>
                    {form.modelTemperature.toFixed(1)}
                  </span>
                </label>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={form.modelTemperature}
                  onChange={e => setForm(f => ({ ...f, modelTemperature: parseFloat(e.target.value) }))}
                  style={{
                    width: '100%', height: '6px', borderRadius: '3px',
                    appearance: 'none', WebkitAppearance: 'none',
                    background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${form.modelTemperature * 100}%, var(--color-border) ${form.modelTemperature * 100}%, var(--color-border) 100%)`,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Lower = more predictable, higher = more creative</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Boosted Keywords</label>
              <input
                type="text"
                className="form-input"
                value={keywordsInput}
                onChange={e => setKeywordsInput(e.target.value)}
                placeholder="product name, brand, technical term, etc."
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Comma-separated words the speech recognition should prioritize</span>
            </div>
          </div>

          {/* Call Limits */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--color-error-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <h3 className="card-title">Call Limits</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Set duration and silence thresholds for automatic call termination</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', margin: '16px 0', padding: 0 }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Max Call Duration</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    className="form-input"
                    value={Math.round(form.maxCallDurationMs / 60000)}
                    onChange={e => setForm(f => ({ ...f, maxCallDurationMs: parseInt(e.target.value || '30') * 60000 }))}
                    min={1}
                    max={120}
                    style={{ paddingRight: '70px' }}
                  />
                  <span style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '0.8rem', color: 'var(--color-text-muted)', pointerEvents: 'none',
                  }}>minutes</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Call will automatically end after this duration</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">End Call After Silence</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    className="form-input"
                    value={Math.round(form.endCallAfterSilenceMs / 1000)}
                    onChange={e => setForm(f => ({ ...f, endCallAfterSilenceMs: parseInt(e.target.value || '30') * 1000 }))}
                    min={5}
                    max={120}
                    style={{ paddingRight: '70px' }}
                  />
                  <span style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '0.8rem', color: 'var(--color-text-muted)', pointerEvents: 'none',
                  }}>seconds</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Hang up if no one speaks for this long</span>
              </div>
            </div>
          </div>

          {/* Call History */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Call History</h3>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {calls.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  No calls yet
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>From</th>
                        <th style={thStyle}>To</th>
                        <th style={thStyle}>Direction</th>
                        <th style={thStyle}>Duration</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Sentiment</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {calls.map(call => (
                        <>
                          <tr key={call.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                            onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}>
                            <td style={tdStyle}>{formatDate(call.started_at)}</td>
                            <td style={tdStyle}>{call.from_number || '-'}</td>
                            <td style={tdStyle}>{call.to_number || '-'}</td>
                            <td style={tdStyle}>
                              <span style={{
                                padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                                background: call.direction === 'inbound' ? '#dbeafe' : '#f0fdf4',
                                color: call.direction === 'inbound' ? '#2563eb' : '#16a34a',
                              }}>
                                {call.direction}
                              </span>
                            </td>
                            <td style={tdStyle}>{formatDuration(call.duration_ms)}</td>
                            <td style={tdStyle}>
                              <span style={{
                                padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                                background: call.status === 'ended' ? '#f0fdf4' : call.status === 'error' ? '#fef2f2' : '#fefce8',
                                color: call.status === 'ended' ? '#16a34a' : call.status === 'error' ? '#dc2626' : '#ca8a04',
                              }}>
                                {call.status}
                              </span>
                            </td>
                            <td style={tdStyle}>{getSentimentBadge(call.user_sentiment)}</td>
                            <td style={tdStyle}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
                                style={{ transform: expandedCall === call.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </td>
                          </tr>
                          {expandedCall === call.id && (
                            <tr key={`${call.id}-detail`}>
                              <td colSpan={8} style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                {call.disconnection_reason && (
                                  <p style={{ margin: '0 0 8px', fontSize: '13px' }}>
                                    <strong>Disconnection:</strong> {call.disconnection_reason}
                                  </p>
                                )}
                                {call.call_summary && (
                                  <div style={{ marginBottom: '12px' }}>
                                    <strong style={{ fontSize: '13px' }}>Summary:</strong>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#475569' }}>{call.call_summary}</p>
                                  </div>
                                )}
                                {call.transcript && (
                                  <div>
                                    <strong style={{ fontSize: '13px' }}>Transcript:</strong>
                                    <pre style={{
                                      margin: '4px 0 0', fontSize: '12px', color: '#475569',
                                      whiteSpace: 'pre-wrap', background: '#fff', padding: '12px',
                                      borderRadius: '8px', border: '1px solid #e2e8f0', maxHeight: '300px', overflow: 'auto',
                                    }}>
                                      {call.transcript}
                                    </pre>
                                  </div>
                                )}
                                {!call.call_summary && !call.transcript && (
                                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>No additional details available</p>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {callsPagination.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px' }}>
                  <button
                    className="btn"
                    style={{ padding: '4px 12px', fontSize: '13px', background: '#f1f5f9', border: 'none' }}
                    disabled={callsPagination.page <= 1}
                    onClick={() => loadCalls(callsPagination.page - 1)}
                  >
                    Previous
                  </button>
                  <span style={{ padding: '4px 12px', fontSize: '13px', color: '#64748b' }}>
                    {callsPagination.page} / {callsPagination.pages}
                  </span>
                  <button
                    className="btn"
                    style={{ padding: '4px 12px', fontSize: '13px', background: '#f1f5f9', border: 'none' }}
                    disabled={callsPagination.page >= callsPagination.pages}
                    onClick={() => loadCalls(callsPagination.page + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      </div>
    </>
  );
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: '13px',
  color: '#334155',
};

export default VoiceAgent;
