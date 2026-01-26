import { useState, useEffect } from 'react';

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  plan: string;
}

function Settings() {
  const [apiUrl, setApiUrl] = useState(
    import.meta.env.VITE_API_URL || 'https://naay-agent-app1763504937.azurewebsites.net'
  );
  const [saved, setSaved] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'account' | 'plans'>('general');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    const storedApiUrl = localStorage.getItem('api_url');
    if (storedApiUrl) {
      setApiUrl(storedApiUrl);
    }
  }, []);

  const handleSaveApiUrl = () => {
    localStorage.setItem('api_url', apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('Las contrasenas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('La contrasena debe tener al menos 8 caracteres');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al cambiar contrasena');
      }

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message);
    }
  };

  const plans = [
    {
      name: 'Starter',
      price: '$149',
      period: '/mes',
      description: 'Para tiendas pequenas',
      features: ['100 mensajes/mes', '50 productos', 'Soporte por email'],
      badge: 'primary'
    },
    {
      name: 'Growth',
      price: '$349',
      period: '/mes',
      description: 'Para tiendas en crecimiento',
      features: ['1,000 mensajes/mes', '500 productos', 'Soporte prioritario', 'Analytics basicos'],
      badge: 'success',
      popular: true
    },
    {
      name: 'Pro',
      price: '$599',
      period: '/mes',
      description: 'Para operaciones profesionales',
      features: ['10,000 mensajes/mes', '5,000 productos', 'Soporte 24/7', 'Analytics avanzados', 'API personalizada'],
      badge: 'warning'
    },
    {
      name: 'Enterprise',
      price: 'Personalizado',
      period: '',
      description: 'Para grandes operaciones',
      features: ['Mensajes ilimitados', 'Productos ilimitados', 'Soporte dedicado', 'SLA garantizado', 'Integraciones custom'],
      badge: 'neutral'
    }
  ];

  return (
    <>
      <header className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">Configuracion</h1>
            <p className="page-subtitle">Administra tu cuenta y preferencias</p>
          </div>
        </div>
      </header>

      <div className="page-content">
        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: '1.5rem' }}>
          <button
            className={`tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            General
          </button>
          <button
            className={`tab ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Mi Cuenta
          </button>
          <button
            className={`tab ${activeTab === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveTab('plans')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            Planes
          </button>
        </div>

        {/* Success Alert */}
        {saved && (
          <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
            <svg className="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div className="alert-content">
              <div className="alert-title">Guardado</div>
              <div className="alert-message">Configuracion guardada exitosamente</div>
            </div>
          </div>
        )}

        {/* General Tab */}
        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* API Configuration */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Configuracion de API</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">URL del Backend</label>
                  <input
                    type="text"
                    className="form-input"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.example.com"
                  />
                  <span className="form-hint">URL base del servidor de Kova Agent</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={handleSaveApiUrl}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Guardar
                  </button>
                </div>
              </div>
            </div>

            {/* System Info */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Informacion del Sistema</h3>
                <span className="badge badge-success">Operativo</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Version</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600' }}>1.0.0</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Ambiente</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600' }}>{import.meta.env.MODE}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Backend</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '500', wordBreak: 'break-all' }}>{apiUrl}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Profile Info */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Informacion de Perfil</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input
                    type="text"
                    className="form-input"
                    value={user?.firstName || ''}
                    disabled
                    style={{ background: 'var(--color-bg)', cursor: 'not-allowed' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Apellido</label>
                  <input
                    type="text"
                    className="form-input"
                    value={user?.lastName || ''}
                    disabled
                    style={{ background: 'var(--color-bg)', cursor: 'not-allowed' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={user?.email || ''}
                    disabled
                    style={{ background: 'var(--color-bg)', cursor: 'not-allowed' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Empresa</label>
                  <input
                    type="text"
                    className="form-input"
                    value={user?.company || '-'}
                    disabled
                    style={{ background: 'var(--color-bg)', cursor: 'not-allowed' }}
                  />
                </div>
              </div>
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Plan actual:</span>
                  <span className={`badge badge-${user?.plan === 'pro' ? 'warning' : user?.plan === 'growth' ? 'success' : 'primary'}`}>
                    {user?.plan?.charAt(0).toUpperCase() + (user?.plan?.slice(1) || '')}
                  </span>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Cambiar Contrasena</h3>
              </div>

              {passwordError && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  <svg className="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div className="alert-content">
                    <div className="alert-message">{passwordError}</div>
                  </div>
                </div>
              )}

              {passwordSuccess && (
                <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                  <svg className="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <div className="alert-content">
                    <div className="alert-message">Contrasena cambiada exitosamente</div>
                  </div>
                </div>
              )}

              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Contrasena actual</label>
                  <input
                    type="password"
                    className="form-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Nueva contrasena</label>
                    <input
                      type="password"
                      className="form-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirmar contrasena</label>
                    <input
                      type="password"
                      className="form-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Cambiar Contrasena
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Plans Tab */}
        {activeTab === 'plans' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className="card"
                  style={{
                    position: 'relative',
                    border: plan.popular ? '2px solid var(--color-primary)' : undefined
                  }}
                >
                  {plan.popular && (
                    <div style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--color-primary)',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      Popular
                    </div>
                  )}
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <span className={`badge badge-${plan.badge}`} style={{ marginBottom: '1rem' }}>
                      {plan.name}
                    </span>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-text)' }}>
                      {plan.price}
                      <span style={{ fontSize: '1rem', fontWeight: '400', color: 'var(--color-text-secondary)' }}>
                        {plan.period}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      {plan.description}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {plan.features.map((feature, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className={`btn ${user?.plan === plan.name.toLowerCase() ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ width: '100%' }}
                    disabled={user?.plan === plan.name.toLowerCase()}
                  >
                    {user?.plan === plan.name.toLowerCase() ? 'Plan Actual' : 'Seleccionar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .tabs {
          display: flex;
          gap: 0.5rem;
          background: var(--color-bg);
          padding: 0.5rem;
          border-radius: 12px;
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .tab:hover {
          color: var(--color-text);
          background: var(--color-card);
        }

        .tab.active {
          background: var(--color-card);
          color: var(--color-primary);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .tab svg {
          width: 18px;
          height: 18px;
        }
      `}</style>
    </>
  );
}

export default Settings;
