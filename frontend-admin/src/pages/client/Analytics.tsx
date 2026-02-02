import { useState, useEffect, useMemo } from 'react';
import { clientApi, ConversionDashboardData } from '../../services/api';

function Analytics() {
  const [data, setData] = useState<ConversionDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    loadConversionDashboard();
  }, [days]);

  const loadConversionDashboard = async () => {
    try {
      setLoading(true);
      const response = await clientApi.getConversionDashboard(days);
      setData(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar conversiones');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours < 24) {
      return `${hours}h ${mins}m`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const maxChartValue = useMemo(() => {
    if (!data?.timeline?.length) return 1;
    const maxConversions = Math.max(...data.timeline.map(d => d.conversions), 1);
    const maxRecommendations = Math.max(...data.timeline.map(d => d.recommendations), 1);
    return Math.max(maxConversions, maxRecommendations);
  }, [data?.timeline]);

  const getChangeIndicator = (change: number, isPercentage: boolean = false) => {
    if (change === 0) return { icon: '−', class: 'neutral', text: isPercentage ? '0%' : '0' };
    if (change > 0) return {
      icon: '↑',
      class: 'positive',
      text: isPercentage ? `+${change.toFixed(1)}%` : `+${change}`
    };
    return {
      icon: '↓',
      class: 'negative',
      text: isPercentage ? `${change.toFixed(1)}%` : `${change}`
    };
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <div className="page-header-content">
            <div>
              <h1 className="page-title">Conversiones</h1>
              <p className="page-subtitle">Seguimiento de ventas atribuidas a tu asistente AI</p>
            </div>
          </div>
        </header>
        <div className="page-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Cargando datos de conversiones...</span>
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
            <h1 className="page-title">Conversiones</h1>
            <p className="page-subtitle">Seguimiento de ventas atribuidas a tu asistente AI</p>
          </div>
          <button className="btn btn-primary" onClick={loadConversionDashboard}>
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

        {/* Period Filter */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginRight: '0.5rem' }}>
              Periodo:
            </span>
            {[7, 14, 30, 90].map((period) => (
              <button
                key={period}
                className={`btn ${days === period ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDays(period)}
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                {period} dias
              </button>
            ))}
          </div>
        </div>

        {/* Overview Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            </div>
            <div className="stat-value">{data?.overview?.totalRecommendations || 0}</div>
            <div className="stat-label">Recomendaciones</div>
            <div className="stat-change positive">
              Productos sugeridos por AI
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <div className="stat-value">{data?.overview?.totalConversions || 0}</div>
            <div className="stat-label">Conversiones</div>
            <div className="stat-change positive">
              Compras atribuidas al chat
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon warning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div className="stat-value">{formatCurrency(data?.overview?.totalRevenue || 0)}</div>
            <div className="stat-label">Ingresos Atribuidos</div>
            <div className="stat-change positive">
              Ventas desde recomendaciones
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="stat-value">{(data?.overview?.conversionRate || 0).toFixed(1)}%</div>
            <div className="stat-label">Tasa de Conversion</div>
            <div className="stat-change positive">
              Recomendacion a compra
            </div>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)' }}>
                  {formatCurrency(data?.overview?.averageOrderValue || 0)}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Ticket Promedio
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)' }}>
                  {formatMinutes(data?.overview?.averageTimeToConversion || 0)}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Tiempo Promedio a Conversion
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Conversiones por Dia</h3>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--color-primary)' }}></span>
                Recomendaciones
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#10b981' }}></span>
                Conversiones
              </span>
            </div>
          </div>
          {data?.timeline && data.timeline.length > 0 ? (
            <div style={{ padding: '1rem 0' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '4px',
                  height: '200px',
                  padding: '0 0.5rem',
                }}
              >
                {data.timeline.map((item) => (
                  <div
                    key={item.date}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end',
                      gap: '2px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '150px' }}>
                      {/* Recommendations bar */}
                      <div
                        style={{
                          width: '16px',
                          height: `${Math.max((item.recommendations / maxChartValue) * 140, 4)}px`,
                          background: item.recommendations > 0
                            ? 'var(--color-primary)'
                            : 'var(--color-border)',
                          borderRadius: '2px 2px 0 0',
                          transition: 'height 0.3s ease',
                          opacity: 0.7,
                        }}
                        title={`${item.recommendations} recomendaciones`}
                      />
                      {/* Conversions bar */}
                      <div
                        style={{
                          width: '16px',
                          height: `${Math.max((item.conversions / maxChartValue) * 140, 4)}px`,
                          background: item.conversions > 0
                            ? '#10b981'
                            : 'var(--color-border)',
                          borderRadius: '2px 2px 0 0',
                          transition: 'height 0.3s ease',
                        }}
                        title={`${item.conversions} conversiones`}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: 'var(--color-text-muted)',
                        marginTop: '4px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(item.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem',
                color: 'var(--color-text-muted)',
              }}
            >
              No hay datos de conversiones para el periodo seleccionado
            </div>
          )}
        </div>

        {/* Attribution Breakdown & Period Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
          {/* Attribution Breakdown */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Atribucion por Tiempo</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                <div style={{
                  width: '10px',
                  height: '40px',
                  borderRadius: '4px',
                  background: '#10b981',
                }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Directa (0-30 min)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {data?.attributionBreakdown?.direct?.count || 0} conversiones
                  </div>
                </div>
                <div style={{ fontWeight: '700', color: '#10b981' }}>
                  {formatCurrency(data?.attributionBreakdown?.direct?.revenue || 0)}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                <div style={{
                  width: '10px',
                  height: '40px',
                  borderRadius: '4px',
                  background: '#f59e0b',
                }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Asistida (30min - 24h)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {data?.attributionBreakdown?.assisted?.count || 0} conversiones
                  </div>
                </div>
                <div style={{ fontWeight: '700', color: '#f59e0b' }}>
                  {formatCurrency(data?.attributionBreakdown?.assisted?.revenue || 0)}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                <div style={{
                  width: '10px',
                  height: '40px',
                  borderRadius: '4px',
                  background: '#6366f1',
                }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>View-Through (24h - 7d)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {data?.attributionBreakdown?.viewThrough?.count || 0} conversiones
                  </div>
                </div>
                <div style={{ fontWeight: '700', color: '#6366f1' }}>
                  {formatCurrency(data?.attributionBreakdown?.viewThrough?.revenue || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Period Comparison */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Comparacion vs Periodo Anterior</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Conversions comparison */}
              <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Conversiones</span>
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: (data?.periodComparison?.change?.conversions || 0) >= 0 ? '#10b981' : '#ef4444',
                  }}>
                    {getChangeIndicator(data?.periodComparison?.change?.conversions || 0).text}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <span style={{ fontWeight: '700', fontSize: '1.25rem' }}>
                    {data?.periodComparison?.currentPeriod?.conversions || 0}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    vs {data?.periodComparison?.previousPeriod?.conversions || 0}
                  </span>
                </div>
              </div>

              {/* Revenue comparison */}
              <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Ingresos</span>
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: (data?.periodComparison?.change?.revenue || 0) >= 0 ? '#10b981' : '#ef4444',
                  }}>
                    {(data?.periodComparison?.change?.revenue || 0) >= 0 ? '+' : ''}{formatCurrency(data?.periodComparison?.change?.revenue || 0)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <span style={{ fontWeight: '700', fontSize: '1.25rem' }}>
                    {formatCurrency(data?.periodComparison?.currentPeriod?.revenue || 0)}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    vs {formatCurrency(data?.periodComparison?.previousPeriod?.revenue || 0)}
                  </span>
                </div>
              </div>

              {/* Rate comparison */}
              <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Tasa de Conversion</span>
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: (data?.periodComparison?.change?.rate || 0) >= 0 ? '#10b981' : '#ef4444',
                  }}>
                    {getChangeIndicator(data?.periodComparison?.change?.rate || 0, true).text}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <span style={{ fontWeight: '700', fontSize: '1.25rem' }}>
                    {(data?.periodComparison?.currentPeriod?.rate || 0).toFixed(1)}%
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    vs {(data?.periodComparison?.previousPeriod?.rate || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Products */}
        {data?.topProducts && data.topProducts.length > 0 && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Productos con Mayor Conversion</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>
                      Producto
                    </th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>
                      Recomendaciones
                    </th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>
                      Conversiones
                    </th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>
                      Tasa
                    </th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>
                      Ingresos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((product, index) => (
                    <tr key={product.productId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: 'var(--color-primary)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                          }}>
                            {index + 1}
                          </span>
                          <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>
                            {product.productTitle}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        {product.recommendations}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          background: '#dcfce7',
                          color: '#166534',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                        }}>
                          {product.conversions}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600' }}>
                        {product.conversionRate.toFixed(1)}%
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                        {formatCurrency(product.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {data?.recentActivity && data.recentActivity.length > 0 && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Actividad Reciente</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {data.recentActivity.slice(0, 10).map((activity, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem',
                    background: 'var(--color-bg)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: activity.type === 'conversion'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark, var(--color-primary)) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {activity.type === 'conversion' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>
                      {activity.type === 'conversion' ? 'Conversion' : 'Recomendacion'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {activity.productTitle}
                    </div>
                  </div>
                  {activity.type === 'conversion' && activity.amount && (
                    <div style={{ fontWeight: '700', color: '#10b981' }}>
                      {formatCurrency(activity.amount)}
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(activity.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!data?.overview?.totalRecommendations && !loading && (
          <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center', padding: '3rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--color-bg)',
              margin: '0 auto 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-text)' }}>Sin datos de conversiones</h3>
            <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>
              Cuando el asistente AI haga recomendaciones de productos y los clientes realicen compras, veras los datos de conversion aqui.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default Analytics;
