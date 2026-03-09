import { useState } from 'react';
import { authApi } from '../services/api';
import logoKova from '../img/kova-logo.svg';

interface RegisterProps {
  onSuccess: (user: any, token: string) => void;
  onLoginClick: () => void;
}

export default function Register({ onSuccess, onLoginClick }: RegisterProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    company: '',
    userType: 'client' as 'admin' | 'client',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        company: formData.company,
        userType: formData.userType,
      });

      if (response.success && response.token && response.user) {
        onSuccess(response.user, response.token);
      } else {
        setError(response.message || 'Error al crear cuenta');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <img src={logoKova} alt="Kova" className="auth-logo-img" />
          <p>Crea tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">Nombre</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Tu nombre"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Apellido</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Tu apellido"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="company">Empresa (opcional)</label>
            <input
              type="text"
              id="company"
              name="company"
              value={formData.company}
              onChange={handleChange}
              placeholder="Nombre de tu empresa"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="********"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar Contraseña</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="********"
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Ya tienes cuenta?{' '}
            <button type="button" onClick={onLoginClick} className="auth-link">
              Inicia Sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
