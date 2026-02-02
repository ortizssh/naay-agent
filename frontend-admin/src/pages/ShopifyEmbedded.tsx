import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import logoKova from '../img/logo-kova.png';

interface ShopifyEmbeddedProps {
  shop: string;
  host: string;
}

interface ChartDataByDay {
  date: string;
  conversations: number;
  recommendations: number;
  conversions: number;
}

interface AnalyticsData {
  conversations: number;
  messages: number;
  products: number;
  recommendations: number;
  conversions: number;
  lastSync: string | null;
  storeCreated: string | null;
  conversationsByDay?: ChartDataByDay[];
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
  welcome_message_2: string;
  subtitle_2: string;
  welcome_message_3: string;
  subtitle_3: string;
  rotating_messages_enabled: boolean;
  rotating_messages_interval: number;
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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatConversation {
  sessionId: string;
  startedAt: string;
  messages: ChatMessage[];
}

interface ConversationsData {
  conversations: ChatConversation[];
  totalConversations: number;
  totalMessages: number;
  date: string;
  availableDates: string[];
}

interface ConversionDashboardData {
  overview: {
    totalRecommendations: number;
    totalConversions: number;
    conversionRate: number;
    totalRevenue: number;
    averageOrderValue: number;
    averageTimeToConversion: number;
  };
  timeline: Array<{
    date: string;
    recommendations: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
  }>;
  topProducts: Array<{
    productId: string;
    productTitle: string;
    recommendations: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
  }>;
  recentActivity: Array<{
    type: 'recommendation' | 'conversion';
    timestamp: string;
    productTitle: string;
    sessionId: string;
    amount?: number;
  }>;
  attributionBreakdown: {
    direct: { count: number; revenue: number };
    assisted: { count: number; revenue: number };
    viewThrough: { count: number; revenue: number };
  };
  periodComparison: {
    currentPeriod: { conversions: number; revenue: number; rate: number };
    previousPeriod: { conversions: number; revenue: number; rate: number };
    change: { conversions: number; revenue: number; rate: number };
  };
}

type TabType = 'dashboard' | 'analytics' | 'widget' | 'conversations';
type DatePreset = 'today' | 'yesterday' | '3d' | '7d' | '14d' | '30d' | 'thisWeek' | 'thisMonth' | 'custom';

// Helper functions for date calculations
const getDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPresetDates = (preset: DatePreset): { start: string; end: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = getDateString(today);

  switch (preset) {
    case 'today':
      return { start: todayStr, end: todayStr };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getDateString(yesterday);
      return { start: yesterdayStr, end: yesterdayStr };
    }
    case '3d': {
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
      return { start: getDateString(threeDaysAgo), end: todayStr };
    }
    case '7d': {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      return { start: getDateString(sevenDaysAgo), end: todayStr };
    }
    case '14d': {
      const fourteenDaysAgo = new Date(today);
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
      return { start: getDateString(fourteenDaysAgo), end: todayStr };
    }
    case '30d': {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      return { start: getDateString(thirtyDaysAgo), end: todayStr };
    }
    case 'thisWeek': {
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      return { start: getDateString(monday), end: todayStr };
    }
    case 'thisMonth': {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: getDateString(firstOfMonth), end: todayStr };
    }
    default:
      return { start: todayStr, end: todayStr };
  }
};

// Helper function to parse and render product recommendations from message content
interface ProductRecommendation {
  id: number;
  title: string;
  image?: { src: string };
  price: number;
  handle: string;
  variant_id?: number;
}

const parseProductRecommendations = (content: string): { text: string; products: ProductRecommendation[] } => {
  // Try to find JSON in the content that contains product recommendations
  const jsonMatch = content.match(/\{\s*"output"\s*:\s*\[[\s\S]*?\]\s*\}/);

  if (!jsonMatch) {
    return { text: content, products: [] };
  }

  try {
    const jsonData = JSON.parse(jsonMatch[0]);
    const products: ProductRecommendation[] = [];

    if (jsonData.output && Array.isArray(jsonData.output)) {
      for (const item of jsonData.output) {
        if (item.product) {
          products.push(item.product);
        }
      }
    }

    // Get the text before the JSON
    const textBeforeJson = content.substring(0, content.indexOf(jsonMatch[0])).trim();

    return { text: textBeforeJson, products };
  } catch {
    return { text: content, products: [] };
  }
};

