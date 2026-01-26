import { useState, useEffect } from 'react';
import { api, Tenant, TenantPlan, TenantStatus } from '../services/api';

function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    shop_domain: '',
    shop_name: '',
    shop_email: '',
    plan: 'starter' as TenantPlan,
    access_token: '',
  });

  useEffect(() => {
    loadTenants();
  }, [page]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const result = await api.getTenants({ page, limit: pageSize });
      setTenants(result.tenants);
      setTotalPages(Math.ceil(result.total / pageSize));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    try {
      await api.createTenant({
        shop_domain: formData.shop_domain,
        shop_name: formData.shop_name,
        shop_email: formData.shop_email,
        plan: formData.plan,
        access_token: formData.access_token,
      });
      setShowCreateModal(false);
      resetForm();
      loadTenants();
    } catch (err: any) {
      setError(err.message || 'Error al crear cliente');
    }
  };

  const handleUpdateTenant = async () => {
    if (!selectedTenant) return;
    try {
      await api.updateTenant(selectedTenant.shop_domain, {
        plan: formData.plan,
        shop_name: formData.shop_name,
        shop_email: formData.shop_email,
      });
      setShowEditModal(false);
      setSelectedTenant(null);
      resetForm();
      loadTenants();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar cliente');
    }
  };

  const handleSuspendTenant = async (shopDomain: string) => {
    if (!confirm('Seguro que deseas suspender este cliente?')) return;
    try {
      await api.updateTenantStatus(shopDomain, 'suspended');
      loadTenants();
    } catch (err: any) {
      setError(err.message || 'Error al suspender cliente');
    }
  };

  const handleActivateTenant = async (shopDomain: string) => {
    try {
      await api.updateTenantStatus(shopDomain, 'active');
      loadTenants();
    } catch (err: any) {
      setError(err.message || 'Error al activar cliente');
    }
  };

  const resetForm = () => {
    setFormData({
      shop_domain: '',
      shop_name: '',
      shop_email: '',
      plan: 'starter',
      access_token: '',
    });
  };

  const openEditModal = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      shop_domain: tenant.shop_domain,
      shop_name: tenant.shop_name || '',
      shop_email: tenant.shop_email || '',
      plan: tenant.plan,
      access_token: '',
    });
    setShowEditModal(true);
  };

  const getPlanBadge = (plan: TenantPlan) => {
    const badges: Record<TenantPlan, string> = {
      free: 'badge-neutral',
      starter: 'badge-primary',
      professional: 'badge-success',
      enterprise: 'badge-warning',
    };
    const labels: Record<TenantPlan, string> = {
      free: 'Free',
      starter: 'Starter',
      professional: 'Professional',
      enterprise: 'Enterprise',
    };
    return <span className={`badge ${badges[plan]}`}>{labels[plan]}</span>;
  };

  const getStatusBadge = (status: TenantStatus) => {
    const badges: Record<TenantStatus, string> = {
      active: 'badge-success',
      trial: 'badge-warning',
      suspended: 'badge-error',
      cancelled: 'badge-neutral',
    };
    const labels: Record<TenantStatus, string> = {
      active: 'Activo',
      trial: 'Prueba',
      suspended: 'Suspendido',
      cancelled: 'Cancelado',
    };
    return <span className={`badge ${badges[status]}`}>{labels[status]}</span>;
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  const getProgressColor = (percentage: number) => {
    if (percentage > 80) return 'error';
    if (percentage > 60) return 'warning';
    return 'primary';
  };

  return (
    <>
      <header className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">Clientes</h1>
            <p className="page-subtitle">Gestiona los clientes de tu plataforma</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Agregar Cliente
          </button>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="alert alert-error">
            <svg className="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="alert-content">
              <div className="alert-message">{error}</div>
            </div>
          </div>
        )}

        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">Lista de Clientes</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {tenants.length} clientes
            </span>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <span className="loading-text">Cargando clientes...</span>
            </div>
          ) : tenants.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="empty-state-title">No hay clientes</h3>
              <p className="empty-state-description">Agrega tu primer cliente para comenzar</p>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                Agregar primer cliente
              </button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tienda</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Uso Mensajes</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => {
                  const usagePercent = getUsagePercentage(
                    tenant.monthly_messages_used,
                    tenant.monthly_messages_limit
                  );
                  return (
                    <tr key={tenant.id}>
                      <td>
                        <div className="table-cell-main">{tenant.shop_domain}</div>
                        {tenant.shop_name && tenant.shop_name !== tenant.shop_domain && (
                          <div className="table-cell-sub">{tenant.shop_name}</div>
                        )}
                      </td>
                      <td>{getPlanBadge(tenant.plan)}</td>
                      <td>{getStatusBadge(tenant.status)}</td>
                      <td>
                        <div style={{ minWidth: '120px' }}>
                          <div style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                            {tenant.monthly_messages_used.toLocaleString()} /{' '}
                            {tenant.monthly_messages_limit === -1
                              ? '∞'
                              : tenant.monthly_messages_limit.toLocaleString()}
                          </div>
                          <div className="progress-bar">
                            <div
                              className={`progress-bar-fill ${getProgressColor(usagePercent)}`}
                              style={{ width: `${usagePercent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                          {new Date(tenant.created_at).toLocaleDateString('es-ES')}
                        </span>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditModal(tenant)}
                          >
                            Editar
                          </button>
                          {tenant.status === 'active' || tenant.status === 'trial' ? (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleSuspendTenant(tenant.shop_domain)}
                            >
                              Suspender
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleActivateTenant(tenant.shop_domain)}
                            >
                              Activar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </button>
              <span style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                Pagina {page} de {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Agregar Nuevo Cliente</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Dominio de Shopify</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="tienda.myshopify.com"
                  value={formData.shop_domain}
                  onChange={(e) => setFormData({ ...formData, shop_domain: e.target.value })}
                />
                <p className="form-hint">El dominio .myshopify.com de la tienda</p>
              </div>
              <div className="form-group">
                <label className="form-label">Access Token</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="shpat_xxxxx"
                  value={formData.access_token}
                  onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                />
                <p className="form-hint">Token de acceso de la app instalada</p>
              </div>
              <div className="form-group">
                <label className="form-label">Nombre de la Tienda (opcional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Mi Tienda"
                  value={formData.shop_name}
                  onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email (opcional)</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="contacto@tienda.com"
                  value={formData.shop_email}
                  onChange={(e) => setFormData({ ...formData, shop_email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Plan</label>
                <select
                  className="form-select"
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value as TenantPlan })}
                >
                  <option value="free">Free - 100 msgs/mes</option>
                  <option value="starter">Starter - 1,000 msgs/mes</option>
                  <option value="professional">Professional - 10,000 msgs/mes</option>
                  <option value="enterprise">Enterprise - Ilimitado</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleCreateTenant}>
                Crear Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTenant && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Editar: {selectedTenant.shop_domain}</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre de la Tienda</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.shop_name}
                  onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.shop_email}
                  onChange={(e) => setFormData({ ...formData, shop_email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Plan</label>
                <select
                  className="form-select"
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value as TenantPlan })}
                >
                  <option value="free">Free - 100 msgs/mes</option>
                  <option value="starter">Starter - 1,000 msgs/mes</option>
                  <option value="professional">Professional - 10,000 msgs/mes</option>
                  <option value="enterprise">Enterprise - Ilimitado</option>
                </select>
              </div>
              <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: '10px', marginTop: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Uso actual: {selectedTenant.monthly_messages_used.toLocaleString()} /{' '}
                  {selectedTenant.monthly_messages_limit === -1
                    ? 'Ilimitado'
                    : selectedTenant.monthly_messages_limit.toLocaleString()}{' '}
                  mensajes
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                  Creado: {new Date(selectedTenant.created_at).toLocaleDateString('es-ES')}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowEditModal(false); setSelectedTenant(null); resetForm(); }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleUpdateTenant}>
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Tenants;
