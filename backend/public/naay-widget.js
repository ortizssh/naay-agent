/**
 * Naay AI Chat Widget - Ultra-Modern Minimalist Design
 * Version: 3.0.0-LUXURY - 2025.11.20.17:00
 * Avant-garde Design with Naay Brand Integration
 * 
 * ✨ LUXURY WIDGET - Ultra-minimalist with glassmorphism
 */

(function() {
  'use strict';

  // UNIQUE IDENTIFIER FOR VERSION DETECTION 
  window.__NAAY_WIDGET_VERSION__ = '3.0.0-LUXURY-' + Date.now();
  window.__NAAY_WIDGET_TIMESTAMP__ = new Date().toISOString();
  console.log('✨ NAAY WIDGET LUXURY VERSION:', {
    version: window.__NAAY_WIDGET_VERSION__,
    timestamp: window.__NAAY_WIDGET_TIMESTAMP__,
    design: 'Ultra-minimalist luxury',
    colors: 'Naay Brand Palette',
    source: 'OFFICIAL-LUXURY-DESIGN'
  });

  // Enhanced singleton protection - prevent ANY duplicate loading
  if (window.__NAAY_WIDGET_LOADING__ || window.__NAAY_WIDGET_INITIALIZED__) {
    console.warn('⚠️ Naay Widget: Already loading/initialized, preventing duplicate');
    return;
  }
  
  // Mark as loading immediately to prevent race conditions
  window.__NAAY_WIDGET_LOADING__ = true;
  
  // Prevent multiple widget loads - check for both class and instance
  if (window.NaayWidget && window.naayWidget) {
    console.warn('🔒 Naay Widget already loaded and instantiated, version:', window.__NAAY_WIDGET_VERSION__);
    window.__NAAY_WIDGET_LOADING__ = false;
    return;
  }
  
  // Check if DOM already has widget
  if (document.querySelector('.naay-widget')) {
    console.warn('🔒 Naay Widget DOM already exists, skipping initialization');
    window.__NAAY_WIDGET_LOADING__ = false;
    return;
  }

  class NaayWidget {
    constructor(config = {}) {
      this.config = {
        shopDomain: '',
        apiEndpoint: 'https://naay-agent-app1763504937.azurewebsites.net',
        position: 'bottom-right',
        // Naay Brand Colors from Design Guidelines
        everyday: '#E8B5A1',    // Soft coral
        fresh: '#8FA68E',       // Sage green  
        delicate: '#D4C4B8',    // Soft taupe
        forever: '#B8A882',     // Olive beige
        hydra: '#A8C4C4',       // Soft blue-gray
        deep: '#D4B82C',        // Mustard yellow
        rich: '#B8943C',        // Golden brown
        radiant: '#A68A3C',     // Olive gold
        perfect: '#A8826B',     // Warm brown
        sage: '#F8F9F8',        // Ultra-light sage
        greeting: '',
        placeholder: 'Pregúntanos lo que quieras...',
        avatar: '🌿',
        brandName: 'Naay',
        language: 'es',
        enabled: true,
        ...config
      };

      if (!this.config.enabled) {
        console.log('Naay Widget is disabled');
        return;
      }

      this.isOpen = false;
      this.messages = [];
      this.conversationId = this.getStoredConversationId();
      this.eventListenersAdded = false; // Prevent duplicate event listeners
      
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
      console.log('✨ Initializing Naay Luxury Widget v2.1 with Cart Sidebar:', new Date().toISOString());
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
      if (document.getElementById('naay-widget')) {
        console.log('🔒 Widget already exists in DOM, skipping creation');
        this.container = document.getElementById('naay-widget');
        return;
      }

      // Create widget container
      this.container = document.createElement('div');
      this.container.id = 'naay-widget';
      this.container.className = `naay-widget naay-widget--${this.config.position} naay-widget--closed`;
      
      // Create ultra-modern HTML with luxury design
      this.container.innerHTML = `
        <!-- Main Widget Layout Container -->
        <div class="naay-widget-layout" id="naay-widget-layout">
          
          
          <!-- Cart Panel - Slides from left -->
          <div class="naay-cart-panel" id="naay-cart-panel">
            <header class="naay-cart-panel__header">
              <div class="naay-cart-panel__title">
                <svg class="naay-cart-panel__icon" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H14C13.4 20 13 19.6 13 19V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h3 id="naay-cart-title">Mi Carrito</h3>
              </div>
              <button class="naay-cart-panel__close" id="naay-cart-close" aria-label="Cerrar carrito">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                </svg>
              </button>
            </header>
            
            <div class="naay-cart-panel__content" id="naay-cart-content">
              <div class="naay-cart-panel__empty" id="naay-cart-empty">
                <svg class="naay-cart-panel__empty-icon" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H14C13.4 20 13 19.6 13 19V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p class="naay-cart-panel__empty-text">Tu carrito está vacío</p>
                <p class="naay-cart-panel__empty-subtitle">¡Agrega productos para comenzar a comprar!</p>
              </div>
              
              <div class="naay-cart-panel__items" id="naay-cart-items"></div>
            </div>
            
            <footer class="naay-cart-panel__footer" id="naay-cart-footer">
              <div class="naay-cart-panel__total">
                <span class="naay-cart-panel__total-label">Total:</span>
                <span class="naay-cart-panel__total-price" id="naay-cart-total">$0.00</span>
              </div>
              <button class="naay-cart-panel__checkout" id="naay-cart-checkout">
                <span>Ir al Checkout</span>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </footer>
          </div>
          
          <!-- Chat Container -->
          <div class="naay-chat-container" id="naay-chat-container">
            <div class="naay-widget__promotional-message" id="naay-promotional-message" role="dialog" aria-label="Mensaje promocional">
              <div class="naay-widget__promotional-content">
                <div class="naay-widget__promotional-text">
                  ¿Necesitas ayuda?
                  <span class="naay-widget__promotional-subtitle">Pregúntanos sobre cuidado natural</span>
                </div>
              </div>
              <div class="naay-widget__promotional-arrow"></div>
            </div>
            
            <button class="naay-widget__button" id="naay-widget-button" aria-label="Abrir chat de Naay" aria-expanded="false">
              <div class="naay-widget__button-content">
                <svg class="naay-widget__chat-icon" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3C17.5 3 21 6.58 21 11C21 15.42 17.5 19 12 19C10.76 19 9.57 18.82 8.47 18.5C5.55 21 2 21 2 21C4.33 18.67 4.7 17.1 4.75 16.5C3.05 15.07 2 13.13 2 11C2 6.58 5.5 3 10 3H12Z" fill="currentColor"/>
                </svg>
                <svg class="naay-widget__close-icon" viewBox="0 0 24 24" fill="none">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                </svg>
              </div>
              <div class="naay-widget__button-pulse"></div>
            </button>
            
            <div class="naay-widget__chat" id="naay-widget-chat" role="dialog" aria-label="Chat de Naay">
              <div class="naay-widget__simple-header">
                <!-- Cart Toggle Button - Small in Top Left -->
                <button class="naay-widget__cart-toggle-btn" id="naay-widget-cart-toggle-btn" aria-label="Ver carrito">
                  <svg class="naay-cart-toggle-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H14C13.4 20 13 19.6 13 19V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span class="naay-cart-toggle-count" id="naay-widget-cart-count">0</span>
                </button>
                
                <button class="naay-widget__back-btn" id="naay-widget-back-btn" aria-label="Volver">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                
                <button class="naay-widget__close" id="naay-widget-close" aria-label="Cerrar chat">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                  </svg>
                </button>
              </div>
              
              <main class="naay-widget__messages" id="naay-widget-messages" role="main">
                
                <div class="naay-widget__welcome">
                  <div class="naay-widget__welcome-header">
                    <h4 class="naay-widget__welcome-title">¡Hola! Soy tu asesora personal de Naay. ¿En qué puedo ayudarte? ✨🌿</h4>
                  </div>
                  <div class="naay-widget__welcome-features">
                    <div class="naay-widget__feature" data-message="¿Qué productos recomiendas para mi tipo de piel?">
                      <svg class="naay-feature-icon" viewBox="0 0 20 20" fill="none">
                        <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <span>Recomendaciones personalizadas para tu piel</span>
                    </div>
                    <div class="naay-widget__feature" data-message="¿Me ayudas a conocer mi tipo de piel?">
                      <svg class="naay-feature-icon" viewBox="0 0 20 20" fill="none">
                        <path d="M13 10V3L4 14H11L11 21L20 10H13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <span>Test rápido para conocer tu tipo de piel</span>
                    </div>
                    <div class="naay-widget__feature" data-message="¿Puedes ayudarme a elegir productos para mi rutina?">
                      <svg class="naay-feature-icon" viewBox="0 0 20 20" fill="none">
                        <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H14C13.4 20 13 19.6 13 19V13M17 13H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <span>Ayuda con tu compra</span>
                    </div>
                  </div>
                </div>
              </main>
              
              <div class="naay-widget__input-container">
                <div class="naay-widget__input-wrapper">
                  <input 
                    type="text" 
                    class="naay-widget__input" 
                    id="naay-widget-input" 
                    placeholder="Pregúntanos lo que quieras..."
                    aria-label="Campo de mensaje"
                  />
                  <button 
                    class="naay-widget__send" 
                    id="naay-widget-send" 
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

      // Append to document
      document.body.appendChild(this.container);
      
      // Add initial fade-in animation
      setTimeout(() => {
        this.container.classList.add('naay-widget--loaded');
      }, 100);
    }

    setupElements() {
      // Wait for DOM to be ready, then get elements using container context
      this.button = this.container.querySelector('#naay-widget-button');
      this.promotionalMessage = this.container.querySelector('#naay-promotional-message');
      this.chat = this.container.querySelector('#naay-widget-chat');
      this.messagesContainer = this.container.querySelector('#naay-widget-messages');
      this.input = this.container.querySelector('#naay-widget-input');
      this.sendButton = this.container.querySelector('#naay-widget-send');
      this.resetButton = this.container.querySelector('#naay-widget-reset');
      this.closeButton = this.container.querySelector('#naay-widget-close');
      this.backButton = this.container.querySelector('#naay-widget-back-btn');

      // Cart elements - new layout structure
      this.cartSmallToggle = this.container.querySelector('#naay-widget-cart-toggle-btn'); // Small cart button in chat
      this.cartSmallCount = this.container.querySelector('#naay-widget-cart-count'); // Count badge for small button
      this.cartPanel = this.container.querySelector('#naay-cart-panel');
      this.cartContent = this.container.querySelector('#naay-cart-content');
      this.cartEmpty = this.container.querySelector('#naay-cart-empty');
      this.cartItems = this.container.querySelector('#naay-cart-items');
      this.cartFooter = this.container.querySelector('#naay-cart-footer');
      this.cartTotal = this.container.querySelector('#naay-cart-total');
      this.cartCheckout = this.container.querySelector('#naay-cart-checkout');
      this.cartClose = this.container.querySelector('#naay-cart-close');

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
    }

    addLuxuryStyles() {
      const style = document.createElement('style');
      style.textContent = `
        /* Naay Luxury Widget - Ultra-Modern Minimalist Design */
        
        :root {
          /* Naay Brand Color Palette */
          --naay-everyday: #E8B5A1;
          --naay-fresh: #8FA68E;
          --naay-delicate: #D4C4B8;
          --naay-forever: #B8A882;
          --naay-hydra: #A8C4C4;
          --naay-deep: #D4B82C;
          --naay-rich: #B8943C;
          --naay-radiant: #A68A3C;
          --naay-perfect: #A8826B;
          --naay-sage: #F8F9F8;
          --naay-white: #FFFFFF;
          --naay-black: #1A1A1A;
          
          /* Typography */
          --naay-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          --naay-font-weight-regular: 400;
          --naay-font-weight-medium: 500;
          --naay-font-weight-semibold: 600;
          
          /* Shadows & Effects */
          --naay-shadow-soft: 0 4px 24px rgba(168, 130, 107, 0.08);
          --naay-shadow-medium: 0 8px 32px rgba(168, 130, 107, 0.12);
          --naay-shadow-strong: 0 16px 48px rgba(168, 130, 107, 0.16);
          --naay-blur: backdrop-filter: blur(16px);
          
          /* Transitions */
          --naay-transition: cubic-bezier(0.4, 0, 0.2, 1);
          --naay-duration: 400ms;
        }

        .naay-widget {
          position: fixed !important;
          bottom: 20px !important;
          right: 20px !important;
          z-index: 999999 !important;
          font-family: var(--naay-font) !important;
          font-feature-settings: 'cv11', 'cv02', 'cv03', 'cv04' !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          opacity: 0 !important;
          transform: translateY(20px) !important;
          transition: all 600ms var(--naay-transition) !important;
        }

        .naay-widget--loaded {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }

        .naay-widget--bottom-right {
          bottom: 32px !important;
          right: 32px !important;
        }

        .naay-widget--bottom-left {
          bottom: 32px !important;
          left: 32px !important;
        }

        .naay-widget--top-right {
          top: 32px !important;
          right: 32px !important;
        }

        .naay-widget--top-left {
          top: 32px !important;
          left: 32px !important;
        }

        /* Ultra-Modern Promotional Message */
        .naay-widget__promotional-message {
          position: absolute !important;
          bottom: 24px !important;
          right: 96px !important;
          background: var(--naay-white) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          border-radius: 8px !important;
          padding: 20px 24px !important;
          max-width: 380px !important;
          width: 380px !important;
          box-shadow: var(--naay-shadow-medium) !important;
          cursor: pointer !important;
          transition: all var(--naay-duration) var(--naay-transition) !important;
          opacity: 1 !important;
          visibility: visible !important;
          transform: translateY(0) scale(1) !important;
        }

        .naay-widget__promotional-message:hover {
          transform: translateY(-4px) scale(1.02) !important;
          box-shadow: var(--naay-shadow-strong) !important;
          border-color: rgba(212, 196, 184, 0.3) !important;
        }

        .naay-widget__promotional-content {
          display: block !important;
        }




        .naay-widget__promotional-text {
          flex: 1 !important;
        }

        .naay-widget__promotional-text {
          color: var(--naay-perfect) !important;
          font-size: 13px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          line-height: 1.3 !important;
          margin: 0 !important;
        }

        .naay-widget__promotional-subtitle {
          display: block !important;
          color: var(--naay-delicate) !important;
          font-size: 11px !important;
          font-weight: var(--naay-font-weight-regular) !important;
          margin-top: 2px !important;
        }

        .naay-widget__promotional-arrow {
          position: absolute !important;
          top: 50% !important;
          left: -8px !important;
          transform: translateY(-50%) !important;
          width: 0 !important;
          height: 0 !important;
          border-right: 8px solid var(--naay-white) !important;
          border-top: 8px solid transparent !important;
          border-bottom: 8px solid transparent !important;
          filter: drop-shadow(-2px 0 4px rgba(168, 130, 107, 0.1)) !important;
        }
        
        .naay-widget--bottom-left .naay-widget__promotional-arrow {
          right: auto !important;
          left: -8px !important;
          border-left: 8px solid transparent !important;
          border-right: 8px solid var(--naay-white) !important;
        }

        .naay-widget--open .naay-widget__promotional-message {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          transform: translateY(16px) scale(0.95) !important;
        }

        /* Ultra-Luxury Chat Button */
        .naay-widget__button {
          width: 72px !important;
          height: 72px !important;
          border-radius: 50% !important;
          background: var(--naay-perfect) !important;
          border: none !important;
          cursor: pointer !important;
          position: relative !important;
          box-shadow: var(--naay-shadow-medium) !important;
          transition: all var(--naay-duration) var(--naay-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: hidden !important;
        }

        .naay-widget__button:hover {
          transform: translateY(-6px) scale(1.08) !important;
          box-shadow: var(--naay-shadow-strong) !important;
          background: var(--naay-rich) !important;
        }

        .naay-widget__button-content {
          position: relative !important;
          z-index: 3 !important;
          width: 24px !important;
          height: 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .naay-widget__chat-icon,
        .naay-widget__close-icon {
          width: 24px !important;
          height: 24px !important;
          color: var(--naay-white) !important;
          position: absolute !important;
          transition: all var(--naay-duration) var(--naay-transition) !important;
        }

        .naay-widget__chat-icon {
          opacity: 1 !important;
          transform: rotate(0deg) scale(1) !important;
        }

        .naay-widget__close-icon {
          opacity: 0 !important;
          transform: rotate(90deg) scale(0.8) !important;
        }

        .naay-widget--open .naay-widget__chat-icon {
          opacity: 0 !important;
          transform: rotate(-90deg) scale(0.8) !important;
        }

        .naay-widget--open .naay-widget__close-icon {
          opacity: 1 !important;
          transform: rotate(0deg) scale(1) !important;
        }

        .naay-widget__button-pulse {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 50% !important;
          background: var(--naay-perfect) !important;
          animation: naayPulse 2s infinite !important;
          z-index: 1 !important;
        }

        @keyframes naayPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.6; }
          100% { transform: scale(1.3); opacity: 0; }
        }

        .naay-widget--open .naay-widget__button-pulse {
          animation: none !important;
        }

        /* Ultra-Modern Chat Window */
        .naay-widget__chat {
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
          box-shadow: var(--naay-shadow-strong) !important;
          display: none !important;
          flex-direction: column !important;
          overflow: hidden !important;
          transform: translateY(32px) scale(0.9) !important;
          opacity: 0 !important;
          visibility: hidden !important;
          transition: all var(--naay-duration) var(--naay-transition) !important;
        }

        .naay-widget--bottom-right .naay-widget__chat {
          left: auto !important;
          right: 0 !important;
        }

        .naay-widget--top-right .naay-widget__chat,
        .naay-widget--top-left .naay-widget__chat {
          bottom: auto !important;
          top: 88px !important;
        }

        .naay-widget--open .naay-widget__chat {
          display: flex !important;
          transform: translateY(0) scale(1) !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .naay-widget--closing .naay-widget__chat {
          transform: translateY(16px) scale(0.95) !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }

        /* Cart Modal - Slide from left inside chat */
        .naay-cart__modal {
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
        .naay-cart__modal--open {
          display: block !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
        }
        .naay-cart__backdrop {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background: rgba(0, 0, 0, 0.2) !important;
          backdrop-filter: blur(2px) !important;
          cursor: pointer !important;
        }
        .naay-cart__slide {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 360px !important;
          height: 100% !important;
          background: rgba(248, 249, 248, 0.98) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border-radius: 0 16px 16px 0 !important;
          border: 1px solid rgba(168, 130, 107, 0.15) !important;
          border-left: none !important;
          box-shadow: 
            4px 0 32px rgba(168, 130, 107, 0.12),
            2px 0 16px rgba(168, 130, 107, 0.08) !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          transform: translateX(-100%) !important;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        }
        .naay-cart__modal--open .naay-cart__slide {
          transform: translateX(0) !important;
        }
        .naay-cart__close {
          background: rgba(255, 255, 255, 0.15) !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px !important;
          color: var(--naay-white) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--naay-transition) !important;
        }
        .naay-cart__close:hover {
          background: rgba(255, 255, 255, 0.25) !important;
          transform: scale(1.1) !important;
        }
        .naay-cart__close svg {
          width: 14px !important;
          height: 14px !important;
        }
        
        /* Legacy cart panel styles - to be removed */
        .naay-widget__cart-panel {
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
          border: 1px solid rgba(168, 130, 107, 0.15) !important;
          box-shadow: 
            0 32px 64px rgba(168, 130, 107, 0.12),
            0 16px 32px rgba(168, 130, 107, 0.08),
            0 8px 16px rgba(168, 130, 107, 0.05),
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

        .naay-widget--bottom-left .naay-widget__cart-panel {
          right: auto !important;
          left: calc(100% + 420px) !important; /* Position to right of chat for left-positioned widget */
          transform: translateX(32px) translateY(24px) scale(0.92) !important;
        }

        /* Cart panel minimized state */
        .naay-widget__cart-panel--minimized {
          height: 60px !important;
          overflow: hidden !important;
        }
        
        .naay-widget__cart-panel--minimized .naay-cart__content,
        .naay-widget__cart-panel--minimized .naay-cart__footer {
          display: none !important;
        }

        .naay-widget--cart-open .naay-widget__cart-panel {
          display: flex !important;
          transform: translateX(0) translateY(0) scale(1) !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .naay-cart__header {
          background: transparent !important;
          color: var(--naay-black) !important;
          padding: 20px 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          border-top-left-radius: 20px !important;
          border-top-right-radius: 20px !important;
        }

        .naay-cart__title {
          font-size: 16px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          margin: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .naay-cart__icon {
          width: 18px !important;
          height: 18px !important;
        }

        .naay-cart__toggle {
          background: rgba(255, 255, 255, 0.15) !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px !important;
          color: var(--naay-white) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--naay-transition) !important;
        }

        .naay-cart__toggle:hover {
          background: rgba(255, 255, 255, 0.25) !important;
          transform: scale(1.1) !important;
        }

        .naay-cart__toggle svg {
          width: 14px !important;
          height: 14px !important;
        }

        .naay-cart__actions {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .naay-cart__minimize {
          background: rgba(255, 255, 255, 0.15) !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px !important;
          color: var(--naay-white) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--naay-transition) !important;
        }

        .naay-cart__minimize:hover {
          background: rgba(255, 255, 255, 0.25) !important;
          transform: scale(1.1) !important;
        }

        .naay-cart__minimize svg {
          width: 14px !important;
          height: 14px !important;
          transition: transform 0.2s var(--naay-transition) !important;
        }

        .naay-widget__cart-panel--minimized .naay-cart__minimize svg {
          transform: rotate(180deg) !important;
        }

        .naay-cart__content {
          flex: 1 !important;
          overflow-y: auto !important;
          padding: 0 !important;
        }

        .naay-cart__empty {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          height: 100% !important;
          padding: 40px 24px !important;
          text-align: center !important;
          color: var(--naay-perfect) !important;
        }

        .naay-cart__empty-icon {
          width: 48px !important;
          height: 48px !important;
          opacity: 0.6 !important;
          margin-bottom: 16px !important;
        }

        .naay-cart__empty-text {
          font-size: 16px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          margin: 0 0 8px 0 !important;
          color: var(--naay-black) !important;
        }

        .naay-cart__empty-subtitle {
          font-size: 13px !important;
          opacity: 0.7 !important;
          color: var(--naay-perfect) !important;
        }

        .naay-cart__items {
          padding: 16px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
        }

        .naay-cart__item {
          background: var(--naay-white) !important;
          border-radius: 12px !important;
          padding: 16px !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          box-shadow: 0 2px 8px rgba(168, 130, 107, 0.05) !important;
          transition: all 0.2s var(--naay-transition) !important;
        }

        .naay-cart__item:hover {
          box-shadow: 0 4px 12px rgba(168, 130, 107, 0.1) !important;
          transform: translateY(-1px) !important;
        }

        .naay-cart__item-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
          margin-bottom: 8px !important;
        }

        .naay-cart__item-title {
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          line-height: 1.3 !important;
          margin: 0 !important;
          flex: 1 !important;
          margin-right: 8px !important;
          color: var(--naay-black) !important;
        }

        .naay-cart__item-remove {
          background: rgba(220, 38, 38, 0.1) !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 4px !important;
          color: #dc2626 !important;
          cursor: pointer !important;
          transition: all 0.2s var(--naay-transition) !important;
        }

        .naay-cart__item-remove:hover {
          background: rgba(220, 38, 38, 0.2) !important;
        }

        .naay-cart__item-remove svg {
          width: 12px !important;
          height: 12px !important;
        }

        .naay-cart__item-details {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
        }

        .naay-cart__item-quantity {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .naay-cart__quantity-btn {
          background: var(--naay-delicate) !important;
          border: none !important;
          border-radius: 6px !important;
          width: 24px !important;
          height: 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          color: var(--naay-perfect) !important;
          transition: all 0.2s var(--naay-transition) !important;
        }

        .naay-cart__quantity-btn:hover {
          background: var(--naay-perfect) !important;
          color: var(--naay-white) !important;
          transform: scale(1.1) !important;
        }

        .naay-cart__quantity-value {
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          min-width: 20px !important;
          text-align: center !important;
          color: var(--naay-black) !important;
        }

        .naay-cart__item-price {
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          color: var(--naay-perfect) !important;
        }

        .naay-cart__footer {
          background: var(--naay-white) !important;
          border-top: 1px solid rgba(212, 196, 184, 0.2) !important;
          padding: 20px 24px !important;
        }

        .naay-cart__total {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 16px !important;
          padding: 16px 0 !important;
          border-top: 1px solid rgba(212, 196, 184, 0.2) !important;
        }

        .naay-cart__total-label {
          font-size: 16px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          color: var(--naay-black) !important;
        }

        .naay-cart__total-amount {
          font-size: 18px !important;
          font-weight: var(--naay-font-weight-bold) !important;
          color: var(--naay-perfect) !important;
        }

        .naay-cart__checkout {
          width: 100% !important;
          background: linear-gradient(135deg, var(--naay-perfect) 0%, var(--naay-rich) 100%) !important;
          color: var(--naay-white) !important;
          border: none !important;
          border-radius: 12px !important;
          padding: 16px 20px !important;
          font-size: 15px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          cursor: pointer !important;
          transition: none !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          box-shadow: 0 4px 16px rgba(168, 130, 107, 0.3) !important;
        }

        .naay-cart__checkout:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(168, 130, 107, 0.4) !important;
        }

        .naay-cart__checkout svg {
          width: 16px !important;
          height: 16px !important;
        }

        /* ======= PRODUCT RECOMMENDATION WIDGET STYLES ======= */

        .naay-product-card {
          background: var(--naay-white) !important;
          border-radius: 12px !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          overflow: hidden !important;
          box-shadow: 0 2px 8px rgba(168, 130, 107, 0.08) !important;
          transition: none !important;
          margin: 8px 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          position: relative !important;
          display: flex !important;
          flex-direction: row !important;
          min-height: 90px !important;
        }

        /* Hover effects removed */

        .naay-product-card__header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
          margin-bottom: 4px !important;
          position: relative !important;
        }

        .naay-product-card__vendor {
          background: rgba(248, 249, 248, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          color: var(--naay-perfect) !important;
          font-size: 12px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          padding: 4px 8px !important;
          border-radius: 6px !important;
          border: 1px solid rgba(212, 196, 184, 0.3) !important;
        }

        .naay-product-card__discount {
          background: linear-gradient(135deg, #dc2626, #ef4444) !important;
          color: var(--naay-white) !important;
          font-size: 12px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          padding: 4px 8px !important;
          border-radius: 6px !important;
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3) !important;
        }

        .naay-product-card__media {
          position: relative !important;
          width: 80px !important;
          height: 80px !important;
          flex-shrink: 0 !important;
          overflow: hidden !important;
          background: var(--naay-sage) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 10px !important;
          align-self: center !important;
        }

        .naay-product-card__image {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          transition: none !important;
          border-radius: 10px !important;
        }

        /* Image hover effect removed */

        .naay-product-card__placeholder {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 64px !important;
          height: 64px !important;
          color: var(--naay-perfect) !important;
          opacity: 0.5 !important;
        }

        .naay-product-card__placeholder svg {
          width: 100% !important;
          height: 100% !important;
        }

        .naay-product-card__overlay {
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
          transition: opacity 0.3s var(--naay-transition) !important;
        }

        /* Overlay hover effect removed */

        .naay-product-card__quick-view {
          background: rgba(248, 249, 248, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          border: none !important;
          border-radius: 50% !important;
          width: 48px !important;
          height: 48px !important;
          color: var(--naay-perfect) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--naay-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        /* Quick view hover effect removed */

        .naay-product-card__quick-view svg {
          width: 20px !important;
          height: 20px !important;
        }

        .naay-product-card__content {
          padding: 12px !important;
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
        }

        .naay-product-card__title {
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          line-height: 1.3 !important;
          margin: 0 0 4px 0 !important;
          color: var(--naay-black) !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
        }

        .naay-product-card__description {
          font-size: 12px !important;
          line-height: 1.4 !important;
          color: var(--naay-perfect) !important;
          margin: 0 0 8px 0 !important;
          opacity: 0.8 !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
        }

        .naay-product-card__price-section {
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
          margin-bottom: 16px !important;
        }

        .naay-product-card__pricing {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .naay-product-card__price {
          font-size: 18px !important;
          font-weight: var(--naay-font-weight-bold) !important;
          color: var(--naay-perfect) !important;
        }

        .naay-product-card__compare-price {
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          color: var(--naay-perfect) !important;
          opacity: 0.6 !important;
          text-decoration: line-through !important;
        }

        .naay-product-card__tags {
          display: flex !important;
          gap: 6px !important;
          flex-wrap: wrap !important;
        }

        .naay-product-card__tag {
          background: var(--naay-delicate) !important;
          color: var(--naay-perfect) !important;
          font-size: 11px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        }

        .naay-product-card__actions {
          display: flex !important;
          gap: 6px !important;
          margin-top: 8px !important;
        }

        .naay-product-card__add-btn {
          flex: 1 !important;
          background: linear-gradient(135deg, var(--naay-perfect) 0%, var(--naay-rich) 100%) !important;
          color: var(--naay-white) !important;
          border: none !important;
          border-radius: 4px !important;
          padding: 6px 10px !important;
          font-size: 11px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          cursor: pointer !important;
          transition: none !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          box-shadow: 0 2px 8px rgba(168, 130, 107, 0.3) !important;
        }

        /* Add button hover effect removed */

        .naay-product-card__add-btn--disabled {
          background: rgba(168, 130, 107, 0.3) !important;
          cursor: not-allowed !important;
          transform: none !important;
          box-shadow: none !important;
        }

        .naay-product-card__add-btn--success {
          background: linear-gradient(135deg, #10b981, #059669) !important;
        }

        .naay-product-card__add-btn svg {
          width: 10px !important;
          height: 10px !important;
        }

        .naay-spinner {
          animation: naaySpinner 1s linear infinite !important;
        }

        @keyframes naaySpinner {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .naay-product-card__details-btn {
          background: rgba(168, 130, 107, 0.1) !important;
          color: var(--naay-perfect) !important;
          border: 1px solid rgba(168, 130, 107, 0.3) !important;
          border-radius: 4px !important;
          padding: 6px 10px !important;
          font-size: 11px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--naay-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 4px !important;
          min-width: 60px !important;
        }

        /* Details button hover effect removed */

        .naay-product-card__details-btn svg {
          width: 10px !important;
          height: 10px !important;
        }

        /* ======= PRODUCT MODAL STYLES ======= */

        .naay-product-modal {
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

        .naay-product-modal--visible {
          opacity: 1 !important;
          visibility: visible !important;
        }

        .naay-product-modal__backdrop {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background: rgba(26, 26, 26, 0.8) !important;
          backdrop-filter: blur(4px) !important;
        }

        .naay-product-modal__content {
          position: relative !important;
          background: var(--naay-white) !important;
          border-radius: 20px !important;
          max-width: 500px !important;
          width: 90vw !important;
          max-height: 80vh !important;
          overflow: hidden !important;
          box-shadow: 0 20px 40px rgba(168, 130, 107, 0.2) !important;
        }

        .naay-product-modal__header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 20px 24px !important;
          border-bottom: 1px solid rgba(212, 196, 184, 0.2) !important;
          background: var(--naay-sage) !important;
        }

        .naay-product-modal__header h2 {
          font-size: 18px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          margin: 0 !important;
          color: var(--naay-black) !important;
        }

        .naay-product-modal__close {
          background: none !important;
          border: none !important;
          cursor: pointer !important;
          padding: 8px !important;
          border-radius: 8px !important;
          transition: background 0.2s var(--naay-transition) !important;
          color: var(--naay-perfect) !important;
        }

        .naay-product-modal__close:hover {
          background: rgba(168, 130, 107, 0.1) !important;
        }

        .naay-product-modal__close svg {
          width: 20px !important;
          height: 20px !important;
        }

        .naay-product-modal__body {
          padding: 24px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 20px !important;
        }

        .naay-product-modal__body img {
          width: 100% !important;
          height: 200px !important;
          object-fit: cover !important;
          border-radius: 12px !important;
        }

        .naay-product-modal__info {
          display: flex !important;
          flex-direction: column !important;
          gap: 16px !important;
        }

        .naay-product-modal__description {
          font-size: 14px !important;
          line-height: 1.6 !important;
          color: var(--naay-perfect) !important;
          margin: 0 !important;
        }

        .naay-product-modal__price {
          font-size: 24px !important;
          font-weight: var(--naay-font-weight-bold) !important;
          color: var(--naay-perfect) !important;
        }

        .naay-product-modal__add-btn {
          background: linear-gradient(135deg, var(--naay-perfect) 0%, var(--naay-rich) 100%) !important;
          color: var(--naay-white) !important;
          border: none !important;
          border-radius: 12px !important;
          padding: 16px 24px !important;
          font-size: 16px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          cursor: pointer !important;
          transition: none !important;
          box-shadow: 0 4px 16px rgba(168, 130, 107, 0.3) !important;
        }

        .naay-product-modal__add-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(168, 130, 107, 0.4) !important;
        }

        /* Simple Header */
        .naay-widget__simple-header {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          height: 52px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 12px !important;
          z-index: 10 !important;
        }

        .naay-widget__cart-button {
          position: relative !important;
          background: rgba(255, 255, 255, 0.9) !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          border-radius: 8px !important;
          padding: 8px !important;
          color: var(--naay-perfect) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--naay-transition) !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        }

        .naay-widget__cart-button:hover {
          background: var(--naay-white) !important;
          transform: scale(1.05) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }

        .naay-widget__cart-button svg {
          width: 16px !important;
          height: 16px !important;
        }

        .naay-widget__cart-count {
          position: absolute !important;
          top: -4px !important;
          right: -4px !important;
          background: var(--naay-perfect) !important;
          color: var(--naay-white) !important;
          border-radius: 50% !important;
          font-size: 10px !important;
          font-weight: var(--naay-font-weight-bold) !important;
          min-width: 16px !important;
          height: 16px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          line-height: 1 !important;
        }

        .naay-widget__close {
          background: rgba(255, 255, 255, 0.9) !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          color: var(--naay-perfect) !important;
          cursor: pointer !important;
          padding: 8px !important;
          border-radius: 8px !important;
          transition: all 0.2s var(--naay-transition) !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        }

        .naay-widget__close:hover {
          background: var(--naay-white) !important;
          transform: scale(1.05) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }

        .naay-widget__close svg {
          width: 16px !important;
          height: 16px !important;
        }

        /* Luxury Messages Area */
        .naay-widget__messages {
          flex: 1 !important;
          padding: 64px 32px 32px 32px !important;
          overflow-y: auto !important;
          background: transparent !important;
          scrollbar-width: thin !important;
          scrollbar-color: var(--naay-delicate) transparent !important;
          position: relative !important;
        }

        /* Cart Toggle Button in Conversation */
        .naay-widget__cart-toggle-btn {
          position: relative !important;
          background: rgba(255, 255, 255, 0.95) !important;
          border: 1px solid rgba(212, 196, 184, 0.3) !important;
          border-radius: 8px !important;
          padding: 6px !important;
          cursor: pointer !important;
          transition: none !important;
          box-shadow: 0 2px 8px rgba(168, 130, 107, 0.1) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 28px !important;
          height: 28px !important;
        }

        .naay-widget__cart-toggle-btn:hover {
          background: var(--naay-white) !important;
          border-color: var(--naay-perfect) !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 16px rgba(168, 130, 107, 0.2) !important;
        }

        /* Back Button in Conversation */
        .naay-widget__back-btn {
          position: relative !important;
          background: rgba(255, 255, 255, 0.95) !important;
          border: 1px solid rgba(212, 196, 184, 0.3) !important;
          border-radius: 8px !important;
          padding: 6px !important;
          cursor: pointer !important;
          transition: none !important;
          box-shadow: 0 2px 8px rgba(168, 130, 107, 0.1) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 28px !important;
          height: 28px !important;
        }

        .naay-widget__back-btn:hover {
          background: var(--naay-white) !important;
          border-color: var(--naay-perfect) !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 16px rgba(168, 130, 107, 0.2) !important;
        }

        .naay-widget__back-btn svg {
          width: 14px !important;
          height: 14px !important;
          color: var(--naay-perfect) !important;
        }

        .naay-cart-toggle-icon {
          width: 16px !important;
          height: 16px !important;
          color: var(--naay-perfect) !important;
        }

        .naay-cart-toggle-count {
          position: absolute !important;
          top: -4px !important;
          right: -4px !important;
          background: var(--naay-perfect) !important;
          color: var(--naay-white) !important;
          border-radius: 50% !important;
          font-size: 8px !important;
          font-weight: var(--naay-font-weight-bold) !important;
          width: 14px !important;
          height: 14px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          line-height: 1 !important;
          border: 1px solid var(--naay-white) !important;
        }

        .naay-cart-toggle-count:empty {
          display: none !important;
        }

        .naay-widget__messages::-webkit-scrollbar {
          width: 6px !important;
        }

        .naay-widget__messages::-webkit-scrollbar-track {
          background: transparent !important;
        }

        .naay-widget__messages::-webkit-scrollbar-thumb {
          background: var(--naay-delicate) !important;
          border-radius: 3px !important;
        }

        .naay-widget__welcome {
          text-align: center !important;
        }

        .naay-widget__welcome-header {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-bottom: 24px !important;
        }

        .naay-widget__welcome-avatar {
          width: 56px !important;
          height: 56px !important;
          background: var(--naay-hydra) !important;
          border-radius: 12px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .naay-welcome-icon {
          width: 28px !important;
          height: 28px !important;
          color: var(--naay-white) !important;
        }

        .naay-widget__welcome-title {
          font-size: 20px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          color: var(--naay-perfect) !important;
          margin: 0 !important;
          letter-spacing: -0.02em !important;
        }

        .naay-widget__welcome-message {
          color: var(--naay-black) !important;
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-regular) !important;
          line-height: 1.5 !important;
          margin: 0 0 24px 0 !important;
          opacity: 0.8 !important;
        }

        .naay-widget__welcome-features {
          display: flex !important;
          flex-direction: column !important;
          gap: 20px !important;
          text-align: left !important;
        }

        .naay-widget__feature {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 16px !important;
          background: #ffffff !important;
          border-radius: 6px !important;
          border: 1px solid #e5e5e5 !important;
          transition: none !important;
          cursor: pointer !important;
        }

        .naay-widget__feature:hover {
          background: #f9f9f9 !important;
          border-color: #d0d0d0 !important;
        }

        .naay-feature-icon {
          width: 20px !important;
          height: 20px !important;
          color: #8B5A3C !important;
          flex-shrink: 0 !important;
        }

        .naay-widget__feature span {
          color: #333333 !important;
          font-size: 13px !important;
          font-weight: 400 !important;
          line-height: 1.3 !important;
        }

        /* Ultra-Modern Input Area */
        .naay-widget__input-area {
          padding: 24px 32px !important;
          background: rgba(255, 255, 255, 0.8) !important;
          backdrop-filter: blur(10px) !important;
          border-top: 1px solid rgba(212, 196, 184, 0.2) !important;
        }

        .naay-widget__input-container {
          display: flex !important;
          gap: 12px !important;
          margin-bottom: 12px !important;
          padding: 0 20px !important;
          width: 100% !important;
        }

        .naay-widget__input-wrapper {
          flex: 1 !important;
          display: flex !important;
          width: 100% !important;
        }

        .naay-widget__input {
          flex: 1 !important;
          width: 100% !important;
          min-width: 0 !important;
          padding: 10px 14px !important;
          border: 1px solid rgba(212, 196, 184, 0.3) !important;
          border-radius: 28px !important;
          font-family: var(--naay-font) !important;
          font-size: 13px !important;
          font-weight: var(--naay-font-weight-regular) !important;
          background: var(--naay-white) !important;
          color: var(--naay-black) !important;
          outline: none !important;
          transition: none !important;
          box-sizing: border-box !important;
        }

        .naay-widget__input:focus {
          border-color: var(--naay-perfect) !important;
          box-shadow: 0 0 0 3px rgba(168, 130, 107, 0.1) !important;
          transform: translateY(-1px) !important;
        }

        .naay-widget__input::placeholder {
          color: var(--naay-delicate) !important;
        }

        .naay-widget__send {
          width: 44px !important;
          height: 44px !important;
          background: var(--naay-perfect) !important;
          color: var(--naay-white) !important;
          border: none !important;
          border-radius: 12px !important;
          cursor: pointer !important;
          transition: none !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .naay-widget__send:hover {
          transform: translateY(-2px) scale(1.05) !important;
          box-shadow: var(--naay-shadow-medium) !important;
          background: var(--naay-rich) !important;
        }

        .naay-widget__send:disabled {
          opacity: 0.6 !important;
          cursor: not-allowed !important;
          transform: none !important;
        }

        .naay-widget__send svg {
          width: 20px !important;
          height: 20px !important;
        }

        /* Reset Button */
        .naay-widget__reset {
          width: 36px !important;
          height: 36px !important;
          background: rgba(212, 196, 184, 0.1) !important;
          color: var(--naay-forever) !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          transition: none !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
        }

        .naay-widget__reset:hover {
          background: rgba(212, 196, 184, 0.2) !important;
          transform: translateY(-1px) !important;
          border-color: rgba(212, 196, 184, 0.4) !important;
        }

        .naay-widget__reset svg {
          width: 16px !important;
          height: 16px !important;
        }

        .naay-widget__powered {
          text-align: center !important;
          font-size: 12px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          color: var(--naay-forever) !important;
          opacity: 0.7 !important;
        }

        /* Message Styles */
        .naay-widget__message {
          margin: 12px 0 !important;
          padding: 12px 16px !important;
          border-radius: 8px !important;
          font-size: 13px !important;
          line-height: 1.4 !important;
          max-width: 85% !important;
        }

        .naay-widget__message--user {
          background: var(--naay-perfect) !important;
          color: var(--naay-white) !important;
          margin-left: auto !important;
          border-bottom-right-radius: 6px !important;
        }

        .naay-widget__message--assistant {
          background: rgba(255, 255, 255, 0.9) !important;
          color: var(--naay-black) !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          border-bottom-left-radius: 6px !important;
        }

        .naay-widget__message .list-item {
          margin: 8px 0 !important;
          padding-left: 8px !important;
        }

        .naay-widget__message .bullet-item {
          margin: 6px 0 !important;
          padding-left: 8px !important;
        }

        .naay-widget__message strong {
          font-weight: 600 !important;
          color: var(--naay-perfect) !important;
        }

        /* Typing Indicator */
        .naay-widget__typing {
          max-width: 75% !important;
        }

        .naay-typing-indicator {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          color: var(--naay-forever) !important;
          font-size: 13px !important;
          font-style: italic !important;
        }

        .naay-typing-dots {
          display: flex !important;
          gap: 4px !important;
          align-items: center !important;
        }

        .naay-dot {
          width: 6px !important;
          height: 6px !important;
          background: var(--naay-forever) !important;
          border-radius: 50% !important;
          animation: naay-typing-bounce 1.4s infinite ease-in-out both !important;
        }

        .naay-dot:nth-child(1) { animation-delay: -0.32s !important; }
        .naay-dot:nth-child(2) { animation-delay: -0.16s !important; }

        @keyframes naay-typing-bounce {
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
          .naay-widget__chat {
            width: 60vw !important;
          }
        }

        @media (max-width: 768px) {
          .naay-widget__chat {
            width: calc(100vw - 24px) !important;
            height: calc(100vh - 120px) !important;
            left: 12px !important;
            bottom: 100px !important;
          }
          
          .naay-widget__promotional-message {
            right: 12px !important;
            bottom: 100px !important;
            max-width: calc(100vw - 100px) !important;
            width: calc(100vw - 100px) !important;
          }
        }

        @media (max-width: 480px) {
          .naay-widget__chat {
            width: calc(100vw - 16px) !important;
            height: calc(100vh - 100px) !important;
            left: 8px !important;
            bottom: 88px !important;
            border-radius: 8px !important;
          }
          
          .naay-widget__promotional-message {
            right: 8px !important;
            bottom: 88px !important;
            max-width: calc(100vw - 88px) !important;
            width: calc(100vw - 88px) !important;
            padding: 16px 20px !important;
          }

          .naay-widget__button {
            width: 60px !important;
            height: 60px !important;
          }

          .naay-widget__feature {
            padding: 16px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }

          .naay-widget__feature span {
            font-size: 13px !important;
            line-height: 1.3 !important;
          }

          .naay-widget__welcome-title {
            font-size: 18px !important;
          }

          .naay-widget__welcome-message {
            font-size: 14px !important;
          }

          .naay-widget__input {
            font-size: 16px !important;
          }

          .naay-widget__input-container {
            padding: 16px !important;
            width: 100% !important;
          }

          .naay-widget__input-wrapper {
            flex: 1 !important;
            width: 100% !important;
          }
        }

        @media (max-width: 360px) {
          .naay-widget__chat {
            width: calc(100vw - 12px) !important;
            left: 6px !important;
            bottom: 82px !important;
          }
          
          .naay-widget__promotional-message {
            right: 6px !important;
            bottom: 82px !important;
            max-width: calc(100vw - 82px) !important;
            width: calc(100vw - 82px) !important;
            padding: 12px 16px !important;
          }

          .naay-widget__button {
            width: 56px !important;
            height: 56px !important;
          }

          .naay-widget__feature {
            padding: 12px !important;
          }

          .naay-widget__promotional-text {
            font-size: 13px !important;
          }

          .naay-widget__promotional-subtitle {
            font-size: 11px !important;
          }

          .naay-widget__welcome-title {
            font-size: 16px !important;
          }
        }

        /* Accessibility & Motion */
        @media (prefers-reduced-motion: reduce) {
          .naay-widget * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (prefers-color-scheme: dark) {
          .naay-widget__chat {
            background: rgba(26, 26, 26, 0.95) !important;
            border-color: rgba(212, 196, 184, 0.1) !important;
          }
          
          .naay-widget__welcome-message {
            color: var(--naay-sage) !important;
          }
          
          .naay-widget__feature {
            background: rgba(255, 255, 255, 0.05) !important;
            border-color: rgba(212, 196, 184, 0.1) !important;
          }
        }

        /* ===== NEW LAYOUT STYLES ===== */
        
        /* Main Widget Layout Container */
        .naay-widget-layout {
          display: flex !important;
          align-items: end !important;
          gap: 0 !important;
          position: relative !important;
        }

        /* Cart Toggle Button - Vertical Left */
        .naay-cart-toggle {
          width: 60px !important;
          height: 620px !important;
          background: rgba(248, 249, 248, 0.95) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          border-radius: 12px 0 0 12px !important;
          color: var(--naay-perfect) !important;
          cursor: pointer !important;
          transition: all var(--naay-duration) var(--naay-transition) !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          box-shadow: var(--naay-shadow-strong) !important;
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
        .naay-widget--open .naay-cart-toggle {
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
        }

        .naay-cart-toggle:hover {
          transform: translateX(-2px) !important;
          box-shadow: 0 12px 28px rgba(139, 93, 75, 0.35), 0 4px 12px rgba(139, 93, 75, 0.2) !important;
          background: rgba(255, 255, 255, 0.98) !important;
        }

        .naay-cart-toggle::before {
          content: '' !important;
          position: absolute !important;
          inset: 0 !important;
          border-radius: inherit !important;
          background: var(--naay-perfect) !important;
          opacity: 0.1 !important;
          animation: naayPulse 3s infinite !important;
          z-index: -1 !important;
        }

        .naay-cart-panel--open ~ .naay-cart-toggle::before {
          animation: none !important;
        }

        .naay-cart-toggle__icon {
          width: 24px !important;
          height: 24px !important;
          stroke-width: 2 !important;
        }

        .naay-cart-toggle__badge {
          position: absolute !important;
          top: 20px !important;
          right: -6px !important;
          background: var(--naay-perfect) !important;
          color: var(--naay-white) !important;
          border-radius: 50% !important;
          width: 20px !important;
          height: 20px !important;
          font-size: 10px !important;
          font-weight: bold !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 2px solid var(--naay-white) !important;
          box-shadow: var(--naay-shadow-medium) !important;
          transition: all 0.2s var(--naay-transition) !important;
        }

        /* Cart Panel - Left extension of the chat widget */
        .naay-cart-panel {
          position: absolute !important;
          bottom: 0px !important;
          right: 400px !important; /* Align with chat widget edge */
          width: 360px !important;
          height: 100% !important; /* Same height as chat */
          background: rgba(248, 249, 248, 0.98) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border-radius: 16px 0 0 16px !important; /* Rounded only on left side */
          border: 1px solid rgba(212, 196, 184, 0.3) !important;
          border-right: none !important; /* No right border to connect with chat */
          box-shadow: -4px 0 16px rgba(139, 93, 75, 0.1) !important; /* Shadow only on left */
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          opacity: 0 !important;
          visibility: hidden !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          pointer-events: none !important;
          z-index: 999997 !important;
          transform: translateX(-20px) scale(0.98) !important;
        }

        .naay-cart-panel--open {
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          transform: translateX(0) scale(1) !important;
        }

        /* Cart panel positioning for bottom-left widget */
        .naay-widget--bottom-left .naay-cart-panel {
          right: auto !important;
          left: 400px !important; /* Position to right of chat for left-positioned widget */
          border-radius: 0 16px 16px 0 !important; /* Rounded only on right side */
          border-right: 1px solid rgba(212, 196, 184, 0.3) !important;
          border-left: none !important; /* No left border to connect with chat */
          box-shadow: 4px 0 16px rgba(139, 93, 75, 0.1) !important; /* Shadow only on right */
          transform: translateX(20px) scale(0.98) !important;
        }

        .naay-widget--bottom-left .naay-cart-panel--open {
          transform: translateX(0) scale(1) !important;
        }

        /* Connect chat widget with cart when cart is open */
        .naay-cart-panel--open + .naay-widget__chat {
          border-radius: 16px 0 0 16px !important; /* Remove right border radius */
        }
        
        .naay-widget--bottom-left .naay-cart-panel--open + .naay-widget__chat {
          border-radius: 0 16px 16px 0 !important; /* Remove left border radius */
        }

        /* Cart Panel Header */
        .naay-cart-panel__header {
          padding: 16px 20px !important;
          background: transparent !important;
          color: var(--naay-black) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          border: none !important;
          border-bottom: 1px solid rgba(212, 196, 184, 0.2) !important;
          flex-shrink: 0 !important;
        }

        .naay-cart-panel__title {
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          margin: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .naay-cart-panel__icon {
          width: 16px !important;
          height: 16px !important;
          color: var(--naay-perfect) !important;
        }

        .naay-cart-panel__close {
          background: rgba(139, 93, 75, 0.1) !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px !important;
          color: var(--naay-perfect) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--naay-transition) !important;
        }

        .naay-cart-panel__close:hover {
          background: rgba(139, 93, 75, 0.15) !important;
          transform: scale(1.05) !important;
        }

        .naay-cart-panel__close svg {
          width: 16px !important;
          height: 16px !important;
        }

        /* Cart Panel Content */
        .naay-cart-panel__content {
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
        
        .naay-cart-panel__content::-webkit-scrollbar {
          display: none !important;
        }

        /* Empty State */
        .naay-cart-panel__empty {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          height: 200px !important;
          padding: 40px 24px !important;
          text-align: center !important;
          margin-top: 20px !important;
        }

        .naay-cart-panel__empty-icon {
          width: 48px !important;
          height: 48px !important;
          color: var(--naay-perfect) !important;
          opacity: 0.6 !important;
          margin-bottom: 16px !important;
        }

        .naay-cart-panel__empty-text {
          font-size: 16px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          color: var(--naay-text-primary) !important;
          margin-bottom: 8px !important;
        }

        .naay-cart-panel__empty-subtitle {
          font-size: 14px !important;
          color: var(--naay-text-secondary) !important;
        }

        /* FORCE HIDE empty state when there are items */
        .naay-cart-panel__items--visible ~ .naay-cart-panel__empty,
        .naay-cart-panel__empty[style*="display: none"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
        }

        /* Items Container */
        .naay-cart-panel__items {
          padding: 20px 24px 0 24px !important;
          flex: 1 !important;
          overflow-y: auto !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 16px !important;
        }

        .naay-cart-panel__items--visible {
          animation: naay-fade-in 0.3s ease-in-out !important;
        }

        @keyframes naay-fade-in {
          from {
            opacity: 0 !important;
            transform: translateY(10px) !important;
          }
          to {
            opacity: 1 !important;
            transform: translateY(0) !important;
          }
        }

        /* Cart Item */
        .naay-cart-panel__item {
          display: flex !important;
          gap: 16px !important;
          padding: 16px !important;
          background: var(--naay-white) !important;
          border-radius: 12px !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          box-shadow: 0 2px 8px rgba(168, 130, 107, 0.08) !important;
          transition: all 0.2s var(--naay-transition) !important;
        }

        .naay-cart-panel__item:hover {
          box-shadow: 0 4px 12px rgba(168, 130, 107, 0.12) !important;
          transform: translateY(-1px) !important;
        }

        /* Item Image */
        .naay-cart-panel__item-image-container {
          flex-shrink: 0 !important;
          width: 80px !important;
          height: 80px !important;
        }

        .naay-cart-panel__item-image {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 8px !important;
          background: var(--naay-surface) !important;
        }

        .naay-cart-panel__item-image--placeholder {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: rgba(212, 196, 184, 0.1) !important;
          color: rgba(168, 130, 107, 0.5) !important;
        }

        .naay-cart-panel__item-image--placeholder svg {
          width: 32px !important;
          height: 32px !important;
        }

        /* Item Details */
        .naay-cart-panel__item-details {
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
        }

        .naay-cart-panel__item-info {
          margin-bottom: 12px !important;
        }

        .naay-cart-panel__item-title {
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          color: var(--naay-text-primary) !important;
          margin: 0 0 4px 0 !important;
          line-height: 1.3 !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
        }

        .naay-cart-panel__item-variant {
          font-size: 12px !important;
          color: var(--naay-text-secondary) !important;
          margin: 0 0 8px 0 !important;
          opacity: 0.8 !important;
        }

        .naay-cart-panel__item-price-info {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .naay-cart-panel__item-unit-price {
          font-size: 12px !important;
          color: var(--naay-text-secondary) !important;
        }

        .naay-cart-panel__item-total-price {
          font-size: 16px !important;
          font-weight: var(--naay-font-weight-bold) !important;
          color: var(--naay-perfect) !important;
        }

        /* Item Controls */
        .naay-cart-panel__item-controls {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px !important;
        }

        .naay-cart-panel__item-quantity {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          background: rgba(212, 196, 184, 0.1) !important;
          border-radius: 8px !important;
          padding: 4px !important;
        }

        .naay-cart-panel__quantity-btn {
          width: 28px !important;
          height: 28px !important;
          border-radius: 6px !important;
          border: none !important;
          background: var(--naay-perfect) !important;
          color: var(--naay-white) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--naay-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .naay-cart-panel__quantity-btn:hover {
          background: var(--naay-rich) !important;
          transform: scale(1.1) !important;
        }

        .naay-cart-panel__quantity-btn svg {
          width: 14px !important;
          height: 14px !important;
        }

        .naay-cart-panel__quantity-value {
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          color: var(--naay-text-primary) !important;
          min-width: 20px !important;
          text-align: center !important;
        }

        .naay-cart-panel__item-remove {
          background: rgba(220, 53, 69, 0.1) !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 6px !important;
          color: #dc3545 !important;
          cursor: pointer !important;
          transition: all 0.2s var(--naay-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .naay-cart-panel__item-remove:hover {
          background: rgba(220, 53, 69, 0.2) !important;
          transform: scale(1.1) !important;
        }

        .naay-cart-panel__item-remove svg {
          width: 14px !important;
          height: 14px !important;
        }

        /* Cart Panel Footer */
        .naay-cart-panel__footer {
          padding: 16px 20px !important;
          background: rgba(248, 249, 248, 0.98) !important;
          border-top: 1px solid rgba(212, 196, 184, 0.2) !important;
          backdrop-filter: blur(10px) !important;
          -webkit-backdrop-filter: blur(10px) !important;
          position: sticky !important;
          bottom: 0 !important;
          z-index: 10 !important;
          flex-shrink: 0 !important;
        }

        .naay-cart-panel__total {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 16px !important;
          padding: 16px 0 !important;
          border-top: 1px solid rgba(212, 196, 184, 0.2) !important;
        }

        .naay-cart-panel__total-label {
          font-size: 16px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          color: var(--naay-text-primary) !important;
        }

        .naay-cart-panel__total-price {
          font-size: 20px !important;
          font-weight: var(--naay-font-weight-bold) !important;
          color: var(--naay-perfect) !important;
        }

        /* Checkout Button - Black Background */
        .naay-cart-panel__checkout {
          width: 100% !important;
          background: #000000 !important;
          color: var(--naay-white) !important;
          border: none !important;
          border-radius: 12px !important;
          padding: 16px 24px !important;
          font-size: 16px !important;
          font-weight: var(--naay-font-weight-bold) !important;
          cursor: pointer !important;
          transition: none !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        }

        .naay-cart-panel__checkout:hover {
          background: #333333 !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
        }

        .naay-cart-panel__checkout svg {
          width: 16px !important;
          height: 16px !important;
        }

        /* Chat Container positioning */
        .naay-chat-container {
          position: relative !important;
          order: 2 !important;
          margin-left: 0 !important;
        }

        /* Responsive Design for larger tablets */
        @media (max-width: 1024px) {
          .naay-cart-panel {
            right: 380px !important; /* Closer to chat on smaller screens */
            width: 350px !important;
            height: 520px !important;
          }
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .naay-widget {
            bottom: 10px !important;
            right: 10px !important;
          }
          
          .naay-cart-panel {
            width: calc(100vw - 40px) !important;
            max-width: 360px !important;
            right: auto !important;
            left: 20px !important;
            bottom: 80px !important;
            height: 450px !important;
            transform: translateY(20px) scale(0.95) !important;
          }
          
          .naay-cart-toggle {
            width: 50px !important;
            height: 400px !important;
            left: -50px !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
          
          .naay-cart-panel--open {
            transform: translateY(0) scale(1) !important;
          }
          
          .naay-widget--open .naay-cart-toggle {
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
          }
        }

        @media (max-width: 480px) {
          .naay-widget {
            bottom: 5px !important;
            right: 5px !important;
          }
          
          .naay-cart-panel {
            width: 95vw !important;
            max-width: none !important;
            height: 350px !important;
            left: -95vw !important;
          }
          
          .naay-cart-toggle {
            width: 45px !important;
            height: 350px !important;
            left: -45px !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
          
          .naay-cart-panel--open {
            left: -440px !important;
          }
          
          .naay-widget--open .naay-cart-toggle {
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
          }
          
          .naay-cart-toggle__icon {
            width: 18px !important;
            height: 18px !important;
          }

          /* Mobile Cart Items */
          .naay-cart-panel__items {
            padding: 16px 12px 0 12px !important;
            gap: 12px !important;
          }

          .naay-cart-panel__item {
            padding: 12px !important;
            gap: 12px !important;
          }

          .naay-cart-panel__item-image-container {
            width: 60px !important;
            height: 60px !important;
          }

          .naay-cart-panel__item-title {
            font-size: 13px !important;
          }

          .naay-cart-panel__item-variant {
            font-size: 11px !important;
          }

          .naay-cart-panel__item-total-price {
            font-size: 14px !important;
          }

          .naay-cart-panel__quantity-btn {
            width: 24px !important;
            height: 24px !important;
          }
        }
      `;

      document.head.appendChild(style);
    }

    addEventListeners() {
      console.log('✨ Adding luxury event listeners...');
      
      // Prevent duplicate event listeners
      if (this.eventListenersAdded) {
        console.log('⚠️ Event listeners already added, skipping...');
        return;
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
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
          }
        });
      }

      // Send button click
      if (this.sendButton) {
        this.sendButton.addEventListener('click', (e) => {
          e.preventDefault();
          this.sendMessage();
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
      const featureCards = this.container.querySelectorAll('.naay-widget__feature[data-message]');
      featureCards.forEach(card => {
        card.addEventListener('click', (e) => {
          e.preventDefault();
          const message = card.getAttribute('data-message');
          if (message && this.input) {
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
      window.testProductRecommendations = function() {
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
                "price": 25.00,
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
      window.testMixedResponse = function() {
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
      window.testRealCartAdd = function() {
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
          classList: { add: function() {}, remove: function() {} }
        });
        
        return 'Real cart test initiated! Check console for details.';
      }.bind(this);
      
      console.log('🧪 Test function available: window.testRealCartAdd()');
      
      // Test function for duplicate prevention
      window.testDuplicatePrevention = function() {
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
            vendor: "Naay"
          },
          {
            id: 14890558325102,
            title: "Super Hero | Bálsam Multiusos | Árnica",
            price: 23.33,
            image: { src: "https://example.com/image1.jpg" },
            variant_id: 53019925709166,
            handle: "super-hero-balsam-multiusos-arnica",
            vendor: "Naay"
          },
          {
            id: 99999999999999,
            title: "Loving Touch | Aceite de Masaje | My Little One",
            price: 4.44,
            image: { src: "https://example.com/image2.jpg" },
            variant_id: 88888888888888,
            handle: "loving-touch-aceite-masaje",
            vendor: "Naay"
          }
        ];
        
        console.log('🔍 Adding products with duplicates:', duplicateProducts);
        widget.addProductRecommendations(duplicateProducts);
        
        return 'Duplicate prevention test completed! Check console for details.';
      }.bind(this);
      
      console.log('🧪 Test function available: window.testDuplicatePrevention()');
      
      // Test function for cart functionality
      window.testCartFunctionality = function() {
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
      window.testCartButtons = function() {
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
      window.debugCartPanel = function() {
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
      window.forceShowCart = function() {
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
        widget.cartPanel.classList.add('naay-cart-panel--open');
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
      this.container.classList.remove('naay-widget--closed', 'naay-widget--closing');
      this.container.classList.add('naay-widget--open');
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
      this.container.classList.add('naay-widget--closing');
      this.container.classList.remove('naay-widget--open');
      this.button.setAttribute('aria-expanded', 'false');
      
      // After animation completes, add closed class and remove closing
      setTimeout(() => {
        this.container.classList.remove('naay-widget--closing');
        this.container.classList.add('naay-widget--closed');
        console.log('✅ Classes after close:', this.container.className);
      }, 400); // Match transition duration
    }

    async sendMessage() {
      const text = this.input.value.trim();
      if (!text) return;

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
        const apiUrl = 'https://n8n.dustkey.com/webhook/chat-naay';
        const payload = {
          message: text,
          shop: this.config.shopDomain,
          conversationId: this.conversationId || null,
          context: this.config.context || {}
        };

        console.log('🌿 Naay Chat: Sending message to n8n webhook', {
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

        console.log('🌿 Naay Chat: API Response status:', response.status, response.statusText);

        const data = await response.json();
        console.log('🌿 Naay Chat: n8n Response data:', data);
        
        // Remove typing indicator
        this.removeTypingIndicator(typingIndicator);
        
        // n8n response handling - expect direct response format
        if (response.ok) {
          // Check for n8n workflow errors
          if (data && data.message === "Error in workflow") {
            console.error('❌ Naay Chat: n8n workflow error', data);
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
          
          console.log('✅ Naay Chat: Message processed successfully via n8n');
        } else {
          console.error('❌ Naay Chat: n8n API returned error', response.status, data);
          if (response.status === 500) {
            this.addMessage('🔧 El asistente de IA está siendo actualizado. Por favor intenta en unos minutos. ¡Gracias por tu paciencia!', 'assistant');
          } else {
            this.addMessage('Lo siento, hubo un error. Por favor intenta de nuevo.', 'assistant');
          }
        }
      } catch (error) {
        console.error('❌ Naay Chat: Network error sending message:', error);
        
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
        // Re-enable send button
        if (this.sendButton) {
          this.sendButton.disabled = false;
        }
      }
    }

    addMessage(text, sender) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `naay-widget__message naay-widget__message--${sender}`;
      
      // Format text with proper line breaks and structure
      const formattedText = this.formatMessage(text);
      messageDiv.innerHTML = formattedText;
      
      // Remove welcome message when first real message is added
      const welcome = this.messagesContainer.querySelector('.naay-widget__welcome');
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
      typingDiv.className = 'naay-widget__message naay-widget__message--assistant naay-widget__typing';
      typingDiv.innerHTML = `
        <div class="naay-typing-indicator">
          <span>Escribiendo</span>
          <div class="naay-typing-dots">
            <div class="naay-dot"></div>
            <div class="naay-dot"></div>
            <div class="naay-dot"></div>
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
      
      products.forEach(shopifyProduct => {
        // Transform Shopify product format to widget format
        const product = this.transformShopifyProduct(shopifyProduct);
        
        // Create unique identifier for the product
        const productKey = `${product.id}-${product.variantId}-${product.title}`.replace(/\s+/g, '_');
        
        // Only add if not already added in this session
        if (!this.addedProducts.has(productKey)) {
          this.addedProducts.add(productKey);
          this.addProductRecommendation(product);
          console.log(`✅ Added unique product: ${product.title} (${productKey})`);
        } else {
          console.log(`⚠️  Skipping duplicate product: ${product.title} (${productKey})`);
        }
      });
      
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
        price = shopifyProduct.price ? parseFloat(shopifyProduct.price).toFixed(2) : '0.00';
        variantId = shopifyProduct.variant_id || null;
      } else {
        // Full Shopify format
        const variant = shopifyProduct.variants && shopifyProduct.variants[0];
        price = variant ? parseFloat(variant.price).toFixed(2) : '0.00';
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
        vendor: shopifyProduct.vendor || 'Naay',
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
      productDiv.className = 'naay-widget__message naay-widget__message--assistant';
      
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
        price = '0.00',
        comparePrice = null,
        image = '',
        tags = [],
        available = true
      } = product;

      const hasDiscount = comparePrice && parseFloat(comparePrice) > parseFloat(price);
      const discountPercent = hasDiscount ? Math.round(((parseFloat(comparePrice) - parseFloat(price)) / parseFloat(comparePrice)) * 100) : 0;
      
      return `
        <div class="naay-product-card" data-product-id="${id}">
          ${hasDiscount ? `<div class="naay-product-card__header">
            <div class="naay-product-card__discount">-${discountPercent}%</div>
          </div>` : ''}
          
          <div class="naay-product-card__media">
            ${image ? 
              `<img class="naay-product-card__image" src="${image}" alt="${title}" loading="lazy">` : 
              `<div class="naay-product-card__placeholder">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M21 16V8C21 6.9 20.1 6 19 6H5C3.9 6 3 6.9 3 8V16C3 17.1 3.9 18 5 18H19C20.1 18 21 17.1 21 16ZM5 16L8.5 11.5L11 14.5L14.5 10L19 16H5Z" fill="currentColor"/>
                </svg>
              </div>`
            }
            <div class="naay-product-card__overlay">
              <button class="naay-product-card__quick-view" data-action="quick-view" title="Vista rápida">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M1 12S5 4 12 4S23 12 23 12S19 20 12 20S1 12 1 12Z" stroke="currentColor" stroke-width="2"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="naay-product-card__content">
            <h3 class="naay-product-card__title">${title}</h3>
            ${description ? `<p class="naay-product-card__description">${description}</p>` : ''}
            
            <div class="naay-product-card__price-section">
              <div class="naay-product-card__pricing">
                <span class="naay-product-card__price">$${price}</span>
                ${hasDiscount ? `<span class="naay-product-card__compare-price">$${comparePrice}</span>` : ''}
              </div>
              ${tags.length > 0 ? `
                <div class="naay-product-card__tags">
                  ${tags.slice(0, 2).map(tag => `<span class="naay-product-card__tag">${tag}</span>`).join('')}
                </div>
              ` : ''}
            </div>
            
            <div class="naay-product-card__actions">
              ${!available ? 
                `<button class="naay-product-card__add-btn naay-product-card__add-btn--disabled" disabled>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  Agotado
                </button>` :
                `<button class="naay-product-card__add-btn" data-action="add-to-cart" title="Agregar al carrito">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H14C13.4 20 13 19.6 13 19V13" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  Agregar al Carrito
                </button>`
              }
              <button class="naay-product-card__details-btn" data-action="view-details" title="Ver detalles">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Detalles
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

      // View details button
      const detailsButton = productElement.querySelector('[data-action="view-details"]');
      if (detailsButton) {
        detailsButton.addEventListener('click', (e) => {
          e.preventDefault();
          this.showProductDetails(product);
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
      const originalHTML = buttonElement.innerHTML;
      buttonElement.innerHTML = `
        <svg class="naay-spinner" viewBox="0 0 24 24" fill="none">
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

      // Update button state to success
      setTimeout(() => {
        buttonElement.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          ¡Agregado!
        `;
        buttonElement.classList.add('naay-product-card__add-btn--success');
        
        // Reset button after 2 seconds
        setTimeout(() => {
          buttonElement.innerHTML = originalHTML;
          buttonElement.disabled = false;
          buttonElement.classList.remove('naay-product-card__add-btn--success');
        }, 2000);
      }, 800);
    }

    showProductQuickView(product) {
      console.log('👁️ Showing quick view for:', product.title);
      
      // Create quick view modal
      const modal = document.createElement('div');
      modal.className = 'naay-product-modal';
      modal.innerHTML = `
        <div class="naay-product-modal__backdrop"></div>
        <div class="naay-product-modal__content">
          <header class="naay-product-modal__header">
            <h2>${product.title}</h2>
            <button class="naay-product-modal__close">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </header>
          <div class="naay-product-modal__body">
            ${product.image ? `<img src="${product.image}" alt="${product.title}">` : ''}
            <div class="naay-product-modal__info">
              <p class="naay-product-modal__description">${product.description || 'Producto de cosmética natural Naay.'}</p>
              <div class="naay-product-modal__price">$${product.price}</div>
              <button class="naay-product-modal__add-btn">Agregar al Carrito</button>
            </div>
          </div>
        </div>
      `;

      // Add to body
      document.body.appendChild(modal);

      // Add event listeners
      const closeBtn = modal.querySelector('.naay-product-modal__close');
      const backdrop = modal.querySelector('.naay-product-modal__backdrop');
      const addBtn = modal.querySelector('.naay-product-modal__add-btn');

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
      setTimeout(() => modal.classList.add('naay-product-modal--visible'), 10);
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
        const messages = this.messagesContainer.querySelectorAll('.naay-widget__message:not(.naay-widget__welcome)');
        messages.forEach(message => message.remove());
        
        // Show welcome message again
        const welcome = this.messagesContainer.querySelector('.naay-widget__welcome');
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
        const storageKey = `naay_conversation_${this.config.shopDomain}`;
        return localStorage.getItem(storageKey);
      } catch (error) {
        console.warn('Could not access localStorage for conversation ID:', error);
        return null;
      }
    }

    storeConversationId(conversationId) {
      try {
        const storageKey = `naay_conversation_${this.config.shopDomain}`;
        localStorage.setItem(storageKey, conversationId);
        console.log('💾 Stored conversation ID:', conversationId);
      } catch (error) {
        console.warn('Could not store conversation ID in localStorage:', error);
      }
    }

    clearStoredConversationId() {
      try {
        const storageKey = `naay_conversation_${this.config.shopDomain}`;
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
        this.addMessage(this.config.greeting, 'assistant');
      }
    }

    // Test function to add sample products to cart (for development)
    testCart() {
      const sampleProduct = {
        id: 'test-product-1',
        title: 'Crema Hidratante Naay Aloe Vera',
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
            title: 'Crema Hidratante Naay con Aloe Vera',
            description: 'Crema hidratante natural con aloe vera orgánico para todo tipo de pieles.',
            price: '24.99',
            comparePrice: '29.99',
            image: 'https://picsum.photos/300/200?random=1',
            vendor: 'Naay',
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
            vendor: 'Naay',
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
      this.cartVisible = true;
      if (this.cartPanel) {
        this.cartPanel.classList.add('naay-cart-panel--open');
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
        this.cartPanel.classList.remove('naay-cart-panel--open');
        this.cartPanel.setAttribute('aria-hidden', 'true');
      }
      console.log('✅ Cart panel hidden');
    }

    async addToCart(product) {
      console.log('🛒 Adding product to cart:', product);
      
      // First try to add to Shopify native cart if we're on a Shopify store
      let addedToShopify = false;
      const isShopifyStore = window.location.hostname.includes('myshopify.com') || 
                            window.location.hostname.includes('shopify.com');
      console.log('🏪 Is Shopify store?', isShopifyStore, 'Hostname:', window.location.hostname);
      
      if (isShopifyStore) {
        addedToShopify = await this.addToShopifyNativeCart(product.variantId, product.quantity || 1);
      } else {
        console.log('⚠️  Not on Shopify domain, skipping native cart addition');
      }
      
      // Also add via our API for consistency
      try {
        const response = await fetch(`${this.config.apiEndpoint}/api/public/cart/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shop: this.config.shopDomain,
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
      
      this.updateCartDisplay();
      // Cart stays visible always
    }


    // Fallback method for local cart management
    addToCartLocal(product) {
      console.log('🛒 Adding product to local cart (fallback):', product);
      
      // Check if product already exists in cart
      const existingItem = this.cartData.items.find(item => item.id === product.id);
      
      if (existingItem) {
        // Update quantity
        existingItem.quantity += product.quantity || 1;
      } else {
        // Add new item
        this.cartData.items.push({
          id: product.id,
          title: product.title,
          price: product.price,
          quantity: product.quantity || 1,
          image: product.image,
          variantId: product.variantId,
          handle: product.handle
        });
      }
      
      console.log('✅ Product added to local cart');
      
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
        title: edge.node.merchandise?.product?.title || 'Product',
        price: edge.node.merchandise?.priceV2?.amount || '0.00',
        quantity: edge.node.quantity,
        image: edge.node.merchandise?.image?.url || '',
        variantId: edge.node.merchandise?.id || '',
        handle: edge.node.merchandise?.product?.handle || ''
      })) || [];
      
      // Update totals
      this.cartData.total = shopifyCart.cost?.totalAmount?.amount || '0.00';
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
      
      // Find the item to get its line index for Shopify
      const item = this.cartData.items.find(item => item.id === productId);
      if (!item) {
        console.warn('⚠️ Item not found in cart:', productId);
        return;
      }
      
      // Try to remove from Shopify native cart first
      let removedFromShopify = false;
      const isShopifyStore = window.location.hostname.includes('myshopify.com') || 
                            window.location.hostname.includes('shopify.com');
      
      if (isShopifyStore && item.line_index) {
        try {
          removedFromShopify = await this.removeFromShopifyNativeCart(item.line_index);
        } catch (error) {
          console.error('❌ Failed to remove from Shopify cart:', error);
        }
      }
      
      // Remove from local cart data
      this.cartData.items = this.cartData.items.filter(item => item.id !== productId);
      
      // Update display
      this.updateCartDisplay();
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
      const isShopifyStore = window.location.hostname.includes('myshopify.com') || 
                            window.location.hostname.includes('shopify.com');
      
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
          this.cartItems.classList.remove('naay-cart-panel__items--visible');
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
            this.cartItems.classList.add('naay-cart-panel__items--visible');
          }
          
          // Show footer
          if (this.cartFooter) {
            this.cartFooter.style.display = 'block';
          }
          
          console.log('📋 Showing cart with items');
          
          // Update total
          if (this.cartTotal) {
            this.cartTotal.textContent = `$${total.toFixed(2)}`;
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
        const itemElement = document.createElement('div');
        itemElement.className = 'naay-cart-panel__item';
        
        // Get product image (try different image properties)
        const imageUrl = item.image || item.featured_image || item.images?.[0] || item.product_image || null;
        const variantTitle = item.variantTitle && item.variantTitle !== 'Default Title' ? item.variantTitle : '';
        const unitPrice = parseFloat(item.price) || 0;
        const totalPrice = unitPrice * item.quantity;
        
        itemElement.innerHTML = `
          <div class="naay-cart-panel__item-image-container">
            ${imageUrl ? 
              `<img src="${imageUrl}" alt="${item.title}" class="naay-cart-panel__item-image" loading="lazy">` :
              `<div class="naay-cart-panel__item-image naay-cart-panel__item-image--placeholder">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" fill="currentColor"/>
                </svg>
              </div>`
            }
          </div>
          <div class="naay-cart-panel__item-details">
            <div class="naay-cart-panel__item-info">
              <h4 class="naay-cart-panel__item-title">${item.title}</h4>
              ${variantTitle ? `<p class="naay-cart-panel__item-variant">${variantTitle}</p>` : ''}
              <div class="naay-cart-panel__item-price-info">
                <span class="naay-cart-panel__item-unit-price">$${unitPrice.toFixed(2)} c/u</span>
                <span class="naay-cart-panel__item-total-price">$${totalPrice.toFixed(2)}</span>
              </div>
            </div>
            <div class="naay-cart-panel__item-controls">
              <div class="naay-cart-panel__item-quantity">
                <button class="naay-cart-panel__quantity-btn naay-cart-panel__quantity-btn--decrease" data-action="decrease" data-product-id="${item.id}" aria-label="Disminuir cantidad">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
                <span class="naay-cart-panel__quantity-value">${item.quantity}</span>
                <button class="naay-cart-panel__quantity-btn naay-cart-panel__quantity-btn--increase" data-action="increase" data-product-id="${item.id}" aria-label="Aumentar cantidad">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              <button class="naay-cart-panel__item-remove" data-product-id="${item.id}" aria-label="Eliminar producto">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        `;
        
        // Add event listeners for this item
        const removeBtn = itemElement.querySelector('.naay-cart-panel__item-remove');
        const decreaseBtn = itemElement.querySelector('[data-action="decrease"]');
        const increaseBtn = itemElement.querySelector('[data-action="increase"]');
        
        if (removeBtn) {
          removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.removeFromCart(item.id);
          });
        }
        
        if (decreaseBtn) {
          decreaseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.updateQuantity(item.id, item.quantity - 1);
          });
        }
        
        if (increaseBtn) {
          increaseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.updateQuantity(item.id, item.quantity + 1);
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
        const shopDomain = this.config.shopDomain;
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
      console.log('🌿 Naay Chat: Cart actions are now handled by n8n workflow', actions);
      // All cart functionality is delegated to n8n
      return;
    }

    // ======= SHOPIFY CART SYNCHRONIZATION =======
    
    async loadShopifyCart() {
      console.log('🔄 Loading Shopify cart...');
      
      try {
        // Try to get cart from Shopify's native cart.js if available
        if (window.fetch && window.location.hostname.includes('myshopify.com') || 
            window.location.hostname.includes('shopify.com')) {
          
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
      this.cartData.total = (shopifyCart.total_price / 100).toFixed(2); // Convert from cents
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
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: variantId,
            quantity: quantity
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Added to Shopify native cart:', result);
          
          // Trigger custom event
          document.dispatchEvent(new CustomEvent('cart:updated'));
          
          // Reload cart data
          await this.loadShopifyCart();
          
          return true;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error('❌ Error adding to Shopify native cart:', error);
        return false;
      }
    }
    
    async removeFromShopifyNativeCart(lineIndex) {
      console.log('🛒 Removing from Shopify native cart line:', lineIndex);
      
      try {
        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            line: lineIndex,
            quantity: 0
          }),
        });
        
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
        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            line: lineIndex,
            quantity: newQuantity
          }),
        });
        
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
      console.log('🧹 Cleaning up Naay Widget...');
      
      // Clear cart sync interval
      if (this.cartSyncInterval) {
        clearInterval(this.cartSyncInterval);
        console.log('✅ Cart sync interval cleared');
      }
      
      // Remove event listeners
      document.removeEventListener('cart:updated', this.cartUpdateHandler);
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      
      console.log('✅ Naay Widget cleanup completed');
    }
  }

  // Expose class for constructor access
  window.NaayWidget = NaayWidget;
  
  // Initialize widget function
  function initializeWidget() {
    if (window.naayWidget) {
      console.log('🔒 Naay Widget: Already initialized, skipping');
      return;
    }

    console.log('🚀 Launching Naay Luxury Widget v2.1...');
    const widget = new NaayWidget();
    window.naayWidget = widget;
    
    // Mark as fully initialized
    window.__NAAY_WIDGET_INITIALIZED__ = true;
    window.__NAAY_WIDGET_LOADING__ = false;
    
    // Expose testing functions for development
    window.testNaayCart = () => {
      console.log('🧪 Testing Naay Cart functionality...');
      widget.testCart();
      return 'Cart test completed! Check the widget.';
    };

    window.testNaayProduct = () => {
      console.log('🧪 Testing Naay Product Recommendations...');
      widget.testProductRecommendation();
      return 'Product recommendations test completed! Check the widget.';
    };

    // Additional cart testing functions
    window.showNaayCart = () => {
      console.log('🛒 Showing Naay Cart...');
      widget.showCart();
      return 'Cart is now visible!';
    };

    window.hideNaayCart = () => {
      console.log('🛒 Hiding Naay Cart...');
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

    window.clearNaayCart = () => {
      console.log('🗑️ Clearing Naay Cart...');
      widget.cartData.items = [];
      widget.updateCartDisplay();
      return 'Cart cleared successfully!';
    };
    
    console.log('✨ Naay Widget initialized! New cart features ready:');
    console.log('🛒 Use window.testNewCartDesign() to test the new sidebar cart');
    console.log('📋 Use window.clearNaayCart() to clear cart items');
    console.log('🔄 Use window.showNaayCart() / window.hideNaayCart() to control visibility');
  }

  // Single initialization based on document state
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidget);
  } else {
    initializeWidget();
  }

  console.log('✨ Naay Luxury Chat: Widget script loaded successfully');
})();