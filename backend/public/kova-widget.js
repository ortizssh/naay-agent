/**
 * Kova AI Chat Widget - Ultra-Modern Minimalist Design
 * Version: 3.0.0-LUXURY - 2025.11.20.17:00
 * Avant-garde Design with Kova Brand Integration
 * 
 * ✨ LUXURY WIDGET - Ultra-minimalist with glassmorphism
 */

(function () {
  'use strict';

  // UNIQUE IDENTIFIER FOR VERSION DETECTION 
  window.__KOVA_WIDGET_VERSION__ = '3.0.0-LUXURY-' + Date.now();
  window.__KOVA_WIDGET_TIMESTAMP__ = new Date().toISOString();
  console.log('✨ KOVA WIDGET LUXURY VERSION:', {
    version: window.__KOVA_WIDGET_VERSION__,
    timestamp: window.__KOVA_WIDGET_TIMESTAMP__,
    design: 'Ultra-minimalist luxury',
    colors: 'Kova Brand Palette',
    source: 'OFFICIAL-LUXURY-DESIGN'
  });

  // Enhanced singleton protection - prevent ANY duplicate loading
  if (window.__KOVA_WIDGET_LOADING__ || window.__KOVA_WIDGET_INITIALIZED__) {
    console.warn('⚠️ Kova Widget: Already loading/initialized, preventing duplicate');
    return;
  }

  // Mark as loading immediately to prevent race conditions
  window.__KOVA_WIDGET_LOADING__ = true;

  // Prevent multiple widget loads - check for both class and instance
  if (window.KovaWidget && window.kovaWidget) {
    console.warn('🔒 Kova Widget already loaded and instantiated, version:', window.__KOVA_WIDGET_VERSION__);
    window.__KOVA_WIDGET_LOADING__ = false;
    return;
  }

  // Check if DOM already has widget
  if (document.querySelector('.kova-widget')) {
    console.warn('🔒 Kova Widget DOM already exists, skipping initialization');
    window.__KOVA_WIDGET_LOADING__ = false;
    return;
  }

  // Helper function to format prices in Chilean peso format (no decimals, with thousands separator)
  function formatChileanPrice(price) {
    // Convert to number and remove decimals
    const numPrice = typeof price === 'string' ? parseFloat(price.replace(',', '')) : price;
    if (isNaN(numPrice)) return '$0';

    // Round to nearest peso (no decimals) and format with thousands separator
    const roundedPrice = Math.round(numPrice);
    return `$${roundedPrice.toLocaleString('es-CL')}`;
  }

  class KovaWidget {
    constructor(config = {}) {
      this.config = {
        shopDomain: '',
        apiEndpoint: '',
        chatEndpoint: '',
        position: 'bottom-right',
        // Kova Brand Colors - Updated Palette 2024
        everyday: '#cec8ae',    // Warm cream (preserved)
        fresh: '#90a284',       // Sage green (preserved)  
        delicate: '#c3ab79',    // Soft gold (preserved)
        forever: '#a59457',     // NEW Primary - Golden mustard
        hydra: '#A8C4C4',       // Soft blue-gray (preserved)
        deep: '#D4B82C',        // Mustard yellow (preserved)
        rich: '#B8943C',        // Golden brown (preserved)
        radiant: '#A68A3C',     // Olive gold (preserved)
        perfect: '#a59457',     // NEW Primary - Golden mustard
        sage: '#F8F9F8',        // Ultra-light sage (preserved)
        dark: '#212120',        // NEW Secondary - Dark charcoal
        terracotta: '#cf795e',  // NEW Tertiary - Warm terracotta
        greeting: '',
        placeholder: 'Pregúntanos sobre tu compra...',
        avatar: '🌿',
        brandName: 'Kova',
        language: 'es',
        enabled: true,
        ...config
      };

      if (!this.config.enabled) {
        console.log('Kova Widget is disabled');
        return;
      }

      this.isOpen = false;
      this.messages = [];
      this.sessionId = this.getOrCreateSessionId();
      this.conversationId = this.getStoredConversationId();
      this.eventListenersAdded = false; // Prevent duplicate event listeners
      this.isSending = false; // Prevent duplicate message sending

      // Cart state - visible only when chat is open
      this.cartVisible = false;
      this.cartId = null; // Shopify cart ID
      this.cartData = {
        items: [],
        total: 0,
        itemCount: 0
      };

      // Product tracking to prevent duplicates
      this.addedProducts = new Set();

      this.init();
    }

    init() {
      console.log('✨ Initializing Kova Luxury Widget v2.1 with Cart Sidebar:', new Date().toISOString());
      console.log('🏪 Shop Domain:', this.config.shopDomain);

      // Load settings from server
      this.loadSettings().then(() => {
        this.initializeWidget();
      }).catch(error => {
        console.error('Failed to load widget settings, using defaults:', error);
        this.initializeWidget();
      });
    }

    initializeWidget() {
      this.createWidget();
      this.setupElements();
      this.addEventListeners();
      this.loadConversationHistory();
      this.loadShopifyCart(); // Load existing Shopify cart
      this.setupShopifyCartSync(); // Setup real-time sync
    }

    async loadSettings() {
      try {
        const response = await fetch(`${this.config.apiEndpoint}/api/widget/config?shop=${this.config.shopDomain}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            Object.assign(this.config, data.data);
            console.log('Loaded widget settings from server:', data.data);
          }
        }
      } catch (error) {
        console.warn('Could not load settings from server:', error);
      }
    }

    createWidget() {
      // Check if widget already exists in DOM
      if (document.getElementById('kova-widget')) {
        console.log('🔒 Widget already exists in DOM, skipping creation');
        this.container = document.getElementById('kova-widget');
        return;
      }

      // Create widget container
      this.container = document.createElement('div');
      this.container.id = 'kova-widget';
      this.container.className = `kova-widget kova-widget--${this.config.position} kova-widget--closed`;

      // Create ultra-modern HTML with luxury design
      this.container.innerHTML = `
        <!-- Main Widget Layout Container -->
        <div class="kova-widget-layout" id="kova-widget-layout">
          
          
          <!-- Cart Panel - Slides from left -->
          <div class="kova-cart-panel" id="kova-cart-panel">
            <header class="kova-cart-panel__header">
              <div class="kova-cart-panel__title">
                <svg class="kova-cart-panel__icon" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H14C13.4 20 13 19.6 13 19V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h3 id="kova-cart-title">Mi Carrito</h3>
              </div>
              <button class="kova-cart-panel__close" id="kova-cart-close" aria-label="Cerrar carrito">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                </svg>
              </button>
            </header>
            
            <div class="kova-cart-panel__content" id="kova-cart-content">
              <div class="kova-cart-panel__empty" id="kova-cart-empty">
                <svg class="kova-cart-panel__empty-icon" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H14C13.4 20 13 19.6 13 19V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p class="kova-cart-panel__empty-text">Tu carrito está vacío</p>
                <p class="kova-cart-panel__empty-subtitle">¡Agrega productos para comenzar a comprar!</p>
              </div>
              
              <div class="kova-cart-panel__items" id="kova-cart-items"></div>
            </div>
            
            <footer class="kova-cart-panel__footer" id="kova-cart-footer">
              <div class="kova-cart-panel__total">
                <span class="kova-cart-panel__total-label">Total:</span>
                <span class="kova-cart-panel__total-price" id="kova-cart-total">$0</span>
              </div>
              <button class="kova-cart-panel__checkout" id="kova-cart-checkout">
                <span>Ir al Checkout</span>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </footer>
          </div>
          
          <!-- Chat Container -->
          <div class="kova-chat-container" id="kova-chat-container">
            <div class="kova-widget__promotional-message" id="kova-promotional-message" role="dialog" aria-label="Mensaje promocional">
              <div class="kova-widget__promotional-content">
                <div class="kova-widget__promotional-text">
                  ¿Necesitas ayuda? 🌿
                  <span class="kova-widget__promotional-subtitle">Te guiamos en tu compra</span>
                </div>
              </div>
              <div class="kova-widget__promotional-arrow"></div>
            </div>
            
            <button class="kova-widget__button" id="kova-widget-button" aria-label="Abrir chat de Kova" aria-expanded="false">
              <div class="kova-widget__button-content">
                <svg class="kova-widget__chat-icon" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3C17.5 3 21 6.58 21 11C21 15.42 17.5 19 12 19C10.76 19 9.57 18.82 8.47 18.5C5.55 21 2 21 2 21C4.33 18.67 4.7 17.1 4.75 16.5C3.05 15.07 2 13.13 2 11C2 6.58 5.5 3 10 3H12Z" fill="currentColor"/>
                </svg>
                <svg class="kova-widget__close-icon" viewBox="0 0 24 24" fill="none">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                </svg>
              </div>
              <div class="kova-widget__button-pulse"></div>
            </button>
            
            <div class="kova-widget__chat" id="kova-widget-chat" role="dialog" aria-label="Chat de Kova">
              <!-- Floating action buttons -->
              <div class="kova-widget__floating-actions">
                <button class="kova-widget__cart-toggle-btn" id="kova-widget-cart-toggle-btn" aria-label="Ver carrito">
                  <svg class="kova-cart-toggle-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H14C13.4 20 13 19.6 13 19V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span class="kova-cart-toggle-count" id="kova-widget-cart-count">0</span>
                </button>

                <button class="kova-widget__close" id="kova-widget-close" aria-label="Cerrar chat">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>

              <button class="kova-widget__back-btn" id="kova-widget-back-btn" aria-label="Volver" style="display: none;">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>

              <main class="kova-widget__messages" id="kova-widget-messages" role="main">
                
                <div class="kova-widget__welcome">
                  <div class="kova-widget__welcome-header">
                    <h4 class="kova-widget__welcome-title">
                      ¡Hola! Soy tu asesora personal de Kova.
                      <span class="kova-widget__welcome-subtitle">¿En qué puedo ayudarte? ✨🌿</span>
                    </h4>
                  </div>
                  <div class="kova-widget__welcome-features">
                    <div class="kova-widget__feature" data-message="¿Qué productos recomiendas para mi tipo de piel?">
                      <svg class="kova-feature-icon" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <span>Recomendaciones personalizadas para tu piel</span>
                    </div>
                    <div class="kova-widget__feature" data-message="¿Me ayudas a conocer mi tipo de piel?">
                      <svg class="kova-feature-icon" viewBox="0 0 24 24" fill="none">
                        <path d="M13 10V3L4 14H11L11 21L20 10H13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <span>Test rápido para conocer tu tipo de piel</span>
                    </div>
                    <div class="kova-widget__feature" data-message="¿Puedes ayudarme a elegir productos para mi rutina?">
                      <svg class="kova-feature-icon" viewBox="0 0 24 24" fill="none">
                        <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H14C13.4 20 13 19.6 13 19V13M17 13H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <span>Ayuda con tu compra</span>
                    </div>
                  </div>
                </div>
              </main>
              
              <div class="kova-widget__input-container">
                <div class="kova-widget__input-wrapper">
                  <input 
                    type="text" 
                    class="kova-widget__input" 
                    id="kova-widget-input" 
                    placeholder="Pregúntanos sobre tu compra..."
                    aria-label="Campo de mensaje"
                  />
                  <button 
                    class="kova-widget__send" 
                    id="kova-widget-send" 
                    aria-label="Enviar mensaje"
                    disabled
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Add luxury styles
      this.addLuxuryStyles();

      // Apply dynamic styles from loaded configuration
      this.applyDynamicStyles();

      // Append to document
      document.body.appendChild(this.container);

      // Add initial fade-in animation
      setTimeout(() => {
        this.container.classList.add('kova-widget--loaded');
      }, 100);
    }

    setupElements() {
      // Wait for DOM to be ready, then get elements using container context
      this.button = this.container.querySelector('#kova-widget-button');
      this.promotionalMessage = this.container.querySelector('#kova-promotional-message');
      this.chat = this.container.querySelector('#kova-widget-chat');
      this.messagesContainer = this.container.querySelector('#kova-widget-messages');
      this.input = this.container.querySelector('#kova-widget-input');
      this.sendButton = this.container.querySelector('#kova-widget-send');
      this.resetButton = this.container.querySelector('#kova-widget-reset');
      this.closeButton = this.container.querySelector('#kova-widget-close');
      this.backButton = this.container.querySelector('#kova-widget-back-btn');

      // Cart elements - new layout structure
      this.cartSmallToggle = this.container.querySelector('#kova-widget-cart-toggle-btn'); // Small cart button in chat
      this.cartSmallCount = this.container.querySelector('#kova-widget-cart-count'); // Count badge for small button
      this.cartPanel = this.container.querySelector('#kova-cart-panel');
      this.cartContent = this.container.querySelector('#kova-cart-content');
      this.cartEmpty = this.container.querySelector('#kova-cart-empty');
      this.cartItems = this.container.querySelector('#kova-cart-items');
      this.cartFooter = this.container.querySelector('#kova-cart-footer');
      this.cartTotal = this.container.querySelector('#kova-cart-total');
      this.cartCheckout = this.container.querySelector('#kova-cart-checkout');
      this.cartClose = this.container.querySelector('#kova-cart-close');

      console.log('✨ Luxury DOM Elements found:', {
        button: !!this.button,
        chat: !!this.chat,
        input: !!this.input,
        promotional: !!this.promotionalMessage,
        cartPanel: !!this.cartPanel,
        cartEmpty: !!this.cartEmpty,
        cartItems: !!this.cartItems,
        cartFooter: !!this.cartFooter,
        cartTotal: !!this.cartTotal,
        cartToggle: !!this.cartToggle,
        cartBadge: !!this.cartBadge
      });

      // Apply dynamic content from config
      this.applyDynamicContent();
    }

    /**
     * Apply dynamic content based on loaded configuration
     * Updates placeholder, greeting, subtitle, avatar, brand name
     */
    applyDynamicContent() {
      const brandName = this.config.brandName || 'Kova';
      const subtitle = this.config.subtitle || 'Asistente de compras con IA';
      const avatar = this.config.avatar || '🌿';

      // Update input placeholder
      if (this.input && this.config.placeholder) {
        this.input.placeholder = this.config.placeholder;
      }

      // Update welcome message / greeting
      const welcomeTitle = this.container.querySelector('.kova-widget__welcome-title');
      if (welcomeTitle) {
        if (this.config.greeting) {
          // Custom greeting provided
          welcomeTitle.innerHTML = `
            ${this.config.greeting}
            <span class="kova-widget__welcome-subtitle">${subtitle}</span>
          `;
        } else {
          // Default greeting with dynamic brand name
          welcomeTitle.innerHTML = `
            ¡Hola! Soy tu asesora personal de ${brandName}.
            <span class="kova-widget__welcome-subtitle">¿En qué puedo ayudarte? ✨${avatar}</span>
          `;
        }
      }

      // Update promotional message
      const promoText = this.container.querySelector('.kova-widget__promotional-text');
      if (promoText) {
        if (this.config.greeting) {
          promoText.innerHTML = `
            ${this.config.greeting}
            <span class="kova-widget__promotional-subtitle">${subtitle}</span>
          `;
        } else {
          promoText.innerHTML = `
            ¿Necesitas ayuda? ${avatar}
            <span class="kova-widget__promotional-subtitle">Te guiamos en tu compra</span>
          `;
        }
      }

      // Update ARIA labels with brand name
      if (this.button) {
        this.button.setAttribute('aria-label', `Abrir chat de ${brandName}`);
      }
      if (this.chat) {
        this.chat.setAttribute('aria-label', `Chat de ${brandName}`);
      }

      // Hide promotional message if showPromoMessage is false
      if (this.promotionalMessage && this.config.showPromoMessage === false) {
        this.promotionalMessage.style.display = 'none';
      }

      // Hide cart button if showCart is false
      if (this.cartSmallToggle && this.config.showCart === false) {
        this.cartSmallToggle.style.display = 'none';
      }

      console.log('📝 Dynamic content applied:', {
        brandName,
        placeholder: this.config.placeholder,
        greeting: this.config.greeting,
        subtitle,
        avatar,
        showPromoMessage: this.config.showPromoMessage,
        showCart: this.config.showCart
      });
    }

    addLuxuryStyles() {
      const style = document.createElement('style');
      style.textContent = `
        /* Kova Luxury Widget - Ultra-Modern Minimalist Design */
        
        :root {
          /* Kova Brand Color Palette */
          --kova-everyday: #cec8ae;
          --kova-fresh: #90a284;
          --kova-delicate: #c3ab79;
          --kova-forever: #a59457;
          --kova-hydra: #A8C4C4;
          --kova-deep: #D4B82C;
          --kova-rich: #B8943C;
          --kova-radiant: #A68A3C;
          --kova-perfect: #a59457;
          --kova-sage: #F8F9F8;
          --kova-dark: #212120;
          --kova-terracotta: #cf795e;
          --kova-white: #FFFFFF;
          --kova-black: #212120;
          
          /* Semantic Color Aliases - Updated */
          --kova-primary: var(--kova-perfect);     /* #a59457 - Primary actions */
          --kova-secondary: var(--kova-dark);      /* #212120 - Secondary elements */
          --kova-accent: var(--kova-terracotta);   /* #cf795e - Accent elements */
          --kova-tertiary: var(--kova-delicate);   /* #c3ab79 - Tertiary elements */
          --kova-highlight: var(--kova-perfect);   /* #a59457 - Highlights */
          --kova-surface: var(--kova-sage);        /* #F8F9F8 - Background surfaces */
          --kova-text-primary: var(--kova-black);  /* #212120 - Primary text */
          --kova-text-secondary: var(--kova-perfect); /* #a59457 - Secondary text */
          
          /* Typography */
          --kova-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          --kova-font-weight-regular: 400;
          --kova-font-weight-medium: 500;
          --kova-font-weight-semibold: 600;
          
          /* Shadows & Effects */
          --kova-shadow-soft: 0 4px 24px rgba(165, 148, 87, 0.08);
          --kova-shadow-medium: 0 8px 32px rgba(165, 148, 87, 0.12);
          --kova-shadow-strong: 0 16px 48px rgba(165, 148, 87, 0.16);
          --kova-blur: backdrop-filter: blur(16px);
          
          /* Transitions */
          --kova-transition: cubic-bezier(0.4, 0, 0.2, 1);
          --kova-duration: 400ms;
        }

        .kova-widget {
          position: fixed !important;
          bottom: 20px !important;
          right: 20px !important;
          z-index: 999999 !important;
          font-family: var(--kova-font) !important;
          font-feature-settings: 'cv11', 'cv02', 'cv03', 'cv04' !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          opacity: 0 !important;
          transform: translateY(20px) !important;
          transition: all 600ms var(--kova-transition) !important;
          overflow: visible !important;
        }

        .kova-widget--loaded {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }

        .kova-widget--bottom-right {
          bottom: 32px !important;
          right: 32px !important;
        }

        .kova-widget--bottom-left {
          bottom: 32px !important;
          left: 32px !important;
        }

        .kova-widget--top-right {
          top: 32px !important;
          right: 32px !important;
        }

        .kova-widget--top-left {
          top: 32px !important;
          left: 32px !important;
        }

        /* Ultra-Modern Promotional Message */
        .kova-widget__promotional-message {
          position: absolute !important;
          bottom: 24px !important;
          right: 96px !important;
          background: var(--kova-white) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid var(--kova-secondary) !important;
          border-radius: 8px !important;
          padding: 20px 24px !important;
          max-width: 380px !important;
          width: 380px !important;
          box-shadow: var(--kova-shadow-medium) !important;
          cursor: pointer !important;
          transition: all var(--kova-duration) var(--kova-transition) !important;
          opacity: 1 !important;
          visibility: visible !important;
          transform: translateY(0) scale(1) !important;
        }

        .kova-widget__promotional-message:hover {
          transform: translateY(-4px) scale(1.02) !important;
          box-shadow: var(--kova-shadow-strong) !important;
          border-color: var(--kova-secondary) !important;
        }

        .kova-widget__promotional-content {
          display: block !important;
        }




        .kova-widget__promotional-text {
          flex: 1 !important;
        }

        .kova-widget__promotional-text {
          color: var(--kova-perfect) !important;
          font-size: 13px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          line-height: 1.3 !important;
          margin: 0 !important;
        }

        .kova-widget__promotional-subtitle {
          display: block !important;
          color: var(--kova-secondary) !important;
          font-size: 11px !important;
          font-weight: var(--kova-font-weight-regular) !important;
          margin-top: 2px !important;
        }

        .kova-widget__promotional-arrow {
          position: absolute !important;
          top: 50% !important;
          left: -8px !important;
          transform: translateY(-50%) !important;
          width: 0 !important;
          height: 0 !important;
          border-right: 8px solid var(--kova-white) !important;
          border-top: 8px solid transparent !important;
          border-bottom: 8px solid transparent !important;
          filter: drop-shadow(-2px 0 4px rgba(165, 148, 87, 0.1)) !important;
        }
        
        .kova-widget--bottom-left .kova-widget__promotional-arrow {
          right: auto !important;
          left: -8px !important;
          border-left: 8px solid transparent !important;
          border-right: 8px solid var(--kova-white) !important;
        }

        .kova-widget--open .kova-widget__promotional-message {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          transform: translateY(16px) scale(0.95) !important;
        }

        /* Ultra-Luxury Chat Button */
        .kova-widget__button {
          width: 72px !important;
          height: 72px !important;
          border-radius: 50% !important;
          background: var(--kova-perfect) !important;
          border: none !important;
          cursor: pointer !important;
          position: relative !important;
          box-shadow: var(--kova-shadow-medium) !important;
          transition: all var(--kova-duration) var(--kova-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: hidden !important;
        }

        .kova-widget__button:hover {
          transform: translateY(-6px) scale(1.08) !important;
          box-shadow: var(--kova-shadow-strong) !important;
          background: var(--kova-rich) !important;
        }

        .kova-widget__button-content {
          position: relative !important;
          z-index: 3 !important;
          width: 24px !important;
          height: 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .kova-widget__chat-icon,
        .kova-widget__close-icon {
          width: 24px !important;
          height: 24px !important;
          color: var(--kova-white) !important;
          position: absolute !important;
          transition: all var(--kova-duration) var(--kova-transition) !important;
        }

        .kova-widget__chat-icon {
          opacity: 1 !important;
          transform: rotate(0deg) scale(1) !important;
        }

        .kova-widget__close-icon {
          opacity: 0 !important;
          transform: rotate(90deg) scale(0.8) !important;
        }

        .kova-widget--open .kova-widget__chat-icon {
          opacity: 0 !important;
          transform: rotate(-90deg) scale(0.8) !important;
        }

        .kova-widget--open .kova-widget__close-icon {
          opacity: 1 !important;
          transform: rotate(0deg) scale(1) !important;
        }

        .kova-widget__button-pulse {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 50% !important;
          background: var(--kova-perfect) !important;
          animation: kovaPulse 2s infinite !important;
          z-index: 1 !important;
        }

        @keyframes kovaPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.6; }
          100% { transform: scale(1.3); opacity: 0; }
        }

        .kova-widget--open .kova-widget__button-pulse {
          animation: none !important;
        }

        /* Ultra-Modern Chat Window */
        .kova-widget__chat {
          position: absolute !important;
          bottom: 88px !important;
          left: 0 !important;
          width: 50vw !important;
          height: 620px !important;
          background: rgba(248, 249, 248, 0.95) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border-radius: 12px !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          box-shadow: var(--kova-shadow-strong) !important;
          display: none !important;
          flex-direction: column !important;
          overflow: hidden !important;
          transform: translateY(32px) scale(0.9) !important;
          opacity: 0 !important;
          visibility: hidden !important;
          transition: all var(--kova-duration) var(--kova-transition) !important;
        }

        .kova-widget--bottom-right .kova-widget__chat {
          left: auto !important;
          right: 0 !important;
        }

        .kova-widget--top-right .kova-widget__chat,
        .kova-widget--top-left .kova-widget__chat {
          bottom: auto !important;
          top: 88px !important;
        }

        .kova-widget--open .kova-widget__chat {
          display: flex !important;
          transform: translateY(0) scale(1) !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .kova-widget--closing .kova-widget__chat {
          transform: translateY(16px) scale(0.95) !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }

        /* Cart Modal - Slide from left inside chat */
        .kova-cart__modal {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          display: none !important;
          z-index: 1000 !important;
          pointer-events: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        }
        .kova-cart__modal--open {
          display: block !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
        }
        .kova-cart__backdrop {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background: rgba(0, 0, 0, 0.2) !important;
          backdrop-filter: blur(2px) !important;
          cursor: pointer !important;
        }
        .kova-cart__slide {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 360px !important;
          height: 100% !important;
          background: rgba(248, 249, 248, 0.98) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border-radius: 0 16px 16px 0 !important;
          border: 1px solid rgba(165, 148, 87, 0.15) !important;
          border-left: none !important;
          box-shadow: 
            4px 0 32px rgba(165, 148, 87, 0.12),
            2px 0 16px rgba(165, 148, 87, 0.08) !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          transform: translateX(-100%) !important;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        }
        .kova-cart__modal--open .kova-cart__slide {
          transform: translateX(0) !important;
        }
        .kova-cart__close {
          background: rgba(255, 255, 255, 0.15) !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px !important;
          color: var(--kova-white) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--kova-transition) !important;
        }
        .kova-cart__close:hover {
          background: rgba(255, 255, 255, 0.25) !important;
          transform: scale(1.1) !important;
        }
        .kova-cart__close svg {
          width: 14px !important;
          height: 14px !important;
        }
        
        /* Legacy cart panel styles - to be removed */
        .kova-widget__cart-panel {
          position: absolute !important;
          bottom: 88px !important;
          right: calc(100% + 420px) !important; /* Position to left of chat (400px chat width + 20px gap) */
          width: 360px !important;
          height: 620px !important;
          /* Same glassmorphism style as chat */
          background: rgba(248, 249, 248, 0.98) !important;
          backdrop-filter: blur(24px) !important;
          -webkit-backdrop-filter: blur(24px) !important;
          border-radius: 20px !important;
          border: 1px solid rgba(165, 148, 87, 0.15) !important;
          box-shadow: 
            0 32px 64px rgba(165, 148, 87, 0.12),
            0 16px 32px rgba(165, 148, 87, 0.08),
            0 8px 16px rgba(165, 148, 87, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.4) !important;
          display: none !important;
          flex-direction: column !important;
          overflow: hidden !important;
          transform: translateX(-32px) translateY(24px) scale(0.92) !important;
          opacity: 0 !important;
          visibility: hidden !important;
          transition: all 450ms cubic-bezier(0.34, 1.56, 0.64, 1) !important;
          z-index: 999997 !important;
        }

        .kova-widget--bottom-left .kova-widget__cart-panel {
          right: auto !important;
          left: calc(100% + 420px) !important; /* Position to right of chat for left-positioned widget */
          transform: translateX(32px) translateY(24px) scale(0.92) !important;
        }

        /* Cart panel minimized state */
        .kova-widget__cart-panel--minimized {
          height: 60px !important;
          overflow: hidden !important;
        }
        
        .kova-widget__cart-panel--minimized .kova-cart__content,
        .kova-widget__cart-panel--minimized .kova-cart__footer {
          display: none !important;
        }

        .kova-widget--cart-open .kova-widget__cart-panel {
          display: flex !important;
          transform: translateX(0) translateY(0) scale(1) !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .kova-cart__header {
          background: transparent !important;
          color: var(--kova-black) !important;
          padding: 20px 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          border-top-left-radius: 20px !important;
          border-top-right-radius: 20px !important;
        }

        .kova-cart__title {
          font-size: 16px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          margin: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .kova-cart__icon {
          width: 18px !important;
          height: 18px !important;
        }

        .kova-cart__toggle {
          background: rgba(255, 255, 255, 0.15) !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px !important;
          color: var(--kova-white) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--kova-transition) !important;
        }

        .kova-cart__toggle:hover {
          background: rgba(255, 255, 255, 0.25) !important;
          transform: scale(1.1) !important;
        }

        .kova-cart__toggle svg {
          width: 14px !important;
          height: 14px !important;
        }

        .kova-cart__actions {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .kova-cart__minimize {
          background: rgba(255, 255, 255, 0.15) !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px !important;
          color: var(--kova-white) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--kova-transition) !important;
        }

        .kova-cart__minimize:hover {
          background: rgba(255, 255, 255, 0.25) !important;
          transform: scale(1.1) !important;
        }

        .kova-cart__minimize svg {
          width: 14px !important;
          height: 14px !important;
          transition: transform 0.2s var(--kova-transition) !important;
        }

        .kova-widget__cart-panel--minimized .kova-cart__minimize svg {
          transform: rotate(180deg) !important;
        }

        .kova-cart__content {
          flex: 1 !important;
          overflow-y: auto !important;
          padding: 0 !important;
        }

        .kova-cart__empty {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          height: 100% !important;
          padding: 40px 24px !important;
          text-align: center !important;
          color: var(--kova-perfect) !important;
        }

        .kova-cart__empty-icon {
          width: 48px !important;
          height: 48px !important;
          opacity: 0.6 !important;
          margin-bottom: 16px !important;
        }

        .kova-cart__empty-text {
          font-size: 16px !important;
          font-weight: var(--kova-font-weight-medium) !important;
          margin: 0 0 8px 0 !important;
          color: var(--kova-black) !important;
        }

        .kova-cart__empty-subtitle {
          font-size: 13px !important;
          opacity: 0.7 !important;
          color: var(--kova-perfect) !important;
        }

        .kova-cart__items {
          padding: 16px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
        }

        .kova-cart__item {
          background: var(--kova-white) !important;
          border-radius: 12px !important;
          padding: 16px !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          box-shadow: 0 2px 8px rgba(165, 148, 87, 0.05) !important;
          transition: all 0.2s var(--kova-transition) !important;
        }

        .kova-cart__item:hover {
          box-shadow: 0 4px 12px rgba(165, 148, 87, 0.1) !important;
          transform: translateY(-1px) !important;
        }

        .kova-cart__item-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
          margin-bottom: 8px !important;
        }

        .kova-cart__item-title {
          font-size: 14px !important;
          font-weight: var(--kova-font-weight-medium) !important;
          line-height: 1.3 !important;
          margin: 0 !important;
          flex: 1 !important;
          margin-right: 8px !important;
          color: var(--kova-black) !important;
        }

        .kova-cart__item-remove {
          background: rgba(220, 38, 38, 0.1) !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 4px !important;
          color: #dc2626 !important;
          cursor: pointer !important;
          transition: all 0.2s var(--kova-transition) !important;
        }

        .kova-cart__item-remove:hover {
          background: rgba(220, 38, 38, 0.2) !important;
        }

        .kova-cart__item-remove svg {
          width: 12px !important;
          height: 12px !important;
        }

        .kova-cart__item-details {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
        }

        .kova-cart__item-quantity {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .kova-cart__quantity-btn {
          background: var(--kova-delicate) !important;
          border: none !important;
          border-radius: 6px !important;
          width: 24px !important;
          height: 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          font-size: 14px !important;
          font-weight: var(--kova-font-weight-medium) !important;
          color: var(--kova-perfect) !important;
          transition: all 0.2s var(--kova-transition) !important;
        }

        .kova-cart__quantity-btn:hover {
          background: var(--kova-perfect) !important;
          color: var(--kova-white) !important;
          transform: scale(1.1) !important;
        }

        .kova-cart__quantity-value {
          font-size: 14px !important;
          font-weight: var(--kova-font-weight-medium) !important;
          min-width: 20px !important;
          text-align: center !important;
          color: var(--kova-black) !important;
        }

        .kova-cart__item-price {
          font-size: 14px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          color: var(--kova-perfect) !important;
        }

        .kova-cart__footer {
          background: var(--kova-white) !important;
          border-top: 1px solid rgba(212, 196, 184, 0.2) !important;
          padding: 20px 24px !important;
        }

        .kova-cart__total {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 16px !important;
          padding: 16px 0 !important;
          border-top: 1px solid rgba(212, 196, 184, 0.2) !important;
        }

        .kova-cart__total-label {
          font-size: 16px !important;
          font-weight: var(--kova-font-weight-medium) !important;
          color: var(--kova-black) !important;
        }

        .kova-cart__total-amount {
          font-size: 18px !important;
          font-weight: var(--kova-font-weight-bold) !important;
          color: var(--kova-perfect) !important;
        }

        .kova-cart__checkout {
          width: 100% !important;
          background: linear-gradient(135deg, var(--kova-perfect) 0%, var(--kova-rich) 100%) !important;
          color: var(--kova-white) !important;
          border: none !important;
          border-radius: 12px !important;
          padding: 16px 20px !important;
          font-size: 15px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          cursor: pointer !important;
          transition: none !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          box-shadow: 0 4px 16px rgba(165, 148, 87, 0.3) !important;
        }

        .kova-cart__checkout:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(165, 148, 87, 0.4) !important;
        }

        .kova-cart__checkout svg {
          width: 16px !important;
          height: 16px !important;
        }

        /* ======= PRODUCT RECOMMENDATION WIDGET STYLES ======= */

        .kova-recommendations-container {
          width: 100% !important;
          margin: 8px 0 !important;
        }

        .kova-recommendations-grid {
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
          padding: 4px !important;
        }


        .kova-product-card {
          background: var(--kova-white) !important;
          border-radius: 16px !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          overflow: hidden !important;
          box-shadow: 0 2px 8px rgba(165, 148, 87, 0.08) !important;
          transition: none !important;
          margin: 0 !important;
          width: 100% !important;
          position: relative !important;
          display: flex !important;
          flex-direction: row !important;
          height: auto !important;
          min-height: 100px !important;
        }

        /* Hover effects removed */

        .kova-product-card__header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
          margin-bottom: 4px !important;
          position: relative !important;
        }

        .kova-product-card__vendor {
          background: rgba(248, 249, 248, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          color: var(--kova-perfect) !important;
          font-size: 12px !important;
          font-weight: var(--kova-font-weight-medium) !important;
          padding: 4px 8px !important;
          border-radius: 6px !important;
          border: 1px solid rgba(212, 196, 184, 0.3) !important;
        }

        .kova-product-card__discount {
          background: linear-gradient(135deg, #dc2626, #ef4444) !important;
          color: var(--kova-white) !important;
          font-size: 12px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          padding: 4px 8px !important;
          border-radius: 6px !important;
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3) !important;
        }

        .kova-product-card__media {
          position: relative !important;
          width: 100px !important;
          height: 100px !important;
          flex-shrink: 0 !important;
          overflow: hidden !important;
          background: var(--kova-sage) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 8px !important;
          margin: 0 !important;
        }

        .kova-product-card__image {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          transition: none !important;
          border-radius: 0 !important;
        }

        /* Image hover effect removed */

        .kova-product-card__placeholder {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 64px !important;
          height: 64px !important;
          color: var(--kova-perfect) !important;
          opacity: 0.5 !important;
        }

        .kova-product-card__placeholder svg {
          width: 100% !important;
          height: 100% !important;
        }

        .kova-product-card__overlay {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          background: rgba(26, 26, 26, 0.4) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          opacity: 0 !important;
          transition: opacity 0.3s var(--kova-transition) !important;
        }

        /* Overlay hover effect removed */

        .kova-product-card__quick-view {
          background: rgba(248, 249, 248, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          border: none !important;
          border-radius: 50% !important;
          width: 48px !important;
          height: 48px !important;
          color: var(--kova-perfect) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--kova-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        /* Quick view hover effect removed */

        .kova-product-card__quick-view svg {
          width: 20px !important;
          height: 20px !important;
        }

        .kova-product-card__content {
          padding: 12px !important;
          margin-left: 12px !important;
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
        }

        .kova-product-card__title {
          font-size: 14px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          line-height: 1.3 !important;
          margin: 0 0 4px 0 !important;
          color: var(--kova-black) !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
        }

        .kova-product-card__description {
          font-size: 12px !important;
          line-height: 1.4 !important;
          color: var(--kova-perfect) !important;
          margin: 0 0 8px 0 !important;
          opacity: 0.8 !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
        }

        .kova-product-card__price-section {
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
          margin-bottom: 16px !important;
        }

        .kova-product-card__pricing {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .kova-product-card__price {
          font-size: 18px !important;
          font-weight: var(--kova-font-weight-bold) !important;
          color: var(--kova-perfect) !important;
        }

        .kova-product-card__compare-price {
          font-size: 14px !important;
          font-weight: var(--kova-font-weight-medium) !important;
          color: var(--kova-perfect) !important;
          opacity: 0.6 !important;
          text-decoration: line-through !important;
        }

        .kova-product-card__tags {
          display: flex !important;
          gap: 6px !important;
          flex-wrap: wrap !important;
        }

        .kova-product-card__tag {
          background: var(--kova-delicate) !important;
          color: var(--kova-perfect) !important;
          font-size: 11px !important;
          font-weight: var(--kova-font-weight-medium) !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        }

        .kova-product-card__actions {
          display: flex !important;
          gap: 6px !important;
          margin-top: 8px !important;
        }

        .kova-product-card__add-btn {
          flex: 1 !important;
          background: var(--kova-perfect) !important;
          color: var(--kova-white) !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 8px 12px !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          transition: none !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          box-shadow: none !important;
        }

        /* Add button hover effect removed */

        .kova-product-card__add-btn--disabled {
          background: rgba(165, 148, 87, 0.3) !important;
          cursor: not-allowed !important;
          transform: none !important;
          box-shadow: none !important;
        }

        .kova-product-card__add-btn--success {
          background: #10b981 !important;
        }

        .kova-product-card__add-btn svg {
          width: 10px !important;
          height: 10px !important;
        }

        .kova-spinner {
          animation: kovaSpinner 1s linear infinite !important;
        }

        @keyframes kovaSpinner {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .kova-product-card__details-btn {
          background: rgba(165, 148, 87, 0.1) !important;
          color: var(--kova-perfect) !important;
          border: 1px solid rgba(165, 148, 87, 0.3) !important;
          border-radius: 4px !important;
          padding: 6px 10px !important;
          font-size: 11px !important;
          font-weight: var(--kova-font-weight-medium) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--kova-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 4px !important;
          min-width: 60px !important;
        }

        /* Details button hover effect removed */

        .kova-product-card__details-btn svg {
          width: 10px !important;
          height: 10px !important;
        }

        /* ======= PRODUCT MODAL STYLES ======= */

        .kova-product-modal {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 999999 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          opacity: 0 !important;
          visibility: hidden !important;
          transition: none !important;
        }

        .kova-product-modal--visible {
          opacity: 1 !important;
          visibility: visible !important;
        }

        .kova-product-modal__backdrop {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background: rgba(26, 26, 26, 0.8) !important;
          backdrop-filter: blur(4px) !important;
        }

        .kova-product-modal__content {
          position: relative !important;
          background: var(--kova-white) !important;
          border-radius: 20px !important;
          max-width: 500px !important;
          width: 90vw !important;
          max-height: 80vh !important;
          overflow: hidden !important;
          box-shadow: 0 20px 40px rgba(165, 148, 87, 0.2) !important;
        }

        .kova-product-modal__header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 20px 24px !important;
          border-bottom: 1px solid rgba(212, 196, 184, 0.2) !important;
          background: var(--kova-sage) !important;
        }

        .kova-product-modal__header h2 {
          font-size: 18px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          margin: 0 !important;
          color: var(--kova-black) !important;
        }

        .kova-product-modal__close {
          background: none !important;
          border: none !important;
          cursor: pointer !important;
          padding: 8px !important;
          border-radius: 8px !important;
          transition: background 0.2s var(--kova-transition) !important;
          color: var(--kova-perfect) !important;
        }

        .kova-product-modal__close:hover {
          background: rgba(165, 148, 87, 0.1) !important;
        }

        .kova-product-modal__close svg {
          width: 20px !important;
          height: 20px !important;
        }

        .kova-product-modal__body {
          padding: 24px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 20px !important;
        }

        .kova-product-modal__body img {
          width: 100% !important;
          height: 200px !important;
          object-fit: cover !important;
          border-radius: 12px !important;
        }

        .kova-product-modal__info {
          display: flex !important;
          flex-direction: column !important;
          gap: 16px !important;
        }

        .kova-product-modal__description {
          font-size: 14px !important;
          line-height: 1.6 !important;
          color: var(--kova-perfect) !important;
          margin: 0 !important;
        }

        .kova-product-modal__price {
          font-size: 24px !important;
          font-weight: var(--kova-font-weight-bold) !important;
          color: var(--kova-perfect) !important;
        }

        .kova-product-modal__add-btn {
          background: linear-gradient(135deg, var(--kova-perfect) 0%, var(--kova-rich) 100%) !important;
          color: var(--kova-white) !important;
          border: none !important;
          border-radius: 12px !important;
          padding: 16px 24px !important;
          font-size: 16px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          cursor: pointer !important;
          transition: none !important;
          box-shadow: 0 4px 16px rgba(165, 148, 87, 0.3) !important;
        }

        .kova-product-modal__add-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(165, 148, 87, 0.4) !important;
        }

        /* Floating Action Buttons */
        .kova-widget__floating-actions {
          position: absolute !important;
          top: 12px !important;
          left: 12px !important;
          right: 12px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          z-index: 20 !important;
          pointer-events: none !important;
        }

        .kova-widget__floating-actions > * {
          pointer-events: auto !important;
        }

        .kova-widget__close {
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          -webkit-backdrop-filter: blur(10px) !important;
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          color: var(--kova-black) !important;
          cursor: pointer !important;
          padding: 10px !important;
          border-radius: 12px !important;
          transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1) !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .kova-widget__close:hover {
          background: var(--kova-white) !important;
          transform: scale(1.05) !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12) !important;
        }

        .kova-widget__close:active {
          transform: scale(0.95) !important;
        }

        .kova-widget__close svg {
          width: 18px !important;
          height: 18px !important;
        }

        .kova-widget__back-btn {
          position: absolute !important;
          top: 12px !important;
          left: 12px !important;
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          -webkit-backdrop-filter: blur(10px) !important;
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          color: var(--kova-black) !important;
          cursor: pointer !important;
          padding: 10px !important;
          border-radius: 12px !important;
          transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1) !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
          z-index: 25 !important;
        }

        .kova-widget__back-btn:hover {
          background: var(--kova-white) !important;
          transform: scale(1.05) !important;
        }

        .kova-widget__back-btn svg {
          width: 18px !important;
          height: 18px !important;
        }

        /* Luxury Messages Area */
        .kova-widget__messages {
          flex: 1 !important;
          padding: 56px 24px 24px 24px !important;
          overflow-y: auto !important;
          background: transparent !important;
          scrollbar-width: thin !important;
          scrollbar-color: var(--kova-delicate) transparent !important;
          position: relative !important;
        }

        /* Cart Toggle Button */
        .kova-widget__cart-toggle-btn {
          position: relative !important;
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          -webkit-backdrop-filter: blur(10px) !important;
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          border-radius: 12px !important;
          padding: 10px !important;
          cursor: pointer !important;
          transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1) !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .kova-widget__cart-toggle-btn:hover {
          background: var(--kova-white) !important;
          transform: scale(1.05) !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12) !important;
        }

        .kova-widget__cart-toggle-btn:active {
          transform: scale(0.95) !important;
        }

        .kova-widget__cart-toggle-btn svg,
        .kova-cart-toggle-icon {
          width: 18px !important;
          height: 18px !important;
          color: var(--kova-black) !important;
        }

        .kova-cart-toggle-icon {
          width: 16px !important;
          height: 16px !important;
          color: var(--kova-perfect) !important;
        }

        .kova-cart-toggle-count {
          position: absolute !important;
          top: -4px !important;
          right: -4px !important;
          background: var(--kova-perfect) !important;
          color: var(--kova-white) !important;
          border-radius: 50% !important;
          font-size: 8px !important;
          font-weight: var(--kova-font-weight-bold) !important;
          width: 14px !important;
          height: 14px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          line-height: 1 !important;
          border: 1px solid var(--kova-white) !important;
        }

        .kova-cart-toggle-count:empty {
          display: none !important;
        }

        .kova-widget__messages::-webkit-scrollbar {
          width: 6px !important;
        }

        .kova-widget__messages::-webkit-scrollbar-track {
          background: transparent !important;
        }

        .kova-widget__messages::-webkit-scrollbar-thumb {
          background: var(--kova-delicate) !important;
          border-radius: 3px !important;
        }

        .kova-widget__welcome {
          text-align: center !important;
        }

        .kova-widget__welcome-header {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-bottom: 24px !important;
        }

        .kova-widget__welcome-avatar {
          width: 56px !important;
          height: 56px !important;
          background: var(--kova-hydra) !important;
          border-radius: 12px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .kova-welcome-icon {
          width: 28px !important;
          height: 28px !important;
          color: var(--kova-white) !important;
        }

        .kova-widget__welcome-title {
          font-size: 20px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          color: var(--kova-perfect) !important;
          margin: 0 !important;
          letter-spacing: -0.02em !important;
          line-height: 1.4 !important;
        }

        .kova-widget__welcome-subtitle {
          display: block !important;
          color: var(--kova-secondary) !important;
          font-size: 16px !important;
          font-weight: var(--kova-font-weight-regular) !important;
          margin-top: 8px !important;
        }

        .kova-widget__welcome-message {
          color: var(--kova-black) !important;
          font-size: 14px !important;
          font-weight: var(--kova-font-weight-regular) !important;
          line-height: 1.5 !important;
          margin: 0 0 24px 0 !important;
          opacity: 0.8 !important;
        }

        .kova-widget__welcome-features {
          display: flex !important;
          flex-direction: column !important;
          gap: 20px !important;
          text-align: left !important;
        }

        .kova-widget__feature {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 16px !important;
          background: var(--kova-white) !important;
          border-radius: 12px !important;
          border: 1px solid rgba(165, 148, 87, 0.15) !important;
          transition: all 0.2s var(--kova-transition) !important;
          cursor: pointer !important;
        }

        .kova-widget__feature:hover {
          background: var(--kova-sage) !important;
          border-color: var(--kova-perfect) !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(165, 148, 87, 0.12) !important;
        }

        .kova-feature-icon {
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          min-height: 20px !important;
          color: var(--kova-perfect) !important;
          flex-shrink: 0 !important;
          display: block !important;
          stroke: currentColor !important;
          fill: none !important;
          overflow: visible !important;
        }

        .kova-widget__feature span {
          color: var(--kova-text-primary) !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          line-height: 1.3 !important;
        }

        /* Ultra-Modern Input Area */
        .kova-widget__input-area {
          padding: 24px 32px !important;
          background: rgba(255, 255, 255, 0.8) !important;
          backdrop-filter: blur(10px) !important;
          border-top: 1px solid rgba(212, 196, 184, 0.2) !important;
        }

        .kova-widget__input-container {
          display: flex !important;
          gap: 12px !important;
          margin-bottom: 12px !important;
          padding: 0 20px !important;
          width: 100% !important;
        }

        .kova-widget__input-wrapper {
          flex: 1 !important;
          display: flex !important;
          width: 100% !important;
        }

        .kova-widget__input {
          flex: 1 !important;
          width: 100% !important;
          min-width: 0 !important;
          padding: 10px 14px !important;
          border: 1px solid rgba(212, 196, 184, 0.3) !important;
          border-radius: 28px !important;
          font-family: var(--kova-font) !important;
          font-size: 13px !important;
          font-weight: var(--kova-font-weight-regular) !important;
          background: var(--kova-white) !important;
          color: var(--kova-black) !important;
          outline: none !important;
          transition: none !important;
          box-sizing: border-box !important;
        }

        .kova-widget__input:focus {
          border-color: var(--kova-perfect) !important;
          box-shadow: 0 0 0 3px rgba(165, 148, 87, 0.1) !important;
          transform: translateY(-1px) !important;
        }

        .kova-widget__input::placeholder {
          color: var(--kova-delicate) !important;
        }

        .kova-widget__send {
          width: 44px !important;
          height: 44px !important;
          background: var(--kova-perfect) !important;
          color: var(--kova-white) !important;
          border: none !important;
          border-radius: 12px !important;
          cursor: pointer !important;
          transition: none !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .kova-widget__send:hover {
          transform: translateY(-2px) scale(1.05) !important;
          box-shadow: var(--kova-shadow-medium) !important;
          background: var(--kova-rich) !important;
        }

        .kova-widget__send:disabled {
          opacity: 0.6 !important;
          cursor: not-allowed !important;
          transform: none !important;
        }

        .kova-widget__send svg {
          width: 20px !important;
          height: 20px !important;
        }

        /* Reset Button */
        .kova-widget__reset {
          width: 36px !important;
          height: 36px !important;
          background: rgba(212, 196, 184, 0.1) !important;
          color: var(--kova-forever) !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          transition: none !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
        }

        .kova-widget__reset:hover {
          background: rgba(212, 196, 184, 0.2) !important;
          transform: translateY(-1px) !important;
          border-color: rgba(212, 196, 184, 0.4) !important;
        }

        .kova-widget__reset svg {
          width: 16px !important;
          height: 16px !important;
        }

        .kova-widget__powered {
          text-align: center !important;
          font-size: 12px !important;
          font-weight: var(--kova-font-weight-medium) !important;
          color: var(--kova-forever) !important;
          opacity: 0.7 !important;
        }

        /* Message Styles */
        .kova-widget__message {
          margin: 12px 0 !important;
          padding: 12px 16px !important;
          border-radius: 8px !important;
          font-size: 13px !important;
          line-height: 1.4 !important;
          max-width: 85% !important;
        }

        .kova-widget__message--user {
          background: var(--kova-perfect) !important;
          color: var(--kova-white) !important;
          margin-left: auto !important;
          border-bottom-right-radius: 6px !important;
        }

        .kova-widget__message--assistant {
          background: rgba(255, 255, 255, 0.9) !important;
          color: var(--kova-black) !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          border-bottom-left-radius: 6px !important;
        }

        .kova-widget__message .list-item {
          margin: 8px 0 !important;
          padding-left: 8px !important;
        }

        .kova-widget__message .bullet-item {
          margin: 6px 0 !important;
          padding-left: 8px !important;
        }

        .kova-widget__message strong {
          font-weight: 600 !important;
          color: var(--kova-perfect) !important;
        }

        /* Typing Indicator */
        .kova-widget__typing {
          max-width: 75% !important;
        }

        .kova-typing-indicator {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          color: var(--kova-forever) !important;
          font-size: 13px !important;
          font-style: italic !important;
        }

        .kova-typing-dots {
          display: flex !important;
          gap: 4px !important;
          align-items: center !important;
        }

        .kova-dot {
          width: 6px !important;
          height: 6px !important;
          background: var(--kova-forever) !important;
          border-radius: 50% !important;
          animation: kova-typing-bounce 1.4s infinite ease-in-out both !important;
        }

        .kova-dot:nth-child(1) { animation-delay: -0.32s !important; }
        .kova-dot:nth-child(2) { animation-delay: -0.16s !important; }

        @keyframes kova-typing-bounce {
          0%, 80%, 100% {
            transform: scale(0.8) !important;
            opacity: 0.6 !important;
          }
          40% {
            transform: scale(1) !important;
            opacity: 1 !important;
          }
        }

        /* Responsive Design */
        @media (max-width: 1200px) {
          .kova-widget__chat {
            width: 60vw !important;
          }
        }

        @media (min-width: 481px) and (max-width: 768px) {
          /* Tablet responsive enhancements */
          .kova-widget__chat {
            width: calc(100vw - 24px) !important;
            height: calc(100vh - 120px) !important;
            left: 12px !important;
            bottom: 100px !important;
            border-radius: 20px !important;
            box-shadow: 0 10px 35px rgba(207, 121, 94, 0.2) !important;
          }
          
          /* Widget button tablet optimization */
          .kova-widget__button {
            width: 64px !important;
            height: 64px !important;
          }
          
          .kova-widget__button-content {
            width: 22px !important;
            height: 22px !important;
          }
          
          .kova-widget__chat-icon,
          .kova-widget__close-icon {
            width: 22px !important;
            height: 22px !important;
          }
          
          /* Chat interface tablet */
          .kova-widget__header {
            padding: 24px 28px !important;
          }
          
          .kova-widget__title {
            font-size: 19px !important;
          }
          
          .kova-widget__messages {
            padding: 20px 24px !important;
            gap: 18px !important;
          }
          
          .kova-widget__message {
            max-width: 85% !important;
            padding: 14px 18px !important;
            font-size: 15px !important;
          }
          
          /* Welcome screen tablet */
          .kova-widget__welcome {
            padding: 24px 28px !important;
          }
          
          .kova-widget__welcome-title {
            font-size: 22px !important;
          }
          
          .kova-widget__welcome-subtitle {
            font-size: 15px !important;
          }
          
          .kova-widget__feature {
            padding: 16px 18px !important;
            border-radius: 16px !important;
          }
          
          /* Input area tablet */
          .kova-widget__input-area {
            padding: 24px 28px !important;
          }
          
          .kova-widget__input {
            padding: 14px 18px !important;
            font-size: 15px !important;
          }
          
          .kova-widget__send {
            width: 48px !important;
            height: 48px !important;
          }
          
          /* Cart panel as bottom drawer on tablet */
          .kova-cart-panel {
            bottom: -100vh !important; /* Hidden below screen */
            left: 12px !important;
            right: auto !important;
            width: calc(100vw - 24px) !important;
            height: 65vh !important;
            max-height: 500px !important;
            border-radius: 24px 24px 0 0 !important;
            border: 1px solid rgba(212, 196, 184, 0.3) !important;
            border-bottom: none !important;
            box-shadow: 0 -10px 40px rgba(207, 121, 94, 0.18) !important;
            transition: bottom 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
          }
          
          .kova-cart-panel--open {
            bottom: 0 !important; /* Slide up from bottom */
          }
          
          /* Product cards tablet */
          .kova-product-card {
            min-height: 130px !important;
            padding: 18px !important;
            border-radius: 18px !important;
          }
          
          .kova-product-card__media {
            width: 85px !important;
            height: 85px !important;
            border-radius: 14px !important;
          }
          
          .kova-product-card__content {
            margin-left: 16px !important;
          }
          
          .kova-product-card__title {
            font-size: 16px !important;
          }
          
          .kova-product-card__description {
            font-size: 13px !important;
          }
          
          .kova-product-card__add-btn {
            padding: 12px 16px !important;
            font-size: 13px !important;
            min-height: 44px !important;
            border-radius: 14px !important;
          }
          
          .kova-widget__promotional-message {
            right: 12px !important;
            bottom: 100px !important;
            max-width: calc(100vw - 100px) !important;
            width: calc(100vw - 100px) !important;
            padding: 16px 20px !important;
            border-radius: 18px !important;
          }
        }

        @media (max-width: 480px) {
          /* ===== MOBILE OPTIMIZED STYLES ===== */

          /* Full screen chat on mobile */
          .kova-widget__chat {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            max-width: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding-bottom: env(safe-area-inset-bottom) !important;
            z-index: 999999 !important;
          }

          /* Widget button mobile */
          .kova-widget__button {
            width: 56px !important;
            height: 56px !important;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
            position: fixed !important;
            bottom: calc(16px + env(safe-area-inset-bottom)) !important;
            right: 16px !important;
            z-index: 999998 !important;
          }

          .kova-widget__button-content {
            width: 22px !important;
            height: 22px !important;
          }

          .kova-widget__chat-icon,
          .kova-widget__close-icon {
            width: 22px !important;
            height: 22px !important;
          }

          /* Floating actions mobile */
          .kova-widget__floating-actions {
            top: calc(12px + env(safe-area-inset-top)) !important;
            left: 16px !important;
            right: 16px !important;
          }

          .kova-widget__cart-toggle-btn,
          .kova-widget__close {
            padding: 12px !important;
            border-radius: 14px !important;
            min-width: 44px !important;
            min-height: 44px !important;
          }

          .kova-widget__cart-toggle-btn svg,
          .kova-cart-toggle-icon,
          .kova-widget__close svg {
            width: 20px !important;
            height: 20px !important;
          }

          .kova-cart-toggle-count {
            width: 18px !important;
            height: 18px !important;
            font-size: 10px !important;
            top: -6px !important;
            right: -6px !important;
          }

          /* Messages area mobile */
          .kova-widget__messages {
            padding: calc(70px + env(safe-area-inset-top)) 16px 16px 16px !important;
            -webkit-overflow-scrolling: touch !important;
          }

          .kova-widget__message {
            max-width: 88% !important;
            padding: 14px 16px !important;
            font-size: 15px !important;
            line-height: 1.5 !important;
            border-radius: 18px !important;
          }

          /* Welcome screen mobile */
          .kova-widget__welcome {
            padding: 16px !important;
          }

          .kova-widget__welcome-title {
            font-size: 22px !important;
            margin-bottom: 6px !important;
            line-height: 1.3 !important;
          }

          .kova-widget__welcome-subtitle {
            font-size: 15px !important;
            display: block !important;
            margin-top: 8px !important;
          }

          .kova-widget__welcome-features {
            gap: 12px !important;
            margin-top: 24px !important;
          }

          .kova-widget__feature {
            padding: 16px !important;
            border-radius: 16px !important;
            min-height: 56px !important;
            touch-action: manipulation !important;
          }
          
          .kova-widget__feature span {
            font-size: 15px !important;
            line-height: 1.4 !important;
          }

          .kova-feature-icon {
            width: 24px !important;
            height: 24px !important;
            flex-shrink: 0 !important;
          }

          /* Input area mobile */
          .kova-widget__input-container {
            padding: 12px 16px !important;
            padding-bottom: calc(12px + env(safe-area-inset-bottom)) !important;
            background: rgba(255, 255, 255, 0.98) !important;
            border-top: 1px solid rgba(0, 0, 0, 0.06) !important;
          }

          .kova-widget__input-wrapper {
            gap: 10px !important;
          }

          .kova-widget__input {
            padding: 14px 18px !important;
            font-size: 16px !important; /* Prevent iOS zoom */
            border-radius: 24px !important;
            background: rgba(0, 0, 0, 0.04) !important;
            border: none !important;
          }

          .kova-widget__input:focus {
            background: white !important;
            border: 1px solid var(--kova-primary-dynamic, var(--kova-perfect)) !important;
          }

          .kova-widget__send {
            width: 48px !important;
            height: 48px !important;
            border-radius: 24px !important;
            flex-shrink: 0 !important;
            touch-action: manipulation !important;
          }

          .kova-widget__send svg {
            width: 20px !important;
            height: 20px !important;
          }

          /* Cart panel mobile - full screen bottom sheet */
          .kova-widget .kova-cart-panel,
          html .kova-widget .kova-cart-panel,
          .kova-cart-panel {
            position: fixed !important;
            top: auto !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            max-width: none !important;
            height: 85vh !important;
            max-height: none !important;
            transform: translateY(100%) !important;
            opacity: 1 !important;
            visibility: hidden !important;
            z-index: 1000000 !important;
            transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), visibility 0.35s !important;
            background: white !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border-radius: 24px 24px 0 0 !important;
            border: none !important;
            box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.15) !important;
            padding-bottom: env(safe-area-inset-bottom) !important;
          }

          .kova-widget .kova-cart-panel--open,
          html .kova-widget .kova-cart-panel--open,
          .kova-cart-panel--open {
            transform: translateY(0) !important;
            visibility: visible !important;
          }

          /* Mobile cart backdrop */
          .kova-widget--cart-open::before {
            content: '' !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 999999 !important;
            animation: fadeIn 0.3s ease !important;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          /* Cart header mobile with drag handle */
          .kova-cart-panel__header {
            padding: 24px 20px 16px 20px !important;
            position: relative !important;
          }

          .kova-cart-panel__header::before {
            content: '' !important;
            position: absolute !important;
            top: 10px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 36px !important;
            height: 4px !important;
            background: rgba(0, 0, 0, 0.15) !important;
            border-radius: 2px !important;
          }

          .kova-cart-panel__header::after {
            display: none !important;
          }

          .kova-cart-panel__close {
            padding: 12px !important;
            min-width: 44px !important;
            min-height: 44px !important;
            border-radius: 12px !important;
          }

          /* Cart items mobile */
          .kova-cart-panel__items {
            padding: 0 20px !important;
          }

          .kova-cart-panel__item {
            padding: 16px !important;
            margin-bottom: 12px !important;
            border-radius: 16px !important;
          }

          .kova-cart-panel__item-image-container {
            width: 80px !important;
            height: 80px !important;
          }

          /* Cart footer mobile */
          .kova-cart-panel__footer {
            padding: 20px !important;
            padding-bottom: calc(20px + env(safe-area-inset-bottom)) !important;
          }

          .kova-cart-panel__checkout {
            padding: 18px 24px !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            min-height: 56px !important;
            border-radius: 16px !important;
          }

          /* Hide promotional message on mobile when widget is open */
          .kova-widget--open .kova-widget__promotional-message {
            display: none !important;
          }

          .kova-widget__promotional-message {
            right: 16px !important;
            bottom: calc(80px + env(safe-area-inset-bottom)) !important;
            max-width: calc(100vw - 100px) !important;
            width: auto !important;
            padding: 14px 18px !important;
            border-radius: 16px !important;
          }

          /* Product cards mobile */
          .kova-product-card {
            border-radius: 16px !important;
          }

          .kova-product-card__add-btn {
            min-height: 48px !important;
            border-radius: 12px !important;
            font-size: 14px !important;
          }

          /* Loading and error states mobile */
          .kova-widget__typing {
            padding: 10px 16px !important;
            border-radius: 16px !important;
          }

          .kova-widget__error {
            padding: 14px 16px !important;
            font-size: 14px !important;
            border-radius: 14px !important;
          }

          /* Empty state mobile */
          .kova-cart-panel__empty {
            padding: 40px 20px !important;
          }

          .kova-cart-panel__empty-icon {
            width: 56px !important;
            height: 56px !important;
          }

          .kova-cart-panel__empty-text {
            font-size: 18px !important;
            line-height: 1.4 !important;
            font-weight: 500 !important;
          }
          
          .kova-feature-icon {
            width: 24px !important;
            height: 24px !important;
            min-width: 24px !important;
            min-height: 24px !important;
          }

          .kova-widget__welcome-title {
            font-size: 18px !important;
          }

          .kova-widget__welcome-message {
            font-size: 14px !important;
          }

          .kova-widget__input {
            font-size: 16px !important;
          }

          .kova-widget__input-container {
            padding: 16px !important;
            width: 100% !important;
          }

          .kova-widget__input-wrapper {
            flex: 1 !important;
            width: 100% !important;
          }
        }

        @media (max-width: 360px) {
          .kova-widget__chat {
            width: calc(100vw - 24px) !important;
            left: 12px !important;
            max-width: 360px !important;
          }
          
          .kova-widget__promotional-message {
            right: 6px !important;
            bottom: 82px !important;
            max-width: calc(100vw - 82px) !important;
            width: calc(100vw - 82px) !important;
            padding: 12px 16px !important;
          }

          .kova-widget__button {
            width: 56px !important;
            height: 56px !important;
          }

          .kova-widget__feature {
            padding: 18px !important;
            min-height: 60px !important;
            border-radius: 14px !important;
          }
          
          .kova-widget__feature span {
            font-size: 14px !important;
            font-weight: 500 !important;
          }
          
          .kova-feature-icon {
            width: 22px !important;
            height: 22px !important;
          }
          
          /* Mobile input area optimizations */
          .kova-widget__input-area {
            padding: 20px !important;
          }
          
          .kova-widget__input {
            padding: 16px 20px !important;
            font-size: 16px !important; /* Prevents zoom on iOS */
            border-radius: 14px !important;
          }
          
          .kova-widget__send-btn {
            width: 48px !important;
            height: 48px !important;
            border-radius: 14px !important;
          }
          
          /* Mobile message optimizations */
          .kova-widget__message {
            font-size: 15px !important;
            line-height: 1.5 !important;
          }
          
          /* Mobile cart toggle button */
          .kova-widget__cart-toggle-btn {
            padding: 10px !important;
            min-width: 44px !important;
            min-height: 44px !important;
          }
          
          /* Add safe area for notched devices */
          .kova-cart-panel {
            padding-bottom: env(safe-area-inset-bottom) !important;
          }
          
          /* Improve touch targets */
          .kova-cart-panel__quantity-btn,
          .kova-cart-panel__item-remove {
            min-width: 44px !important;
            min-height: 44px !important;
          }
          
          /* Optimize scrolling for mobile */
          .kova-cart-panel__items {
            -webkit-overflow-scrolling: touch !important;
          }
          
          .kova-widget__messages {
            -webkit-overflow-scrolling: touch !important;
          }

          .kova-widget__promotional-text {
            font-size: 13px !important;
          }

          .kova-widget__promotional-subtitle {
            font-size: 11px !important;
          }

          .kova-widget__welcome-title {
            font-size: 16px !important;
          }
        }

        /* Accessibility & Motion */
        @media (prefers-reduced-motion: reduce) {
          .kova-widget * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (prefers-color-scheme: dark) {
          .kova-widget__chat {
            background: rgba(26, 26, 26, 0.95) !important;
            border-color: rgba(212, 196, 184, 0.1) !important;
          }
          
          .kova-widget__welcome-message {
            color: var(--kova-sage) !important;
          }
          
          .kova-widget__feature {
            background: rgba(255, 255, 255, 0.05) !important;
            border-color: rgba(212, 196, 184, 0.1) !important;
          }
        }

        /* ===== NEW LAYOUT STYLES ===== */
        
        /* Main Widget Layout Container */
        .kova-widget-layout {
          display: flex !important;
          align-items: end !important;
          gap: 0 !important;
          position: relative !important;
        }

        /* Cart Toggle Button - Vertical Left */
        .kova-cart-toggle {
          width: 60px !important;
          height: 620px !important;
          background: rgba(248, 249, 248, 0.95) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          border-radius: 12px 0 0 12px !important;
          color: var(--kova-perfect) !important;
          cursor: pointer !important;
          transition: all var(--kova-duration) var(--kova-transition) !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          box-shadow: var(--kova-shadow-strong) !important;
          position: absolute !important;
          left: -60px !important;
          bottom: 0 !important;
          z-index: 999998 !important;
          overflow: hidden !important;
          /* Hidden by default when widget is closed */
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        /* Show cart button only when widget is open */
        .kova-widget--open .kova-cart-toggle {
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
        }

        .kova-cart-toggle:hover {
          transform: translateX(-2px) !important;
          box-shadow: 0 12px 28px rgba(207, 121, 94, 0.35), 0 4px 12px rgba(207, 121, 94, 0.2) !important;
          background: rgba(255, 255, 255, 0.98) !important;
        }

        .kova-cart-toggle::before {
          content: '' !important;
          position: absolute !important;
          inset: 0 !important;
          border-radius: inherit !important;
          background: var(--kova-perfect) !important;
          opacity: 0.1 !important;
          animation: kovaPulse 3s infinite !important;
          z-index: -1 !important;
        }

        .kova-cart-panel--open ~ .kova-cart-toggle::before {
          animation: none !important;
        }

        .kova-cart-toggle__icon {
          width: 24px !important;
          height: 24px !important;
          stroke-width: 2 !important;
        }

        .kova-cart-toggle__badge {
          position: absolute !important;
          top: 20px !important;
          right: -6px !important;
          background: var(--kova-perfect) !important;
          color: var(--kova-white) !important;
          border-radius: 50% !important;
          width: 20px !important;
          height: 20px !important;
          font-size: 10px !important;
          font-weight: bold !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 2px solid var(--kova-white) !important;
          box-shadow: var(--kova-shadow-medium) !important;
          transition: all 0.2s var(--kova-transition) !important;
        }

        /* Cart Panel - Floating panel to the left of chat widget */
        .kova-cart-panel {
          position: fixed !important;
          bottom: 88px !important; /* Same as chat widget */
          right: auto !important;
          left: auto !important;
          width: 340px !important;
          height: 580px !important; /* Slightly shorter than chat */
          background: rgba(255, 255, 255, 0.98) !important;
          backdrop-filter: blur(24px) !important;
          -webkit-backdrop-filter: blur(24px) !important;
          border-radius: 16px !important; /* Rounded on all sides */
          border: 1px solid rgba(212, 196, 184, 0.25) !important;
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.12),
            0 8px 24px rgba(165, 148, 87, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          z-index: 999997 !important;
          transform: translateX(30px) scale(0.95) !important;
          transition: all 0.35s cubic-bezier(0.32, 0.72, 0, 1) !important;
        }

        .kova-cart-panel--open {
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          transform: translateX(0) scale(1) !important;
        }

        /* Cart panel positioning for bottom-right widget (default) */
        /* Position to the left of the chat widget with a gap */
        .kova-widget--bottom-right .kova-cart-panel {
          right: calc(var(--kova-chat-width, 420px) + 32px + 20px) !important; /* chat width + widget margin + gap */
          left: auto !important;
        }

        /* Cart panel positioning for bottom-left widget */
        .kova-widget--bottom-left .kova-cart-panel {
          left: calc(var(--kova-chat-width, 420px) + 32px + 20px) !important; /* Position to right of chat */
          right: auto !important;
        }

        /* No longer connecting the panels - they float separately */

        /* Cart Panel Header */
        .kova-cart-panel__header {
          padding: 18px 20px !important;
          background: linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,249,248,0.95) 100%) !important;
          color: var(--kova-black) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          border: none !important;
          border-bottom: 1px solid rgba(212, 196, 184, 0.15) !important;
          flex-shrink: 0 !important;
          position: relative !important;
        }

        .kova-cart-panel__header::after {
          content: '' !important;
          position: absolute !important;
          bottom: 0 !important;
          left: 20px !important;
          right: 20px !important;
          height: 1px !important;
          background: linear-gradient(90deg, transparent, rgba(165, 148, 87, 0.3), transparent) !important;
        }

        .kova-cart-panel__title {
          font-size: 15px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          margin: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          color: var(--kova-black) !important;
        }

        .kova-cart-panel__title h3 {
          margin: 0 !important;
          font-size: 15px !important;
          font-weight: 600 !important;
        }

        .kova-cart-panel__icon {
          width: 18px !important;
          height: 18px !important;
          color: var(--kova-perfect) !important;
        }

        .kova-cart-panel__close {
          background: rgba(0, 0, 0, 0.04) !important;
          border: none !important;
          border-radius: 10px !important;
          padding: 8px !important;
          color: var(--kova-black) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--kova-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .kova-cart-panel__close:hover {
          background: rgba(0, 0, 0, 0.08) !important;
          transform: scale(1.05) !important;
        }

        .kova-cart-panel__close svg {
          width: 18px !important;
          height: 18px !important;
        }

        /* Cart Panel Content */
        .kova-cart-panel__content {
          flex: 1 !important;
          overflow-y: auto !important;
          padding: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch !important;
          justify-content: flex-start !important;
          min-height: 0 !important; /* Important for proper flex behavior with sticky footer */
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        
        .kova-cart-panel__content::-webkit-scrollbar {
          display: none !important;
        }

        /* Empty State */
        .kova-cart-panel__empty {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          height: 200px !important;
          padding: 40px 24px !important;
          text-align: center !important;
          margin-top: 20px !important;
        }

        .kova-cart-panel__empty-icon {
          width: 48px !important;
          height: 48px !important;
          color: var(--kova-perfect) !important;
          opacity: 0.6 !important;
          margin-bottom: 16px !important;
        }

        .kova-cart-panel__empty-text {
          font-size: 16px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          color: var(--kova-text-primary) !important;
          margin-bottom: 8px !important;
        }

        .kova-cart-panel__empty-subtitle {
          font-size: 14px !important;
          color: var(--kova-text-secondary) !important;
        }

        /* FORCE HIDE empty state when there are items */
        .kova-cart-panel__items--visible ~ .kova-cart-panel__empty,
        .kova-cart-panel__empty[style*="display: none"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
        }

        /* Items Container - Enhanced scrolling */
        .kova-cart-panel__items {
          padding: 20px 24px 0 24px !important;
          flex: 1 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 16px !important;
          /* Enhanced scrolling properties */
          scroll-behavior: smooth !important;
          scrollbar-width: thin !important;
          scrollbar-color: var(--kova-perfect) rgba(212, 196, 184, 0.2) !important;
          /* Max height to ensure scroll is visible */
          max-height: calc(100% - 80px) !important;
          /* Better scroll performance */
          will-change: scroll-position !important;
        }

        /* Custom scrollbar for webkit browsers */
        .kova-cart-panel__items::-webkit-scrollbar {
          width: 6px !important;
        }

        .kova-cart-panel__items::-webkit-scrollbar-track {
          background: rgba(212, 196, 184, 0.1) !important;
          border-radius: 3px !important;
        }

        .kova-cart-panel__items::-webkit-scrollbar-thumb {
          background: var(--kova-perfect) !important;
          border-radius: 3px !important;
          transition: background 0.2s ease !important;
        }

        .kova-cart-panel__items::-webkit-scrollbar-thumb:hover {
          background: var(--kova-rich) !important;
        }

        /* Scroll shadow indicators */
        .kova-cart-panel__items::before {
          content: '' !important;
          position: sticky !important;
          top: 0 !important;
          height: 20px !important;
          background: linear-gradient(to bottom, rgba(248, 249, 248, 0.98), transparent) !important;
          z-index: 1 !important;
          pointer-events: none !important;
          margin: -20px -24px 0 -24px !important;
        }

        .kova-cart-panel__items::after {
          content: '' !important;
          position: sticky !important;
          bottom: 0 !important;
          height: 20px !important;
          background: linear-gradient(to top, rgba(248, 249, 248, 0.98), transparent) !important;
          z-index: 1 !important;
          pointer-events: none !important;
          margin: 0 -24px -20px -24px !important;
        }

        .kova-cart-panel__items--visible {
          animation: kova-fade-in 0.3s ease-in-out !important;
        }

        @keyframes kova-fade-in {
          from {
            opacity: 0 !important;
            transform: translateY(10px) !important;
          }
          to {
            opacity: 1 !important;
            transform: translateY(0) !important;
          }
        }
        
        /* FIXED: Improved cart item animations */
        .kova-cart-panel__item {
          opacity: 1 !important;
          transform: translateY(0) !important;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
          will-change: transform, opacity !important;
        }
        
        .kova-cart-panel__item--removing {
          opacity: 0 !important;
          transform: translateX(-100%) scale(0.8) !important;
          pointer-events: none !important;
        }
        
        .kova-cart-panel__quantity-btn {
          transition: all 0.2s ease !important;
        }
        
        .kova-cart-panel__quantity-btn:active {
          transform: scale(0.95) !important;
        }
        
        .kova-cart-panel__quantity-value {
          transition: transform 0.2s ease !important;
        }
        
        .kova-cart-panel__quantity-value--updating {
          transform: scale(1.1) !important;
        }

        /* Cart Loading */
        .kova-cart-loading {
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          padding: 40px 20px !important;
          flex: 1 !important;
        }

        .kova-cart-loading__content {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 12px !important;
          color: var(--kova-perfect) !important;
        }

        .kova-cart-loading svg {
          width: 32px !important;
          height: 32px !important;
          color: var(--kova-perfect) !important;
        }

        .kova-cart-loading span {
          font-size: 14px !important;
          font-weight: var(--kova-font-weight-medium) !important;
          opacity: 0.8 !important;
        }

        /* Cart Item */
        .kova-cart-panel__item {
          display: flex !important;
          gap: 16px !important;
          padding: 16px !important;
          background: var(--kova-white) !important;
          border-radius: 12px !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          box-shadow: 0 2px 8px rgba(165, 148, 87, 0.08) !important;
          transition: all 0.3s ease !important;
          overflow: hidden !important;
          transform-origin: center !important;
        }
        
        .kova-cart-panel__item:hover {
          border-color: rgba(165, 148, 87, 0.3) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(165, 148, 87, 0.12) !important;
        }

        /* Item Image */
        .kova-cart-panel__item-image-container {
          flex-shrink: 0 !important;
          width: 80px !important;
          height: 80px !important;
        }

        .kova-cart-panel__item-image {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 8px !important;
          background: var(--kova-surface) !important;
        }

        .kova-cart-panel__item-image--placeholder {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: rgba(212, 196, 184, 0.1) !important;
          color: rgba(165, 148, 87, 0.5) !important;
        }

        .kova-cart-panel__item-image--placeholder svg {
          width: 32px !important;
          height: 32px !important;
        }

        /* Item Details */
        .kova-cart-panel__item-details {
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
        }

        .kova-cart-panel__item-info {
          margin-bottom: 12px !important;
        }

        .kova-cart-panel__item-title {
          font-size: 14px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          color: var(--kova-text-primary) !important;
          margin: 0 0 4px 0 !important;
          line-height: 1.3 !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
        }

        .kova-cart-panel__item-variant {
          font-size: 12px !important;
          color: var(--kova-text-secondary) !important;
          margin: 0 0 8px 0 !important;
          opacity: 0.8 !important;
        }

        .kova-cart-panel__item-price-info {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .kova-cart-panel__item-unit-price {
          font-size: 12px !important;
          color: var(--kova-text-secondary) !important;
        }

        .kova-cart-panel__item-total-price {
          font-size: 16px !important;
          font-weight: var(--kova-font-weight-bold) !important;
          color: var(--kova-perfect) !important;
        }

        /* Item Controls */
        .kova-cart-panel__item-controls {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px !important;
        }

        .kova-cart-panel__item-quantity {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          background: rgba(212, 196, 184, 0.1) !important;
          border-radius: 8px !important;
          padding: 4px !important;
        }

        .kova-cart-panel__quantity-btn {
          width: 28px !important;
          height: 28px !important;
          border-radius: 6px !important;
          border: none !important;
          background: var(--kova-perfect) !important;
          color: var(--kova-white) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--kova-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .kova-cart-panel__quantity-btn:hover {
          background: var(--kova-rich) !important;
          transform: scale(1.1) !important;
        }

        .kova-cart-panel__quantity-btn svg {
          width: 14px !important;
          height: 14px !important;
        }

        .kova-cart-panel__quantity-value {
          font-size: 14px !important;
          font-weight: var(--kova-font-weight-semibold) !important;
          color: var(--kova-text-primary) !important;
          min-width: 20px !important;
          text-align: center !important;
        }

        .kova-cart-panel__item-remove {
          background: rgba(220, 53, 69, 0.1) !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 6px !important;
          color: #dc3545 !important;
          cursor: pointer !important;
          transition: all 0.2s var(--kova-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .kova-cart-panel__item-remove:hover {
          background: rgba(220, 53, 69, 0.2) !important;
          transform: scale(1.1) !important;
        }

        .kova-cart-panel__item-remove svg {
          width: 14px !important;
          height: 14px !important;
        }

        /* Cart Panel Footer */
        .kova-cart-panel__footer {
          padding: 20px !important;
          background: linear-gradient(180deg, rgba(248,249,248,0.95) 0%, rgba(255,255,255,1) 100%) !important;
          border-top: none !important;
          position: relative !important;
          z-index: 10 !important;
          flex-shrink: 0 !important;
        }

        .kova-cart-panel__footer::before {
          content: '' !important;
          position: absolute !important;
          top: 0 !important;
          left: 20px !important;
          right: 20px !important;
          height: 1px !important;
          background: linear-gradient(90deg, transparent, rgba(165, 148, 87, 0.2), transparent) !important;
        }

        .kova-cart-panel__total {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 16px !important;
          padding: 0 !important;
          border: none !important;
        }

        .kova-cart-panel__total-label {
          font-size: 14px !important;
          font-weight: 500 !important;
          color: var(--kova-text-primary) !important;
          opacity: 0.7 !important;
        }

        .kova-cart-panel__total-price {
          font-size: 22px !important;
          font-weight: 700 !important;
          color: var(--kova-perfect) !important;
          letter-spacing: -0.5px !important;
        }

        /* Checkout Button - Uses dynamic primary color */
        .kova-cart-panel__checkout {
          width: 100% !important;
          background: var(--kova-primary-dynamic, var(--kova-perfect)) !important;
          color: var(--kova-white) !important;
          border: none !important;
          border-radius: 14px !important;
          padding: 16px 24px !important;
          font-size: 15px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 10px !important;
          text-transform: none !important;
          letter-spacing: 0 !important;
          box-shadow: 0 4px 12px rgba(165, 148, 87, 0.25) !important;
        }

        .kova-cart-panel__checkout:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 24px rgba(165, 148, 87, 0.35) !important;
          filter: brightness(1.05) !important;
        }

        .kova-cart-panel__checkout:active {
          transform: translateY(0) !important;
        }

        .kova-cart-panel__checkout svg {
          width: 18px !important;
          height: 18px !important;
        }

        /* Chat Container positioning */
        .kova-chat-container {
          position: relative !important;
          order: 2 !important;
          margin-left: 0 !important;
        }

        /* Responsive Design for larger tablets - exclude mobile */
        @media (min-width: 481px) and (max-width: 1024px) {
          .kova-cart-panel {
            right: 380px !important; /* Closer to chat on smaller screens */
            width: 350px !important;
            height: 520px !important;
          }
        }

        /* Responsive Design - Tablet only (not mobile) */
        @media (min-width: 481px) and (max-width: 768px) {
          .kova-widget {
            bottom: 10px !important;
            right: 10px !important;
          }
          
          .kova-cart-panel {
            right: auto !important;
            width: 300px !important;
            height: calc(100vh - 120px) !important;
          }
          
          .kova-cart-toggle {
            width: 50px !important;
            height: 400px !important;
            left: -50px !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
          
          .kova-cart-panel--open {
            right: 60vw !important; /* Position to left of chat widget */
          }
          
          .kova-widget--open .kova-cart-toggle {
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
          }
        }

        @media (max-width: 480px) {
          .kova-widget {
            bottom: 5px !important;
            right: 5px !important;
          }
          
          /* Cart panel uses centered modal on mobile (configured above) */
          
          .kova-cart-toggle {
            width: 45px !important;
            height: 350px !important;
            left: -45px !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
          
          .kova-widget--open .kova-cart-toggle {
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
          }
          
          .kova-cart-toggle__icon {
            width: 18px !important;
            height: 18px !important;
          }

          /* Mobile Product Recommendations */
          /* Enhanced mobile product cards */
          .kova-product-card {
            min-height: 140px !important;
            padding: 16px !important;
            margin-bottom: 12px !important;
            border-radius: 16px !important;
            box-shadow: 0 4px 16px rgba(165, 148, 87, 0.12) !important;
            background: var(--kova-white) !important;
            border: 1px solid rgba(212, 196, 184, 0.25) !important;
            transition: all 0.3s ease !important;
          }
          
          .kova-product-card:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 8px 24px rgba(165, 148, 87, 0.18) !important;
            border-color: rgba(165, 148, 87, 0.4) !important;
          }
          
          .kova-product-card__media {
            width: 90px !important;
            height: 90px !important;
            border-radius: 12px !important;
            overflow: hidden !important;
            flex-shrink: 0 !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
          }
          
          .kova-product-card__image {
            transition: transform 0.3s ease !important;
          }
          
          .kova-product-card__image:hover {
            transform: scale(1.05) !important;
          }
          
          .kova-product-card__content {
            padding: 0 !important;
            margin-left: 14px !important;
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            min-height: 90px !important;
          }
          
          .kova-product-card__title {
            font-size: 15px !important;
            font-weight: 600 !important;
            line-height: 1.3 !important;
            margin-bottom: 4px !important;
            color: var(--kova-black) !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
          }
          
          .kova-product-card__description {
            font-size: 12px !important;
            line-height: 1.4 !important;
            color: var(--kova-perfect) !important;
            opacity: 0.8 !important;
            margin-bottom: 8px !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
          }
          
          .kova-product-card__price-section {
            margin-bottom: 12px !important;
          }
          
          .kova-product-card__pricing {
            gap: 6px !important;
            align-items: baseline !important;
          }
          
          .kova-product-card__price {
            font-size: 16px !important;
            font-weight: 700 !important;
            color: var(--kova-perfect) !important;
          }
          
          .kova-product-card__compare-price {
            font-size: 13px !important;
            color: rgba(165, 148, 87, 0.6) !important;
          }
          
          .kova-product-card__tags {
            gap: 4px !important;
            margin-bottom: 8px !important;
          }
          
          .kova-product-card__tag {
            font-size: 10px !important;
            padding: 2px 6px !important;
            border-radius: 8px !important;
            background: rgba(165, 148, 87, 0.1) !important;
            color: var(--kova-perfect) !important;
          }
          
          .kova-product-card__actions {
            gap: 8px !important;
            margin-top: auto !important;
          }
          
          .kova-product-card__add-btn {
            padding: 10px 14px !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            border-radius: 12px !important;
            min-height: 40px !important;
            flex: 1 !important;
            background: var(--kova-perfect) !important;
            color: var(--kova-white) !important;
            border: none !important;
            transition: all 0.2s ease !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 6px !important;
          }
          
          .kova-product-card__add-btn:hover {
            background: var(--kova-rich) !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 4px 12px rgba(165, 148, 87, 0.3) !important;
          }
          
          .kova-product-card__add-btn--disabled {
            background: rgba(165, 148, 87, 0.3) !important;
            cursor: not-allowed !important;
            transform: none !important;
            box-shadow: none !important;
          }
          
          .kova-product-card__add-btn--success {
            background: #10b981 !important;
          }
          
          .kova-product-card__details-btn {
            padding: 8px !important;
            min-width: 40px !important;
            height: 40px !important;
            border-radius: 12px !important;
            background: rgba(165, 148, 87, 0.1) !important;
            border: 1px solid rgba(165, 148, 87, 0.3) !important;
            color: var(--kova-perfect) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
          }
          
          .kova-product-card__details-btn:hover {
            background: rgba(165, 148, 87, 0.15) !important;
            border-color: var(--kova-perfect) !important;
            transform: translateY(-1px) !important;
          }
          
          .kova-product-card__header {
            margin-bottom: 6px !important;
          }
          
          .kova-product-card__discount {
            font-size: 11px !important;
            padding: 3px 6px !important;
            border-radius: 6px !important;
          }
          
          .kova-product-card__quick-view {
            width: 40px !important;
            height: 40px !important;
            border-radius: 8px !important;
          }
          
          .kova-product-card__quick-view svg,
          .kova-product-card__details-btn svg,
          .kova-product-card__add-btn svg {
            width: 14px !important;
            height: 14px !important;
          }
          
          /* Mobile Cart Items */
          .kova-cart-panel__items {
            padding: 16px 12px 0 12px !important;
            gap: 12px !important;
          }

          .kova-cart-panel__item {
            padding: 12px !important;
            gap: 12px !important;
          }

          .kova-cart-panel__item-image-container {
            width: 60px !important;
            height: 60px !important;
          }

          .kova-cart-panel__item-title {
            font-size: 13px !important;
          }

          .kova-cart-panel__item-variant {
            font-size: 11px !important;
          }

          .kova-cart-panel__item-total-price {
            font-size: 14px !important;
          }

          .kova-cart-panel__quantity-btn {
            width: 24px !important;
            height: 24px !important;
          }
        }
      `;

      document.head.appendChild(style);
    }

    /**
     * Apply dynamic styles based on loaded configuration
     * This method updates CSS custom properties based on this.config values
     */
    applyDynamicStyles() {
      // Remove existing dynamic styles if present
      const existingDynamic = document.getElementById('kova-dynamic-styles');
      if (existingDynamic) {
        existingDynamic.remove();
      }

      const dynamicStyle = document.createElement('style');
      dynamicStyle.id = 'kova-dynamic-styles';

      // Get config values with fallbacks
      const primaryColor = this.config.primaryColor || '#a59457';
      const secondaryColor = this.config.secondaryColor || '#212120';
      const accentColor = this.config.accentColor || '#cf795e';
      const buttonSize = this.config.buttonSize || 72;
      const chatWidth = this.config.chatWidth || 420;
      const chatHeight = this.config.chatHeight || 600;
      const buttonStyle = this.config.buttonStyle || 'circle';
      const showPulse = this.config.showPulse !== false;
      const theme = this.config.theme || 'light';

      // Calculate button border radius based on style
      let buttonRadius = '50%'; // circle (default)
      if (buttonStyle === 'rounded') buttonRadius = '16px';
      if (buttonStyle === 'square') buttonRadius = '8px';

      // Theme-based surface colors
      const surfaceColor = theme === 'dark' ? '#1a1a1a' : '#F8F9F8';
      const surfaceBg = theme === 'dark' ? 'rgba(26, 26, 26, 0.95)' : 'rgba(248, 249, 248, 0.95)';
      const textPrimary = theme === 'dark' ? '#ffffff' : '#212120';

      dynamicStyle.textContent = `
        /* Dynamic Kova Widget Styles - Applied from configuration */
        :root {
          --kova-primary-dynamic: ${primaryColor} !important;
          --kova-secondary-dynamic: ${secondaryColor} !important;
          --kova-accent-dynamic: ${accentColor} !important;
          --kova-chat-width: ${chatWidth}px !important;
          --kova-chat-height: ${chatHeight}px !important;
          --kova-button-size: ${buttonSize}px !important;
        }

        /* Override base colors with dynamic values */
        .kova-widget__button {
          width: ${buttonSize}px !important;
          height: ${buttonSize}px !important;
          border-radius: ${buttonRadius} !important;
          background: ${primaryColor} !important;
        }

        .kova-widget__button:hover {
          background: ${this.adjustColor(primaryColor, -15)} !important;
        }

        .kova-widget__button-pulse {
          background: ${primaryColor} !important;
          border-radius: ${buttonRadius} !important;
          ${!showPulse ? 'display: none !important;' : ''}
        }

        .kova-widget__chat {
          width: ${chatWidth}px !important;
          height: ${chatHeight}px !important;
          background: ${surfaceBg} !important;
        }

        /* Cart panel dynamic positioning */
        .kova-widget--bottom-right .kova-cart-panel {
          right: calc(${chatWidth}px + 52px) !important;
        }

        .kova-widget--bottom-left .kova-cart-panel {
          left: calc(${chatWidth}px + 52px) !important;
        }

        .kova-cart-panel {
          height: ${Math.min(chatHeight - 40, 580)}px !important;
        }

        /* Input focus and send button */
        .kova-widget__input:focus {
          border-color: ${primaryColor} !important;
          box-shadow: 0 0 0 3px ${primaryColor}22 !important;
        }

        .kova-widget__send {
          background: ${primaryColor} !important;
        }

        .kova-widget__send:hover:not(:disabled) {
          background: ${this.adjustColor(primaryColor, -15)} !important;
        }

        /* Message bubbles */
        .kova-widget__message--assistant .kova-widget__message-content {
          border-left-color: ${primaryColor} !important;
        }

        /* Product cards */
        .kova-widget__product-actions button,
        .kova-widget__product-add {
          background: ${primaryColor} !important;
        }

        .kova-widget__product-actions button:hover,
        .kova-widget__product-add:hover {
          background: ${this.adjustColor(primaryColor, -15)} !important;
        }

        /* Cart panel */
        .kova-cart-panel__checkout {
          background: ${primaryColor} !important;
        }

        .kova-cart-panel__checkout:hover {
          background: ${this.adjustColor(primaryColor, -15)} !important;
        }

        /* Feature items and promotional message */
        .kova-widget__feature:hover {
          border-color: ${primaryColor} !important;
        }

        .kova-widget__promotional-text {
          color: ${primaryColor} !important;
        }

        /* Typing indicator */
        .kova-typing-dot {
          background: ${primaryColor} !important;
        }

        /* Welcome title accent */
        .kova-widget__welcome-title {
          color: ${secondaryColor} !important;
        }

        .kova-widget__welcome-subtitle {
          color: ${primaryColor} !important;
        }

        /* Cart toggle button */
        .kova-widget__cart-toggle-btn:hover {
          background: ${primaryColor}15 !important;
          border-color: ${primaryColor}40 !important;
        }

        .kova-cart-toggle-count {
          background: ${accentColor} !important;
        }

        /* Theme-specific overrides */
        ${theme === 'dark' ? `
        .kova-widget__chat {
          background: ${surfaceBg} !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
        .kova-widget__messages {
          background: ${surfaceColor} !important;
        }
        .kova-widget__input {
          background: rgba(255, 255, 255, 0.05) !important;
          color: ${textPrimary} !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
        .kova-widget__message--user .kova-widget__message-content {
          background: ${primaryColor} !important;
          color: white !important;
        }
        .kova-widget__message--assistant .kova-widget__message-content {
          background: rgba(255, 255, 255, 0.05) !important;
          color: ${textPrimary} !important;
        }
        .kova-widget__welcome {
          background: transparent !important;
        }
        .kova-widget__welcome-title,
        .kova-widget__feature span {
          color: ${textPrimary} !important;
        }
        ` : ''}

        /* Mobile responsiveness - maintain dynamic sizes on small screens */
        @media (max-width: 480px) {
          .kova-widget__chat {
            width: 100vw !important;
            height: 100dvh !important;
          }
          .kova-widget__button {
            width: ${Math.min(buttonSize, 64)}px !important;
            height: ${Math.min(buttonSize, 64)}px !important;
          }
        }
      `;

      document.head.appendChild(dynamicStyle);
      console.log('🎨 Dynamic styles applied:', { primaryColor, secondaryColor, accentColor, buttonSize, chatWidth, chatHeight, buttonStyle, theme });
    }

    /**
     * Adjust color brightness (helper for hover states)
     */
    adjustColor(color, amount) {
      // Convert hex to RGB, adjust, and convert back
      const hex = color.replace('#', '');
      const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
      const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
      const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    addEventListeners() {
      console.log('✨ Adding luxury event listeners...');

      // Prevent duplicate event listeners
      if (this.eventListenersAdded) {
        console.log('⚠️ Event listeners already added, skipping...');
        return;
      }

      // Mobile Viewport & Keyboard Handling
      if (window.visualViewport) {
        const handleViewportChange = () => {
          if (!this.isOpen) return;

          // Only apply on mobile devices (width <= 480px)
          if (window.innerWidth > 480) return;

          const viewport = window.visualViewport;
          const chatContainer = this.container.querySelector('.kova-widget__chat');

          if (chatContainer) {
            // Adjust height to fit visible viewport
            // Subtract header (88px) and some padding
            const availableHeight = viewport.height;
            const keyboardVisible = viewport.height < window.innerHeight;

            if (keyboardVisible) {
              // Keyboard is open
              chatContainer.style.height = `${availableHeight - 20}px`;
              chatContainer.style.bottom = `${window.innerHeight - viewport.height - viewport.offsetTop + 10}px`;

              // Ensure input is visible
              setTimeout(() => {
                if (this.input) this.input.scrollIntoView({ block: 'end', behavior: 'smooth' });
              }, 100);
            } else {
              // Keyboard is closed - reset to CSS defaults
              chatContainer.style.height = '';
              chatContainer.style.bottom = '';
            }
          }
        };

        window.visualViewport.addEventListener('resize', handleViewportChange);
        window.visualViewport.addEventListener('scroll', handleViewportChange);
      }

      // Toggle widget open/close
      if (this.button) {
        this.button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('✨ Luxury button clicked! Current state:', this.isOpen);
          this.toggle();
        });
        console.log('✅ Luxury button event listener added');
      } else {
        console.error('❌ Button element not found!');
      }

      // Promotional message click
      if (this.promotionalMessage) {
        this.promotionalMessage.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('✨ Promotional message clicked!');
          this.open();
        });
        console.log('✅ Promotional message event listener added');
      }

      // Close button
      if (this.closeButton) {
        this.closeButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('✨ Close button clicked!');
          this.close();
        });
        console.log('✅ Close button event listener added');
      }

      // Back button
      if (this.backButton) {
        this.backButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('✨ Back button clicked!');
          this.resetConversation();
        });
        console.log('✅ Back button event listener added');
      }

      // Send message on Enter key
      if (this.input) {
        this.input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !e.shiftKey && !this.isSending) {
            e.preventDefault();
            this.sendMessage();
          }
        });
      }

      // Send button click
      if (this.sendButton) {
        this.sendButton.addEventListener('click', (e) => {
          e.preventDefault();
          if (!this.isSending) {
            this.sendMessage();
          }
        });
      }

      // Reset button click - volver al inicio
      if (this.resetButton) {
        this.resetButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('✨ Reset button clicked!');
          this.resetConversation();
        });
        console.log('✅ Reset button event listener added');
      }

      // Feature cards click
      const featureCards = this.container.querySelectorAll('.kova-widget__feature[data-message]');
      featureCards.forEach(card => {
        card.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Prevent rapid double clicks
          if (card.dataset.clicked === 'true') return;
          card.dataset.clicked = 'true';
          setTimeout(() => {
            card.dataset.clicked = 'false';
          }, 1000);

          const message = card.getAttribute('data-message');
          if (message && this.input && !this.isSending) {
            this.input.value = message;
            this.sendMessage();
          }
        });
      });
      console.log('✅ Feature cards event listeners added:', featureCards.length);

      // Cart toggle - small toggle inside chat
      if (this.cartSmallToggle) {
        this.cartSmallToggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('✨ Small cart toggle clicked!');
          this.toggleCart();
        });
        console.log('✅ Small cart toggle event listener added');
      }


      // Cart close button
      if (this.cartClose) {
        this.cartClose.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('✨ Cart close button clicked!');
          this.hideCart();
        });
        console.log('✅ Cart close button event listener added');
      }

      // Cart checkout
      if (this.cartCheckout) {
        this.cartCheckout.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('✨ Cart checkout clicked!');
          this.proceedToCheckout();
        });
        console.log('✅ Cart checkout event listener added');
      }

      // Escape key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
        if (e.key === 'Escape' && this.cartVisible) {
          this.hideCart();
        }
      });

      // Add test function to window for debugging cart
      window.testAddToCart = () => {
        console.log('🧪 Adding test product to cart...');
        const testProduct = {
          id: 'test-product-123',
          title: 'Producto de Prueba',
          price: '29.99',
          quantity: 1,
          image: 'https://via.placeholder.com/80x80?text=Test',
          variantId: 'variant-123',
          handle: 'producto-prueba'
        };
        this.addToCartLocal(testProduct);
        this.forceHideEmptyMessage(); // Force hide after test
        this.showCart();
      };

      console.log('🧪 Test function available: window.testAddToCart()');

      // Test function for product recommendations
      const widget = this;
      window.testProductRecommendations = function () {
        console.log('🧪 Testing product recommendations from n8n format...');

        // Latest n8n format: {output: [{product: {...}}, {product: {...}}]}
        const mockN8nResponse = {
          "output": [
            {
              "product": {
                "id": 14890558325102,
                "title": "Loving Touch | Aceite de Masaje | My Little One",
                "image": {
                  "src": "https://cdn.shopify.com/s/files/1/example/loving-touch.jpg"
                },
                "price": 25990,
                "handle": "loving-touch-aceite-de-masaje-my-little-one",
                "variant_id": 53019925709166
              }
            },
            {
              "product": {
                "id": 14890558390638,
                "title": "Super Hero | Bálsamo Multiusos | Árnica",
                "image": {
                  "src": "https://cdn.shopify.com/s/files/1/example/super-hero.jpg"
                },
                "price": 18.50,
                "handle": "super-hero-balsamo-multiusos-arnica",
                "variant_id": 53019925938542
              }
            }
          ]
        };

        // Test the detection and rendering logic - simulate the full response processing
        widget.addMessage('🌿 Te recomiendo estos productos perfectos para ti:', 'assistant');

        // Extract products using the same logic as the main code
        const outputItems = mockN8nResponse.output.filter(item => item.product);
        const products = outputItems.map(item => item.product);
        widget.addProductRecommendations(products);

        return 'Product recommendations test completed! Check the chat.';
      };

      console.log('🧪 Test function available: window.testProductRecommendations()');

      // Test function for mixed text and product JSON
      window.testMixedResponse = function () {
        console.log('🧪 Testing mixed text and JSON response...');

        // Simulate the exact response from the screenshot
        const mixedResponse = `Te recomiendo nuevamente el producto:

### Loving Touch | Aceite de Masaje | My Little One

Este aceite es ideal para cuidar e hidratar la delicada piel de bebés y niños, gracias a su fórmula con aceite de sésamo, caléndula, rosa mosqueta y manzanilla que calma y protege la piel sensible. Perfecto para masajes tras el baño o para calmar irritaciones.

Si quieres, puedo ayudarte a agregarlo a tu carrito o responder cualquier duda que tengas sobre su uso.

{
"output": [
{
"product": {
"id": 14890558325102,
"title": "Loving Touch | Aceite de Masaje | My Little One",
"image": {
"src": ""
},
"price": 0,
"handle": "loving-touch-aceite-de-masaje-my-little-one",
"variant_id": 53019925709166
}
}
]
}`;

        // Test the automatic detection and parsing
        const parseResult = widget.parseProductsFromText(mixedResponse);

        console.log('Parsed result:', parseResult);

        // Add the clean text
        if (parseResult.cleanText) {
          widget.addMessage(parseResult.cleanText, 'assistant');
        }

        // Add products if found
        if (parseResult.products.length > 0) {
          widget.addProductRecommendations(parseResult.products);
        }

        return 'Mixed response test completed! Check the chat.';
      }.bind(this);

      console.log('🧪 Test function available: window.testMixedResponse()');

      // Test function for real cart functionality
      window.testRealCartAdd = function () {
        console.log('🧪 Testing real cart functionality...');

        // Sample product with real variant ID format
        const testProduct = {
          id: 14890558325102,
          title: "Test Product for Cart",
          price: 25.99,
          quantity: 1,
          image: '',
          variantId: 53019925709166,  // Real variant ID format from n8n
          handle: 'test-product-cart'
        };

        console.log('🛒 Test product details:', testProduct);
        widget.handleAddToCartFromRecommendation(testProduct, {
          innerHTML: 'Test Button',
          disabled: false,
          classList: { add: function () { }, remove: function () { } }
        });

        return 'Real cart test initiated! Check console for details.';
      }.bind(this);

      console.log('🧪 Test function available: window.testRealCartAdd()');

      // Test function for duplicate prevention
      window.testDuplicatePrevention = function () {
        console.log('🧪 Testing duplicate product prevention...');

        // Sample products - same product repeated 3 times with slight variations
        const duplicateProducts = [
          {
            id: 14890558325102,
            title: "Super Hero | Bálsam Multiusos | Árnica",
            price: 23.33,
            image: { src: "https://example.com/image1.jpg" },
            variant_id: 53019925709166,
            handle: "super-hero-balsam-multiusos-arnica",
            vendor: "Kova"
          },
          {
            id: 14890558325102,
            title: "Super Hero | Bálsam Multiusos | Árnica",
            price: 23.33,
            image: { src: "https://example.com/image1.jpg" },
            variant_id: 53019925709166,
            handle: "super-hero-balsam-multiusos-arnica",
            vendor: "Kova"
          },
          {
            id: 99999999999999,
            title: "Loving Touch | Aceite de Masaje | My Little One",
            price: 4.44,
            image: { src: "https://example.com/image2.jpg" },
            variant_id: 88888888888888,
            handle: "loving-touch-aceite-masaje",
            vendor: "Kova"
          }
        ];

        console.log('🔍 Adding products with duplicates:', duplicateProducts);
        widget.addProductRecommendations(duplicateProducts);

        return 'Duplicate prevention test completed! Check console for details.';
      }.bind(this);

      console.log('🧪 Test function available: window.testDuplicatePrevention()');

      // Test function for cart functionality
      window.testCartFunctionality = function () {
        console.log('🧪 Testing cart functionality...');

        // Add a test product to cart
        const testProduct = {
          id: 'test-123',
          title: 'Test Product for Cart',
          price: 25.99,
          quantity: 2,
          image: 'https://via.placeholder.com/100x100',
          variantId: 'test-variant-123',
          handle: 'test-product',
          line_index: 1
        };

        // Add to local cart
        widget.cartData.items.push(testProduct);
        widget.updateCartDisplay();

        console.log('✅ Test product added to cart');
        console.log('🧪 Current cart items:', widget.cartData.items);
        console.log('🧪 Cart panel visible:', widget.cartVisible);

        // Show cart panel if not visible
        if (!widget.cartVisible) {
          widget.showCart();
        }

        return 'Cart test completed! Check the cart panel for the test product.';
      }.bind(this);

      // Test function for cart button interactions
      window.testCartButtons = function () {
        console.log('🧪 Testing cart button functionality...');

        if (widget.cartData.items.length === 0) {
          console.log('⚠️  No items in cart. Add a test product first.');
          return 'Please add a product to test button functionality.';
        }

        const firstItem = widget.cartData.items[0];
        console.log('🧪 Testing with item:', firstItem);

        // Test quantity increase
        const originalQuantity = firstItem.quantity;
        widget.updateQuantity(firstItem.id, originalQuantity + 1);

        console.log('✅ Quantity increased from', originalQuantity, 'to', firstItem.quantity);

        // Show debug info
        console.log('🧪 Cart buttons should now be functional in the cart panel');

        return 'Button test completed! Try clicking the +/- buttons in the cart.';
      }.bind(this);

      console.log('🧪 Test functions available:');
      console.log('  - window.testCartFunctionality() - Add test product to cart');
      console.log('  - window.testCartButtons() - Test quantity and remove buttons');

      // Debug function to check cart panel visibility
      window.debugCartPanel = function () {
        console.log('🔍 Cart Panel Debug Info:');
        console.log('  - Cart panel exists:', !!widget.cartPanel);
        console.log('  - Cart panel ID:', widget.cartPanel?.id);
        console.log('  - Cart visible state:', widget.cartVisible);
        console.log('  - Cart panel classes:', widget.cartPanel?.className);
        console.log('  - Cart panel style:', widget.cartPanel?.style.cssText);
        console.log('  - Cart panel computed styles:', widget.cartPanel ? window.getComputedStyle(widget.cartPanel) : 'N/A');
        console.log('  - Cart toggle button exists:', !!widget.cartSmallToggle);
        console.log('  - Cart close button exists:', !!widget.cartClose);

        if (widget.cartPanel) {
          const rect = widget.cartPanel.getBoundingClientRect();
          console.log('  - Cart panel position:', rect);
          console.log('  - Cart panel visible in viewport:', rect.width > 0 && rect.height > 0);
        }

        return 'Debug info logged to console';
      }.bind(this);

      // Force show cart function
      window.forceShowCart = function () {
        console.log('🛒 Force showing cart panel...');

        if (!widget.cartPanel) {
          console.error('❌ Cart panel not found!');
          return 'Cart panel not found in DOM';
        }

        // Force visibility
        widget.cartPanel.style.opacity = '1';
        widget.cartPanel.style.visibility = 'visible';
        widget.cartPanel.style.pointerEvents = 'auto';
        widget.cartPanel.style.transform = 'translateX(0) scale(1)';
        widget.cartPanel.classList.add('kova-cart-panel--open');
        widget.cartVisible = true;

        // Update display
        widget.updateCartDisplay();

        console.log('✅ Cart panel forced to show');
        return 'Cart panel forced visible - check the left side of the chat';
      }.bind(this);

      console.log('🧪 Debug functions available:');
      console.log('  - window.debugCartPanel() - Show cart panel debug info');
      console.log('  - window.forceShowCart() - Force cart panel to be visible');

      // Mark event listeners as added to prevent duplicates
      this.eventListenersAdded = true;
      console.log('✅ Event listeners successfully added and flagged');
    }

    toggle() {
      console.log('✨ Toggling luxury widget. Current state:', this.isOpen);
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    open() {
      console.log('✨ Opening luxury chat...');
      this.isOpen = true;
      this.container.classList.remove('kova-widget--closed', 'kova-widget--closing');
      this.container.classList.add('kova-widget--open');
      this.button.setAttribute('aria-expanded', 'true');
      console.log('✅ Classes after open:', this.container.className);

      // Cart only shows when opened via cart button - not automatically
      // this.showCart(); // Removed automatic cart opening

      // Focus input with delay for smooth animation
      setTimeout(() => {
        if (this.input) {
          this.input.focus();
        }
      }, 450);
    }

    close() {
      console.log('✨ Closing luxury chat...');
      this.isOpen = false;

      // Hide cart if it's open when chat closes
      if (this.cartVisible) {
        this.hideCart();
      }

      // Add closing animation class first
      this.container.classList.add('kova-widget--closing');
      this.container.classList.remove('kova-widget--open');
      this.button.setAttribute('aria-expanded', 'false');

      // After animation completes, add closed class and remove closing
      setTimeout(() => {
        this.container.classList.remove('kova-widget--closing');
        this.container.classList.add('kova-widget--closed');
        console.log('✅ Classes after close:', this.container.className);
      }, 400); // Match transition duration
    }

    async sendMessage() {
      const text = this.input.value.trim();
      if (!text || this.isSending) return;

      // Set sending flag to prevent duplicates
      this.isSending = true;

      // Clear input
      this.input.value = '';

      // Add user message to UI
      this.addMessage(text, 'user');

      // Add typing indicator
      const typingIndicator = this.addTypingIndicator();

      // Disable send button while processing
      if (this.sendButton) {
        this.sendButton.disabled = true;
      }

      try {
        // Use configured chat endpoint or fail gracefully
        const apiUrl = this.config.chatEndpoint;
        if (!apiUrl) {
          console.error('❌ Kova Widget: chatEndpoint not configured');
          this.addMessage('Error: Chat no configurado. Contacta al administrador.', 'assistant');
          return;
        }

        const payload = {
          message: text,
          shop: this.config.shopDomain,
          session_id: this.sessionId,
          conversationId: this.conversationId || null,
          context: this.config.context || {}
        };

        console.log('🌿 Kova Chat: Sending message to chat endpoint', {
          url: apiUrl,
          payload: payload,
          shopDomain: this.config.shopDomain
        });

        // Send to n8n webhook with enhanced error handling
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          mode: 'cors',
          credentials: 'omit',
          body: JSON.stringify(payload)
        });

        console.log('🌿 Kova Chat: API Response status:', response.status, response.statusText);

        const data = await response.json();
        console.log('🌿 Kova Chat: n8n Response data:', data);

        // Remove typing indicator
        this.removeTypingIndicator(typingIndicator);

        // n8n response handling - expect direct response format
        if (response.ok) {
          // Check for n8n workflow errors
          if (data && data.message === "Error in workflow") {
            console.error('❌ Kova Chat: n8n workflow error', data);
            this.addMessage('🔧 El asistente de IA está siendo actualizado. Por favor intenta en unos minutos. ¡Gracias por tu paciencia!', 'assistant');
            return;
          }

          // Handle different n8n response formats
          let assistantMessage = '🔧 El asistente recibió tu mensaje pero está configurando la respuesta. Por favor intenta de nuevo en un momento.';
          let hasProducts = false;
          let products = [];

          // Check if response contains products - Latest n8n format: {output: [{product: {...}}]}
          if (data && data.output && Array.isArray(data.output) && data.output.length > 0) {
            // Check for new simplified product format
            const outputItems = data.output.filter(item => item.product);
            if (outputItems.length > 0) {
              // Latest n8n format: {"output": [{"product": {...}}, {"product": {...}}]}
              hasProducts = true;
              products = outputItems.map(item => item.product);
              assistantMessage = '🌿 Te recomiendo estos productos perfectos para ti:';
            } else {
              const outputItem = data.output[0];
              if (outputItem.response && Array.isArray(outputItem.response)) {
                // Previous n8n format: {"output": [{"response": [product1, product2, ...]}]}
                hasProducts = true;
                products = outputItem.response;
                assistantMessage = '🌿 Te recomiendo estos productos perfectos para ti:';
              } else {
                // Regular text in output format
                assistantMessage = data.output;
              }
            }
          } else if (Array.isArray(data) && data.length > 0 && data[0].response && Array.isArray(data[0].response)) {
            // Old format: [{response: [product1, product2, ...]}]
            hasProducts = true;
            products = data[0].response;
            assistantMessage = '🌿 Te recomiendo estos productos perfectos para ti:';
          } else if (typeof data === 'string' && data.trim()) {
            assistantMessage = data;
          } else if (data && data.output && typeof data.output === 'string') {
            // n8n format: {"output": "response text"}
            assistantMessage = data.output;
          } else if (data && data.response) {
            // Check if response contains products
            if (Array.isArray(data.response) && data.response.length > 0 && data.response[0].id) {
              hasProducts = true;
              products = data.response;
              assistantMessage = '🌿 Te recomiendo estos productos perfectos para ti:';
            } else {
              assistantMessage = data.response;
            }
          } else if (data && data.message && data.message !== "Error in workflow") {
            assistantMessage = data.message;
          } else if (data && data.text) {
            assistantMessage = data.text;
          } else if (data && data.choices && data.choices[0] && data.choices[0].message) {
            assistantMessage = data.choices[0].message.content;
          } else if (!data || Object.keys(data).length === 0) {
            assistantMessage = '🔧 El asistente está procesando tu mensaje. El flujo de n8n necesita configurar una respuesta.';
          }

          // Parse products from text if not already found
          if (!hasProducts) {
            console.log('🔍 Processing n8n response for JSON detection. Message:', assistantMessage);
            const parseResult = this.parseProductsFromText(assistantMessage);
            console.log('🔍 Parse result:', parseResult);
            if (parseResult.products.length > 0) {
              hasProducts = true;
              products = parseResult.products;
              // Use the clean text without JSON
              assistantMessage = parseResult.cleanText || '🌿 Te recomiendo estos productos perfectos para ti:';
              console.log('🔍 Products found! Using clean text:', assistantMessage);
            } else {
              console.log('🔍 No products found in text response');
            }
          }

          // Add the message
          if (assistantMessage) {
            this.addMessage(assistantMessage, 'assistant');
          }

          // Add product recommendations if present
          if (hasProducts && products.length > 0) {
            this.addProductRecommendations(products);
          }

          // Update conversation ID if provided by n8n
          if (data.conversationId) {
            this.conversationId = data.conversationId;
            this.storeConversationId(this.conversationId);
          }

          console.log('✅ Kova Chat: Message processed successfully via n8n');
        } else {
          console.error('❌ Kova Chat: n8n API returned error', response.status, data);
          if (response.status === 500) {
            this.addMessage('🔧 El asistente de IA está siendo actualizado. Por favor intenta en unos minutos. ¡Gracias por tu paciencia!', 'assistant');
          } else {
            this.addMessage('Lo siento, hubo un error. Por favor intenta de nuevo.', 'assistant');
          }
        }
      } catch (error) {
        console.error('❌ Kova Chat: Network error sending message:', error);

        // Remove typing indicator on error
        this.removeTypingIndicator(typingIndicator);

        // Check if it's a CORS error
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          console.error('❌ Possible CORS error detected');
          this.addMessage('Error de configuración del servidor. Por favor contacta al soporte.', 'assistant');
        } else if (error.message.includes('NetworkError')) {
          this.addMessage('Error de conexión de red. Verifica tu conexión a internet.', 'assistant');
        } else {
          this.addMessage('Lo siento, hubo un error de conexión. Por favor intenta de nuevo.', 'assistant');
        }
      } finally {
        // Re-enable send button and reset sending flag
        if (this.sendButton) {
          this.sendButton.disabled = false;
        }
        this.isSending = false;
      }
    }

    addMessage(text, sender) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `kova-widget__message kova-widget__message--${sender}`;

      // Format text with proper line breaks and structure
      const formattedText = this.formatMessage(text);
      messageDiv.innerHTML = formattedText;

      // Remove welcome message when first real message is added
      const welcome = this.messagesContainer.querySelector('.kova-widget__welcome');
      if (welcome && sender === 'user') {
        welcome.style.display = 'none';
      }

      if (this.messagesContainer) {
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }
    }

    addTypingIndicator() {
      const typingDiv = document.createElement('div');
      typingDiv.className = 'kova-widget__message kova-widget__message--assistant kova-widget__typing';
      typingDiv.innerHTML = `
        <div class="kova-typing-indicator">
          <span>Escribiendo</span>
          <div class="kova-typing-dots">
            <div class="kova-dot"></div>
            <div class="kova-dot"></div>
            <div class="kova-dot"></div>
          </div>
        </div>
      `;

      if (this.messagesContainer) {
        this.messagesContainer.appendChild(typingDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }

      return typingDiv;
    }

    removeTypingIndicator(typingElement) {
      if (typingElement && typingElement.parentNode) {
        typingElement.parentNode.removeChild(typingElement);
      }
    }

    // ======= PRODUCT RECOMMENDATION WIDGET =======

    // Extract and parse JSON products from text responses
    parseProductsFromText(text) {
      console.log('🔍 JSON Detection: Starting to parse text:', text);
      const products = [];
      let cleanText = text;

      try {
        // Look for JSON patterns in the text
        const jsonPatterns = [
          // Pattern 1: {output: [...]} format
          /\{\s*"output"\s*:\s*\[[\s\S]*?\]\s*\}/g,
          // Pattern 2: [{product: {...}}] format  
          /\[\s*\{\s*"product"\s*:[\s\S]*?\}\s*\]/g,
          // Pattern 3: Individual {product: {...}} objects
          /\{\s*"product"\s*:\s*\{[\s\S]*?\}\s*\}/g
        ];

        console.log('🔍 JSON Detection: Testing patterns...');

        for (let i = 0; i < jsonPatterns.length; i++) {
          const pattern = jsonPatterns[i];
          console.log(`🔍 JSON Detection: Testing pattern ${i + 1}:`, pattern);

          let match;
          while ((match = pattern.exec(text)) !== null) {
            console.log('🔍 JSON Detection: Found match:', match[0]);
            try {
              const jsonStr = match[0];
              const parsed = JSON.parse(jsonStr);
              console.log('🔍 JSON Detection: Parsed JSON:', parsed);

              // Process different JSON structures
              if (parsed.output && Array.isArray(parsed.output)) {
                console.log('🔍 JSON Detection: Processing output array format');
                // Handle {output: [{product: {...}}]} format
                const outputItems = parsed.output.filter(item => item.product);
                if (outputItems.length > 0) {
                  console.log('🔍 JSON Detection: Found products in output array:', outputItems);
                  products.push(...outputItems.map(item => item.product));
                  // Remove the JSON from the text
                  cleanText = cleanText.replace(jsonStr, '').trim();
                }
              } else if (Array.isArray(parsed)) {
                console.log('🔍 JSON Detection: Processing direct array format');
                // Handle [{product: {...}}] format
                const productItems = parsed.filter(item => item.product);
                if (productItems.length > 0) {
                  console.log('🔍 JSON Detection: Found products in array:', productItems);
                  products.push(...productItems.map(item => item.product));
                  cleanText = cleanText.replace(jsonStr, '').trim();
                }
              } else if (parsed.product) {
                console.log('🔍 JSON Detection: Processing individual product format');
                // Handle individual {product: {...}} format
                products.push(parsed.product);
                cleanText = cleanText.replace(jsonStr, '').trim();
              }
            } catch (e) {
              console.log('🔍 JSON Detection: Failed to parse JSON fragment:', e);
            }
          }
        }

        console.log('🔍 JSON Detection: Final result - Products:', products, 'Clean text:', cleanText);
      } catch (error) {
        console.error('🔍 JSON Detection: Error parsing products from text:', error);
      }

      return {
        products: products,
        cleanText: cleanText.replace(/\n\s*\n/g, '\n').trim()
      };
    }

    // Handle multiple product recommendations from n8n
    addProductRecommendations(products) {
      console.log('🛍️ Adding multiple product recommendations:', products);
      console.log('🔍 Currently added products:', Array.from(this.addedProducts));
      console.trace('📍 addProductRecommendations called from:');

      // Create horizontal container for recommendations
      const recommendationsContainer = document.createElement('div');
      recommendationsContainer.className = 'kova-widget__message kova-widget__message--assistant';

      // Process products and store valid ones
      const validProducts = [];
      const productsHTML = products.map(shopifyProduct => {
        const product = this.transformShopifyProduct(shopifyProduct);
        const productKey = `${product.id}-${product.variantId}-${product.title}`.replace(/\s+/g, '_');

        // Only add if not already added in this session
        if (!this.addedProducts.has(productKey)) {
          this.addedProducts.add(productKey);
          validProducts.push(product);
          console.log(`✅ Added unique product: ${product.title} (${productKey})`);
          return this.createProductCardHTML(product);
        } else {
          console.log(`⚠️  Skipping duplicate product: ${product.title} (${productKey})`);
          return '';
        }
      }).filter(html => html);

      const recommendationsHTML = `
        <div class="kova-recommendations-container">
          <div class="kova-recommendations-grid">
            ${productsHTML.join('')}
          </div>
        </div>
      `;

      recommendationsContainer.innerHTML = recommendationsHTML;

      // Add event listeners for all product cards using valid products array
      const productCards = recommendationsContainer.querySelectorAll('.kova-product-card');
      productCards.forEach((card, index) => {
        const product = validProducts[index];
        if (product) {
          this.setupProductCardListeners(card, product);
        }
      });

      if (this.messagesContainer) {
        this.messagesContainer.appendChild(recommendationsContainer);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }

      console.log('🔍 Total unique products added so far:', this.addedProducts.size);
    }

    // Method to clear product history (useful for new conversations)
    clearProductHistory() {
      console.log('🗑️  Clearing product history...');
      this.addedProducts.clear();
      console.log('✅ Product history cleared');
    }

    // Transform Shopify product format to widget format
    transformShopifyProduct(shopifyProduct) {
      // Handle simplified n8n format vs full Shopify format
      const isSimplified = shopifyProduct.variant_id && !shopifyProduct.variants;

      let price = '0.00';
      let variantId = null;
      let available = true;

      if (isSimplified) {
        // New simplified format from n8n
        price = shopifyProduct.price ? parseFloat(shopifyProduct.price) : 0;
        variantId = shopifyProduct.variant_id || null;
      } else {
        // Full Shopify format
        const variant = shopifyProduct.variants && shopifyProduct.variants[0];
        price = variant ? parseFloat(variant.price) : 0;
        variantId = variant ? variant.id : null;
        available = variant ? variant.inventory_quantity > 0 : true;
      }

      // Handle image format
      let imageUrl = '';
      if (shopifyProduct.images && Array.isArray(shopifyProduct.images) && shopifyProduct.images.length > 0) {
        imageUrl = shopifyProduct.images[0].src || '';
      } else if (shopifyProduct.image) {
        imageUrl = shopifyProduct.image.src || shopifyProduct.image || '';
      }

      return {
        id: shopifyProduct.id || '',
        title: shopifyProduct.title || 'Producto sin nombre',
        description: this.stripHTML(shopifyProduct.body_html || ''),
        price: price,
        comparePrice: null, // Not provided in simplified format
        image: imageUrl,
        vendor: shopifyProduct.vendor || 'Kova',
        handle: shopifyProduct.handle || '',
        variantId: variantId,
        available: available
      };
    }

    // Strip HTML tags from description
    stripHTML(html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || "";
    }

    addProductRecommendation(product) {
      console.log('🛍️ Adding product recommendation:', product);

      const productDiv = document.createElement('div');
      productDiv.className = 'kova-widget__message kova-widget__message--assistant';

      // Create product card HTML
      const productHTML = this.createProductCardHTML(product);
      productDiv.innerHTML = productHTML;

      // Add event listeners for the product card
      this.setupProductCardListeners(productDiv, product);

      if (this.messagesContainer) {
        this.messagesContainer.appendChild(productDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }

      console.log('✅ Product recommendation added to chat');
    }

    createProductCardHTML(product) {
      const {
        id = '',
        title = 'Producto sin nombre',
        description = '',
        price = 0,
        comparePrice = null,
        image = '',
        tags = [],
        available = true
      } = product;

      const hasDiscount = comparePrice && parseFloat(comparePrice) > parseFloat(price);
      const discountPercent = hasDiscount ? Math.round(((parseFloat(comparePrice) - parseFloat(price)) / parseFloat(comparePrice)) * 100) : 0;

      return `
        <div class="kova-product-card" data-product-id="${id}">
          ${hasDiscount ? `<div class="kova-product-card__header">
            <div class="kova-product-card__discount">-${discountPercent}%</div>
          </div>` : ''}
          
          <div class="kova-product-card__media">
            ${image ?
          `<img class="kova-product-card__image" src="${image}" alt="${title}" loading="lazy">` :
          `<div class="kova-product-card__placeholder">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M21 16V8C21 6.9 20.1 6 19 6H5C3.9 6 3 6.9 3 8V16C3 17.1 3.9 18 5 18H19C20.1 18 21 17.1 21 16ZM5 16L8.5 11.5L11 14.5L14.5 10L19 16H5Z" fill="currentColor"/>
                </svg>
              </div>`
        }
            <div class="kova-product-card__overlay">
              <button class="kova-product-card__quick-view" data-action="quick-view" title="Vista rápida">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M1 12S5 4 12 4S23 12 23 12S19 20 12 20S1 12 1 12Z" stroke="currentColor" stroke-width="2"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="kova-product-card__content">
            <h3 class="kova-product-card__title">${title}</h3>
            ${description ? `<p class="kova-product-card__description">${description}</p>` : ''}
            
            <div class="kova-product-card__price-section">
              <div class="kova-product-card__pricing">
                <span class="kova-product-card__price">${formatChileanPrice(price)}</span>
                ${hasDiscount ? `<span class="kova-product-card__compare-price">${formatChileanPrice(comparePrice)}</span>` : ''}
              </div>
              ${tags.length > 0 ? `
                <div class="kova-product-card__tags">
                  ${tags.slice(0, 2).map(tag => `<span class="kova-product-card__tag">${tag}</span>`).join('')}
                </div>
              ` : ''}
            </div>
            
            <div class="kova-product-card__actions">
              ${!available ?
          `<button class="kova-product-card__add-btn kova-product-card__add-btn--disabled" disabled>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  Agotado
                </button>` :
          `<button class="kova-product-card__add-btn" data-action="add-to-cart" title="Agregar al carrito">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H14C13.4 20 13 19.6 13 19V13" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  Agregar al Carrito
                </button>`
        }
              <button class="kova-product-card__details-btn" data-action="go-checkout" title="Ir al checkout">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19A2 2 0 01-2 2H9A2 2 0 017 19V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Ir al Checkout
              </button>
            </div>
          </div>
        </div>
      `;
    }

    setupProductCardListeners(productElement, product) {
      // Add to cart button
      const addButton = productElement.querySelector('[data-action="add-to-cart"]');
      if (addButton) {
        addButton.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleAddToCartFromRecommendation(product, addButton);
        });
      }

      // Quick view button
      const quickViewButton = productElement.querySelector('[data-action="quick-view"]');
      if (quickViewButton) {
        quickViewButton.addEventListener('click', (e) => {
          e.preventDefault();
          this.showProductQuickView(product);
        });
      }

      // Go to checkout button
      const checkoutButton = productElement.querySelector('[data-action="go-checkout"]');
      if (checkoutButton) {
        checkoutButton.addEventListener('click', (e) => {
          e.preventDefault();
          this.openCart();
        });
      }
    }

    handleAddToCartFromRecommendation(product, buttonElement) {
      console.log('🛒 Adding product to cart from recommendation:', product.title);
      console.log('🔍 Product details for cart:', {
        id: product.id,
        title: product.title,
        variantId: product.variantId,
        price: product.price,
        handle: product.handle
      });

      // Update button state to loading
      buttonElement.innerHTML = `
        <svg class="kova-spinner" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/>
          <path d="M22 12C22 6.48 17.52 2 12 2V22C17.52 22 22 17.52 22 12Z" fill="currentColor"/>
        </svg>
        Agregando...
      `;
      buttonElement.disabled = true;

      // Add to cart
      this.addToCart({
        id: product.id,
        title: product.title,
        price: product.price,
        quantity: 1,
        image: product.image,
        variantId: product.variantId || product.id,
        handle: product.handle
      });

      // Update button state to success (permanent)
      setTimeout(() => {
        buttonElement.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Producto en el carrito
        `;
        buttonElement.classList.add('kova-product-card__add-btn--success');
        buttonElement.disabled = false; // Keep clickable for feedback
      }, 800);
    }

    showProductQuickView(product) {
      console.log('👁️ Showing quick view for:', product.title);

      // Create quick view modal
      const modal = document.createElement('div');
      modal.className = 'kova-product-modal';
      modal.innerHTML = `
        <div class="kova-product-modal__backdrop"></div>
        <div class="kova-product-modal__content">
          <header class="kova-product-modal__header">
            <h2>${product.title}</h2>
            <button class="kova-product-modal__close">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </header>
          <div class="kova-product-modal__body">
            ${product.image ? `<img src="${product.image}" alt="${product.title}">` : ''}
            <div class="kova-product-modal__info">
              <p class="kova-product-modal__description">${product.description || 'Producto de cosmética natural Kova.'}</p>
              <div class="kova-product-modal__price">${formatChileanPrice(product.price)}</div>
              <button class="kova-product-modal__add-btn">Agregar al Carrito</button>
            </div>
          </div>
        </div>
      `;

      // Add to body
      document.body.appendChild(modal);

      // Add event listeners
      const closeBtn = modal.querySelector('.kova-product-modal__close');
      const backdrop = modal.querySelector('.kova-product-modal__backdrop');
      const addBtn = modal.querySelector('.kova-product-modal__add-btn');

      const closeModal = () => {
        modal.remove();
      };

      closeBtn.addEventListener('click', closeModal);
      backdrop.addEventListener('click', closeModal);
      addBtn.addEventListener('click', () => {
        this.handleAddToCartFromRecommendation(product, addBtn);
        setTimeout(closeModal, 1500);
      });

      // Animate in
      setTimeout(() => modal.classList.add('kova-product-modal--visible'), 10);
    }

    showProductDetails(product) {
      console.log('📄 Showing details for:', product.title);

      // Open product page in new tab
      if (product.handle) {
        const productUrl = `https://${this.config.shopDomain}/products/${product.handle}`;
        window.open(productUrl, '_blank');
      } else {
        console.warn('No product handle available for details view');
      }
    }

    formatMessage(text) {
      // Convert numbered lists to proper HTML
      let formatted = text
        .replace(/(\d+)\.\s+([^\n]+)/g, '<div class="list-item"><strong>$1.</strong> $2</div>')
        .replace(/\*\s+([^\n]+)/g, '<div class="bullet-item">• $1</div>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/([A-ZÁ-Ú][^:]{2,30}):/g, '<strong>$1:</strong>');

      return formatted;
    }

    resetConversation() {
      // Clear all messages except welcome
      if (this.messagesContainer) {
        // Remove all messages
        const messages = this.messagesContainer.querySelectorAll('.kova-widget__message:not(.kova-widget__welcome)');
        messages.forEach(message => message.remove());

        // Show welcome message again
        const welcome = this.messagesContainer.querySelector('.kova-widget__welcome');
        if (welcome) {
          welcome.style.display = 'block';
        }

        // Scroll to top
        this.messagesContainer.scrollTop = 0;
      }

      // Clear input
      if (this.input) {
        this.input.value = '';
      }

      // Reset conversation state completely
      this.messages = [];
      this.conversationId = null;
      this.clearStoredConversationId(); // Clear from localStorage too

      console.log('✅ Conversation reset to welcome state');
    }

    getStoredConversationId() {
      try {
        const storageKey = `kova_conversation_${this.config.shopDomain}`;
        return localStorage.getItem(storageKey);
      } catch (error) {
        console.warn('Could not access localStorage for conversation ID:', error);
        return null;
      }
    }

    storeConversationId(conversationId) {
      try {
        const storageKey = `kova_conversation_${this.config.shopDomain}`;
        localStorage.setItem(storageKey, conversationId);
        console.log('💾 Stored conversation ID:', conversationId);
      } catch (error) {
        console.warn('Could not store conversation ID in localStorage:', error);
      }
    }

    getOrCreateSessionId() {
      try {
        const storageKey = `kova_session_${this.config.shopDomain}`;
        let sessionId = localStorage.getItem(storageKey);
        
        if (!sessionId) {
          // Generate unique session ID combining timestamp, random, and browser fingerprint
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 15);
          const userAgent = navigator.userAgent.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
          const screenSize = `${window.screen.width}x${window.screen.height}`;
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const language = navigator.language || 'unknown';
          
          // Create a fingerprint hash (simple version)
          const fingerprint = btoa(`${userAgent}_${screenSize}_${timezone}_${language}`).substring(0, 16).replace(/[^a-zA-Z0-9]/g, '');
          
          sessionId = `kova_${timestamp}_${random}_${fingerprint}`;
          
          localStorage.setItem(storageKey, sessionId);
          console.log('🆔 Generated new session ID:', sessionId);
          
          // Optionally try to enhance session with IP (non-blocking)
          this.enhanceSessionWithIP(sessionId);
        } else {
          console.log('🆔 Retrieved existing session ID:', sessionId);
        }
        
        return sessionId;
      } catch (error) {
        // Fallback if localStorage is not available
        console.warn('Could not access localStorage for session ID, using fallback:', error);
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `kova_${timestamp}_${random}_fallback`;
      }
    }

    async enhanceSessionWithIP(sessionId) {
      try {
        // Optional: Try to get IP for enhanced session tracking (non-blocking)
        // This is for analytics purposes and doesn't affect core functionality
        const ipResponse = await fetch('https://api.ipify.org?format=json', {
          method: 'GET',
          timeout: 2000 // Quick timeout to not delay the UI
        });
        
        if (ipResponse.ok) {
          const ipData = await ipResponse.json();
          const ipHash = btoa(ipData.ip).substring(0, 8).replace(/[^a-zA-Z0-9]/g, '');
          console.log('🌐 Enhanced session with IP info (hashed):', ipHash);
          
          // Store enhanced session info for analytics (optional)
          const storageKey = `kova_session_enhanced_${this.config.shopDomain}`;
          localStorage.setItem(storageKey, JSON.stringify({
            sessionId: sessionId,
            ipHash: ipHash,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        // Silently fail - IP enhancement is optional
        console.log('ℹ️ IP enhancement unavailable (non-critical):', error.message);
      }
    }

    clearStoredConversationId() {
      try {
        const storageKey = `kova_conversation_${this.config.shopDomain}`;
        localStorage.removeItem(storageKey);
        console.log('🗑️ Cleared stored conversation ID');
      } catch (error) {
        console.warn('Could not clear conversation ID from localStorage:', error);
      }
    }

    async loadConversationHistory() {
      if (this.conversationId) {
        console.log('📖 Loading conversation history for ID:', this.conversationId);
        // Add welcome message only if no conversation ID exists
      } else {
        console.log('🆕 Starting new conversation');
        // Default message removed - widget starts clean
      }
    }

    // Test function to add sample products to cart (for development)
    testCart() {
      const sampleProduct = {
        id: 'test-product-1',
        title: 'Crema Hidratante Kova Aloe Vera',
        price: '24.99',
        quantity: 1,
        image: '',
        variantId: 'variant-123',
        handle: 'crema-hidratante-aloe-vera'
      };

      this.addToCart(sampleProduct);
      console.log('🧪 Test product added to cart');
    }

    // Test function to show product recommendations (for development)
    async testProductRecommendation() {
      console.log('🧪 Testing real product recommendations...');

      // Test with real API
      const products = await this.getRecommendations('grasa', ['hidratación']);

      if (products.length > 0) {
        products.forEach(product => {
          this.addProductRecommendation(product);
        });
        console.log('✅ Real recommendations loaded:', products);
      } else {
        console.log('⚠️ No products found, using sample data...');

        // Fallback to sample products
        const sampleProducts = [
          {
            id: 'product-1',
            title: 'Crema Hidratante Kova con Aloe Vera',
            description: 'Crema hidratante natural con aloe vera orgánico para todo tipo de pieles.',
            price: '24.99',
            comparePrice: '29.99',
            image: 'https://picsum.photos/300/200?random=1',
            vendor: 'Kova',
            tags: ['hidratante', 'aloe vera', 'natural'],
            available: true,
            handle: 'crema-hidratante-aloe-vera',
            variants: [{ id: 'variant-1', price: '24.99', shopifyVariantId: 'gid://shopify/ProductVariant/1' }]
          },
          {
            id: 'product-2',
            title: 'Sérum Facial Vitamina C',
            description: 'Sérum antioxidante con vitamina C para iluminar y proteger la piel.',
            price: '32.50',
            image: 'https://picsum.photos/300/200?random=2',
            vendor: 'Kova',
            tags: ['sérum', 'vitamina c', 'antioxidante'],
            available: true,
            handle: 'serum-facial-vitamina-c',
            variants: [{ id: 'variant-2', price: '32.50', shopifyVariantId: 'gid://shopify/ProductVariant/2' }]
          }
        ];

        sampleProducts.forEach(product => {
          this.addProductRecommendation(product);
        });
      }

      console.log('🧪 Product recommendations test completed');
    }

    // ======= CART FUNCTIONALITY =======

    toggleCart() {
      if (this.cartVisible) {
        this.hideCart();
      } else {
        this.showCart();
      }
    }


    showCart() {
      console.log('🛒 Showing cart panel...');

      // AGGRESSIVE MOBILE POSITIONING ENFORCEMENT
      if (window.innerWidth <= 480) {
        console.log('📱 MOBILE DETECTED: Applying emergency cart positioning');

        // Method 1: Apply mobile styles
        if (typeof applyMobileCartStyles === 'function') {
          applyMobileCartStyles();
          console.log('✅ Applied mobile cart styles before showing cart');
        }

        // Method 2: Direct cart panel styling if it exists
        if (this.cartPanel) {
          console.log('🎯 DIRECT STYLING: Forcing cart panel position');
          this.cartPanel.style.setProperty('position', 'fixed', 'important');
          this.cartPanel.style.setProperty('top', '50%', 'important');
          this.cartPanel.style.setProperty('left', '50%', 'important');
          this.cartPanel.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
          this.cartPanel.style.setProperty('right', 'unset', 'important');
          this.cartPanel.style.setProperty('bottom', 'unset', 'important');
          this.cartPanel.style.setProperty('margin', '0', 'important');
          this.cartPanel.style.setProperty('width', 'calc(100vw - 40px)', 'important');
          this.cartPanel.style.setProperty('max-width', '380px', 'important');
          this.cartPanel.style.setProperty('height', '80vh', 'important');
          this.cartPanel.style.setProperty('z-index', '10002', 'important');
          console.log('✅ Direct cart panel styling applied');
        }

        // Method 3: Delayed verification and re-application
        setTimeout(() => {
          const panel = this.cartPanel || document.querySelector('.kova-cart-panel');
          if (panel && window.innerWidth <= 480) {
            const rect = panel.getBoundingClientRect();
            console.log('🔍 DELAYED CHECK: Cart position verification');
            console.log('Cart position:', {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height
            });

            // If cart is off-screen, force it back
            if (rect.left > window.innerWidth - 50 || rect.right < 50 ||
              rect.top > window.innerHeight - 50 || rect.bottom < 50) {
              console.log('🚨 DELAYED CHECK: Cart is off-screen, forcing re-center');

              // Nuclear option - completely override with inline styles
              panel.style.cssText = `
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                width: calc(100vw - 40px) !important;
                max-width: 380px !important;
                height: 80vh !important;
                margin: 0 !important;
                padding: 20px !important;
                background: rgba(248, 249, 248, 0.98) !important;
                border-radius: 20px !important;
                border: 1px solid rgba(212, 196, 184, 0.3) !important;
                box-shadow: 0 20px 60px rgba(207, 121, 94, 0.25) !important;
                z-index: 10002 !important;
                display: flex !important;
                flex-direction: column !important;
                opacity: 1 !important;
                visibility: visible !important;
              `;
              console.log('✅ NUCLEAR OPTION: Complete cart style override applied');
            } else {
              console.log('✅ DELAYED CHECK: Cart position is acceptable');
            }
          }
        }, 500);
      }

      this.cartVisible = true;
      if (this.cartPanel) {
        this.cartPanel.classList.add('kova-cart-panel--open');
        this.cartPanel.setAttribute('aria-hidden', 'false');
      }
      // Update cart display to show latest items
      this.updateCartDisplay();
      console.log('✅ Cart panel shown');
    }

    hideCart() {
      console.log('🛒 Hiding cart panel...');
      this.cartVisible = false;
      if (this.cartPanel) {
        this.cartPanel.classList.remove('kova-cart-panel--open');
        this.cartPanel.setAttribute('aria-hidden', 'true');
      }
      console.log('✅ Cart panel hidden');
    }

    async addToCart(product) {
      console.log('🛒 Adding product to cart:', product);

      // Show loading state
      this.showCartLoading();

      // First try to add to Shopify native cart if we're on a Shopify store
      let addedToShopify = false;
      // Check if we're on a Shopify store (either .myshopify.com or a custom domain with a configured shop)
      const isShopifyDomain = window.location.hostname.includes('myshopify.com') ||
        window.location.hostname.includes('shopify.com');

      // Always check window.KovaConfig for the most up-to-date configuration
      const currentShopDomain = (window.KovaConfig && window.KovaConfig.shopDomain) || this.config.shopDomain;
      const hasShopConfig = currentShopDomain && currentShopDomain.trim() !== '';
      const isShopifyStore = isShopifyDomain || hasShopConfig;

      console.log('🏪 Is Shopify store?', isShopifyStore, 'Hostname:', window.location.hostname, 'Shop config:', currentShopDomain);
      console.log('🔧 Config sources - this.config.shopDomain:', this.config.shopDomain, 'window.KovaConfig.shopDomain:', window.KovaConfig?.shopDomain);

      if (isShopifyStore && hasShopConfig) {
        addedToShopify = await this.addToShopifyNativeCart(product.variantId, product.quantity || 1);
      } else {
        console.log('⚠️  No Shopify configuration or domain, skipping native cart addition');
      }

      // Also add via our API for consistency (only if we have shop config)
      if (hasShopConfig) {
        try {
          const response = await fetch(`${this.config.apiEndpoint}/api/public/cart/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shop: currentShopDomain,
              cartId: this.cartId,
              variantId: product.variantId,
              quantity: product.quantity || 1,
            }),
          });

          const data = await response.json();

          if (data.success && data.data.cart) {
            // Update local cart with Shopify cart data
            this.cartId = data.data.cart.id;
            this.syncCartFromShopify(data.data.cart);

            console.log('✅ Product added to Shopify cart via API:', data.data.cart);
          } else if (!addedToShopify) {
            console.error('❌ Failed to add to cart via API:', data);
            // Fallback to local cart only if Shopify native also failed
            this.addToCartLocal(product);
          }
        } catch (error) {
          console.error('❌ Error adding to cart via API:', error);
          if (!addedToShopify) {
            // Fallback to local cart only if Shopify native also failed
            this.addToCartLocal(product);
          }
        }
      } else {
        console.log('⚠️ No shop configuration, adding to local cart only');
        // Add to local cart if we don't have shop config
        if (!addedToShopify) {
          this.addToCartLocal(product);
        }
      }

      // Hide loading and update cart display
      this.hideCartLoading();
      // Cart stays visible always
    }

    // ENHANCED: Remove from cart by unique cart item ID
    removeFromCartByItemId(cartItemId) {
      console.log('🛒 Removing cart item by ID:', cartItemId);

      // Find the specific cart item by unique ID only
      const itemIndex = this.cartData.items.findIndex(item =>
        item.cartItemId === cartItemId
      );

      if (itemIndex === -1) {
        console.warn('⚠️ Cart item not found:', cartItemId);
        return;
      }

      const item = this.cartData.items[itemIndex];
      console.log('🗑️ Found item to remove:', item);

      // Remove the specific item from local cart immediately (no loading needed - instant operation)
      this.cartData.items.splice(itemIndex, 1);

      console.log('✅ Cart item removed successfully. Remaining items:', this.cartData.items.length);

      // Update cart display immediately to reflect changes
      this.updateCartDisplay();
    }

    // ENHANCED: Update quantity by unique cart item ID
    updateQuantityByItemId(cartItemId, newQuantity) {
      console.log('🛒 Updating cart item quantity:', cartItemId, 'to', newQuantity);

      // Find the specific cart item by unique ID only
      const item = this.cartData.items.find(item =>
        item.cartItemId === cartItemId
      );

      if (!item) {
        console.warn('⚠️ Cart item not found:', cartItemId);
        return;
      }

      if (newQuantity <= 0) {
        // If quantity is 0 or less, remove the item
        this.removeFromCartByItemId(cartItemId);
        return;
      }

      // Update the quantity immediately
      item.quantity = newQuantity;

      console.log('✅ Cart item quantity updated:', item);

      // Update cart display immediately to reflect changes
      this.updateCartDisplay();
    }


    // Fallback method for local cart management
    addToCartLocal(product) {
      console.log('🛒 Adding product to local cart (fallback):', product);

      // ENHANCED: Allow multiple products without limitations
      // Instead of checking for existing items, always add as new entry
      // This allows customers to add the same product multiple times
      // Generate unique cart item ID to allow multiple instances of same product
      const uniqueCartItemId = `${product.id}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      // Always add as new item - no quantity merging
      this.cartData.items.push({
        id: product.id, // Keep original product ID for reference
        cartItemId: uniqueCartItemId, // Unique cart entry ID
        title: product.title,
        price: product.price,
        quantity: product.quantity || 1,
        image: product.image,
        variantId: product.variantId,
        handle: product.handle,
        addedAt: new Date().toISOString() // Track when item was added
      });

      console.log('✅ Product added to local cart as new entry. Total items in cart:', this.cartData.items.length);

      // Update cart display to reflect changes
      this.updateCartDisplay();

      // Force hide empty message after any cart update
      this.forceHideEmptyMessage();
    }

    // Sync local cart data from Shopify cart
    syncCartFromShopify(shopifyCart) {
      console.log('🔄 Syncing cart from Shopify:', shopifyCart);

      // Transform Shopify cart lines to our format
      this.cartData.items = shopifyCart.lines?.edges?.map(edge => ({
        id: edge.node.id,
        cartItemId: `shopify_${edge.node.id}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`, // Add unique cart item ID
        title: edge.node.merchandise?.product?.title || 'Product',
        price: edge.node.merchandise?.priceV2?.amount || 0,
        quantity: edge.node.quantity,
        image: edge.node.merchandise?.image?.url || '',
        variantId: edge.node.merchandise?.id || '',
        handle: edge.node.merchandise?.product?.handle || '',
        addedAt: new Date().toISOString()
      })) || [];

      // Update totals
      this.cartData.total = shopifyCart.cost?.totalAmount?.amount || 0;
      this.cartData.itemCount = shopifyCart.totalQuantity || 0;

      console.log('✅ Cart synced with Shopify');
    }

    // Search for products using the new endpoint
    async searchProducts(query, skinType) {
      console.log('🔍 Searching products:', { query, skinType });

      try {
        const response = await fetch(`${this.config.apiEndpoint}/api/public/products/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shop: this.config.shopDomain,
            q: query,
            limit: 5,
            skinType: skinType
          }),
        });

        const data = await response.json();

        if (data.success && data.data.products) {
          console.log('✅ Products found:', data.data.products);
          return data.data.products;
        } else {
          console.error('❌ Failed to search products:', data);
          return [];
        }
      } catch (error) {
        console.error('❌ Error searching products:', error);
        return [];
      }
    }

    // Get product recommendations
    async getRecommendations(skinType, concerns) {
      console.log('💡 Getting product recommendations:', { skinType, concerns });

      try {
        const response = await fetch(`${this.config.apiEndpoint}/api/public/products/recommendations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shop: this.config.shopDomain,
            skinType: skinType,
            concerns: concerns,
            limit: 3
          }),
        });

        const data = await response.json();

        if (data.success && data.data.products) {
          console.log('✅ Recommendations found:', data.data.products);
          return data.data.products;
        } else {
          console.error('❌ Failed to get recommendations:', data);
          return [];
        }
      } catch (error) {
        console.error('❌ Error getting recommendations:', error);
        return [];
      }
    }

    async removeFromCart(productId) {
      console.log('🛒 Removing product from cart:', productId);

      // Show loading state
      this.showCartLoading();

      // Find the item to get its line index for Shopify
      const item = this.cartData.items.find(item => item.id === productId);
      if (!item) {
        console.warn('⚠️ Item not found in cart:', productId);
        this.hideCartLoading();
        return;
      }

      // Try to remove from Shopify native cart first
      let removedFromShopify = false;
      const isShopifyDomain = window.location.hostname.includes('myshopify.com') ||
        window.location.hostname.includes('shopify.com');

      // Always check window.KovaConfig for the most up-to-date configuration
      const currentShopDomain = (window.KovaConfig && window.KovaConfig.shopDomain) || this.config.shopDomain;
      const hasShopConfig = currentShopDomain && currentShopDomain.trim() !== '';
      const isShopifyStore = isShopifyDomain || hasShopConfig;

      console.log('🗑️ Remove from Shopify?', isShopifyStore, 'Has line_index:', !!item.line_index, 'Shop config:', currentShopDomain);
      console.log('🔍 Item details:', { id: item.id, title: item.title, line_index: item.line_index, variantId: item.variantId });

      if (isShopifyStore && item.line_index) {
        try {
          removedFromShopify = await this.removeFromShopifyNativeCart(item.line_index);
        } catch (error) {
          console.error('❌ Failed to remove from Shopify cart:', error);
        }
      }

      // Remove from local cart data
      const previousLength = this.cartData.items.length;
      this.cartData.items = this.cartData.items.filter(item => item.id !== productId);
      const newLength = this.cartData.items.length;

      console.log(`🗑️ Cart items before removal: ${previousLength}, after: ${newLength}`);

      // Hide loading and update cart display
      this.hideCartLoading();

      // Force re-render to ensure DOM is updated
      setTimeout(() => {
        this.renderCartItems();
        console.log('🔄 Forced cart re-render after removal');
      }, 50);

      console.log('✅ Product removed from cart. Shopify sync:', removedFromShopify);
    }

    async updateQuantity(productId, newQuantity) {
      console.log('🛒 Updating quantity for product:', productId, 'to:', newQuantity);

      const item = this.cartData.items.find(item => item.id === productId);
      if (!item) {
        console.warn('⚠️ Item not found in cart:', productId);
        return;
      }

      if (newQuantity <= 0) {
        await this.removeFromCart(productId);
        return;
      }

      // Try to update quantity in Shopify native cart first
      let updatedInShopify = false;
      const isShopifyDomain = window.location.hostname.includes('myshopify.com') ||
        window.location.hostname.includes('shopify.com');

      // Always check window.KovaConfig for the most up-to-date configuration
      const currentShopDomain = (window.KovaConfig && window.KovaConfig.shopDomain) || this.config.shopDomain;
      const hasShopConfig = currentShopDomain && currentShopDomain.trim() !== '';
      const isShopifyStore = isShopifyDomain || hasShopConfig;

      console.log('🔄 Update in Shopify?', isShopifyStore, 'Has line_index:', !!item.line_index, 'New quantity:', newQuantity);
      console.log('🔍 Item details:', { id: item.id, title: item.title, line_index: item.line_index, variantId: item.variantId });

      if (isShopifyStore && item.line_index) {
        try {
          updatedInShopify = await this.updateShopifyCartQuantity(item.line_index, newQuantity);
        } catch (error) {
          console.error('❌ Failed to update Shopify cart quantity:', error);
        }
      }

      // Update local cart data
      item.quantity = newQuantity;
      this.updateCartDisplay();

      console.log('✅ Quantity updated. Shopify sync:', updatedInShopify);
    }

    updateCartDisplay() {
      console.log('🛒 Updating cart display. Current cart data:', this.cartData);
      console.log('🔍 Cart DOM elements check:', {
        cartEmpty: !!this.cartEmpty,
        cartItems: !!this.cartItems,
        cartFooter: !!this.cartFooter,
        cartTotal: !!this.cartTotal,
        cartBadge: !!this.cartBadge
      });

      // Ensure cartData.items is an array
      if (!Array.isArray(this.cartData.items)) {
        console.warn('⚠️ Cart items is not an array, resetting to empty array');
        this.cartData.items = [];
      }

      // Calculate totals
      let total = 0;
      let itemCount = 0;

      this.cartData.items.forEach(item => {
        const itemPrice = parseFloat(item.price) || 0;
        const itemQuantity = parseInt(item.quantity) || 0;
        total += itemPrice * itemQuantity;
        itemCount += itemQuantity;
      });

      this.cartData.total = total;
      this.cartData.itemCount = itemCount;

      console.log('📊 Cart calculations: items count =', this.cartData.items.length, ', total items =', itemCount, ', total price =', total);

      // Update UI based on cart content
      const hasItems = this.cartData.items.length > 0 && itemCount > 0;

      console.log('🔍 Cart UI Update Debug:', {
        'cartData.items.length': this.cartData.items.length,
        'itemCount': itemCount,
        'hasItems': hasItems,
        'cartEmpty exists': !!this.cartEmpty,
        'cartItems exists': !!this.cartItems,
        'cartFooter exists': !!this.cartFooter,
        'cart items array': this.cartData.items
      });

      if (this.cartEmpty && this.cartItems && this.cartFooter) {
        if (!hasItems) {
          // Show empty state
          this.cartEmpty.style.display = 'flex';
          this.cartItems.style.display = 'none';
          this.cartItems.classList.remove('kova-cart-panel__items--visible');
          this.cartFooter.style.display = 'none';
          console.log('📋 Showing empty cart state');
        } else {
          // Show items
          console.log('📋 HIDING EMPTY STATE - SHOWING ITEMS');

          // FORCE HIDE empty state with multiple methods
          if (this.cartEmpty) {
            this.cartEmpty.style.display = 'none';
            this.cartEmpty.style.visibility = 'hidden';
            this.cartEmpty.style.opacity = '0';
            this.cartEmpty.style.height = '0';
            this.cartEmpty.style.overflow = 'hidden';
          }

          // Show items container
          if (this.cartItems) {
            this.cartItems.style.display = 'flex';
            this.cartItems.classList.add('kova-cart-panel__items--visible');
          }

          // Show footer
          if (this.cartFooter) {
            this.cartFooter.style.display = 'block';
          }

          console.log('📋 Showing cart with items');

          // Update total
          if (this.cartTotal) {
            this.cartTotal.textContent = formatChileanPrice(total);
          }

          // Render cart items
          this.renderCartItems();
        }
      } else {
        console.error('❌ Cart DOM elements missing:', {
          cartEmpty: !!this.cartEmpty,
          cartItems: !!this.cartItems,
          cartFooter: !!this.cartFooter
        });
      }

      // Update cart badge - small button in chat
      if (this.cartSmallCount) {
        if (itemCount > 0) {
          this.cartSmallCount.textContent = itemCount;
          this.cartSmallCount.style.display = 'flex';
        } else {
          this.cartSmallCount.textContent = '0';
          this.cartSmallCount.style.display = 'none';
        }
      }

      console.log('✅ Cart display updated successfully. Has items:', hasItems, 'Item count:', itemCount);
    }

    renderCartItems() {
      console.log('🎨 Rendering cart items. Items count:', this.cartData.items.length);
      console.log('🎨 Cart items container exists:', !!this.cartItems);

      if (!this.cartItems) {
        console.error('❌ Cart items container not found!');
        return;
      }

      this.cartItems.innerHTML = '';
      console.log('🎨 Cleared cart items container');

      this.cartData.items.forEach((item, index) => {
        console.log(`🎨 Rendering item ${index + 1}:`, item);
        
        // FIXED: Ensure every item has a cartItemId
        if (!item.cartItemId) {
          item.cartItemId = `fallback_${item.id}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          console.log('⚠️ Added fallback cartItemId to item:', item.cartItemId);
        }
        
        const itemElement = document.createElement('div');
        itemElement.className = 'kova-cart-panel__item';

        // Get product image (try different image properties)
        const imageUrl = item.image || item.featured_image || item.images?.[0] || item.product_image || null;
        const variantTitle = item.variantTitle && item.variantTitle !== 'Default Title' ? item.variantTitle : '';
        const unitPrice = parseFloat(item.price) || 0;
        const totalPrice = unitPrice * item.quantity;

        itemElement.innerHTML = `
          <div class="kova-cart-panel__item-image-container">
            ${imageUrl ?
            `<img src="${imageUrl}" alt="${item.title}" class="kova-cart-panel__item-image" loading="lazy">` :
            `<div class="kova-cart-panel__item-image kova-cart-panel__item-image--placeholder">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" fill="currentColor"/>
                </svg>
              </div>`
          }
          </div>
          <div class="kova-cart-panel__item-details">
            <div class="kova-cart-panel__item-info">
              <h4 class="kova-cart-panel__item-title">${item.title}</h4>
              ${variantTitle ? `<p class="kova-cart-panel__item-variant">${variantTitle}</p>` : ''}
              <div class="kova-cart-panel__item-price-info">
                <span class="kova-cart-panel__item-unit-price">${formatChileanPrice(unitPrice)} c/u</span>
                <span class="kova-cart-panel__item-total-price">${formatChileanPrice(totalPrice)}</span>
              </div>
            </div>
            <div class="kova-cart-panel__item-controls">
              <div class="kova-cart-panel__item-quantity">
                <button class="kova-cart-panel__quantity-btn kova-cart-panel__quantity-btn--decrease" data-action="decrease" data-cart-item-id="${item.cartItemId}" aria-label="Disminuir cantidad">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
                <span class="kova-cart-panel__quantity-value">${item.quantity}</span>
                <button class="kova-cart-panel__quantity-btn kova-cart-panel__quantity-btn--increase" data-action="increase" data-cart-item-id="${item.cartItemId}" aria-label="Aumentar cantidad">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              <button class="kova-cart-panel__item-remove" data-cart-item-id="${item.cartItemId}" aria-label="Eliminar producto">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        `;

        // Add event listeners for this item
        const removeBtn = itemElement.querySelector('.kova-cart-panel__item-remove');
        const decreaseBtn = itemElement.querySelector('[data-action="decrease"]');
        const increaseBtn = itemElement.querySelector('[data-action="increase"]');

        if (removeBtn) {
          removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const cartItemId = removeBtn.getAttribute('data-cart-item-id');
            console.log('🗑️ Remove clicked for item:', item.title, 'ID:', cartItemId);

            if (!cartItemId) {
              console.error('❌ No cart item ID found on remove button!');
              return;
            }

            // Disable button immediately to prevent double clicks
            removeBtn.disabled = true;

            // Remove item immediately - updateCartDisplay will re-render the cart
            this.removeFromCartByItemId(cartItemId);
          });
        }

        if (decreaseBtn) {
          decreaseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const cartItemId = decreaseBtn.getAttribute('data-cart-item-id');
            const quantityValue = itemElement.querySelector('.kova-cart-panel__quantity-value');
            
            // Visual feedback
            decreaseBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
              decreaseBtn.style.transform = 'scale(1)';
            }, 150);
            
            if (quantityValue) {
              quantityValue.classList.add('kova-cart-panel__quantity-value--updating');
              setTimeout(() => {
                quantityValue.classList.remove('kova-cart-panel__quantity-value--updating');
              }, 200);
            }
            
            this.updateQuantityByItemId(cartItemId, item.quantity - 1);
          });
        }

        if (increaseBtn) {
          increaseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const cartItemId = increaseBtn.getAttribute('data-cart-item-id');
            const quantityValue = itemElement.querySelector('.kova-cart-panel__quantity-value');
            
            // Visual feedback
            increaseBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
              increaseBtn.style.transform = 'scale(1)';
            }, 150);
            
            if (quantityValue) {
              quantityValue.classList.add('kova-cart-panel__quantity-value--updating');
              setTimeout(() => {
                quantityValue.classList.remove('kova-cart-panel__quantity-value--updating');
              }, 200);
            }
            
            this.updateQuantityByItemId(cartItemId, item.quantity + 1);
          });
        }

        this.cartItems.appendChild(itemElement);
        console.log(`✅ Item ${index + 1} added to cart container`);
      });

      console.log('🎨 Finished rendering all cart items. Total items rendered:', this.cartData.items.length);
    }

    forceHideEmptyMessage() {
      console.log('🚫 Force hiding empty cart message');

      if (this.cartEmpty) {
        // Multiple methods to ensure it's hidden
        this.cartEmpty.style.display = 'none';
        this.cartEmpty.style.visibility = 'hidden';
        this.cartEmpty.style.opacity = '0';
        this.cartEmpty.style.height = '0';
        this.cartEmpty.style.overflow = 'hidden';
        this.cartEmpty.style.position = 'absolute';
        this.cartEmpty.style.left = '-9999px';

        // Remove from DOM flow
        this.cartEmpty.setAttribute('hidden', 'true');
        this.cartEmpty.setAttribute('aria-hidden', 'true');

        console.log('✅ Empty message forcefully hidden');
      } else {
        console.warn('⚠️ Cart empty element not found for hiding');
      }
    }

    showCartLoading() {
      console.log('⏳ Showing cart loading state');
      
      if (!this.cartItems) {
        console.warn('⚠️ Cart items container not found');
        return;
      }

      // Hide empty state and footer temporarily
      if (this.cartEmpty) {
        this.cartEmpty.style.display = 'none';
      }
      if (this.cartFooter) {
        this.cartFooter.style.display = 'none';
      }

      // Show loading state
      this.cartItems.style.display = 'flex';
      this.cartItems.innerHTML = `
        <div class="kova-cart-loading">
          <div class="kova-cart-loading__content">
            <svg class="kova-spinner" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/>
              <path d="M22 12C22 6.48 17.52 2 12 2V22C17.52 22 22 17.52 22 12Z" fill="currentColor"/>
            </svg>
            <span>Actualizando carrito...</span>
          </div>
        </div>
      `;
    }

    hideCartLoading() {
      console.log('✅ Hiding cart loading state');
      // updateCartDisplay will handle showing the correct state
      this.updateCartDisplay();
    }

    proceedToCheckout() {
      console.log('🛒 Proceeding to checkout...');

      if (this.cartData.items.length === 0) {
        console.warn('Cart is empty, cannot proceed to checkout');
        this.addMessage('Tu carrito está vacío. Agrega productos antes de proceder al checkout.', 'assistant');
        return;
      }

      try {
        // If we have a checkout URL from Shopify Storefront API, use it
        if (this.cartData.checkoutUrl) {
          console.log('🛒 Using Shopify checkout URL:', this.cartData.checkoutUrl);
          window.open(this.cartData.checkoutUrl, '_blank');
          return;
        }

        // Fallback: construct checkout URL based on shop domain
        const shopDomain = (window.KovaConfig && window.KovaConfig.shopDomain) || this.config.shopDomain;
        console.log('🔍 Using shop domain for checkout:', shopDomain);
        if (!shopDomain) {
          console.error('❌ No shop domain configured');
          this.addMessage('Error: No se pudo obtener la información de la tienda.', 'assistant');
          return;
        }

        // Determine the correct checkout URL format
        let checkoutUrl;
        if (window.location.hostname.includes('myshopify.com') ||
          window.location.hostname.includes('shopify.com')) {
          // If we're on a Shopify domain, use relative path
          checkoutUrl = '/cart';
          window.location.href = checkoutUrl;
        } else {
          // External domain, open Shopify store in new window
          checkoutUrl = `https://${shopDomain}/cart`;
          window.open(checkoutUrl, '_blank');
        }

        console.log('✅ Redirected to checkout:', checkoutUrl);

        // Show confirmation message
        this.addMessage('Abriendo checkout... Serás redirigido a completar tu compra.', 'assistant');

      } catch (error) {
        console.error('❌ Error proceeding to checkout:', error);
        this.addMessage('Error al proceder al checkout. Por favor, inténtalo de nuevo.', 'assistant');
      }
    }

    // Process cart actions - Simplified for n8n integration
    // n8n will handle all cart actions directly, so this is now a no-op
    processCartActions(actions) {
      console.log('🌿 Kova Chat: Cart actions are now handled by n8n workflow', actions);
      // All cart functionality is delegated to n8n
      return;
    }

    // ======= SHOPIFY CART SYNCHRONIZATION =======

    async loadShopifyCart() {
      console.log('🔄 Loading Shopify cart...');

      try {
        // Try to get cart from Shopify's native cart.js if available
        const isShopifyDomain = window.location.hostname.includes('myshopify.com') ||
          window.location.hostname.includes('shopify.com');
        const hasShopConfig = this.config.shopDomain && this.config.shopDomain.trim() !== '';

        if (window.fetch && (isShopifyDomain || hasShopConfig)) {
          // Use Shopify's cart.js API
          const response = await fetch('/cart.js');
          const cartData = await response.json();

          if (cartData) {
            console.log('✅ Loaded Shopify cart:', cartData);
            this.syncFromShopifyNativeCart(cartData);
            this.updateCartDisplay();
            return;
          }
        }

        // Fallback: Try to get cart from our API if cartId exists
        if (this.cartId) {
          const response = await fetch(`${this.config.apiEndpoint}/api/public/cart/get`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shop: this.config.shopDomain,
              cartId: this.cartId
            }),
          });

          const data = await response.json();
          if (data.success && data.data.cart) {
            console.log('✅ Loaded cart from API:', data.data.cart);
            this.syncCartFromShopify(data.data.cart);
            this.updateCartDisplay();
          }
        }
      } catch (error) {
        console.error('❌ Error loading Shopify cart:', error);
      }
    }

    syncFromShopifyNativeCart(shopifyCart) {
      console.log('🔄 Syncing from Shopify native cart:', shopifyCart);

      // Transform Shopify native cart to our format
      this.cartData.items = shopifyCart.items?.map((item, index) => ({
        id: item.variant_id.toString(),
        title: item.product_title,
        variantTitle: item.variant_title,
        price: (item.price / 100).toFixed(2), // Shopify prices are in cents
        quantity: item.quantity,
        image: item.image,
        variantId: item.variant_id.toString(),
        handle: item.handle,
        url: item.url,
        line_index: index + 1 // Shopify line indices are 1-based
      })) || [];

      // Update totals
      this.cartData.total = shopifyCart.total_price / 100; // Convert from cents
      this.cartData.itemCount = shopifyCart.item_count || 0;

      console.log('✅ Cart synced from Shopify native cart');
    }

    setupShopifyCartSync() {
      console.log('🔄 Setting up Shopify cart synchronization...');

      // Prevent duplicate sync intervals
      if (this.cartSyncInterval) {
        console.log('🔄 Cart sync already running, skipping setup');
        return;
      }

      // Listen for Shopify cart updates if available
      if (window.addEventListener) {
        // Store event handlers for cleanup
        this.cartUpdateHandler = (event) => {
          console.log('🔄 Shopify cart updated event detected:', event.detail);
          if (event.detail) {
            this.syncFromShopifyNativeCart(event.detail);
            this.updateCartDisplay();
          }
        };

        this.visibilityChangeHandler = () => {
          if (!document.hidden) {
            this.loadShopifyCart();
          }
        };

        // Listen for cart drawer updates
        document.addEventListener('cart:updated', this.cartUpdateHandler);

        // Periodically sync with Shopify cart (every 5 seconds)
        this.cartSyncInterval = setInterval(() => {
          this.loadShopifyCart();
        }, 5000);

        // Listen for page visibility changes to sync when user returns
        document.addEventListener('visibilitychange', this.visibilityChangeHandler);

        console.log('✅ Shopify cart sync listeners setup');
      }
    }

    async addToShopifyNativeCart(variantId, quantity = 1) {
      console.log('🛒 Adding to Shopify native cart:', { variantId, quantity });
      console.log('🌐 Current hostname:', window.location.hostname);
      console.log('🔗 Cart API endpoint: /cart/add.js');

      try {
        // Use Shopify's cart API
        const payload = {
          id: String(variantId), // Ensure variant ID is string
          quantity: parseInt(quantity)
        };
        console.log('📤 Sending to /cart/add.js:', payload);

        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify(payload),
        });

        console.log('📥 Response status:', response.status, response.statusText);

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Added to Shopify native cart:', result);

          // Trigger custom event
          document.dispatchEvent(new CustomEvent('cart:updated'));

          // Reload cart data
          await this.loadShopifyCart();

          return true;
        } else {
          // Try to get error details from response body
          let errorText = '';
          try {
            const errorData = await response.text();
            errorText = errorData;
            console.error('❌ Shopify cart API error response:', errorData);
          } catch (e) {
            console.error('❌ Could not read error response body');
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}. Response: ${errorText}`);
        }
      } catch (error) {
        console.error('❌ Error adding to Shopify native cart:', error);
        return false;
      }
    }

    async removeFromShopifyNativeCart(lineIndex) {
      console.log('🛒 Removing from Shopify native cart line:', lineIndex);

      try {
        const payload = {
          line: lineIndex,
          quantity: 0
        };
        console.log('📤 Sending to /cart/change.js:', payload);

        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify(payload),
        });

        console.log('📥 Response status:', response.status, response.statusText);

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Removed from Shopify native cart:', result);

          // Trigger custom event
          document.dispatchEvent(new CustomEvent('cart:updated'));

          // Reload cart data
          await this.loadShopifyCart();

          return true;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error('❌ Error removing from Shopify native cart:', error);
        return false;
      }
    }

    async updateShopifyCartQuantity(lineIndex, newQuantity) {
      console.log('🛒 Updating Shopify cart quantity. Line:', lineIndex, 'Quantity:', newQuantity);

      try {
        const payload = {
          line: lineIndex,
          quantity: newQuantity
        };
        console.log('📤 Sending to /cart/change.js:', payload);

        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify(payload),
        });

        console.log('📥 Response status:', response.status, response.statusText);

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Updated Shopify cart quantity:', result);

          // Trigger custom event
          document.dispatchEvent(new CustomEvent('cart:updated'));

          // Reload cart data
          await this.loadShopifyCart();

          return true;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error('❌ Error updating Shopify cart quantity:', error);
        return false;
      }
    }

    // Cleanup function
    destroy() {
      console.log('🧹 Cleaning up Kova Widget...');

      // Clear cart sync interval
      if (this.cartSyncInterval) {
        clearInterval(this.cartSyncInterval);
        console.log('✅ Cart sync interval cleared');
      }

      // Remove event listeners
      document.removeEventListener('cart:updated', this.cartUpdateHandler);
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);

      console.log('✅ Kova Widget cleanup completed');
    }
  }

  // Expose class for constructor access
  window.KovaWidget = KovaWidget;

  // EMERGENCY DEBUGGING AND CART POSITIONING SYSTEM
  function emergencyDebugCartPosition() {
    const timestamp = new Date().toISOString();
    const debugInfo = {
      timestamp,
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth <= 480
      },
      script: {
        src: document.querySelector('script[src*="kova-widget.js"]')?.src || 'NOT_FOUND',
        size: document.querySelector('script[src*="kova-widget.js"]')?.getAttribute('data-size') || 'UNKNOWN'
      }
    };

    console.log('🚨 EMERGENCY CART DEBUG START', debugInfo);

    // Check if our function is accessible
    console.log('📊 Function Check:', {
      applyMobileCartStyles: typeof applyMobileCartStyles,
      emergencyDebugCartPosition: typeof emergencyDebugCartPosition,
      window_applyMobileCartStyles: typeof window.applyMobileCartStyles
    });

    // Check for existing style elements
    const existingStyles = document.querySelectorAll('#kova-mobile-cart-override, style[data-kova-mobile]');
    console.log('📄 Existing style elements:', existingStyles.length, Array.from(existingStyles));

    // Check for cart panel element
    const cartPanel = document.querySelector('.kova-cart-panel');
    if (cartPanel) {
      const computedStyles = window.getComputedStyle(cartPanel);
      const rect = cartPanel.getBoundingClientRect();
      console.log('🛒 Cart panel element FOUND:', {
        classList: Array.from(cartPanel.classList),
        position: computedStyles.position,
        top: computedStyles.top,
        left: computedStyles.left,
        right: computedStyles.right,
        bottom: computedStyles.bottom,
        transform: computedStyles.transform,
        width: computedStyles.width,
        height: computedStyles.height,
        zIndex: computedStyles.zIndex,
        display: computedStyles.display,
        visibility: computedStyles.visibility,
        opacity: computedStyles.opacity,
        boundingRect: {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        }
      });
    } else {
      console.log('🛒 Cart panel element NOT FOUND');
    }

    return debugInfo;
  }

  // AGGRESSIVE MOBILE CART OVERRIDE WITH MULTIPLE FALLBACK METHODS
  function applyMobileCartStyles() {
    console.log('📱 STARTING MOBILE CART STYLES APPLICATION...');

    const debugInfo = emergencyDebugCartPosition();

    // Remove existing mobile styles if they exist
    const existingStyles = document.querySelectorAll('#kova-mobile-cart-override, style[data-kova-mobile]');
    existingStyles.forEach(style => {
      console.log('🗑️ Removing existing style:', style.id || style.getAttribute('data-kova-mobile'));
      style.remove();
    });

    // METHOD 1: CSS INJECTION WITH ULTRA-HIGH SPECIFICITY
    const mobileCartStyles = `
      /* EMERGENCY MOBILE CART PANEL - MAXIMUM OVERRIDE PRIORITY */
      @media (max-width: 480px) {
        /* Ultra high specificity selectors */
        html body div.kova-widget div.kova-cart-panel,
        html body .kova-widget .kova-cart-panel,
        html body .kova-cart-panel,
        .kova-cart-panel,
        *[class*="kova-cart-panel"] {
          /* FORCED POSITIONING - ABSOLUTE OVERRIDE */
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          right: unset !important;
          bottom: unset !important;
          
          /* ZERO OUT ALL MARGINS/PADDING */
          margin: 0 !important;
          margin-top: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          margin-bottom: 0 !important;
          padding: 20px !important;
          
          /* RESPONSIVE DIMENSIONS */
          width: calc(100vw - 40px) !important;
          max-width: 380px !important;
          height: 80vh !important;
          max-height: 550px !important;
          min-height: 300px !important;
          min-width: 280px !important;
          
          /* CENTERING TRANSFORM */
          transform: translate(-50%, -50%) !important;
          -webkit-transform: translate(-50%, -50%) !important;
          -moz-transform: translate(-50%, -50%) !important;
          -ms-transform: translate(-50%, -50%) !important;
          
          /* VISUAL STYLING */
          background: rgba(248, 249, 248, 0.98) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border-radius: 20px !important;
          border: 1px solid rgba(212, 196, 184, 0.3) !important;
          box-shadow: 0 20px 60px rgba(207, 121, 94, 0.25) !important;
          
          /* DISPLAY AND LAYERING */
          display: flex !important;
          flex-direction: column !important;
          z-index: 10002 !important;
          
          /* INITIAL STATE - HIDDEN */
          opacity: 0 !important;
          visibility: hidden !important;
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
        }
        
        /* OPEN STATE */
        .kova-cart-panel.kova-cart-panel--open,
        html body .kova-cart-panel.kova-cart-panel--open {
          opacity: 1 !important;
          visibility: visible !important;
          transform: translate(-50%, -50%) !important;
          -webkit-transform: translate(-50%, -50%) !important;
        }
        
        /* BACKDROP */
        .kova-cart-panel--open::before {
          content: '' !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          background: rgba(0, 0, 0, 0.5) !important;
          z-index: -1 !important;
        }
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'kova-mobile-cart-override';
    styleSheet.setAttribute('data-kova-mobile', 'emergency-override');
    styleSheet.textContent = mobileCartStyles;
    document.head.appendChild(styleSheet);
    console.log('✅ CSS INJECTION: Mobile cart styles injected');

    // METHOD 2: DIRECT DOM MANIPULATION FALLBACK
    function applyDirectStyling(element) {
      if (!element) return false;

      console.log('🎯 DIRECT STYLING: Applying inline styles to cart panel');

      // Force inline styles that cannot be overridden
      const inlineStyles = {
        position: 'fixed',
        top: '50%',
        left: '50%',
        right: 'unset',
        bottom: 'unset',
        margin: '0',
        padding: '20px',
        width: 'calc(100vw - 40px)',
        maxWidth: '380px',
        height: '80vh',
        maxHeight: '550px',
        minHeight: '300px',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(248, 249, 248, 0.98)',
        borderRadius: '20px',
        border: '1px solid rgba(212, 196, 184, 0.3)',
        boxShadow: '0 20px 60px rgba(207, 121, 94, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: '10002'
      };

      Object.entries(inlineStyles).forEach(([property, value]) => {
        element.style.setProperty(property, value, 'important');
      });

      console.log('✅ DIRECT STYLING: Applied inline styles');
      return true;
    }

    // METHOD 3: MUTATION OBSERVER FOR CART CREATION
    function setupCartWatcher() {
      console.log('👁️ MUTATION OBSERVER: Setting up cart panel watcher');

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              if (node.classList && node.classList.contains('kova-cart-panel')) {
                console.log('🎯 MUTATION OBSERVER: Cart panel detected, applying emergency styling');
                if (window.innerWidth <= 480) {
                  applyDirectStyling(node);
                }
              }

              // Check children too
              const cartPanels = node.querySelectorAll && node.querySelectorAll('.kova-cart-panel');
              if (cartPanels) {
                cartPanels.forEach(panel => {
                  console.log('🎯 MUTATION OBSERVER: Cart panel child detected, applying emergency styling');
                  if (window.innerWidth <= 480) {
                    applyDirectStyling(panel);
                  }
                });
              }
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      console.log('✅ MUTATION OBSERVER: Cart watcher active');
      return observer;
    }

    // METHOD 4: AGGRESSIVE PERIODIC CHECKING
    function setupPeriodicCheck() {
      console.log('⏰ PERIODIC CHECK: Setting up aggressive cart styling checks');

      const checkInterval = setInterval(() => {
        const cartPanel = document.querySelector('.kova-cart-panel');
        if (cartPanel && window.innerWidth <= 480) {
          const computedStyles = window.getComputedStyle(cartPanel);
          const rect = cartPanel.getBoundingClientRect();

          // Check if cart is off-screen or incorrectly positioned
          if (rect.left > window.innerWidth - 100 || rect.right < 100 ||
            rect.top > window.innerHeight - 100 || rect.bottom < 100) {
            console.log('🚨 PERIODIC CHECK: Cart detected off-screen, applying emergency fix');
            applyDirectStyling(cartPanel);
          }
        }
      }, 1000);

      // Clear after 30 seconds to prevent infinite checking
      setTimeout(() => {
        clearInterval(checkInterval);
        console.log('⏰ PERIODIC CHECK: Cleanup after 30 seconds');
      }, 30000);

      return checkInterval;
    }

    // Apply existing cart panel styling immediately
    const existingCartPanel = document.querySelector('.kova-cart-panel');
    if (existingCartPanel && window.innerWidth <= 480) {
      console.log('🎯 IMMEDIATE: Found existing cart panel, applying direct styling');
      applyDirectStyling(existingCartPanel);
    }

    // Setup all fallback methods
    setupCartWatcher();
    setupPeriodicCheck();

    console.log('✅ MOBILE CART EMERGENCY SYSTEM: All methods activated');
    console.log('📊 Debug info available in browser console');
  }

  // Apply styles initially and on resize
  applyMobileCartStyles();

  // Handle viewport changes (rotation, resize)
  let resizeTimeout;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(applyMobileCartStyles, 150);
  });

  // GLOBAL EMERGENCY FUNCTIONS - Available before widget initialization
  // Quick cart position check
  window.KOVA_WHERE_IS_CART = function() {
    const cartPanel = document.querySelector('.kova-cart-panel');
    if (!cartPanel) {
      console.log('❌ NO CART PANEL FOUND');
      return 'No cart panel found';
    }
    
    const rect = cartPanel.getBoundingClientRect();
    const computed = window.getComputedStyle(cartPanel);
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    
    console.log('🎯 CART POSITION DEBUG:');
    console.log('   Position:', computed.position);
    console.log('   Top:', computed.top, 'Left:', computed.left);
    console.log('   Right:', computed.right, 'Bottom:', computed.bottom);
    console.log('   Transform:', computed.transform);
    console.log('   Bounding Rect:', rect);
    console.log('   Viewport:', viewport);
    console.log('   Visible?', rect.left >= 0 && rect.top >= 0 && rect.right <= viewport.width && rect.bottom <= viewport.height);
    
    // Simple visibility check
    const isVisible = rect.width > 0 && rect.height > 0;
    const isOnScreen = rect.left < viewport.width && rect.right > 0 && rect.top < viewport.height && rect.bottom > 0;
    
    console.log('   Has dimensions?', isVisible);
    console.log('   On screen?', isOnScreen);
    
    return {
      found: true,
      position: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom },
      visible: isVisible,
      onScreen: isOnScreen
    };
  };

  window.KOVA_EMERGENCY_DEBUG = function () {
    console.log('🚨 GLOBAL EMERGENCY DEBUG CALLED');
    console.log('Current viewport:', window.innerWidth + 'x' + window.innerHeight);
    console.log('Is mobile:', window.innerWidth <= 480);

    const cartPanel = document.querySelector('.kova-cart-panel');
    if (cartPanel) {
      console.log('Cart panel found:', cartPanel);
      console.log('Cart classes:', Array.from(cartPanel.classList));
      console.log('Cart position:', cartPanel.getBoundingClientRect());
      return cartPanel;
    } else {
      console.log('No cart panel found');
      return null;
    }
  };

  window.KOVA_FORCE_CENTER = function () {
    console.log('🎯 GENTLE FORCE CENTER CALLED');
    const cartPanel = document.querySelector('.kova-cart-panel');
    if (cartPanel && window.innerWidth <= 480) {
      console.log('Applying gentle emergency centering...');

      // Gentle option - only set essential positioning properties
      cartPanel.style.setProperty('position', 'fixed', 'important');
      cartPanel.style.setProperty('top', '50%', 'important');
      cartPanel.style.setProperty('left', '50%', 'important');
      cartPanel.style.setProperty('right', 'auto', 'important');
      cartPanel.style.setProperty('bottom', 'auto', 'important');
      cartPanel.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
      cartPanel.style.setProperty('width', 'calc(100vw - 32px)', 'important');
      cartPanel.style.setProperty('max-width', '380px', 'important');
      cartPanel.style.setProperty('height', '80vh', 'important');
      cartPanel.style.setProperty('max-height', '500px', 'important');
      cartPanel.style.setProperty('margin', '0', 'important');
      cartPanel.style.setProperty('z-index', '10002', 'important');

      // Show if hidden
      if (cartPanel.classList.contains('kova-cart-panel--open')) {
        cartPanel.style.setProperty('opacity', '1', 'important');
        cartPanel.style.setProperty('visibility', 'visible', 'important');
      }

      console.log('✅ Gentle cart centering applied');
      return 'Cart gently centered!';
    } else if (!cartPanel) {
      console.log('❌ No cart panel found');
      return 'No cart panel found!';
    } else {
      console.log('ℹ️ Not on mobile viewport');
      return 'Not on mobile viewport - centering not needed';
    }
  };

  window.KOVA_REAPPLY_STYLES = function () {
    console.log('🔄 GLOBAL STYLE REAPPLICATION');
    if (typeof applyMobileCartStyles === 'function') {
      applyMobileCartStyles();
      return 'Styles reapplied!';
    } else {
      console.log('❌ applyMobileCartStyles function not available');
      return 'Function not available';
    }
  };

  // Initialize widget function
  function initializeWidget() {
    if (window.kovaWidget) {
      console.log('🔒 Kova Widget: Already initialized, skipping');
      return;
    }

    console.log('🚀 Launching Kova Luxury Widget v2.1...');
    // Use window.KovaConfig if available (set by Shopify Liquid template)
    const widget = new KovaWidget(window.KovaConfig || {});
    window.kovaWidget = widget;

    // Mark as fully initialized
    window.__KOVA_WIDGET_INITIALIZED__ = true;
    window.__KOVA_WIDGET_LOADING__ = false;

    // Expose testing functions for development
    window.testKovaCart = () => {
      console.log('🧪 Testing Kova Cart functionality...');
      widget.testCart();
      return 'Cart test completed! Check the widget.';
    };

    window.testKovaProduct = () => {
      console.log('🧪 Testing Kova Product Recommendations...');
      widget.testProductRecommendation();
      return 'Product recommendations test completed! Check the widget.';
    };

    // Additional cart testing functions
    window.showKovaCart = () => {
      console.log('🛒 Showing Kova Cart...');
      widget.showCart();
      return 'Cart is now visible!';
    };

    window.hideKovaCart = () => {
      console.log('🛒 Hiding Kova Cart...');
      widget.hideCart();
      return 'Cart is now hidden!';
    };

    // Additional testing function for new cart design
    window.testNewCartDesign = () => {
      console.log('🎨 Testing new cart sidebar design...');

      // Add a test product
      const testProduct = {
        id: 'test-' + Date.now(),
        title: 'Test Product - New Cart Design',
        price: '29.99',
        variantId: 'test-variant-123',
        quantity: 1
      };

      widget.addToCartLocal(testProduct);
      widget.showCart();

      return 'New cart design test completed! Check the sidebar cart.';
    };

    window.clearKovaCart = () => {
      console.log('🗑️ Clearing Kova Cart...');
      widget.cartData.items = [];
      widget.updateCartDisplay();
      return 'Cart cleared successfully!';
    };

    // EMERGENCY DEBUGGING FUNCTIONS
    window.emergencyDebugCart = () => {
      console.log('🚨 EMERGENCY CART DEBUG TRIGGERED BY USER');
      return emergencyDebugCartPosition();
    };

    window.forceCartCenter = () => {
      console.log('🎯 FORCING CART CENTER MANUALLY');
      const cartPanel = document.querySelector('.kova-cart-panel');
      if (cartPanel) {
        // Apply direct inline styling with highest priority
        cartPanel.style.setProperty('position', 'fixed', 'important');
        cartPanel.style.setProperty('top', '50%', 'important');
        cartPanel.style.setProperty('left', '50%', 'important');
        cartPanel.style.setProperty('right', 'unset', 'important');
        cartPanel.style.setProperty('bottom', 'unset', 'important');
        cartPanel.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
        cartPanel.style.setProperty('margin', '0', 'important');
        cartPanel.style.setProperty('width', 'calc(100vw - 40px)', 'important');
        cartPanel.style.setProperty('max-width', '380px', 'important');
        cartPanel.style.setProperty('height', '80vh', 'important');
        cartPanel.style.setProperty('z-index', '10002', 'important');
        console.log('✅ Direct inline styles applied to cart panel');
        return 'Cart panel manually centered with inline styles!';
      } else {
        console.log('❌ No cart panel found to style');
        return 'No cart panel found!';
      }
    };

    window.reapplyMobileStyles = () => {
      console.log('🔄 REAPPLYING MOBILE STYLES');
      applyMobileCartStyles();
      return 'Mobile styles reapplied!';
    };

    window.inspectCartStyles = () => {
      const cartPanel = document.querySelector('.kova-cart-panel');
      if (cartPanel) {
        const computedStyles = window.getComputedStyle(cartPanel);
        const rect = cartPanel.getBoundingClientRect();
        const styleInfo = {
          computed: {
            position: computedStyles.position,
            top: computedStyles.top,
            left: computedStyles.left,
            right: computedStyles.right,
            bottom: computedStyles.bottom,
            transform: computedStyles.transform,
            width: computedStyles.width,
            height: computedStyles.height,
            zIndex: computedStyles.zIndex,
            margin: computedStyles.margin,
            display: computedStyles.display,
            visibility: computedStyles.visibility,
            opacity: computedStyles.opacity
          },
          bounding: {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          },
          inline: cartPanel.style.cssText,
          classList: Array.from(cartPanel.classList)
        };
        console.log('📊 CART STYLE INSPECTION:', styleInfo);
        return styleInfo;
      } else {
        console.log('❌ No cart panel found to inspect');
        return 'No cart panel found!';
      }
    };

    console.log('✨ Kova Widget initialized! New cart features ready:');
    console.log('🛒 Use window.testNewCartDesign() to test the new sidebar cart');
    console.log('📋 Use window.clearKovaCart() to clear cart items');
    console.log('🔄 Use window.showKovaCart() / window.hideKovaCart() to control visibility');
    console.log('🚨 EMERGENCY DEBUG FUNCTIONS:');
    console.log('   📊 window.emergencyDebugCart() - Full cart debug information');
    console.log('   🎯 window.forceCartCenter() - Force cart to center with inline styles');
    console.log('   🔄 window.reapplyMobileStyles() - Reapply mobile cart styles');
    console.log('   📊 window.inspectCartStyles() - Inspect current cart styles');
  }

  // Single initialization based on document state
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidget);
  } else {
    initializeWidget();
  }

  console.log('✨ Kova Luxury Chat: Widget script loaded successfully');
  console.log('🚨 EMERGENCY MOBILE CART DEBUGGING SYSTEM ACTIVE');
  console.log('📋 Available Emergency Functions:');
  console.log('   🚨 KOVA_EMERGENCY_DEBUG() - Full diagnostic information');
  console.log('   🎯 KOVA_FORCE_CENTER() - Nuclear cart centering');
  console.log('   🔄 KOVA_REAPPLY_STYLES() - Reapply mobile styles');
  console.log('📊 Emergency system will automatically apply multiple fallbacks on mobile devices');
  console.log('⚡ Mobile cart positioning will be enforced with 4 different methods simultaneously');
})();