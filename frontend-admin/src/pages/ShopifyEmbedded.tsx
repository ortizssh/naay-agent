import { useState, useEffect, useMemo } from 'react';
import logoKova from '../img/logo-kova.png';

interface ShopifyEmbeddedProps {
  shop: string;
  host: string;
}

interface ConversationByDay {
  date: string;
  count: number;
}

interface AnalyticsData {
  conversations: number;
  messages: number;
  products: number;
  recommendations: number;
  conversions: number;
  lastSync: string | null;
  storeCreated: string | null;
  conversationsByDay?: ConversationByDay[];
}

interface StoreData {
  shop_domain: string;
  status: string;
  widget_enabled: boolean;
  products_synced: number;
  last_sync_at: string | null;
  created_at: string | null;
}

interface WidgetConfig {
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
  widget_enable_animations: boolean;
  widget_theme: string;
  widget_brand_name: string;
}

type TabType = 'dashboard' | 'analytics' | 'widget';

function ShopifyEmbedded({ shop, host }: ShopifyEmbeddedProps) {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [store, setStore] = useState<StoreData | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>({
    widget_position: 'bottom-right',
    widget_color: '#a59457',
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
    widget_enable_animations: true,
    widget_theme: 'light',
    widget_brand_name: 'Kova',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [widgetTab, setWidgetTab] = useState<'appearance' | 'content' | 'features'>('appearance');

  // Date filter state
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

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
  }, [shop, startDate, endDate]);

  useEffect(() => {
    if (currentTab === 'widget') {
      loadWidgetConfig();
    }
  }, [currentTab, shop]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = getApiUrl();

      // Fetch analytics data for the shop with date filters
      const analyticsRes = await fetch(
        `${apiUrl}/api/shopify/embedded/analytics?shop=${encodeURIComponent(shop)}&startDate=${startDate}&endDate=${endDate}`
      );

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

  const loadWidgetConfig = async () => {
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/widget/config?shop=${encodeURIComponent(shop)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setWidgetConfig(prev => ({
            ...prev,
            widget_position: data.data.position || prev.widget_position,
            widget_color: data.data.primaryColor || prev.widget_color,
            welcome_message: data.data.greeting || prev.welcome_message,
            widget_enabled: data.data.enabled ?? prev.widget_enabled,
            widget_secondary_color: data.data.secondaryColor || prev.widget_secondary_color,
            widget_accent_color: data.data.accentColor || prev.widget_accent_color,
            widget_button_size: data.data.buttonSize || prev.widget_button_size,
            widget_button_style: data.data.buttonStyle || prev.widget_button_style,
            widget_show_pulse: data.data.showPulse ?? prev.widget_show_pulse,
            widget_chat_width: data.data.chatWidth || prev.widget_chat_width,
            widget_chat_height: data.data.chatHeight || prev.widget_chat_height,
            widget_subtitle: data.data.subtitle || prev.widget_subtitle,
            widget_placeholder: data.data.placeholder || prev.widget_placeholder,
            widget_avatar: data.data.avatar || prev.widget_avatar,
            widget_show_promo_message: data.data.showPromoMessage ?? prev.widget_show_promo_message,
            widget_show_cart: data.data.showCart ?? prev.widget_show_cart,
            widget_enable_animations: data.data.enableAnimations ?? prev.widget_enable_animations,
            widget_theme: data.data.theme || prev.widget_theme,
            widget_brand_name: data.data.brandName || prev.widget_brand_name,
          }));
        }
      }
    } catch (err) {
      console.error('Error loading widget config:', err);
    }
  };

  const saveWidgetConfig = async () => {
    try {
      setSaving(true);
      setError(null);

      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/shopify/embedded/widget/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop,
          config: {
            widgetPosition: widgetConfig.widget_position,
            widgetColor: widgetConfig.widget_color,
            welcomeMessage: widgetConfig.welcome_message,
            widgetEnabled: widgetConfig.widget_enabled,
            widgetSecondaryColor: widgetConfig.widget_secondary_color,
            widgetAccentColor: widgetConfig.widget_accent_color,
            widgetButtonSize: widgetConfig.widget_button_size,
            widgetButtonStyle: widgetConfig.widget_button_style,
            widgetShowPulse: widgetConfig.widget_show_pulse,
            widgetChatWidth: widgetConfig.widget_chat_width,
            widgetChatHeight: widgetConfig.widget_chat_height,
            widgetSubtitle: widgetConfig.widget_subtitle,
            widgetPlaceholder: widgetConfig.widget_placeholder,
            widgetAvatar: widgetConfig.widget_avatar,
            widgetShowPromoMessage: widgetConfig.widget_show_promo_message,
            widgetShowCart: widgetConfig.widget_show_cart,
            widgetEnableAnimations: widgetConfig.widget_enable_animations,
            widgetTheme: widgetConfig.widget_theme,
            widgetBrandName: widgetConfig.widget_brand_name,
          },
        }),
      });

      if (!res.ok) throw new Error('Error al guardar');

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar configuracion');
    } finally {
      setSaving(false);
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

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const chartData = useMemo(() => {
    if (!analytics?.conversationsByDay) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    const dataMap = new Map(analytics.conversationsByDay.map(item => [item.date, item.count]));
    return dates.map(date => ({ date, count: dataMap.get(date) || 0 }));
  }, [analytics?.conversationsByDay, startDate, endDate]);

  const maxCount = useMemo(() => {
    if (chartData.length === 0) return 1;
    const max = Math.max(...chartData.map(d => d.count));
    return max > 0 ? max : 1;
  }, [chartData]);

  const conversionRate =
    analytics && analytics.recommendations > 0
      ? ((analytics.conversions / analytics.recommendations) * 100).toFixed(1)
      : '0';

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

        {success && (
          <div className="alert alert-success">
            <div className="alert-content">
              <div className="alert-message">Configuracion guardada exitosamente</div>
            </div>
          </div>
        )}

        {/* Dashboard Tab */}
        {currentTab === 'dashboard' && analytics && (
          <>
            {/* Date Filter */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Desde</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Hasta</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
                  {[3, 7, 30].map(days => (
                    <button
                      key={days}
                      className="btn btn-secondary"
                      onClick={() => {
                        const today = new Date();
                        setEndDate(today.toISOString().split('T')[0]);
                        setStartDate(
                          new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                        );
                      }}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

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

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="card" style={{ marginTop: '1rem' }}>
                <div className="card-header">
                  <h3 className="card-title">Conversaciones por Dia</h3>
                </div>
                <div style={{ padding: '0.5rem 0' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px', padding: '0 0.5rem' }}
                  >
                    {chartData.map(item => (
                      <div
                        key={item.date}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <span style={{ fontSize: '0.65rem', fontWeight: '600', marginBottom: '2px' }}>{item.count}</span>
                        <div
                          style={{
                            width: '100%',
                            maxWidth: '30px',
                            height: `${Math.max((item.count / maxCount) * 80, 3)}px`,
                            background: item.count > 0 ? 'var(--color-primary)' : 'var(--color-border)',
                            borderRadius: '3px 3px 0 0',
                          }}
                        />
                        <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                          {formatShortDate(item.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Info */}
            <div className="card" style={{ marginTop: '1rem' }}>
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
            {/* Date Filter */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Desde</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Hasta</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
                  {[3, 7, 30].map(days => (
                    <button
                      key={days}
                      className="btn btn-secondary"
                      onClick={() => {
                        const today = new Date();
                        setEndDate(today.toISOString().split('T')[0]);
                        setStartDate(
                          new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                        );
                      }}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

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
              <div className="card" style={{ marginTop: '1rem' }}>
                <div className="card-header">
                  <h3 className="card-title">Metricas de Conversion</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '1rem',
                      background: 'var(--color-bg)',
                      borderRadius: '10px',
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                      {conversionRate}%
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                      Recomendacion a Compra
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: 'center',
                      padding: '1rem',
                      background: 'var(--color-bg)',
                      borderRadius: '10px',
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-success)' }}>
                      {analytics.conversations > 0 ? (analytics.recommendations / analytics.conversations).toFixed(1) : 0}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                      Recomendaciones por Chat
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: 'center',
                      padding: '1rem',
                      background: 'var(--color-bg)',
                      borderRadius: '10px',
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-warning)' }}>
                      {analytics.conversations > 0 ? (analytics.messages / analytics.conversations).toFixed(1) : 0}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                      Mensajes por Chat
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Widget Tab */}
        {currentTab === 'widget' && (
          <>
            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button className="btn btn-primary" onClick={saveWidgetConfig} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>

            {/* Widget Enable Toggle */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Estado del Widget</h3>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {widgetConfig.widget_enabled ? 'Visible en tu tienda' : 'Oculto'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className={`btn ${widgetConfig.widget_enabled ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setWidgetConfig({ ...widgetConfig, widget_enabled: true })}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                  >
                    Activo
                  </button>
                  <button
                    className={`btn ${!widgetConfig.widget_enabled ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => setWidgetConfig({ ...widgetConfig, widget_enabled: false })}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                  >
                    Inactivo
                  </button>
                </div>
              </div>
            </div>

            {/* Widget Sub-Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {(['appearance', 'content', 'features'] as const).map(tab => (
                <button
                  key={tab}
                  className={`btn ${widgetTab === tab ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setWidgetTab(tab)}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                >
                  {tab === 'appearance' ? 'Apariencia' : tab === 'content' ? 'Contenido' : 'Funciones'}
                </button>
              ))}
            </div>

            <div className="card">
              {widgetTab === 'appearance' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Tema</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {themes.map(theme => (
                        <button
                          key={theme.value}
                          className={`btn ${widgetConfig.widget_theme === theme.value ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setWidgetConfig({ ...widgetConfig, widget_theme: theme.value })}
                          style={{ flex: 1, fontSize: '0.85rem' }}
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
                        value={widgetConfig.widget_color}
                        onChange={e => setWidgetConfig({ ...widgetConfig, widget_color: e.target.value })}
                      />
                      <input
                        type="text"
                        className="form-input"
                        value={widgetConfig.widget_color}
                        onChange={e => setWidgetConfig({ ...widgetConfig, widget_color: e.target.value })}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Color secundario</label>
                    <div className="color-picker-wrapper">
                      <input
                        type="color"
                        className="color-picker-input"
                        value={widgetConfig.widget_secondary_color}
                        onChange={e => setWidgetConfig({ ...widgetConfig, widget_secondary_color: e.target.value })}
                      />
                      <input
                        type="text"
                        className="form-input"
                        value={widgetConfig.widget_secondary_color}
                        onChange={e => setWidgetConfig({ ...widgetConfig, widget_secondary_color: e.target.value })}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Posicion</label>
                    <div className="position-grid">
                      {positions.map(pos => (
                        <button
                          key={pos.value}
                          className={`position-option ${widgetConfig.widget_position === pos.value ? 'selected' : ''}`}
                          onClick={() => setWidgetConfig({ ...widgetConfig, widget_position: pos.value })}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estilo del boton</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {buttonStyles.map(style => (
                        <button
                          key={style.value}
                          className={`btn ${widgetConfig.widget_button_style === style.value ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setWidgetConfig({ ...widgetConfig, widget_button_style: style.value })}
                          style={{ flex: 1, fontSize: '0.85rem' }}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tamano del boton: {widgetConfig.widget_button_size}px</label>
                    <input
                      type="range"
                      min="56"
                      max="80"
                      step="4"
                      value={widgetConfig.widget_button_size}
                      onChange={e => setWidgetConfig({ ...widgetConfig, widget_button_size: parseInt(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )}

              {widgetTab === 'content' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Nombre de marca</label>
                    <input
                      type="text"
                      className="form-input"
                      value={widgetConfig.widget_brand_name}
                      onChange={e => setWidgetConfig({ ...widgetConfig, widget_brand_name: e.target.value })}
                      placeholder="Kova"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Avatar / Emoji</label>
                    <input
                      type="text"
                      className="form-input"
                      value={widgetConfig.widget_avatar}
                      onChange={e => setWidgetConfig({ ...widgetConfig, widget_avatar: e.target.value })}
                      placeholder="🌿"
                      maxLength={4}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mensaje de bienvenida</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={widgetConfig.welcome_message}
                      onChange={e => setWidgetConfig({ ...widgetConfig, welcome_message: e.target.value })}
                      placeholder="Necesitas ayuda para tu compra?"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Subtitulo</label>
                    <input
                      type="text"
                      className="form-input"
                      value={widgetConfig.widget_subtitle}
                      onChange={e => setWidgetConfig({ ...widgetConfig, widget_subtitle: e.target.value })}
                      placeholder="Asistente de compras con IA"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Placeholder del input</label>
                    <input
                      type="text"
                      className="form-input"
                      value={widgetConfig.widget_placeholder}
                      onChange={e => setWidgetConfig({ ...widgetConfig, widget_placeholder: e.target.value })}
                      placeholder="Escribe tu mensaje..."
                    />
                  </div>
                </>
              )}

              {widgetTab === 'features' && (
                <>
                  {[
                    { key: 'widget_show_pulse', label: 'Animacion de pulso', desc: 'Efecto para llamar la atencion' },
                    { key: 'widget_show_promo_message', label: 'Mensaje promocional', desc: 'Junto al boton' },
                    { key: 'widget_show_cart', label: 'Carrito integrado', desc: 'Agregar productos desde el chat' },
                    { key: 'widget_enable_animations', label: 'Animaciones', desc: 'Transiciones y efectos' },
                  ].map(item => (
                    <div className="form-group" key={item.key}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={(widgetConfig as any)[item.key]}
                          onChange={e => setWidgetConfig({ ...widgetConfig, [item.key]: e.target.checked })}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <div>
                          <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{item.label}</span>
                          <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {item.desc}
                          </p>
                        </div>
                      </label>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ShopifyEmbedded;
