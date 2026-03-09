import { useState, useEffect } from 'react';
import './styles/admin.css';
import logoKova from './img/kova-logo.svg';

// Public pages
import Login from './pages/Login';
import Register from './pages/Register';

// Admin pages
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import Settings from './pages/Settings';

// Client pages
import ClientDashboard from './pages/client/ClientDashboard';
import MyStore from './pages/client/MyStore';
import WidgetConfig from './pages/client/WidgetConfig';
import Analytics from './pages/client/Analytics';
import KnowledgeBase from './pages/client/KnowledgeBase';
import Subscription from './pages/client/Subscription';
import AiConfigPage from './pages/client/AiConfigPage';
import VoiceAgent from './pages/client/VoiceAgent';

// Onboarding
import OnboardingWizard from './pages/onboarding/OnboardingWizard';

// Layout
import ClientSidebar from './components/layout/ClientSidebar';

// Shopify Embedded
import ShopifyEmbedded from './pages/ShopifyEmbedded';

type AdminPageType = 'dashboard' | 'tenants' | 'settings';
type ClientPageType = 'dashboard' | 'store' | 'widget' | 'analytics' | 'ai-config' | 'knowledge' | 'voice-agent' | 'subscription';
type PageType = 'login' | 'register' | 'dashboard';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  userType?: 'admin' | 'client';
  onboardingCompleted?: boolean;
  onboardingStep?: number;
}

// Helper to detect Shopify embedded context
function getShopifyEmbedParams(): { shop: string; host: string } | null {
  const params = new URLSearchParams(window.location.search);
  const shop = params.get('shop');
  const host = params.get('host');

  // Check if we're in an iframe (embedded in Shopify)
  const isInIframe = window.self !== window.top;

  if (shop && host && isInIframe) {
    return { shop, host };
  }

  // Also check for shop in path or stored session
  if (shop && host) {
    return { shop, host };
  }

  return null;
}

