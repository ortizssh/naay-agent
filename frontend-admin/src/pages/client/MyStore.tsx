import { useState, useEffect, useRef, useCallback } from 'react';
import { clientApi } from '../../services/api';

interface StoreData {
  id: string;
  shop_domain: string;
  shop_name: string | null;
  shop_email: string | null;
  shop_currency: string | null;
  shop_country: string | null;
  shop_timezone: string | null;
  platform: string;
  status: string;
  is_active: boolean;
  products_synced: number;
  last_sync_at: string | null;
  sync_status: string | null;
  webhooks_configured: boolean;
  widget_enabled: boolean;
  voice_agent_enabled: boolean;
  plan: string | null;
  created_at: string;
  updated_at: string;
}

interface SyncStatusData {
  status: string;
  synced: number;
  total: number;
  webhooksConfigured: boolean;
}

function MyStore() {
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusData | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadStore();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
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

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncStatus(null);
      setError(null);
      await clientApi.triggerSync();

      pollRef.current = setInterval(async () => {
        try {
          const res = await clientApi.getSyncStatus();
          const status = res.data;
          setSyncStatus(status);

          if (status.status === 'completed' || status.status === 'failed') {
            stopPolling();
            setSyncing(false);
            if (status.status === 'completed') {
              await loadStore();
            }
          }
        } catch {
          stopPolling();
          setSyncing(false);
        }
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Error al sincronizar');
      setSyncing(false);
    }
  };

  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 30) return `Hace ${diffDays} dias`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return 'Hace 1 mes';
    if (diffMonths < 12) return `Hace ${diffMonths} meses`;
    const diffYears = Math.floor(diffMonths / 12);
    if (diffYears === 1) return 'Hace 1 año';
    return `Hace ${diffYears} años`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isShopify = store?.platform === 'shopify';
  const platformName = isShopify ? 'Shopify' : 'WooCommerce';
  const platformColor = isShopify ? '#95bf47' : '#7f54b3';
  const adminUrl = isShopify
    ? `https://${store?.shop_domain}/admin`
    : `https://${store?.shop_domain}/wp-admin`;

  const getSyncBadge = (status: string | null) => {
    const map: Record<string, { label: string; bg: string; color: string }> = {
      completed: { label: 'Completado', bg: '#f0fdf4', color: '#16a34a' },
      in_progress: { label: 'En progreso', bg: '#eff6ff', color: '#2563eb' },
      failed: { label: 'Fallido', bg: '#fef2f2', color: '#dc2626' },
      pending: { label: 'Pendiente', bg: '#f8fafc', color: '#64748b' },
    };
    const s = map[status || 'pending'] || map.pending;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
        borderRadius: '20px', fontSize: '12px', fontWeight: 600,
        background: s.bg, color: s.color,
      }}>
        {s.label}
      </span>
    );
  };

  const ShopifyLogo = () => (
    <svg width="36" height="36" viewBox="0 0 109.5 124.5" fill="white">
      <path d="M95.6 28.2c-.1-.6-.6-1-1.1-1-.5 0-10.3-.8-10.3-.8s-6.8-6.8-7.6-7.5c-.7-.7-2.2-.5-2.8-.3 0 0-1.4.4-3.7 1.2-2.2-6.3-6.1-12.1-13-12.1h-.6C54.5 5.2 52 3.7 49.8 3.7c-17.7 0-26.2 22.1-28.9 33.4-6.9 2.1-11.8 3.7-12.4 3.8-3.9 1.2-4 1.3-4.5 4.9C3.7 48.8 0 121.8 0 121.8l75.6 13 41-8.9S95.7 28.8 95.6 28.2zM67.3 21.8l-5.7 1.8c0-1.6-.1-3.5-.4-5.7 3.6.7 5.3 3 6.1 3.9zM57.5 24.5l-12.3 3.8c1.2-4.6 3.5-9.2 7.9-12.2.9-.6 2.2-1.3 3.6-1.6 1.5 3 1 7.3.8 10zM49.9 7.8c1.2 0 2.1.4 3 1.1-5.4 2.5-11.2 8.9-13.6 21.6l-9.7 3c2.7-9.2 9.2-25.7 20.3-25.7z" />
      <path d="M94.5 27.2c-.5 0-10.3-.8-10.3-.8s-6.8-6.8-7.6-7.5c-.3-.3-.6-.4-1-.4l-5.6 114.3 41-8.9S95.7 28.8 95.6 28.2c-.1-.6-.6-1-1.1-1" fill="rgba(255,255,255,0.3)" />
      <path d="M56.3 40.9l-4.9 14.5s-4.3-2.3-9.6-2.3c-7.7 0-8.1 4.8-8.1 6.1 0 6.6 17.4 9.2 17.4 24.7 0 12.2-7.7 20.1-18.2 20.1-12.5 0-18.9-7.8-18.9-7.8l3.3-11s6.6 5.6 12.1 5.6c3.6 0 5.1-2.8 5.1-4.9 0-8.7-14.3-9.1-14.3-23.3 0-12 8.6-23.5 26-23.5 6.7-.1 10.1 1.8 10.1 1.8z" fill="white" />
    </svg>
  );

  const WooCommerceLogo = () => (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
      <path d="M2.227 4C.9 4 0 5.012 0 6.338v9.396c0 1.326.9 2.266 2.227 2.266h7.635l3.32 2.847-.534-2.847h9.125C23.1 18 24 16.988 24 15.662V6.338C24 5.012 23.1 4 21.773 4H2.227zm1.592 2.8c.684 0 1.263.227 1.662.79.456.563.684 1.355.684 2.373 0 1.355-.342 2.486-1.026 3.39-.57.79-1.254 1.13-2.053 1.13-.684 0-1.207-.228-1.606-.79-.4-.563-.627-1.355-.627-2.373 0-1.355.342-2.487 1.026-3.39.57-.79 1.254-1.13 1.94-1.13zm7.92 0c.684 0 1.263.227 1.662.79.456.563.684 1.355.684 2.373 0 1.355-.342 2.486-1.026 3.39-.57.79-1.254 1.13-2.053 1.13-.684 0-1.207-.228-1.606-.79-.4-.563-.627-1.355-.627-2.373 0-1.355.342-2.487 1.026-3.39.57-.79 1.254-1.13 1.94-1.13zm6.75.06c.228 0 .456.057.57.228.114.17.17.398.114.676l-1.14 5.478h-.003l-.684-3.645-1.026 3.645-.003.001-1.37-6.165c-.057-.284 0-.512.17-.676.114-.17.342-.228.57-.228.456 0 .74.284.854.74l.57 3.05.912-3.39c.057-.228.228-.398.4-.512.172-.057.342-.057.57.057.228.113.342.284.4.512l.854 3.334.627-3.05c.057-.456.342-.74.797-.74l-.002-.001z" />
    </svg>
  );

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
          <div className="alert alert-error" style={{ marginBottom: '16px' }}>
            <div className="alert-content">
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
              Completa el proceso de onboarding para conectar tu tienda.
            </p>
          </div>
        ) : (
          <>
            {/* Store Header Card */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{
                  width: '72px', height: '72px', background: platformColor,
                  borderRadius: '16px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}>
                  {isShopify ? <ShopifyLogo /> : <WooCommerceLogo />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, marginBottom: '6px' }}>
                    {store.shop_name || store.shop_domain}
                  </h2>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                      background: `${platformColor}18`, color: platformColor,
                    }}>
                      {platformName}
                    </span>
                    <span className={`badge ${store.is_active ? 'badge-success' : 'badge-warning'}`}>
                      {store.is_active ? 'Activa' : store.status === 'connected' ? 'Conectada' : store.status}
                    </span>
                  </div>
                </div>
                <a
                  href={adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ flexShrink: 0 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Ir a {platformName}
                </a>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div className="stat-card">
                <div className="stat-icon success">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="stat-value">{store.products_synced || 0}</div>
                <div className="stat-label">Productos Sincronizados</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon primary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </div>
                <div style={{ marginBottom: '4px' }}>
                  {getSyncBadge(syncing ? 'in_progress' : store.sync_status)}
                </div>
                <div className="stat-label">Estado de Sync</div>
                {syncing && syncStatus && syncStatus.total > 0 && (
                  <div style={{ marginTop: '8px', width: '100%' }}>
                    <div style={{
                      height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: '3px',
                        background: 'var(--color-primary)',
                        width: `${Math.round((syncStatus.synced / syncStatus.total) * 100)}%`,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', textAlign: 'center' }}>
                      {syncStatus.synced} / {syncStatus.total}
                    </div>
                  </div>
                )}
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
                <div className="stat-value" style={{ fontSize: '1.15rem' }}>
                  {getRelativeTime(store.created_at)}
                </div>
                <div className="stat-label">Conectada desde</div>
              </div>
            </div>

            {/* Information Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              {/* Store Info */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    Informacion de la Tienda
                  </h3>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <InfoRow label="Nombre" value={store.shop_name || 'Sin configurar'} muted={!store.shop_name} />
                  <InfoRow label="Email" value={store.shop_email || 'Sin configurar'} muted={!store.shop_email} />
                  <InfoRow label="Moneda" value={store.shop_currency?.toUpperCase() || 'Sin configurar'} muted={!store.shop_currency} />
                  <InfoRow label="Pais" value={store.shop_country || 'Sin configurar'} muted={!store.shop_country} />
                  <InfoRow label="Zona horaria" value={store.shop_timezone || 'Sin configurar'} muted={!store.shop_timezone} last />
                </div>
              </div>

              {/* Connection & Config */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    Conexion y Configuracion
                  </h3>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <InfoRow label="Dominio" value={store.shop_domain} />
                  <InfoRow label="Plataforma" value={platformName} />
                  <InfoRow label="Plan" value={store.plan ? store.plan.charAt(0).toUpperCase() + store.plan.slice(1) : 'Sin plan'} muted={!store.plan} />
                  <InfoRow
                    label="Webhooks"
                    value={
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                        borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        background: store.webhooks_configured ? '#f0fdf4' : '#fefce8',
                        color: store.webhooks_configured ? '#16a34a' : '#ca8a04',
                      }}>
                        {store.webhooks_configured ? 'Configurados' : 'Pendientes'}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Widget"
                    value={
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                        borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        background: store.widget_enabled ? '#f0fdf4' : '#f1f5f9',
                        color: store.widget_enabled ? '#16a34a' : '#64748b',
                      }}>
                        {store.widget_enabled ? 'Activo' : 'Inactivo'}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Voice Agent"
                    value={
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                        borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        background: store.voice_agent_enabled ? '#f0fdf4' : '#f1f5f9',
                        color: store.voice_agent_enabled ? '#16a34a' : '#64748b',
                      }}>
                        {store.voice_agent_enabled ? 'Activo' : 'Inactivo'}
                      </span>
                    }
                    last
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Acciones Rapidas</h3>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSync}
                  disabled={syncing}
                  style={{ opacity: syncing ? 0.7 : 1 }}
                >
                  {syncing ? (
                    <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                  )}
                  {syncing ? 'Sincronizando...' : 'Sincronizar Productos'}
                </button>
                <a
                  href={adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Ir a {platformName} Admin
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function InfoRow({ label, value, muted, last }: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  last?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 20px',
      borderBottom: last ? 'none' : '1px solid var(--color-border)',
    }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{label}</span>
      <span style={{
        fontWeight: 600, fontSize: '13px',
        color: muted ? 'var(--color-text-muted)' : 'var(--color-text)',
        fontStyle: muted ? 'italic' : 'normal',
      }}>
        {value}
      </span>
    </div>
  );
}

export default MyStore;
