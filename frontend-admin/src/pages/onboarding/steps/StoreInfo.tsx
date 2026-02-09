import { useState, useEffect } from 'react';
import { clientApi } from '../../../services/api';

interface StoreInfoProps {
  onBack: () => void;
  onNext: () => void;
}

function StoreInfo({ onBack, onNext }: StoreInfoProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [brandName, setBrandName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');

  useEffect(() => {
    loadStoreInfo();
  }, []);

  const loadStoreInfo = async () => {
    try {
      const response = await clientApi.getStoreInfo();
      if (response.data) {
        setStoreInfo(response.data);
        setBrandName(response.data.widget_brand_name || response.data.shop_name || '');
        setSupportEmail(response.data.shop_email || '');
      }
    } catch (error) {
      console.error('Error loading store info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      await clientApi.updateStoreInfo({ brandName, supportEmail });
      await clientApi.updateOnboardingStep(2, { brandName, supportEmail });
      onNext();
    } catch (error) {
      console.error('Error saving store info:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="loading-spinner" style={{ width: '32px', height: '32px', margin: '0 auto 1rem' }}></div>
        <p style={{ color: 'var(--color-text-secondary)' }}>Cargando datos de tu tienda...</p>
      </div>
    );
  }

  return (
    <>
      <h2 className="onboarding-title">Datos de tu tienda</h2>
      <p className="onboarding-subtitle">
        Obtuvimos esta informacion de tu tienda automaticamente
      </p>

      {storeInfo && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {storeInfo.shop_name && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Tienda</span>
                <span style={{ fontWeight: '500' }}>{storeInfo.shop_name}</span>
              </div>
            )}
            {storeInfo.shop_email && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Email</span>
                <span style={{ fontWeight: '500' }}>{storeInfo.shop_email}</span>
              </div>
            )}
            {storeInfo.shop_currency && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Moneda</span>
                <span style={{ fontWeight: '500' }}>{storeInfo.shop_currency}</span>
              </div>
            )}
            {storeInfo.shop_country && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Pais</span>
                <span style={{ fontWeight: '500' }}>{storeInfo.shop_country}</span>
              </div>
            )}
            {storeInfo.shop_timezone && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Zona horaria</span>
                <span style={{ fontWeight: '500' }}>{storeInfo.shop_timezone}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label className="form-label">Nombre de marca</label>
          <input
            type="text"
            className="form-input"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Nombre que se mostrara en el widget"
          />
          <div className="form-hint">
            Este nombre aparecera como titulo del chat widget
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Email de soporte</label>
          <input
            type="email"
            className="form-input"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="soporte@tutienda.com"
          />
          <div className="form-hint">
            Email de contacto para tus clientes
          </div>
        </div>
      </div>

      <div className="onboarding-nav">
        <button className="btn btn-secondary" onClick={onBack} disabled={saving}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Atras
        </button>
        <button className="btn btn-primary" onClick={handleNext} disabled={saving}>
          {saving ? (
            <>
              <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
              Guardando...
            </>
          ) : (
            <>
              Continuar
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </>
          )}
        </button>
      </div>
    </>
  );
}

export default StoreInfo;
