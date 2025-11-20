/**
 * Naay AI Chat Widget
 * Version: 2.2.0-FIXED - 2025.11.20.16:30
 * Fixed Design with Proper Event Handling & Flat Colors
 * 
 * ✅ OFFICIAL WIDGET - Fixed click events and positioning
 */

(function() {
  'use strict';

  // UNIQUE IDENTIFIER FOR VERSION DETECTION 
  window.__NAAY_WIDGET_VERSION__ = '2.2.0-FIXED-' + Date.now();
  window.__NAAY_WIDGET_TIMESTAMP__ = new Date().toISOString();
  console.log('✅ NAAY WIDGET VERIFICATION:', {
    version: window.__NAAY_WIDGET_VERSION__,
    timestamp: window.__NAAY_WIDGET_TIMESTAMP__,
    hasFixedEvents: true,
    hasImprovedDesign: true,
    source: 'OFFICIAL-AZURE-SERVER-FIXED'
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
        primaryColor: '#8B5A3C', // Naay natural brown - flat
        secondaryColor: '#F5F1EB', // Naay cream - flat
        accentColor: '#6B8E23', // Naay natural green - flat
        backgroundColor: '#FFFFFF', // White background for message
        greeting: '¡Hola! 🌿 Soy tu asistente de Naay. ¿Cómo puedo ayudarte a encontrar el cuidado perfecto para tu piel?',
        placeholder: 'Escribe tu mensaje...',
        theme: 'light',
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
      console.log('🌿 Initializing Naay Widget v2.2.0-FIXED - OFFICIAL WIDGET LOADED:', new Date().toISOString());
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
            // Merge server settings with config
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
      
      // Create widget HTML with improved positioning
      this.container.innerHTML = `
        <div class="naay-widget__promotional-message" id="naay-promotional-message">
          <div class="naay-widget__promotional-content">
            ¿Necesitas ayuda para tu compra? ¡Habla aquí!
          </div>
          <div class="naay-widget__promotional-arrow"></div>
        </div>
        
        <div class="naay-widget__button" id="naay-widget-button">
          <div class="naay-widget__button-content">
            <span class="naay-widget__icon">${this.config.avatar}</span>
            <span class="naay-widget__close-icon">×</span>
          </div>
        </div>
        
        <div class="naay-widget__chat" id="naay-widget-chat">
          <div class="naay-widget__header">
            <div class="naay-widget__brand">
              <div class="naay-widget__brand-icon">${this.config.avatar}</div>
              <div class="naay-widget__brand-info">
                <div class="naay-widget__brand-name">${this.config.brandName}</div>
                <div class="naay-widget__brand-tagline">Cosmética Ecológica • Cuidado Natural</div>
                <div class="naay-widget__status">
                  <span class="naay-widget__status-dot"></span>
                  Asistente IA disponible
                </div>
              </div>
            </div>
            <button class="naay-widget__close" id="naay-widget-close" title="Cerrar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
              </svg>
            </button>
          </div>
          
          <div class="naay-widget__messages" id="naay-widget-messages">
            <div class="naay-widget__welcome">
              <div class="naay-widget__welcome-header">
                <div class="naay-widget__welcome-icon">${this.config.avatar}</div>
                <div class="naay-widget__welcome-title">Asistente Naay</div>
              </div>
              <div class="naay-widget__welcome-message">${this.config.greeting}</div>
              <div class="naay-widget__welcome-features">
                <div class="naay-widget__feature">
                  <span class="naay-widget__feature-icon">🌿</span>
                  <span>Recomendaciones personalizadas</span>
                </div>
                <div class="naay-widget__feature">
                  <span class="naay-widget__feature-icon">💬</span>
                  <span>Respuestas inmediatas</span>
                </div>
                <div class="naay-widget__feature">
                  <span class="naay-widget__feature-icon">🛍️</span>
                  <span>Ayuda con tu compra</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="naay-widget__input-area">
            <div class="naay-widget__input-container">
              <input type="text" id="naay-widget-input" class="naay-widget__input" placeholder="${this.config.placeholder}">
              <button class="naay-widget__send" id="naay-widget-send">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="m2 21 21-9L2 3v7l15 2-15 2v7z" fill="currentColor"/>
                </svg>
              </button>
            </div>
            <div class="naay-widget__powered">
              Impulsado por IA • Naay
            </div>
          </div>
        </div>
      `;

      // Add styles with flat colors and improved positioning
      this.addStyles();

      // Append to document
      document.body.appendChild(this.container);
    }

    setupElements() {
      // Wait for DOM to be ready, then get elements
      this.button = this.container.querySelector('#naay-widget-button');
      this.promotionalMessage = this.container.querySelector('#naay-promotional-message');
      this.chat = this.container.querySelector('#naay-widget-chat');
      this.messagesContainer = this.container.querySelector('#naay-widget-messages');
      this.input = this.container.querySelector('#naay-widget-input');
      this.sendButton = this.container.querySelector('#naay-widget-send');
      this.closeButton = this.container.querySelector('#naay-widget-close');

      console.log('✅ DOM Elements found:', {
        button: !!this.button,
        chat: !!this.chat,
        input: !!this.input,
        promotional: !!this.promotionalMessage
      });
    }

    addStyles() {
      const style = document.createElement('style');
      style.textContent = `
        /* Naay Widget Base Styles - FLAT DESIGN */
        .naay-widget {
          position: fixed !important;
          z-index: 99999 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }

        .naay-widget--bottom-right {
          bottom: 20px !important;
          right: 20px !important;
        }

        .naay-widget--bottom-left {
          bottom: 20px !important;
          left: 20px !important;
        }

        .naay-widget--top-right {
          top: 20px !important;
          right: 20px !important;
        }

        .naay-widget--top-left {
          top: 20px !important;
          left: 20px !important;
        }

        /* Promotional Message - MOVED TO LEFT WITH WHITE BACKGROUND */
        .naay-widget__promotional-message {
          position: absolute !important;
          bottom: 20px !important;
          right: 80px !important; /* Position to left of bubble */
          transform: translateY(-50%) !important;
          background: ${this.config.backgroundColor} !important; /* White background */
          color: ${this.config.primaryColor} !important;
          padding: 12px 16px !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(139, 90, 60, 0.2) !important;
          border: 1px solid ${this.config.primaryColor} !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          max-width: 200px !important;
          cursor: pointer !important;
          transition: all 0.3s ease !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .naay-widget__promotional-message:hover {
          transform: translateY(-50%) scale(1.02) !important;
          box-shadow: 0 6px 16px rgba(139, 90, 60, 0.3) !important;
        }

        .naay-widget__promotional-content {
          text-align: center !important;
          line-height: 1.4 !important;
        }

        .naay-widget__promotional-arrow {
          position: absolute !important;
          top: 50% !important;
          right: -6px !important;
          transform: translateY(-50%) !important;
          width: 0 !important;
          height: 0 !important;
          border-left: 6px solid ${this.config.primaryColor} !important;
          border-top: 6px solid transparent !important;
          border-bottom: 6px solid transparent !important;
        }

        .naay-widget--open .naay-widget__promotional-message {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        /* Chat Button - FLAT DESIGN */
        .naay-widget__button {
          width: 64px !important;
          height: 64px !important;
          border-radius: 50% !important;
          background: ${this.config.primaryColor} !important; /* Flat color, no gradient */
          border: none !important;
          cursor: pointer !important;
          position: relative !important;
          box-shadow: 0 4px 16px rgba(139, 90, 60, 0.3) !important;
          transition: all 0.3s ease !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .naay-widget__button:hover {
          transform: translateY(-2px) scale(1.05) !important;
          box-shadow: 0 8px 24px rgba(139, 90, 60, 0.4) !important;
          background: #A0672A !important; /* Slightly darker on hover */
        }

        .naay-widget__button-content {
          position: relative !important;
          z-index: 2 !important;
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: white !important;
        }

        .naay-widget__icon {
          font-size: 28px !important;
          transition: all 0.3s ease !important;
          opacity: 1 !important;
        }

        .naay-widget__close-icon {
          position: absolute !important;
          font-size: 24px !important;
          opacity: 0 !important;
          transition: all 0.3s ease !important;
          color: white !important;
        }

        .naay-widget--open .naay-widget__icon {
          opacity: 0 !important;
          transform: rotate(90deg) !important;
        }

        .naay-widget--open .naay-widget__close-icon {
          opacity: 1 !important;
          transform: rotate(0deg) !important;
        }

        /* Chat Window - FLAT DESIGN */
        .naay-widget__chat {
          position: absolute !important;
          bottom: 76px !important;
          right: 0 !important;
          width: 380px !important;
          height: 520px !important;
          background: ${this.config.secondaryColor} !important; /* Flat color */
          border-radius: 12px !important;
          box-shadow: 0 8px 24px rgba(139, 90, 60, 0.2) !important;
          border: 1px solid rgba(139, 90, 60, 0.1) !important;
          display: none !important;
          flex-direction: column !important;
          overflow: hidden !important;
          transform: translateY(20px) scale(0.95) !important;
          opacity: 0 !important;
          transition: all 0.3s ease !important;
        }

        .naay-widget--bottom-left .naay-widget__chat {
          right: auto !important;
          left: 0 !important;
        }

        .naay-widget--top-right .naay-widget__chat,
        .naay-widget--top-left .naay-widget__chat {
          bottom: auto !important;
          top: 76px !important;
        }

        /* CRITICAL: Show chat when open */
        .naay-widget--open .naay-widget__chat {
          display: flex !important;
          transform: translateY(0) scale(1) !important;
          opacity: 1 !important;
        }

        /* Header - FLAT DESIGN */
        .naay-widget__header {
          background: ${this.config.primaryColor} !important; /* Flat color */
          color: white !important;
          padding: 16px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
        }

        .naay-widget__brand {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
        }

        .naay-widget__brand-icon {
          font-size: 24px !important;
        }

        .naay-widget__brand-name {
          font-size: 18px !important;
          font-weight: 600 !important;
          margin-bottom: 2px !important;
        }

        .naay-widget__brand-tagline {
          font-size: 12px !important;
          opacity: 0.9 !important;
          margin-bottom: 4px !important;
        }

        .naay-widget__status {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          font-size: 12px !important;
          opacity: 0.9 !important;
        }

        .naay-widget__status-dot {
          width: 8px !important;
          height: 8px !important;
          border-radius: 50% !important;
          background: ${this.config.accentColor} !important; /* Flat green */
        }

        .naay-widget__close {
          background: none !important;
          border: none !important;
          color: white !important;
          cursor: pointer !important;
          padding: 8px !important;
          border-radius: 4px !important;
          transition: background 0.2s ease !important;
        }

        .naay-widget__close:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }

        /* Messages */
        .naay-widget__messages {
          flex: 1 !important;
          padding: 20px !important;
          overflow-y: auto !important;
          background: white !important;
        }

        .naay-widget__welcome {
          text-align: center !important;
        }

        .naay-widget__welcome-header {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          margin-bottom: 16px !important;
        }

        .naay-widget__welcome-icon {
          font-size: 24px !important;
        }

        .naay-widget__welcome-title {
          font-size: 20px !important;
          font-weight: 600 !important;
          color: ${this.config.primaryColor} !important;
        }

        .naay-widget__welcome-message {
          color: #333 !important;
          margin-bottom: 20px !important;
          line-height: 1.5 !important;
        }

        .naay-widget__welcome-features {
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
        }

        .naay-widget__feature {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          color: #666 !important;
          font-size: 14px !important;
        }

        /* Input Area */
        .naay-widget__input-area {
          padding: 16px !important;
          background: white !important;
          border-top: 1px solid #eee !important;
        }

        .naay-widget__input-container {
          display: flex !important;
          gap: 8px !important;
          margin-bottom: 8px !important;
        }

        .naay-widget__input {
          flex: 1 !important;
          padding: 12px !important;
          border: 1px solid #ddd !important;
          border-radius: 8px !important;
          font-size: 14px !important;
          outline: none !important;
          transition: border-color 0.2s ease !important;
        }

        .naay-widget__input:focus {
          border-color: ${this.config.primaryColor} !important;
        }

        .naay-widget__send {
          background: ${this.config.primaryColor} !important; /* Flat color */
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 12px !important;
          cursor: pointer !important;
          transition: background 0.2s ease !important;
        }

        .naay-widget__send:hover {
          background: #A0672A !important;
        }

        .naay-widget__powered {
          font-size: 12px !important;
          color: #999 !important;
          text-align: center !important;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .naay-widget__chat {
            width: calc(100vw - 40px) !important;
            right: 20px !important;
          }
          
          .naay-widget__promotional-message {
            right: 20px !important;
            bottom: 90px !important;
            max-width: 150px !important;
          }
        }
      `;

      document.head.appendChild(style);
    }

    addEventListeners() {
      console.log('🔧 Adding event listeners...');

      // Toggle widget open/close
      if (this.button) {
        this.button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🔥 Button clicked! Current state:', this.isOpen);
          this.toggle();
        });
        console.log('✅ Button event listener added');
      } else {
        console.error('❌ Button element not found!');
      }

      // Promotional message click
      if (this.promotionalMessage) {
        this.promotionalMessage.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🔥 Promotional message clicked!');
          this.open();
        });
        console.log('✅ Promotional message event listener added');
      }

      // Close button
      if (this.closeButton) {
        this.closeButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🔥 Close button clicked!');
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
      console.log('🔄 Toggling widget. Current state:', this.isOpen);
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    open() {
      console.log('🔥 Opening chat...');
      this.isOpen = true;
      this.container.classList.remove('naay-widget--closed');
      this.container.classList.add('naay-widget--open');
      console.log('✅ Classes after open:', this.container.className);
      console.log('✅ Chat element display:', window.getComputedStyle(this.chat).display);
      
      // Focus input with delay
      setTimeout(() => {
        if (this.input) {
          this.input.focus();
        }
      }, 300);
    }

    close() {
      console.log('🔥 Closing chat...');
      this.isOpen = false;
      this.container.classList.remove('naay-widget--open');
      this.container.classList.add('naay-widget--closed');
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
        // Send to API
        const response = await fetch(`${this.config.apiEndpoint}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text,
            conversationId: this.conversationId,
            shopDomain: this.config.shopDomain
          })
        });

        const data = await response.json();
        
        if (data.success) {
          this.addMessage(data.response || 'Lo siento, no pude procesar tu mensaje.', 'assistant');
          this.conversationId = data.conversationId;
        } else {
          this.addMessage('Lo siento, hubo un error. Por favor intenta de nuevo.', 'assistant');
        }
      } catch (error) {
        console.error('Error sending message:', error);
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
      
      if (this.messagesContainer) {
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }
    }

    async loadConversationHistory() {
      // Implementation for loading conversation history
      console.log('Loading conversation history...');
    }
  }

  // Auto-initialize widget
  document.addEventListener('DOMContentLoaded', function() {
    console.log('🌿 DOM loaded, initializing Naay Widget...');
    window.NaayWidget = new NaayWidget();
  });

  // Fallback initialization if DOM already loaded
  if (document.readyState === 'loading') {
    // Document still loading, wait for DOMContentLoaded
  } else {
    // Document already loaded
    console.log('🌿 Document ready, initializing Naay Widget immediately...');
    window.NaayWidget = new NaayWidget();
  }

  console.log('✅ Naay Chat: Widget script loaded successfully');
})();