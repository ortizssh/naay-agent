import { useState, useEffect } from 'react';
import logoKova from '../img/logo-kova.png';

interface ShopifyEmbeddedProps {
  shop: string;
  host: string;
}

interface AnalyticsData {
  conversations: number;
  messages: number;
  products: number;
  recommendations: number;
  conversions: number;
  lastSync: string | null;
  storeCreated: string | null;
}

interface StoreData {
  shop_domain: string;
  status: string;
  widget_enabled: boolean;
  products_synced: number;
  last_sync_at: string | null;
  created_at: string | null;
}

type TabType = 'dashboard' | 'analytics' | 'widget';

function ShopifyEmbedded({ shop, host }: ShopifyEmbeddedProps) {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get API URL - for embedded Shopify context, we need the app URL, not the iframe origin
  const getApiUrl = () => {
    // Check for environment variable first
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

    // For localhost development
    if (window.location.hostname === 'localhost') return 'http://localhost:3000';

    // For embedded context, check if we're on the app's domain
    const currentOrigin = window.location.origin;
    if (currentOrigin.includes('naay-agent') || currentOrigin.includes('azurewebsites.net')) {
      return currentOrigin;
    }

    // Fallback to production URL for Shopify embedded context
    return 'https://naay-agent-app1763504937.azurewebsites.net';
  };

  useEffect(() => {
    loadData();
  }, [shop]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = getApiUrl();

      // Fetch analytics data for the shop
      const analyticsRes = await fetch(`${apiUrl}/api/shopify/embedded/analytics?shop=${encodeURIComponent(shop)}`);

      if (!analyticsRes.ok) {
        throw new Error('Error al cargar datos');
      }

      const analyticsData = await analyticsRes.json();

      if (analyticsData.success) {
        setAnalytics(analyticsData.data.analytics);
        setStore(analyticsData.data.store);
      } else {
        throw new Error(analyticsData.error || 'Error desconocido');
      }
    } catch (err: any) {
      console.error('Error loading embedded data:', err);
      setError(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const conversionRate = analytics && analytics.recommendations > 0
    ? ((analytics.conversions / analytics.recommendations) * 100).toFixed(1)
    : '0';

  if (loading) {
    return (
      <div className="shopify-embedded">
        <div className="loading-container" style={{ minHeight: '400px' }}>
          <div className="loading-spinner"></div>
          <span className="loading-text">Cargando datos de {shop}...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="shopify-embedded">
      {/* Header */}
      <header className="embedded-header">
        <div className="embedded-header-content">
          <img src={logoKova} alt="Kova" className="embedded-logo" />
          <div className="embedded-shop-info">
            <span className="embedded-shop-name">{shop}</span>
            {store && (
              <span className={`embedded-status ${store.widget_enabled ? 'active' : 'inactive'}`}>
                {store.widget_enabled ? 'Widget Activo' : 'Widget Inactivo'}
              </span>
            )}
          </div>
          <button className="btn btn-primary btn-sm" onClick={loadData}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Actualizar
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="embedded-tabs">
        <button
          className={`embedded-tab ${currentTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentTab('dashboard')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
          Dashboard
        </button>
        <button
          className={`embedded-tab ${currentTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setCurrentTab('analytics')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Estadisticas
        </button>
        <button
          className={`embedded-tab ${currentTab === 'widget' ? 'active' : ''}`}
          onClick={() => setCurrentTab('widget')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Widget
        </button>
      </nav>

      {/* Content */}
      <div className="embedded-content">
        {error && (
          <div className="alert alert-error">
            <div className="alert-content">
              <div className="alert-message">{error}</div>
            </div>
          </div>
        )}

        {/* Dashboard Tab */}
        {currentTab === 'dashboard' && analytics && (
          <>
            {/* Main Stats */}
            <div className="stats-grid embedded-stats">
              <div className="stat-card">
                <div className="stat-icon primary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="stat-value">{analytics.conversations.toLocaleString()}</div>
                <div className="stat-label">Conversaciones</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon success">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
                <div className="stat-value">{analytics.recommendations.toLocaleString()}</div>
                <div className="stat-label">Recomendaciones</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon warning">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                </div>
                <div className="stat-value">{analytics.conversions.toLocaleString()}</div>
                <div className="stat-label">Conversiones</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon accent">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  </svg>
                </div>
                <div className="stat-value">{conversionRate}%</div>
                <div className="stat-label">Tasa Conversion</div>
              </div>
            </div>

            {/* Quick Info */}
            <div className="card" style={{ marginTop: '1.5rem' }}>
              <div className="card-header">
                <h3 className="card-title">Resumen</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div className="info-item">
                  <span className="info-label">Total Mensajes</span>
                  <span className="info-value">{analytics.messages.toLocaleString()}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Productos Indexados</span>
                  <span className="info-value">{analytics.products}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Ultima Sincronizacion</span>
                  <span className="info-value">{formatDate(analytics.lastSync)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Tienda Conectada</span>
                  <span className="info-value">{formatDate(analytics.storeCreated)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Analytics Tab */}
        {currentTab === 'analytics' && analytics && (
          <>
            <div className="stats-grid embedded-stats">
              <div className="stat-card">
                <div className="stat-value">{analytics.conversations.toLocaleString()}</div>
                <div className="stat-label">Conversaciones Totales</div>
                <div className="stat-change positive">{analytics.messages.toLocaleString()} mensajes</div>
              </div>

              <div className="stat-card">
                <div className="stat-value">{analytics.recommendations.toLocaleString()}</div>
                <div className="stat-label">Productos Recomendados</div>
                <div className="stat-change positive">Por el asistente AI</div>
              </div>

              <div className="stat-card">
                <div className="stat-value">{analytics.conversions.toLocaleString()}</div>
                <div className="stat-label">Compras desde Chat</div>
                <div className="stat-change positive">Conversiones atribuidas</div>
              </div>

              <div className="stat-card">
                <div className="stat-value">{analytics.products}</div>
                <div className="stat-label">Productos Indexados</div>
                <div className="stat-change positive">Disponibles para AI</div>
              </div>
            </div>

            {/* Conversion Metrics */}
            {analytics.recommendations > 0 && (
              <div className="card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header">
                  <h3 className="card-title">Metricas de Conversion</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'center', padding: '1.5rem 1rem', background: 'var(--color-bg)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                      {conversionRate}%
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Recomendacion a Compra
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', padding: '1.5rem 1rem', background: 'var(--color-bg)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-success)' }}>
                      {analytics.conversations > 0 ? (analytics.recommendations / analytics.conversations).toFixed(1) : 0}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Recomendaciones por Chat
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', padding: '1.5rem 1rem', background: 'var(--color-bg)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-warning)' }}>
                      {analytics.conversations > 0 ? (analytics.messages / analytics.conversations).toFixed(1) : 0}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Mensajes por Chat
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Widget Tab */}
        {currentTab === 'widget' && store && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Configuracion del Widget</h3>
              <span className={`badge ${store.widget_enabled ? 'badge-success' : 'badge-warning'}`}>
                {store.widget_enabled ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                El widget de chat Kova esta {store.widget_enabled ? 'activo' : 'inactivo'} en tu tienda.
              </p>

              <div className="info-grid" style={{ display: 'grid', gap: '1rem' }}>
                <div className="info-item">
                  <span className="info-label">Tienda</span>
                  <span className="info-value">{store.shop_domain}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Estado</span>
                  <span className="info-value">{store.status}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Productos Sincronizados</span>
                  <span className="info-value">{store.products_synced}</span>
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Para personalizar el widget:</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Ve a <strong>Tema &gt; Personalizar &gt; App embeds</strong> y busca "Kova AI Chat Widget"
                para ajustar colores, mensajes y posicion.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShopifyEmbedded;
