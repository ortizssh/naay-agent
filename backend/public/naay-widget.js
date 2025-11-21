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

  // Prevent multiple widget loads
  if (window.NaayWidget) {
    console.warn('Naay Widget already loaded, version:', window.__NAAY_WIDGET_VERSION__);
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
        greeting: '¿En qué podemos ayudarte hoy?',
        placeholder: 'Escribe tu mensaje...',
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
      
      // Cart state - visible only when chat is open
      this.cartVisible = false;
      this.cartMinimized = false;
      this.cartId = null; // Shopify cart ID
      this.cartData = {
        items: [],
        total: 0,
        itemCount: 0
      };

      this.init();
    }

    init() {
      console.log('✨ Initializing Naay Flat Widget v3.2.2 - CORS FIXED:', new Date().toISOString());
      console.log('Shop:', this.config.shopDomain);
      
      // Load settings from server
      this.loadSettings().then(() => {
        this.createWidget();
        this.setupElements();
        this.addEventListeners();
        this.loadConversationHistory();
        this.loadShopifyCart(); // Load existing Shopify cart
        this.setupShopifyCartSync(); // Setup real-time sync
      }).catch(error => {
        console.error('Failed to load widget settings, using defaults:', error);
        this.createWidget();
        this.setupElements();
        this.addEventListeners();
        this.loadShopifyCart(); // Load existing Shopify cart
        this.setupShopifyCartSync(); // Setup real-time sync
      });
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
      // Create widget container
      this.container = document.createElement('div');
      this.container.id = 'naay-widget';
      this.container.className = `naay-widget naay-widget--${this.config.position} naay-widget--closed`;
      
      // Create ultra-modern HTML with luxury design
      this.container.innerHTML = `
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
        
        <div class="naay-widget__cart-panel" id="naay-widget-cart" role="complementary" aria-label="Carrito de compras">
          <header class="naay-cart__header">
            <h3 class="naay-cart__title">
              <svg class="naay-cart__icon" viewBox="0 0 24 24" fill="none">
                <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H14C13.4 20 13 19.6 13 19V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Mi Carrito
            </h3>
            <div class="naay-cart__actions">
              <button class="naay-cart__minimize" id="naay-cart-minimize" aria-label="Minimizar carrito">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="naay-cart__toggle" id="naay-cart-toggle" aria-label="Cerrar carrito">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </header>
          
          <div class="naay-cart__content" id="naay-cart-content">
            <div class="naay-cart__empty" id="naay-cart-empty">
              <svg class="naay-cart__empty-icon" viewBox="0 0 24 24" fill="none">
                <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <p class="naay-cart__empty-text">Tu carrito está vacío</p>
              <span class="naay-cart__empty-subtitle">¡Agrega productos para comenzar!</span>
            </div>
            
            <div class="naay-cart__items" id="naay-cart-items" style="display: none;">
              <!-- Los productos se agregarán dinámicamente aquí -->
            </div>
          </div>
          
          <footer class="naay-cart__footer" id="naay-cart-footer" style="display: none;">
            <div class="naay-cart__total">
              <span class="naay-cart__total-label">Total:</span>
              <span class="naay-cart__total-amount" id="naay-cart-total">$0.00</span>
            </div>
            <button class="naay-cart__checkout" id="naay-cart-checkout">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Ir al Checkout
            </button>
          </footer>
        </div>
        
        <div class="naay-widget__chat" id="naay-widget-chat" role="dialog" aria-labelledby="naay-chat-header">
          <header class="naay-widget__header" id="naay-chat-header">
            <div class="naay-widget__brand">
              <div class="naay-widget__brand-avatar">
                <svg class="naay-brand-icon" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 13L13 11L11 13L9 11L7 13L5 11L3 13V15L5 13L7 15L9 13L11 15L13 13L15 15L21 9Z" fill="currentColor"/>
                </svg>
              </div>
              <div class="naay-widget__brand-info">
                <h2 class="naay-widget__brand-name">${this.config.brandName}</h2>
                <p class="naay-widget__brand-tagline">Cosmética Ecológica Funcional</p>
                <div class="naay-widget__status">
                  <div class="naay-widget__status-dot" aria-hidden="true"></div>
                  <span>Asistente especializado disponible</span>
                </div>
              </div>
            </div>
            <button class="naay-widget__close" id="naay-widget-close" aria-label="Cerrar chat">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
              </svg>
            </button>
          </header>
          
          <main class="naay-widget__messages" id="naay-widget-messages" role="main">
            <div class="naay-widget__welcome">
              <div class="naay-widget__welcome-header">
                <h3 class="naay-widget__welcome-title">¡Hola! Soy tu asesora personal en Naáy</h3>
              </div>
              <p class="naay-widget__welcome-message">${this.config.greeting}</p>
              <div class="naay-widget__welcome-features">
                <div class="naay-widget__feature" data-message="¿Qué productos recomiendas para mi tipo de piel?">
                  <svg class="naay-feature-icon" viewBox="0 0 20 20" fill="none">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>Recomendaciones personalizadas para tu piel</span>
                </div>
                <div class="naay-widget__feature" data-message="¿Cuáles son los ingredientes naturales más efectivos?">
                  <svg class="naay-feature-icon" viewBox="0 0 20 20" fill="none">
                    <path d="M13 10V3L4 14H11L11 21L20 10H13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>Respuestas inmediatas de expertos</span>
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
          
          <footer class="naay-widget__input-area">
            <div class="naay-widget__input-container">
              <button class="naay-widget__reset" id="naay-widget-reset" aria-label="Volver al inicio" title="Volver al inicio">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M3 12L21 12M3 12L7 8M3 12L7 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <input type="text" id="naay-widget-input" class="naay-widget__input" placeholder="${this.config.placeholder}" aria-label="Escribe tu mensaje">
              <button class="naay-widget__send" id="naay-widget-send" aria-label="Enviar mensaje">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
                </svg>
              </button>
            </div>
            <div class="naay-widget__powered">
              <span>Powered by Dustkey LLC.</span>
            </div>
          </footer>
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

      // Cart elements
      this.cartPanel = this.container.querySelector('#naay-widget-cart');
      this.cartToggle = this.container.querySelector('#naay-cart-toggle');
      this.cartMinimize = this.container.querySelector('#naay-cart-minimize');
      this.cartContent = this.container.querySelector('#naay-cart-content');
      this.cartEmpty = this.container.querySelector('#naay-cart-empty');
      this.cartItems = this.container.querySelector('#naay-cart-items');
      this.cartFooter = this.container.querySelector('#naay-cart-footer');
      this.cartTotal = this.container.querySelector('#naay-cart-total');
      this.cartCheckout = this.container.querySelector('#naay-cart-checkout');

      console.log('✨ Luxury DOM Elements found:', {
        button: !!this.button,
        chat: !!this.chat,
        input: !!this.input,
        promotional: !!this.promotionalMessage,
        cart: !!this.cartPanel
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

        /* Luxury Cart Panel - positioned to the left of chat */
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
          background: linear-gradient(135deg, var(--naay-perfect) 0%, var(--naay-rich) 100%) !important;
          color: var(--naay-white) !important;
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
          transition: all 0.3s var(--naay-transition) !important;
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
          border-radius: 16px !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          overflow: hidden !important;
          box-shadow: 0 4px 16px rgba(168, 130, 107, 0.1) !important;
          transition: all 0.3s var(--naay-transition) !important;
          margin: 16px 0 !important;
          max-width: 380px !important;
          position: relative !important;
        }

        .naay-product-card:hover {
          transform: translateY(-4px) !important;
          box-shadow: 0 8px 24px rgba(168, 130, 107, 0.15) !important;
        }

        .naay-product-card__header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 12px 16px 0 16px !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 2 !important;
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
          width: 100% !important;
          height: 200px !important;
          overflow: hidden !important;
          background: var(--naay-sage) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .naay-product-card__image {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          transition: transform 0.3s var(--naay-transition) !important;
        }

        .naay-product-card:hover .naay-product-card__image {
          transform: scale(1.05) !important;
        }

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

        .naay-product-card:hover .naay-product-card__overlay {
          opacity: 1 !important;
        }

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

        .naay-product-card__quick-view:hover {
          background: var(--naay-white) !important;
          transform: scale(1.1) !important;
        }

        .naay-product-card__quick-view svg {
          width: 20px !important;
          height: 20px !important;
        }

        .naay-product-card__content {
          padding: 20px !important;
        }

        .naay-product-card__title {
          font-size: 16px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          line-height: 1.4 !important;
          margin: 0 0 8px 0 !important;
          color: var(--naay-black) !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
        }

        .naay-product-card__description {
          font-size: 13px !important;
          line-height: 1.5 !important;
          color: var(--naay-perfect) !important;
          margin: 0 0 16px 0 !important;
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
          gap: 8px !important;
        }

        .naay-product-card__add-btn {
          flex: 1 !important;
          background: linear-gradient(135deg, var(--naay-perfect) 0%, var(--naay-rich) 100%) !important;
          color: var(--naay-white) !important;
          border: none !important;
          border-radius: 10px !important;
          padding: 12px 16px !important;
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          cursor: pointer !important;
          transition: all 0.3s var(--naay-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          box-shadow: 0 2px 8px rgba(168, 130, 107, 0.3) !important;
        }

        .naay-product-card__add-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(168, 130, 107, 0.4) !important;
        }

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
          width: 16px !important;
          height: 16px !important;
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
          border-radius: 10px !important;
          padding: 12px 16px !important;
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          cursor: pointer !important;
          transition: all 0.2s var(--naay-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          min-width: 80px !important;
        }

        .naay-product-card__details-btn:hover {
          background: rgba(168, 130, 107, 0.2) !important;
          border-color: var(--naay-perfect) !important;
        }

        .naay-product-card__details-btn svg {
          width: 14px !important;
          height: 14px !important;
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
          transition: all 0.3s var(--naay-transition) !important;
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
          transition: all 0.3s var(--naay-transition) !important;
          box-shadow: 0 4px 16px rgba(168, 130, 107, 0.3) !important;
        }

        .naay-product-modal__add-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(168, 130, 107, 0.4) !important;
        }

        /* Header Hidden */
        .naay-widget__header {
          display: none !important;
        }

        .naay-widget__brand {
          display: flex !important;
          align-items: center !important;
          gap: 16px !important;
        }

        .naay-widget__brand-avatar {
          width: 48px !important;
          height: 48px !important;
          background: rgba(255, 255, 255, 0.15) !important;
          backdrop-filter: blur(10px) !important;
          border-radius: 8px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .naay-brand-icon {
          width: 24px !important;
          height: 24px !important;
          color: var(--naay-white) !important;
        }

        .naay-widget__brand-name {
          font-size: 20px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          margin: 0 0 2px 0 !important;
          letter-spacing: -0.02em !important;
        }

        .naay-widget__brand-tagline {
          font-size: 13px !important;
          font-weight: var(--naay-font-weight-regular) !important;
          opacity: 0.9 !important;
          margin: 0 0 6px 0 !important;
        }

        .naay-widget__status {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          font-size: 12px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          opacity: 0.9 !important;
        }

        .naay-widget__status-dot {
          width: 10px !important;
          height: 10px !important;
          border-radius: 50% !important;
          background: var(--naay-fresh) !important;
          box-shadow: 0 0 8px rgba(143, 166, 142, 0.6) !important;
          animation: naayStatusPulse 2s infinite !important;
        }

        @keyframes naayStatusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .naay-widget__close {
          background: rgba(255, 255, 255, 0.1) !important;
          border: none !important;
          color: var(--naay-white) !important;
          cursor: pointer !important;
          padding: 12px !important;
          border-radius: 12px !important;
          transition: all 0.2s var(--naay-transition) !important;
          backdrop-filter: blur(10px) !important;
        }

        .naay-widget__close:hover {
          background: rgba(255, 255, 255, 0.2) !important;
          transform: scale(1.1) !important;
        }

        .naay-widget__close svg {
          width: 16px !important;
          height: 16px !important;
        }

        /* Luxury Messages Area */
        .naay-widget__messages {
          flex: 1 !important;
          padding: 32px !important;
          overflow-y: auto !important;
          background: transparent !important;
          scrollbar-width: thin !important;
          scrollbar-color: var(--naay-delicate) transparent !important;
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
          gap: 16px !important;
          padding: 20px !important;
          background: rgba(255, 255, 255, 0.7) !important;
          border-radius: 8px !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          transition: all 0.3s var(--naay-transition) !important;
          cursor: pointer !important;
        }

        .naay-widget__feature:hover {
          background: rgba(255, 255, 255, 0.9) !important;
          transform: translateY(-2px) !important;
          box-shadow: var(--naay-shadow-soft) !important;
        }

        .naay-feature-icon {
          width: 24px !important;
          height: 24px !important;
          color: var(--naay-fresh) !important;
          flex-shrink: 0 !important;
        }

        .naay-widget__feature span {
          color: var(--naay-perfect) !important;
          font-size: 12px !important;
          font-weight: var(--naay-font-weight-medium) !important;
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
        }

        .naay-widget__input {
          flex: 1 !important;
          padding: 10px 14px !important;
          border: 1px solid rgba(212, 196, 184, 0.3) !important;
          border-radius: 28px !important;
          font-family: var(--naay-font) !important;
          font-size: 13px !important;
          font-weight: var(--naay-font-weight-regular) !important;
          background: var(--naay-white) !important;
          color: var(--naay-black) !important;
          outline: none !important;
          transition: all 0.3s var(--naay-transition) !important;
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
          transition: all 0.3s var(--naay-transition) !important;
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
          transition: all 0.3s var(--naay-transition) !important;
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
      `;

      document.head.appendChild(style);
    }

    addEventListeners() {
      console.log('✨ Adding luxury event listeners...');

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

      // Cart toggle
      if (this.cartToggle) {
        this.cartToggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('✨ Cart toggle clicked!');
          this.hideCart();
        });
        console.log('✅ Cart toggle event listener added');
      }

      // Cart minimize
      if (this.cartMinimize) {
        this.cartMinimize.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('✨ Cart minimize clicked!');
          this.toggleCartMinimize();
        });
        console.log('✅ Cart minimize event listener added');
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
      
      // Show cart when chat opens
      this.showCart();
      
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
      
      // Hide cart when chat closes
      this.hideCart();
      
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
        const apiUrl = `${this.config.apiEndpoint}/api/simple-chat`;
        const payload = {
          message: text,
          shop: this.config.shopDomain,
          conversationId: this.conversationId
        };

        console.log('🌿 Naay Chat: Sending message to API', {
          url: apiUrl,
          payload: payload,
          shopDomain: this.config.shopDomain
        });

        // Send to API with enhanced error handling
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
        console.log('🌿 Naay Chat: API Response data:', data);
        
        // Remove typing indicator
        this.removeTypingIndicator(typingIndicator);
        
        if (data.success && data.data) {
          this.addMessage(data.data.response || 'Lo siento, no pude procesar tu mensaje.', 'assistant');
          this.conversationId = data.data.conversationId;
          this.storeConversationId(this.conversationId);
          
          // Process cart actions if present
          if (data.data.actions && Array.isArray(data.data.actions)) {
            this.processCartActions(data.data.actions);
          }
          
          console.log('✅ Naay Chat: Message processed successfully', data.data.conversationId);
        } else {
          console.error('❌ Naay Chat: API returned error', data);
          this.addMessage('Lo siento, hubo un error. Por favor intenta de nuevo.', 'assistant');
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
        vendor = 'Naay',
        tags = [],
        available = true
      } = product;

      const hasDiscount = comparePrice && parseFloat(comparePrice) > parseFloat(price);
      const discountPercent = hasDiscount ? Math.round(((parseFloat(comparePrice) - parseFloat(price)) / parseFloat(comparePrice)) * 100) : 0;
      
      return `
        <div class="naay-product-card" data-product-id="${id}">
          <div class="naay-product-card__header">
            <div class="naay-product-card__vendor">${vendor}</div>
            ${hasDiscount ? `<div class="naay-product-card__discount">-${discountPercent}%</div>` : ''}
          </div>
          
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
        variantId: product.variants && product.variants[0] ? product.variants[0].id : product.id,
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

    toggleCartMinimize() {
      this.cartMinimized = !this.cartMinimized;
      console.log('🛒 Cart minimize toggled:', this.cartMinimized);
      
      if (this.cartMinimized) {
        this.cartPanel.classList.add('naay-widget__cart-panel--minimized');
      } else {
        this.cartPanel.classList.remove('naay-widget__cart-panel--minimized');
      }
    }

    showCart() {
      console.log('🛒 Showing cart...');
      this.cartVisible = true;
      this.container.classList.add('naay-widget--cart-open');
      console.log('✅ Cart shown');
    }

    hideCart() {
      console.log('🛒 Hiding cart...');
      this.cartVisible = false;
      this.container.classList.remove('naay-widget--cart-open');
      console.log('✅ Cart hidden');
    }

    async addToCart(product) {
      console.log('🛒 Adding product to cart:', product);
      
      // First try to add to Shopify native cart if we're on a Shopify store
      let addedToShopify = false;
      if (window.location.hostname.includes('myshopify.com') || 
          window.location.hostname.includes('shopify.com')) {
        addedToShopify = await this.addToShopifyNativeCart(product.variantId, product.quantity || 1);
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

    async proceedToCheckout() {
      console.log('🛒 Proceeding to checkout...');
      
      try {
        // If on Shopify store, redirect to native checkout
        if (window.location.hostname.includes('myshopify.com') || 
            window.location.hostname.includes('shopify.com')) {
          window.location.href = '/cart';
          return;
        }
        
        // Otherwise, open checkout URL if available from API
        // This would be the checkout URL from Shopify Storefront API
        console.log('🛒 Opening checkout in new window...');
        // Implementation for external checkout would go here
        
      } catch (error) {
        console.error('❌ Error proceeding to checkout:', error);
      }
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

    removeFromCart(productId) {
      console.log('🛒 Removing product from cart:', productId);
      this.cartData.items = this.cartData.items.filter(item => item.id !== productId);
      this.updateCartDisplay();
      console.log('✅ Product removed from cart');
    }

    updateQuantity(productId, newQuantity) {
      console.log('🛒 Updating quantity for product:', productId, 'to:', newQuantity);
      
      const item = this.cartData.items.find(item => item.id === productId);
      if (item) {
        if (newQuantity <= 0) {
          this.removeFromCart(productId);
        } else {
          item.quantity = newQuantity;
          this.updateCartDisplay();
        }
      }
      
      console.log('✅ Quantity updated');
    }

    updateCartDisplay() {
      // Calculate totals
      let total = 0;
      let itemCount = 0;
      
      this.cartData.items.forEach(item => {
        total += parseFloat(item.price) * item.quantity;
        itemCount += item.quantity;
      });
      
      this.cartData.total = total;
      this.cartData.itemCount = itemCount;
      
      // Update UI
      if (this.cartData.items.length === 0) {
        this.cartEmpty.style.display = 'flex';
        this.cartItems.style.display = 'none';
        this.cartFooter.style.display = 'none';
      } else {
        this.cartEmpty.style.display = 'none';
        this.cartItems.style.display = 'flex';
        this.cartFooter.style.display = 'block';
        
        // Update total
        if (this.cartTotal) {
          this.cartTotal.textContent = `$${total.toFixed(2)}`;
        }
        
        // Render cart items
        this.renderCartItems();
      }
      
      console.log('🛒 Cart display updated:', this.cartData);
    }

    renderCartItems() {
      if (!this.cartItems) return;
      
      this.cartItems.innerHTML = '';
      
      this.cartData.items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'naay-cart__item';
        itemElement.innerHTML = `
          <div class="naay-cart__item-header">
            <h4 class="naay-cart__item-title">${item.title}</h4>
            <button class="naay-cart__item-remove" data-product-id="${item.id}">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="naay-cart__item-details">
            <div class="naay-cart__item-quantity">
              <button class="naay-cart__quantity-btn" data-action="decrease" data-product-id="${item.id}">-</button>
              <span class="naay-cart__quantity-value">${item.quantity}</span>
              <button class="naay-cart__quantity-btn" data-action="increase" data-product-id="${item.id}">+</button>
            </div>
            <span class="naay-cart__item-price">$${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
          </div>
        `;
        
        // Add event listeners for this item
        const removeBtn = itemElement.querySelector('.naay-cart__item-remove');
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
      });
    }

    proceedToCheckout() {
      console.log('🛒 Proceeding to checkout...');
      
      if (this.cartData.items.length === 0) {
        console.warn('Cart is empty, cannot proceed to checkout');
        return;
      }
      
      // Create checkout URL based on shop domain
      const checkoutUrl = `https://${this.config.shopDomain}/cart`;
      
      // Open in new window
      window.open(checkoutUrl, '_blank');
      
      console.log('✅ Redirected to checkout');
    }

    // Process cart actions and product recommendations from AI response
    processCartActions(actions) {
      if (!actions || !Array.isArray(actions)) return;
      
      actions.forEach(action => {
        console.log('🛒 Processing action:', action);
        
        switch (action.type) {
          case 'cart.add':
            if (action.product) {
              this.addToCart(action.product);
            }
            break;
          case 'cart.show':
            this.showCart();
            break;
          case 'cart.hide':
            this.hideCart();
            break;
          case 'cart.remove':
            if (action.productId) {
              this.removeFromCart(action.productId);
            }
            break;
          case 'cart.update':
            if (action.productId && action.quantity !== undefined) {
              this.updateQuantity(action.productId, action.quantity);
            }
            break;
          case 'product.recommend':
            if (action.product) {
              this.addProductRecommendation(action.product);
            }
            break;
          case 'product.show':
            if (action.products && Array.isArray(action.products)) {
              action.products.forEach(product => {
                this.addProductRecommendation(product);
              });
            }
            break;
          default:
            console.warn('Unknown action type:', action.type);
        }
      });
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
      this.cartData.items = shopifyCart.items?.map(item => ({
        id: item.variant_id.toString(),
        title: item.product_title,
        variantTitle: item.variant_title,
        price: (item.price / 100).toFixed(2), // Shopify prices are in cents
        quantity: item.quantity,
        image: item.image,
        variantId: item.variant_id.toString(),
        handle: item.handle,
        url: item.url
      })) || [];
      
      // Update totals
      this.cartData.total = (shopifyCart.total_price / 100).toFixed(2); // Convert from cents
      this.cartData.itemCount = shopifyCart.item_count || 0;
      
      console.log('✅ Cart synced from Shopify native cart');
    }
    
    setupShopifyCartSync() {
      console.log('🔄 Setting up Shopify cart synchronization...');
      
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
      console.log('✨ Naay Widget already initialized');
      return;
    }

    console.log('✨ Initializing Naay Luxury Widget...');
    const widget = new NaayWidget();
    window.naayWidget = widget;
    
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
    
    console.log('✨ Naay Widget initialized! Use window.testNaayCart(), window.testNaayProduct(), window.showNaayCart() and window.hideNaayCart() to test functionality.');
  }

  // Single initialization based on document state
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidget);
  } else {
    initializeWidget();
  }

  console.log('✨ Naay Luxury Chat: Widget script loaded successfully');
})();