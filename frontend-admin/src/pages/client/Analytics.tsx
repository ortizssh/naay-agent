import { useState, useEffect } from 'react';
import { clientApi } from '../../services/api';

interface AnalyticsData {
  conversations: number;
  messages: number;
  products: number;
  recommendations: number;
  conversions: number;
  lastSync: string | null;
  storeCreated: string | null;
}

function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await clientApi.getAnalytics();
      setData(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar estadisticas');
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <div className="page-header-content">
            <div>
              <h1 className="page-title">Estadisticas</h1>
              <p className="page-subtitle">Metricas de uso de tu asistente AI</p>
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
            <h1 className="page-title">Estadisticas</h1>
            <p className="page-subtitle">Metricas de uso de tu asistente AI</p>
          </div>
          <button className="btn btn-primary" onClick={loadAnalytics}>
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
              <div className="alert-message">{error}</div>
            </div>
          </div>
        )}

        {/* Stats Grid - Main Metrics */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="stat-value">{data?.conversations || 0}</div>
            <div className="stat-label">Conversaciones</div>
            <div className="stat-change positive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              </svg>
              {data?.messages || 0} mensajes
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            </div>
            <div className="stat-value">{data?.recommendations || 0}</div>
            <div className="stat-label">Recomendaciones</div>
            <div className="stat-change positive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              </svg>
              Productos sugeridos
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon warning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <div className="stat-value">{data?.conversions || 0}</div>
            <div className="stat-label">Conversiones</div>
            <div className="stat-change positive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              </svg>
              Compras desde chat
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className="stat-value">{data?.products || 0}</div>
            <div className="stat-label">Productos Indexados</div>
            <div className="stat-change positive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              </svg>
              Disponibles para AI
            </div>
          </div>
        </div>

        {/* Conversion Rate Card */}
        {data && data.recommendations > 0 && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Tasa de Conversion</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', background: 'var(--color-bg)', borderRadius: '12px' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                  {((data.conversions / data.recommendations) * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                  Recomendacion a Compra
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', background: 'var(--color-bg)', borderRadius: '12px' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-success)' }}>
                  {data.conversations > 0 ? (data.recommendations / data.conversations).toFixed(1) : 0}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                  Recomendaciones por Conversacion
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', background: 'var(--color-bg)', borderRadius: '12px' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-warning)' }}>
                  {data.conversations > 0 ? (data.messages / data.conversations).toFixed(1) : 0}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                  Mensajes por Conversacion
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Store Info */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Informacion de la Tienda</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                Ultima Sincronizacion
              </div>
              <div style={{ fontWeight: '600' }}>{formatDate(data?.lastSync || null)}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                Tienda Conectada
              </div>
              <div style={{ fontWeight: '600' }}>{formatDate(data?.storeCreated || null)}</div>
            </div>
          </div>
        </div>

        {/* Usage Info */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Uso del Plan</h3>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Mensajes este mes</span>
              <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>-- / 100</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill primary" style={{ width: '0%' }}></div>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            El contador de mensajes se actualizara automaticamente a medida que tu asistente reciba consultas.
          </p>
        </div>
      </div>
    </>
  );
}

export default Analytics;
