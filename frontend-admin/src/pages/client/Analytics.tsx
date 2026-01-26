import { useState, useEffect } from 'react';
import { clientApi } from '../../services/api';

interface AnalyticsData {
  conversations: number;
  products: number;
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

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="stat-value">{data?.conversations || 0}</div>
            <div className="stat-label">Conversaciones Totales</div>
            <div className="stat-change positive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              </svg>
              Historico
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon success">
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

          <div className="stat-card">
            <div className="stat-icon warning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="stat-value" style={{ fontSize: '1rem' }}>{formatDate(data?.lastSync || null)}</div>
            <div className="stat-label">Ultima Sincronizacion</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="stat-value" style={{ fontSize: '1rem' }}>{formatDate(data?.storeCreated || null)}</div>
            <div className="stat-label">Tienda Conectada</div>
          </div>
        </div>

        {/* Coming Soon Features */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Metricas Avanzadas</h3>
            <span className="badge badge-primary">Proximamente</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'var(--color-bg)', borderRadius: '12px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" style={{ margin: '0 auto 1rem' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Tasa de Conversion</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Mide cuantas conversaciones terminan en compra
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'var(--color-bg)', borderRadius: '12px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" style={{ margin: '0 auto 1rem' }}>
                <path d="M12 20V10M18 20V4M6 20v-4" />
              </svg>
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Engagement Score</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Analiza la calidad de las interacciones
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'var(--color-bg)', borderRadius: '12px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" style={{ margin: '0 auto 1rem' }}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Productos Populares</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Descubre que productos preguntan mas
              </div>
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
