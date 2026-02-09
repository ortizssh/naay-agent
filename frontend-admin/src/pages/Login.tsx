import { useState } from 'react';
import { authApi } from '../services/api';
import logoKova from '../img/kova-logo.svg';

interface LoginProps {
  onSuccess: (user: any, token: string) => void;
  onRegisterClick: () => void;
}

export default function Login({ onSuccess, onRegisterClick }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.login(email, password);
      if (response.success && response.token && response.user) {
        onSuccess(response.user, response.token);
      } else {
        setError(response.message || 'Error al iniciar sesion');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src={logoKova} alt="Kova" className="auth-logo-img" />
          <p>Inicia sesion en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contrasena</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Iniciando...' : 'Iniciar Sesion'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            No tienes cuenta?{' '}
            <button type="button" onClick={onRegisterClick} className="auth-link">
              Registrate
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