const formatPrice = (price: number): string => {
  // Price comes in cents, convert to currency format
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(price);
};

const ProductCard = ({ product }: { product: ProductRecommendation }) => (
  <div style={{
    display: 'flex',
    gap: '0.75rem',
    padding: '0.75rem',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e5e5',
    marginTop: '0.5rem',
    maxWidth: '300px',
  }}>
    {product.image?.src && (
      <img
        src={product.image.src}
        alt={product.title}
        style={{
          width: '60px',
          height: '60px',
          objectFit: 'cover',
          borderRadius: '8px',
          flexShrink: 0,
        }}
      />
    )}
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '0.25rem',
      overflow: 'hidden',
    }}>
      <div style={{
        fontSize: '0.85rem',
        fontWeight: 500,
        color: '#333',
        lineHeight: 1.3,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {product.title}
      </div>
      <div style={{
        fontSize: '0.9rem',
        fontWeight: 600,
        color: 'var(--color-primary)',
      }}>
        {formatPrice(product.price)}
      </div>
    </div>
  </div>
);

const MessageContent = ({ content, role }: { content: string; role: string }) => {
  const { text, products } = parseProductRecommendations(content);

  return (
    <>
      {text && <div>{text}</div>}
      {products.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          marginTop: text ? '0.5rem' : 0,
        }}>
          {products.map((product, idx) => (
            <ProductCard key={product.id || idx} product={product} />
          ))}
        </div>
      )}
    </>
  );
};

