import { useState, useEffect } from 'react';
import { clientApi } from '../../services/api';

interface StoreData {
  id: string;
  shop_domain: string;
  platform: string;
  status: string;
  products_synced: number;
  last_sync_at: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

function MyStore() {
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStore();
  }, []);

  const loadStore = async () => {
    try {
      setLoading(true);
      const response = await clientApi.getStore();
      setStore(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar tienda');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getTrialDaysLeft = () => {
    if (!store?.trial_ends_at) return 0;
    const now = new Date();
    const trialEnd = new Date(store.trial_ends_at);
    const diff = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <div className="page-header-content">
            <div>
              <h1 className="page-title">Mi Tienda</h1>
              <p className="page-subtitle">Detalles de tu tienda conectada</p>
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
            <h1 className="page-title">Mi Tienda</h1>
            <p className="page-subtitle">Detalles de tu tienda conectada</p>
          </div>
          <button className="btn btn-primary" onClick={loadStore}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Actualizar
          </button>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="alert alert-error">
            <div className="alert-content">
              <div className="alert-title">Error</div>
              <div className="alert-message">{error}</div>
            </div>
          </div>
        )}

        {!store ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h3 className="empty-state-title">No hay tienda conectada</h3>
            <p className="empty-state-description">
              Completa el proceso de onboarding para conectar tu tienda Shopify.
            </p>
          </div>
        ) : (
          <>
            {/* Store Info Card */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: store.platform === 'shopify' ? '#95bf47' : '#7f54b3',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                    <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.021-.116-.124-.2-.251-.208-.127-.007-2.832-.205-2.832-.205s-1.872-1.854-2.085-2.06c-.213-.206-.63-.146-.794-.1-.003 0-.152.047-.398.123-.236-.692-.655-1.498-1.383-2.241-.962-.975-2.302-1.461-3.889-1.461-.117 0-.235.003-.354.012-.174-.225-.383-.405-.611-.539-.802-.471-1.804-.534-2.736-.179-2.436.928-4.066 3.506-4.503 6.269-.693.215-1.186.367-1.254.388-.785.246-.81.27-.914.978-.078.534-2.124 16.358-2.124 16.358l15.866 2.974z" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                    {store.shop_domain}
                  </h3>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                    {store.platform === 'shopify' ? 'Shopify' : 'WooCommerce'}
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <span className={`badge ${store.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                      {store.status === 'active' ? 'Activa' : store.status === 'connected' ? 'Conectada' : store.status}
                    </span>
                    {store.trial_ends_at && getTrialDaysLeft() > 0 && (
                      <span className="badge badge-warning">
                        {getTrialDaysLeft()} dias de trial restantes
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={`https://${store.shop_domain}/admin`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Ir a Shopify
                </a>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="stat-card">
                <div className="stat-icon success">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <div className="stat-value">{store.products_synced || 0}</div>
                <div className="stat-label">Productos Sincronizados</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon primary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                  {formatDate(store.last_sync_at)}
                </div>
                <div className="stat-label">Ultima Sincronizacion</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon warning">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                  {formatDate(store.created_at)}
                </div>
                <div className="stat-label">Fecha de Conexion</div>
              </div>
            </div>

            {/* Actions */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Acciones de Tienda</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <button className="btn btn-secondary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Forzar Sincronizacion
                </button>
                <button className="btn btn-secondary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Configurar Conexion
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default MyStore;
