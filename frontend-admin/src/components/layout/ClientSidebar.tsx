import logoKova from '../../img/kova-logo.svg';

interface ClientSidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  onLogout: () => void;
}

function ClientSidebar({ currentPage, onPageChange, user, onLogout }: ClientSidebarProps) {
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <a href="/" className="sidebar-logo">
          <img src={logoKova} alt="Kova" className="sidebar-logo-img" />
        </a>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Menu</div>
          <button
            className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => onPageChange('dashboard')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            Dashboard
          </button>
          <button
            className={`nav-item ${currentPage === 'store' ? 'active' : ''}`}
            onClick={() => onPageChange('store')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Mi Tienda
          </button>
          <button
            className={`nav-item ${currentPage === 'widget' ? 'active' : ''}`}
            onClick={() => onPageChange('widget')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Widget
          </button>
          <button
            className={`nav-item ${currentPage === 'analytics' ? 'active' : ''}`}
            onClick={() => onPageChange('analytics')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Conversiones
          </button>
          <button
            className={`nav-item ${currentPage === 'ai-config' ? 'active' : ''}`}
            onClick={() => onPageChange('ai-config')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
              <circle cx="12" cy="15" r="2" />
            </svg>
            Configuración IA
          </button>
          <button
            className={`nav-item ${currentPage === 'knowledge' ? 'active' : ''}`}
            onClick={() => onPageChange('knowledge')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Knowledge Base
          </button>
          <button
            className={`nav-item ${currentPage === 'voice-agent' ? 'active' : ''}`}
            onClick={() => onPageChange('voice-agent')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Voice Agent
          </button>
          <button
            className={`nav-item ${currentPage === 'subscription' ? 'active' : ''}`}
            onClick={() => onPageChange('subscription')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            Suscripción
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Ayuda</div>
          <button className="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Documentación
          </button>
          <button className="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Soporte
          </button>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user ? getInitials(user.firstName, user.lastName) : 'U'}
          </div>
          <div className="user-details">
            <div className="user-name">
              {user ? `${user.firstName} ${user.lastName}` : 'Usuario'}
            </div>
            <div className="user-email">
              {user?.email || 'user@example.com'}
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Cerrar sesión">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default ClientSidebar;