function ShopifyEmbedded({ shop, host: _host }: ShopifyEmbeddedProps) {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [store, setStore] = useState<StoreData | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>({
    widget_position: 'bottom-right',
    widget_color: '#a59457',
    welcome_message: '',
    welcome_message_2: '',
    subtitle_2: '',
    welcome_message_3: '',
    subtitle_3: '',
    rotating_messages_enabled: false,
    rotating_messages_interval: 5,
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

  // Conversations state
  const [conversationsData, setConversationsData] = useState<ConversationsData | null>(null);
  const [conversationsDate, setConversationsDate] = useState(getDateString(new Date()));
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [expandedConversation, setExpandedConversation] = useState<string | null>(null);

  // Conversion dashboard state
  const [conversionDashboard, setConversionDashboard] = useState<ConversionDashboardData | null>(null);
  const [conversionDays, setConversionDays] = useState(7);
  const [conversionLoading, setConversionLoading] = useState(false);

  // Date filter state - optimized
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('7d');
  const initialDates = getPresetDates('7d');
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [pendingFilter, setPendingFilter] = useState(false);

  // Get API URL - for embedded Shopify context, we need the app URL, not the iframe origin
  const getApiUrl = useCallback(() => {
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
  }, []);

  // Apply preset filter
  const applyPreset = useCallback((preset: DatePreset) => {
    const dates = getPresetDates(preset);
    setSelectedPreset(preset);
    setStartDate(dates.start);
    setEndDate(dates.end);
    setPendingFilter(false);
  }, []);

  // Handle custom date changes - no auto-apply, requires button click
  const handleCustomDateChange = useCallback((type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
    setSelectedPreset('custom');
    setPendingFilter(true); // Mark as pending until user clicks Apply
  }, []);

  // Apply custom date filter
  const applyCustomFilter = useCallback(() => {
    setPendingFilter(false); // This triggers the loadData effect
  }, []);

  // Load data function
  const loadData = useCallback(async (showFullLoading = true) => {
    try {
      if (showFullLoading) {
        setLoading(true);
      } else {
        setIsFilterLoading(true);
      }
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
      setIsFilterLoading(false);
    }
  }, [shop, startDate, endDate, getApiUrl]);

  // Initial load and filter change effect
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isInitialLoad.current) {
      // Initial load
      isInitialLoad.current = false;
      loadData(true);
    } else if (!pendingFilter) {
      // Filter change - use lighter loading indicator
      loadData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, startDate, endDate, pendingFilter]);

  // Widget config load
  useEffect(() => {
    if (currentTab === 'widget') {
      loadWidgetConfig();
    }
  }, [currentTab, shop]);

  // Conversations load
  useEffect(() => {
    if (currentTab === 'conversations') {
      loadConversations(conversationsDate);
    }
  }, [currentTab, conversationsDate, shop]);

  // Conversion dashboard load
  useEffect(() => {
    if (currentTab === 'analytics') {
      loadConversionDashboard();
    }
  }, [currentTab, conversionDays, shop]);

  // Load conversations function
  const loadConversations = async (date: string) => {
    try {
      setConversationsLoading(true);
      const apiUrl = getApiUrl();
      const res = await fetch(
        `${apiUrl}/api/shopify/embedded/conversations?shop=${encodeURIComponent(shop)}&date=${date}`
      );

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setConversationsData(data.data);
        }
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setConversationsLoading(false);
    }
  };

  // Load conversion dashboard function
  const loadConversionDashboard = async () => {
    try {
      setConversionLoading(true);
      const apiUrl = getApiUrl();
      const res = await fetch(
        `${apiUrl}/api/shopify/embedded/conversions/dashboard?shop=${encodeURIComponent(shop)}&days=${conversionDays}`
      );

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setConversionDashboard(data.data);
        }
      }
    } catch (err) {
      console.error('Error loading conversion dashboard:', err);
    } finally {
      setConversionLoading(false);
    }
  };

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format time helper
  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
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
            welcome_message_2: data.data.greeting2 || prev.welcome_message_2,
            subtitle_2: data.data.subtitle2 || prev.subtitle_2,
            welcome_message_3: data.data.greeting3 || prev.welcome_message_3,
            subtitle_3: data.data.subtitle3 || prev.subtitle_3,
            rotating_messages_enabled: data.data.rotatingMessagesEnabled ?? prev.rotating_messages_enabled,
            rotating_messages_interval: data.data.rotatingMessagesInterval || prev.rotating_messages_interval,
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
            welcomeMessage2: widgetConfig.welcome_message_2,
            subtitle2: widgetConfig.subtitle_2,
            welcomeMessage3: widgetConfig.welcome_message_3,
            subtitle3: widgetConfig.subtitle_3,
            rotatingMessagesEnabled: widgetConfig.rotating_messages_enabled,
            rotatingMessagesInterval: widgetConfig.rotating_messages_interval,
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
    // Parse date string as local time to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const chartData = useMemo(() => {
    if (!analytics?.conversationsByDay) return [];

    // Parse dates as local time to avoid timezone issues
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    const dates: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }

    const dataMap = new Map(
      analytics.conversationsByDay.map(item => [
        item.date,
        { conversations: item.conversations, recommendations: item.recommendations, conversions: item.conversions }
      ])
    );

    return dates.map(date => ({
      date,
      conversations: dataMap.get(date)?.conversations || 0,
      recommendations: dataMap.get(date)?.recommendations || 0,
      conversions: dataMap.get(date)?.conversions || 0,
    }));
  }, [analytics?.conversationsByDay, startDate, endDate]);

  const maxCount = useMemo(() => {
    if (chartData.length === 0) return 1;
    const max = Math.max(...chartData.map(d => Math.max(d.conversations, d.recommendations, d.conversions)));
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
          <button className="btn btn-primary btn-sm" onClick={() => loadData(true)} disabled={loading || isFilterLoading}>
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
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Conversiones
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
        <button
          className={`embedded-tab ${currentTab === 'conversations' ? 'active' : ''}`}
          onClick={() => setCurrentTab('conversations')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          Conversaciones
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
            {/* Date Filter - Optimized */}
            <div className="card" style={{ marginBottom: '1rem', position: 'relative' }}>
              {/* Loading overlay */}
              {isFilterLoading && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(var(--color-bg-rgb, 255, 255, 255), 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  zIndex: 10,
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid var(--color-border)',
                    borderTopColor: 'var(--color-primary)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                </div>
              )}

              {/* Quick Presets Row with Custom Dates */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Presets */}
                {([
                  { key: 'today', label: 'Hoy' },
                  { key: 'yesterday', label: 'Ayer' },
                  { key: '3d', label: '3 dias' },
                  { key: '7d', label: '7 dias' },
                  { key: '14d', label: '14 dias' },
                  { key: '30d', label: '30 dias' },
                  { key: 'thisWeek', label: 'Esta semana' },
                  { key: 'thisMonth', label: 'Este mes' },
                ] as { key: DatePreset; label: string }[]).map(preset => (
                  <button
                    key={preset.key}
                    onClick={() => applyPreset(preset.key)}
                    disabled={isFilterLoading}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      border: selectedPreset === preset.key
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--color-border)',
                      background: selectedPreset === preset.key
                        ? 'var(--color-primary)'
                        : 'var(--color-bg)',
                      color: selectedPreset === preset.key
                        ? 'white'
                        : 'var(--color-text)',
                      cursor: isFilterLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      fontWeight: selectedPreset === preset.key ? '600' : '400',
                      boxShadow: selectedPreset === preset.key ? '0 2px 8px rgba(107, 92, 255, 0.3)' : 'none',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}

                {/* Separator */}
                <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', margin: '0 0.25rem' }} />

                {/* Custom Date Inputs */}
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={e => handleCustomDateChange('start', e.target.value)}
                  disabled={isFilterLoading}
                  title="Fecha inicio"
                  style={{
                    padding: '0.35rem 0.5rem',
                    borderRadius: '6px',
                    border: selectedPreset === 'custom'
                      ? '1px solid var(--color-primary)'
                      : '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.8rem',
                    cursor: isFilterLoading ? 'not-allowed' : 'pointer',
                  }}
                />
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>-</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={getDateString(new Date())}
                  onChange={e => handleCustomDateChange('end', e.target.value)}
                  disabled={isFilterLoading}
                  title="Fecha fin"
                  style={{
                    padding: '0.35rem 0.5rem',
                    borderRadius: '6px',
                    border: selectedPreset === 'custom'
                      ? '1px solid var(--color-primary)'
                      : '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.8rem',
                    cursor: isFilterLoading ? 'not-allowed' : 'pointer',
                  }}
                />

                {/* Apply Button - only show when custom dates are pending */}
                {pendingFilter && (
                  <button
                    onClick={applyCustomFilter}
                    disabled={isFilterLoading}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      border: '1px solid var(--color-primary)',
                      background: 'var(--color-primary)',
                      color: 'white',
                      cursor: isFilterLoading ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    Aplicar
                  </button>
                )}
              </div>
            </div>

            {/* CSS for animations */}
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}</style>

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
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="card-title">Actividad por Dia</h3>
                  {/* Legend */}
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <div style={{ width: '12px', height: '12px', background: 'var(--color-primary)', borderRadius: '2px' }} />
                      <span>Conversaciones</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <div style={{ width: '12px', height: '12px', background: '#20b2aa', borderRadius: '2px' }} />
                      <span>Recomendaciones</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <div style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '2px' }} />
                      <span>Conversiones</span>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '0.5rem 0' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '140px', padding: '0 0.5rem' }}
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
                        {/* Values above bars */}
                        <div style={{ display: 'flex', gap: '1px', fontSize: '0.6rem', fontWeight: '600', marginBottom: '2px' }}>
                          <span style={{ color: 'var(--color-primary)' }}>{item.conversations}</span>
                          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
                          <span style={{ color: '#20b2aa' }}>{item.recommendations}</span>
                          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
                          <span style={{ color: '#f59e0b' }}>{item.conversions}</span>
                        </div>
                        {/* Bars container */}
                        <div style={{ display: 'flex', gap: '1px', width: '100%', maxWidth: '50px', justifyContent: 'center', alignItems: 'flex-end', height: '90px' }}>
                          {/* Conversations bar */}
                          <div
                            style={{
                              width: '30%',
                              height: `${Math.max((item.conversations / maxCount) * 90, 3)}px`,
                              background: item.conversations > 0 ? 'var(--color-primary)' : 'var(--color-border)',
                              borderRadius: '2px 2px 0 0',
                            }}
                          />
                          {/* Recommendations bar */}
                          <div
                            style={{
                              width: '30%',
                              height: `${Math.max((item.recommendations / maxCount) * 90, 3)}px`,
                              background: item.recommendations > 0 ? '#20b2aa' : 'var(--color-border)',
                              borderRadius: '2px 2px 0 0',
                            }}
                          />
                          {/* Conversions bar */}
                          <div
                            style={{
                              width: '30%',
                              height: `${Math.max((item.conversions / maxCount) * 90, 3)}px`,
                              background: item.conversions > 0 ? '#f59e0b' : 'var(--color-border)',
                              borderRadius: '2px 2px 0 0',
                            }}
                          />
                        </div>
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

        {/* Conversions Tab */}
        {currentTab === 'analytics' && (
          <>
            {/* Period Filter */}
            <div className="card" style={{ marginBottom: '1rem', position: 'relative' }}>
              {conversionLoading && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(var(--color-bg-rgb, 255, 255, 255), 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  zIndex: 10,
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid var(--color-border)',
                    borderTopColor: 'var(--color-primary)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>
                  Periodo:
                </span>
                {[7, 14, 30, 90].map((period) => (
                  <button
                    key={period}
                    onClick={() => setConversionDays(period)}
                    disabled={conversionLoading}
                    style={{
                      padding: '0.35rem 0.7rem',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      border: conversionDays === period
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--color-border)',
                      background: conversionDays === period
                        ? 'var(--color-primary)'
                        : 'var(--color-bg)',
                      color: conversionDays === period
                        ? 'white'
                        : 'var(--color-text)',
                      cursor: conversionLoading ? 'not-allowed' : 'pointer',
                      fontWeight: conversionDays === period ? '600' : '400',
                    }}
                  >
                    {period} dias
                  </button>
                ))}
              </div>
            </div>

            {conversionDashboard && (
              <>
                {/* Overview Stats */}
                <div className="stats-grid embedded-stats">
                  <div className="stat-card">
                    <div className="stat-icon primary">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                    </div>
                    <div className="stat-value">{conversionDashboard.overview.totalRecommendations.toLocaleString()}</div>
                    <div className="stat-label">Recomendaciones</div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon success">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="9" cy="21" r="1" />
                        <circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                    </div>
                    <div className="stat-value">{conversionDashboard.overview.totalConversions.toLocaleString()}</div>
                    <div className="stat-label">Conversiones</div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon warning">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </div>
                    <div className="stat-value">{formatCurrency(conversionDashboard.overview.totalRevenue)}</div>
                    <div className="stat-label">Ingresos Atribuidos</div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon accent">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                    <div className="stat-value">{conversionDashboard.overview.conversionRate.toFixed(1)}%</div>
                    <div className="stat-label">Tasa Conversion</div>
                  </div>
                </div>

                {/* Secondary Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                          {formatCurrency(conversionDashboard.overview.averageOrderValue)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Ticket Promedio
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                          {formatMinutes(conversionDashboard.overview.averageTimeToConversion)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Tiempo a Conversion
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attribution Breakdown */}
                <div className="card" style={{ marginTop: '1rem' }}>
                  <div className="card-header">
                    <h3 className="card-title">Atribucion por Tiempo</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Directa (0-30 min)</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', marginTop: '0.25rem' }}>
                        {conversionDashboard.attributionBreakdown.direct.count} conv.
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '600' }}>
                        {formatCurrency(conversionDashboard.attributionBreakdown.direct.revenue)}
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Asistida (30min-24h)</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', marginTop: '0.25rem' }}>
                        {conversionDashboard.attributionBreakdown.assisted.count} conv.
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: '600' }}>
                        {formatCurrency(conversionDashboard.attributionBreakdown.assisted.revenue)}
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '8px', borderLeft: '4px solid #6366f1' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>View-Through (24h-7d)</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', marginTop: '0.25rem' }}>
                        {conversionDashboard.attributionBreakdown.viewThrough.count} conv.
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#6366f1', fontWeight: '600' }}>
                        {formatCurrency(conversionDashboard.attributionBreakdown.viewThrough.revenue)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Period Comparison */}
                <div className="card" style={{ marginTop: '1rem' }}>
                  <div className="card-header">
                    <h3 className="card-title">vs Periodo Anterior</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Conversiones</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                          {conversionDashboard.periodComparison.currentPeriod.conversions}
                        </span>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: conversionDashboard.periodComparison.change.conversions >= 0 ? '#10b981' : '#ef4444'
                        }}>
                          {conversionDashboard.periodComparison.change.conversions >= 0 ? '+' : ''}
                          {conversionDashboard.periodComparison.change.conversions}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Ingresos</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                          {formatCurrency(conversionDashboard.periodComparison.currentPeriod.revenue)}
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: conversionDashboard.periodComparison.change.revenue >= 0 ? '#10b981' : '#ef4444'
                        }}>
                          {conversionDashboard.periodComparison.change.revenue >= 0 ? '+' : ''}
                          {formatCurrency(conversionDashboard.periodComparison.change.revenue)}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tasa Conversion</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                          {conversionDashboard.periodComparison.currentPeriod.rate.toFixed(1)}%
                        </span>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: conversionDashboard.periodComparison.change.rate >= 0 ? '#10b981' : '#ef4444'
                        }}>
                          {conversionDashboard.periodComparison.change.rate >= 0 ? '+' : ''}
                          {conversionDashboard.periodComparison.change.rate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Products */}
                {conversionDashboard.topProducts.length > 0 && (
                  <div className="card" style={{ marginTop: '1rem' }}>
                    <div className="card-header">
                      <h3 className="card-title">Top Productos por Conversion</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: 'var(--color-text-muted)' }}>Producto</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', color: 'var(--color-text-muted)' }}>Rec.</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', color: 'var(--color-text-muted)' }}>Conv.</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', color: 'var(--color-text-muted)' }}>Tasa</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: 'var(--color-text-muted)' }}>Ingresos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {conversionDashboard.topProducts.slice(0, 5).map((product, index) => (
                            <tr key={product.productId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '4px',
                                    background: 'var(--color-primary)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.7rem',
                                    fontWeight: '600',
                                  }}>
                                    {index + 1}
                                  </span>
                                  <span style={{ fontWeight: '500', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {product.productTitle}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{product.recommendations}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                <span style={{ background: '#dcfce7', color: '#166534', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: '600' }}>
                                  {product.conversions}
                                </span>
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600' }}>{product.conversionRate.toFixed(1)}%</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>{formatCurrency(product.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent Activity */}
                {conversionDashboard.recentActivity.length > 0 && (
                  <div className="card" style={{ marginTop: '1rem' }}>
                    <div className="card-header">
                      <h3 className="card-title">Actividad Reciente</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {conversionDashboard.recentActivity.slice(0, 6).map((activity, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.5rem',
                            background: 'var(--color-bg)',
                            borderRadius: '8px',
                          }}
                        >
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: activity.type === 'conversion'
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                              : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {activity.type === 'conversion' ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                              </svg>
                            )}
                          </div>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                              {activity.type === 'conversion' ? 'Conversion' : 'Recomendacion'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {activity.productTitle}
                            </div>
                          </div>
                          {activity.type === 'conversion' && activity.amount && (
                            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#10b981' }}>
                              {formatCurrency(activity.amount)}
                            </div>
                          )}
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(activity.timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Empty State */}
            {!conversionLoading && !conversionDashboard?.overview?.totalRecommendations && (
              <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" style={{ margin: '0 auto 1rem' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '600' }}>Sin datos de conversiones</h3>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  Los datos aparecerán cuando el asistente haga recomendaciones y los clientes compren
                </p>
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

                  {/* Rotating Messages Section */}
                  <div style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    background: 'var(--color-bg)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)'
                  }}>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={widgetConfig.rotating_messages_enabled}
                          onChange={e => setWidgetConfig({ ...widgetConfig, rotating_messages_enabled: e.target.checked })}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <div>
                          <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>Mensajes rotativos</span>
                          <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            Alterna entre 3 mensajes de bienvenida automaticamente
                          </p>
                        </div>
                      </label>
                    </div>

                    {widgetConfig.rotating_messages_enabled && (
                      <>
                        <div style={{ padding: '0.75rem', background: 'rgba(var(--color-primary-rgb, 107, 92, 255), 0.05)', borderRadius: '8px', marginBottom: '0.75rem' }}>
                          <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: '600' }}>Mensaje 2</label>
                          <textarea
                            className="form-input"
                            rows={2}
                            value={widgetConfig.welcome_message_2}
                            onChange={e => setWidgetConfig({ ...widgetConfig, welcome_message_2: e.target.value })}
                            placeholder="Segundo mensaje de bienvenida..."
                            style={{ marginBottom: '0.5rem' }}
                          />
                          <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Subtitulo 2</label>
                          <input
                            type="text"
                            className="form-input"
                            value={widgetConfig.subtitle_2}
                            onChange={e => setWidgetConfig({ ...widgetConfig, subtitle_2: e.target.value })}
                            placeholder="Subtitulo para el mensaje 2..."
                          />
                        </div>

                        <div style={{ padding: '0.75rem', background: 'rgba(var(--color-primary-rgb, 107, 92, 255), 0.05)', borderRadius: '8px', marginBottom: '0.75rem' }}>
                          <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: '600' }}>Mensaje 3</label>
                          <textarea
                            className="form-input"
                            rows={2}
                            value={widgetConfig.welcome_message_3}
                            onChange={e => setWidgetConfig({ ...widgetConfig, welcome_message_3: e.target.value })}
                            placeholder="Tercer mensaje de bienvenida..."
                            style={{ marginBottom: '0.5rem' }}
                          />
                          <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Subtitulo 3</label>
                          <input
                            type="text"
                            className="form-input"
                            value={widgetConfig.subtitle_3}
                            onChange={e => setWidgetConfig({ ...widgetConfig, subtitle_3: e.target.value })}
                            placeholder="Subtitulo para el mensaje 3..."
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.85rem' }}>
                            Intervalo: {widgetConfig.rotating_messages_interval} segundos
                          </label>
                          <input
                            type="range"
                            min="2"
                            max="15"
                            step="1"
                            value={widgetConfig.rotating_messages_interval}
                            onChange={e => setWidgetConfig({ ...widgetConfig, rotating_messages_interval: parseInt(e.target.value) })}
                            style={{ width: '100%' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                            <span>2s (rapido)</span>
                            <span>15s (lento)</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="form-group" style={{ marginTop: '1.5rem' }}>
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

        {/* Conversations Tab */}
        {currentTab === 'conversations' && (
          <>
            {/* Date Selector */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: '500' }}>
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={conversationsDate}
                    max={getDateString(new Date())}
                    onChange={e => setConversationsDate(e.target.value)}
                    disabled={conversationsLoading}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--color-primary)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      fontSize: '0.9rem',
                      cursor: conversationsLoading ? 'not-allowed' : 'pointer',
                    }}
                  />
                </div>

                {/* Quick date buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[
                    { label: 'Hoy', days: 0 },
                    { label: 'Ayer', days: 1 },
                    { label: 'Hace 2 dias', days: 2 },
                  ].map(({ label, days }) => {
                    const d = new Date();
                    d.setDate(d.getDate() - days);
                    const dateStr = getDateString(d);
                    return (
                      <button
                        key={days}
                        onClick={() => setConversationsDate(dateStr)}
                        disabled={conversationsLoading}
                        style={{
                          padding: '0.4rem 0.7rem',
                          fontSize: '0.8rem',
                          borderRadius: '6px',
                          border: conversationsDate === dateStr
                            ? '1px solid var(--color-primary)'
                            : '1px solid var(--color-border)',
                          background: conversationsDate === dateStr
                            ? 'var(--color-primary)'
                            : 'var(--color-bg)',
                          color: conversationsDate === dateStr
                            ? 'white'
                            : 'var(--color-text)',
                          cursor: conversationsLoading ? 'not-allowed' : 'pointer',
                          fontWeight: conversationsDate === dateStr ? '600' : '400',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Stats */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Conversaciones: </span>
                    <strong>{conversationsData?.totalConversations || 0}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Mensajes: </span>
                    <strong>{conversationsData?.totalMessages || 0}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {conversationsLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  border: '3px solid var(--color-border)',
                  borderTopColor: 'var(--color-primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            )}

            {/* Conversations List */}
            {!conversationsLoading && conversationsData && (
              <>
                {conversationsData.conversations.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" style={{ margin: '0 auto 1rem' }}>
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '600' }}>
                      No hay conversaciones
                    </h3>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      No se encontraron conversaciones para el {new Date(conversationsDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {conversationsData.conversations.map((conv) => (
                      <div
                        key={conv.sessionId}
                        className="card"
                        style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                        onClick={() => setExpandedConversation(
                          expandedConversation === conv.sessionId ? null : conv.sessionId
                        )}
                      >
                        {/* Conversation Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: 'var(--color-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: '600',
                              fontSize: '0.9rem',
                            }}>
                              {conv.messages.filter(m => m.role === 'user').length}
                            </div>
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                                Conversacion #{conv.sessionId.slice(-6)}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                {new Date(conv.startedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                {' - '}
                                {conv.messages.length} mensajes
                              </div>
                            </div>
                          </div>
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{
                              transform: expandedConversation === conv.sessionId ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>

                        {/* Conversation Messages (Expanded) */}
                        {expandedConversation === conv.sessionId && (
                          <div style={{
                            marginTop: '1rem',
                            paddingTop: '1rem',
                            borderTop: '1px solid var(--color-border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                          }}>
                            {conv.messages.map((msg, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                }}
                              >
                                <div style={{
                                  maxWidth: '85%',
                                  padding: '0.75rem 1rem',
                                  borderRadius: msg.role === 'user'
                                    ? '16px 16px 4px 16px'
                                    : '16px 16px 16px 4px',
                                  background: msg.role === 'user'
                                    ? 'var(--color-primary)'
                                    : 'var(--color-bg)',
                                  color: msg.role === 'user'
                                    ? 'white'
                                    : 'var(--color-text)',
                                  fontSize: '0.9rem',
                                  lineHeight: '1.4',
                                  boxShadow: msg.role === 'user'
                                    ? 'none'
                                    : '0 1px 3px rgba(0,0,0,0.1)',
                                }}>
                                  <MessageContent content={msg.content} role={msg.role} />
                                </div>
                                <div style={{
                                  fontSize: '0.7rem',
                                  color: 'var(--color-text-muted)',
                                  marginTop: '0.25rem',
                                  padding: '0 0.5rem',
                                }}>
                                  {new Date(msg.timestamp).toLocaleTimeString('es-ES', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ShopifyEmbedded;
