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
      this.conversationId = null;

      this.init();
    }

    init() {
      console.log('✨ Initializing Naay Luxury Widget v3.0.0 - OFFICIAL DESIGN LOADED:', new Date().toISOString());
      console.log('Shop:', this.config.shopDomain);
      
      // Load settings from server
      this.loadSettings().then(() => {
        this.createWidget();
        this.setupElements();
        this.addEventListeners();
        this.loadConversationHistory();
      }).catch(error => {
        console.error('Failed to load widget settings, using defaults:', error);
        this.createWidget();
        this.setupElements();
        this.addEventListeners();
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
            <div class="naay-widget__promotional-icon">
              <svg class="naay-leaf-icon" viewBox="0 0 24 24" fill="none">
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22L6.66 19.7C7.14 19.87 7.64 20 8 20C19 20 22 3 22 3C21 5 14 5.25 9 6.25C4 7.25 2 11.5 2 15.5C2 15.5 2 16.5 3 16.5S4 15.5 4 15.5C4 14.5 5.5 10.25 17 8Z" fill="currentColor"/>
              </svg>
            </div>
            <div class="naay-widget__promotional-text">
              ¿Necesitas ayuda especializada?
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
                <div class="naay-widget__welcome-avatar">
                  <svg class="naay-welcome-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M6.05 8.05C6.05 6.7 7.1 5.65 8.45 5.65C9.8 5.65 10.85 6.7 10.85 8.05C10.85 9.4 9.8 10.45 8.45 10.45C7.1 10.45 6.05 9.4 6.05 8.05ZM12.55 8.05C12.55 6.7 13.6 5.65 14.95 5.65C16.3 5.65 17.35 6.7 17.35 8.05C17.35 9.4 16.3 10.45 14.95 10.45C13.6 10.45 12.55 9.4 12.55 8.05ZM12 14C8.13 14 5 11.37 5 8.1C5 6.61 5.53 5.24 6.46 4.17C7.39 3.1 8.65 2.4 10.05 2.15C11.45 1.9 12.9 2.12 14.18 2.79C15.46 3.46 16.5 4.54 17.15 5.86C17.8 7.18 18.02 8.67 17.77 10.11C17.52 11.55 16.81 12.87 15.74 13.85C14.67 14.83 13.3 15.41 11.85 15.5C10.4 15.59 8.96 15.19 7.77 14.36L12 14Z" fill="currentColor"/>
                  </svg>
                </div>
                <h3 class="naay-widget__welcome-title">¡Hola! Soy tu experta en Naay</h3>
              </div>
              <p class="naay-widget__welcome-message">${this.config.greeting}</p>
              <div class="naay-widget__welcome-features">
                <div class="naay-widget__feature">
                  <svg class="naay-feature-icon" viewBox="0 0 20 20" fill="none">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>Recomendaciones personalizadas para tu piel</span>
                </div>
                <div class="naay-widget__feature">
                  <svg class="naay-feature-icon" viewBox="0 0 20 20" fill="none">
                    <path d="M13 10V3L4 14H11L11 21L20 10H13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>Respuestas inmediatas de expertos</span>
                </div>
                <div class="naay-widget__feature">
                  <svg class="naay-feature-icon" viewBox="0 0 20 20" fill="none">
                    <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19C17 19.6 16.6 20 16 20H14C13.4 20 13 19.6 13 19V13M17 13H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>Ayuda especializada con tu compra</span>
                </div>
              </div>
            </div>
          </main>
          
          <footer class="naay-widget__input-area">
            <div class="naay-widget__input-container">
              <input type="text" id="naay-widget-input" class="naay-widget__input" placeholder="${this.config.placeholder}" aria-label="Escribe tu mensaje">
              <button class="naay-widget__send" id="naay-widget-send" aria-label="Enviar mensaje">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
                </svg>
              </button>
            </div>
            <div class="naay-widget__powered">
              <span>Inteligencia artificial • ${this.config.brandName}</span>
            </div>
          </footer>
        </div>
      `;

      // Add luxury styles
      this.addLuxuryStyles();

      // Append to document
      document.body.appendChild(this.container);
    }

    setupElements() {
      // Wait for DOM to be ready, then get elements using container context
      this.button = this.container.querySelector('#naay-widget-button');
      this.promotionalMessage = this.container.querySelector('#naay-promotional-message');
      this.chat = this.container.querySelector('#naay-widget-chat');
      this.messagesContainer = this.container.querySelector('#naay-widget-messages');
      this.input = this.container.querySelector('#naay-widget-input');
      this.sendButton = this.container.querySelector('#naay-widget-send');
      this.closeButton = this.container.querySelector('#naay-widget-close');

      console.log('✨ Luxury DOM Elements found:', {
        button: !!this.button,
        chat: !!this.chat,
        input: !!this.input,
        promotional: !!this.promotionalMessage
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
          border-radius: 16px !important;
          padding: 20px 24px !important;
          max-width: 280px !important;
          box-shadow: var(--naay-shadow-medium) !important;
          cursor: pointer !important;
          transition: all var(--naay-duration) var(--naay-transition) !important;
          opacity: 1 !important;
          visibility: visible !important;
          transform: translateY(0) !important;
        }

        .naay-widget__promotional-message:hover {
          transform: translateY(-4px) !important;
          box-shadow: var(--naay-shadow-strong) !important;
          border-color: rgba(212, 196, 184, 0.3) !important;
        }

        .naay-widget__promotional-content {
          display: flex !important;
          align-items: flex-start !important;
          gap: 16px !important;
        }

        .naay-widget__promotional-icon {
          width: 28px !important;
          height: 28px !important;
          background: linear-gradient(135deg, var(--naay-fresh), var(--naay-hydra)) !important;
          border-radius: 10px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
        }

        .naay-leaf-icon {
          width: 16px !important;
          height: 16px !important;
          color: var(--naay-white) !important;
          animation: naayLeafFloat 3s ease-in-out infinite !important;
        }

        @keyframes naayLeafFloat {
          0%, 100% { transform: rotate(0deg) translateY(0px); }
          33% { transform: rotate(1deg) translateY(-2px); }
          66% { transform: rotate(-1deg) translateY(1px); }
        }

        .naay-widget__promotional-text {
          flex: 1 !important;
        }

        .naay-widget__promotional-text {
          color: var(--naay-perfect) !important;
          font-size: 15px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          line-height: 1.4 !important;
          margin: 0 !important;
        }

        .naay-widget__promotional-subtitle {
          display: block !important;
          color: var(--naay-delicate) !important;
          font-size: 13px !important;
          font-weight: var(--naay-font-weight-regular) !important;
          margin-top: 4px !important;
        }

        .naay-widget__promotional-arrow {
          position: absolute !important;
          top: 50% !important;
          right: -8px !important;
          transform: translateY(-50%) !important;
          width: 0 !important;
          height: 0 !important;
          border-left: 8px solid var(--naay-white) !important;
          border-top: 8px solid transparent !important;
          border-bottom: 8px solid transparent !important;
          filter: drop-shadow(2px 0 4px rgba(168, 130, 107, 0.1)) !important;
        }

        .naay-widget--open .naay-widget__promotional-message {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          transform: translateY(8px) !important;
        }

        /* Ultra-Luxury Chat Button */
        .naay-widget__button {
          width: 72px !important;
          height: 72px !important;
          border-radius: 50% !important;
          background: linear-gradient(135deg, var(--naay-perfect), var(--naay-rich)) !important;
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
          background: linear-gradient(135deg, var(--naay-rich), var(--naay-radiant)) !important;
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
          background: linear-gradient(135deg, var(--naay-perfect), var(--naay-rich)) !important;
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
          right: 0 !important;
          width: 420px !important;
          height: 640px !important;
          background: rgba(248, 249, 248, 0.95) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border-radius: 24px !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          box-shadow: var(--naay-shadow-strong) !important;
          display: none !important;
          flex-direction: column !important;
          overflow: hidden !important;
          transform: translateY(24px) scale(0.95) !important;
          opacity: 0 !important;
          transition: all var(--naay-duration) var(--naay-transition) !important;
        }

        .naay-widget--bottom-left .naay-widget__chat {
          right: auto !important;
          left: 0 !important;
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
        }

        /* Luxury Header */
        .naay-widget__header {
          background: linear-gradient(135deg, var(--naay-perfect), var(--naay-rich)) !important;
          color: var(--naay-white) !important;
          padding: 24px 32px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          position: relative !important;
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
          border-radius: 16px !important;
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
          gap: 12px !important;
          margin-bottom: 24px !important;
        }

        .naay-widget__welcome-avatar {
          width: 56px !important;
          height: 56px !important;
          background: linear-gradient(135deg, var(--naay-hydra), var(--naay-delicate)) !important;
          border-radius: 18px !important;
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
          font-size: 24px !important;
          font-weight: var(--naay-font-weight-semibold) !important;
          color: var(--naay-perfect) !important;
          margin: 0 !important;
          letter-spacing: -0.02em !important;
        }

        .naay-widget__welcome-message {
          color: var(--naay-black) !important;
          font-size: 16px !important;
          font-weight: var(--naay-font-weight-regular) !important;
          line-height: 1.6 !important;
          margin: 0 0 32px 0 !important;
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
          border-radius: 16px !important;
          border: 1px solid rgba(212, 196, 184, 0.2) !important;
          transition: all 0.3s var(--naay-transition) !important;
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
          font-size: 14px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          line-height: 1.4 !important;
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
          margin-bottom: 16px !important;
        }

        .naay-widget__input {
          flex: 1 !important;
          padding: 16px 20px !important;
          border: 1px solid rgba(212, 196, 184, 0.3) !important;
          border-radius: 28px !important;
          font-family: var(--naay-font) !important;
          font-size: 15px !important;
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
          width: 56px !important;
          height: 56px !important;
          background: linear-gradient(135deg, var(--naay-perfect), var(--naay-rich)) !important;
          color: var(--naay-white) !important;
          border: none !important;
          border-radius: 28px !important;
          cursor: pointer !important;
          transition: all 0.3s var(--naay-transition) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .naay-widget__send:hover {
          transform: translateY(-2px) scale(1.05) !important;
          box-shadow: var(--naay-shadow-medium) !important;
          background: linear-gradient(135deg, var(--naay-rich), var(--naay-radiant)) !important;
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

        .naay-widget__powered {
          text-align: center !important;
          font-size: 12px !important;
          font-weight: var(--naay-font-weight-medium) !important;
          color: var(--naay-forever) !important;
          opacity: 0.7 !important;
        }

        /* Message Styles */
        .naay-widget__message {
          margin: 16px 0 !important;
          padding: 16px 20px !important;
          border-radius: 18px !important;
          font-size: 15px !important;
          line-height: 1.5 !important;
          max-width: 85% !important;
        }

        .naay-widget__message--user {
          background: linear-gradient(135deg, var(--naay-perfect), var(--naay-rich)) !important;
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

        /* Responsive Design */
        @media (max-width: 480px) {
          .naay-widget__chat {
            width: calc(100vw - 32px) !important;
            height: calc(100vh - 120px) !important;
            right: 16px !important;
            bottom: 104px !important;
          }
          
          .naay-widget__promotional-message {
            right: 16px !important;
            bottom: 104px !important;
            max-width: calc(100vw - 120px) !important;
          }
          
          .naay-widget__button {
            width: 64px !important;
            height: 64px !important;
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

      // Escape key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
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
      this.container.classList.remove('naay-widget--closed');
      this.container.classList.add('naay-widget--open');
      this.button.setAttribute('aria-expanded', 'true');
      console.log('✅ Classes after open:', this.container.className);
      
      // Focus input with delay
      setTimeout(() => {
        if (this.input) {
          this.input.focus();
        }
      }, 400);
    }

    close() {
      console.log('✨ Closing luxury chat...');
      this.isOpen = false;
      this.container.classList.remove('naay-widget--open');
      this.container.classList.add('naay-widget--closed');
      this.button.setAttribute('aria-expanded', 'false');
      console.log('✅ Classes after close:', this.container.className);
    }

    async sendMessage() {
      const text = this.input.value.trim();
      if (!text) return;

      // Clear input
      this.input.value = '';

      // Add user message to UI
      this.addMessage(text, 'user');

      // Disable send button while processing
      if (this.sendButton) {
        this.sendButton.disabled = true;
      }

      try {
        const apiUrl = `${this.config.apiEndpoint}/api/chat`;
        const payload = {
          message: text,
          shop: this.config.shopDomain,
          conversationId: this.conversationId,
          context: this.config.context || {}
        };

        console.log('🌿 Naay Chat: Sending message to API', {
          url: apiUrl,
          payload: payload,
          shopDomain: this.config.shopDomain
        });

        // Send to API
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        console.log('🌿 Naay Chat: API Response status:', response.status, response.statusText);

        const data = await response.json();
        console.log('🌿 Naay Chat: API Response data:', data);
        
        if (data.success && data.data) {
          this.addMessage(data.data.response || 'Lo siento, no pude procesar tu mensaje.', 'assistant');
          this.conversationId = data.data.conversationId;
          console.log('✅ Naay Chat: Message processed successfully', data.data.conversationId);
        } else {
          console.error('❌ Naay Chat: API returned error', data);
          this.addMessage('Lo siento, hubo un error. Por favor intenta de nuevo.', 'assistant');
        }
      } catch (error) {
        console.error('❌ Naay Chat: Network error sending message:', error);
        this.addMessage('Lo siento, hubo un error de conexión. Por favor intenta de nuevo.', 'assistant');
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
      messageDiv.textContent = text;
      
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

    async loadConversationHistory() {
      console.log('Loading conversation history...');
    }
  }

  // Auto-initialize widget
  document.addEventListener('DOMContentLoaded', function() {
    console.log('✨ DOM loaded, initializing Naay Luxury Widget...');
    window.NaayWidget = new NaayWidget();
  });

  // Fallback initialization if DOM already loaded
  if (document.readyState === 'loading') {
    // Document still loading, wait for DOMContentLoaded
  } else {
    // Document already loaded
    console.log('✨ Document ready, initializing Naay Luxury Widget immediately...');
    window.NaayWidget = new NaayWidget();
  }

  console.log('✨ Naay Luxury Chat: Widget script loaded successfully');
})();