function App() {
  const [currentAdminPage, setCurrentAdminPage] = useState<AdminPageType>('dashboard');
  const [currentClientPage, setCurrentClientPage] = useState<ClientPageType>('dashboard');
  const [currentPage, setCurrentPage] = useState<PageType>('login');
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shopifyEmbed, setShopifyEmbed] = useState<{ shop: string; host: string } | null>(null);

  const navigateTo = (page: PageType) => {
    setCurrentPage(page);
    const paths: Record<PageType, string> = {
      login: '/login',
      register: '/register',
      dashboard: '/dashboard',
    };
    window.history.pushState({}, '', paths[page]);
  };

  useEffect(() => {
    const initAuth = async () => {
      // Check for Shopify embedded context first
      const embedParams = getShopifyEmbedParams();
      if (embedParams) {
        console.log('Shopify embedded mode detected:', embedParams.shop);
        setShopifyEmbed(embedParams);
        setLoading(false);
        return; // Skip normal auth flow for embedded mode
      }

      // Check current path for routing
      const path = window.location.pathname;
      let initialPage: PageType = 'login';

      if (path === '/register') {
        initialPage = 'register';
      } else if (path === '/login') {
        initialPage = 'login';
      } else if (path.startsWith('/dashboard') || path.startsWith('/client') || path.startsWith('/onboarding')) {
        initialPage = 'dashboard';
      }

      // Check for stored user and validate token
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('auth_token');

      if (storedUser && token) {
        try {
          // Validate token with server
          const { authApi } = await import('./services/api');
          const response = await authApi.getMe();

          if (response.success && response.user) {
            // Token is valid, use fresh user data from server
            const userData = response.user;
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));

            // If user is authenticated and on landing/login/register, go to dashboard
            if (initialPage === 'login' || initialPage === 'register') {
              initialPage = 'dashboard';
              window.history.replaceState({}, '', '/dashboard');
            }

            // Check if client needs onboarding
            if (userData.userType === 'client' && !userData.onboardingCompleted) {
              setShowOnboarding(true);
            }
          } else {
            // Token invalid, clear storage
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            // If trying to access dashboard without auth, redirect to login
            if (initialPage === 'dashboard') {
              initialPage = 'login';
              window.history.replaceState({}, '', '/login');
            }
          }
        } catch (error) {
          // Token validation failed, clear storage
          console.error('Token validation failed:', error);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          if (initialPage === 'dashboard') {
            initialPage = 'login';
            window.history.replaceState({}, '', '/login');
          }
        }
      } else {
        // No token, if trying to access dashboard, redirect to login
        if (initialPage === 'dashboard') {
          initialPage = 'login';
          window.history.replaceState({}, '', '/login');
        }
      }

      setCurrentPage(initialPage);
      setLoading(false);

      // Check URL for oauth callback
      const params = new URLSearchParams(window.location.search);
      if (params.get('oauth') === 'success') {
        setShowOnboarding(true);
      }
    };

    initAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const handleOnboardingComplete = () => {
    // Update user state
    if (user) {
      const updatedUser = { ...user, onboardingCompleted: true, onboardingStep: 4 };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
    setShowOnboarding(false);
  };

  const handleStartOnboarding = () => {
    setShowOnboarding(true);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const handleLoginSuccess = (userData: User, token: string) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    navigateTo('dashboard');

    // Check if client needs onboarding
    if (userData.userType === 'client' && !userData.onboardingCompleted) {
      setShowOnboarding(true);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner"></div>
        <span className="loading-text">Cargando...</span>
      </div>
    );
  }

  // Show Shopify embedded view (no login required)
  if (shopifyEmbed) {
    return <ShopifyEmbedded shop={shopifyEmbed.shop} host={shopifyEmbed.host} />;
  }

  // Show auth pages if not logged in
  if (!user) {
    if (currentPage === 'register') {
      return (
        <Register
          onSuccess={handleLoginSuccess}
          onLoginClick={() => navigateTo('login')}
        />
      );
    }
    return (
      <Login
        onSuccess={handleLoginSuccess}
        onRegisterClick={() => navigateTo('register')}
      />
    );
  }

  // Show onboarding for clients
  if (showOnboarding && user?.userType === 'client') {
    return (
      <OnboardingWizard
        initialStep={user.onboardingStep || 0}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  // Render client view
  if (user?.userType === 'client') {
    const renderClientPage = () => {
      switch (currentClientPage) {
        case 'dashboard':
          return <ClientDashboard onStartOnboarding={handleStartOnboarding} onPageChange={(page) => setCurrentClientPage(page as ClientPageType)} />;
        case 'store':
          return <MyStore onStartOnboarding={handleStartOnboarding} />;
        case 'widget':
          return <WidgetConfig onStartOnboarding={handleStartOnboarding} onPageChange={(page) => setCurrentClientPage(page as ClientPageType)} />;
        case 'analytics':
          return <Analytics onPageChange={(page) => setCurrentClientPage(page as ClientPageType)} />;
        case 'ai-config':
          return <AiConfigPage />;
        case 'knowledge':
          return <KnowledgeBase />;
        case 'voice-agent':
          return <VoiceAgent />;
        case 'subscription':
          return <Subscription />;
        default:
          return <ClientDashboard onStartOnboarding={handleStartOnboarding} onPageChange={(page) => setCurrentClientPage(page as ClientPageType)} />;
      }
    };

    return (
      <div className="admin-layout">
        <ClientSidebar
          currentPage={currentClientPage}
          onPageChange={(page) => setCurrentClientPage(page as ClientPageType)}
          user={user}
          onLogout={handleLogout}
        />
        <main className="main-content">
          {renderClientPage()}
        </main>
      </div>
    );
  }

  // Render admin view (default)
  const renderAdminPage = () => {
    switch (currentAdminPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'tenants':
        return <Tenants />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <a href="/" className="sidebar-logo">
            <img src={logoKova} alt="Kova" className="sidebar-logo-img" />
          </a>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Menu</div>
            <button
              className={`nav-item ${currentAdminPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentAdminPage('dashboard')}
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
              className={`nav-item ${currentAdminPage === 'tenants' ? 'active' : ''}`}
              onClick={() => setCurrentAdminPage('tenants')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Clientes
            </button>
            <button
              className={`nav-item ${currentAdminPage === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentAdminPage('settings')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Configuración
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
                {user?.email || 'admin@kova.ai'}
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Cerrar sesión">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {renderAdminPage()}
      </main>
    </div>
  );
}

export default App;
