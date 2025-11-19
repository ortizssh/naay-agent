/**
 * Naay AI Chat Widget
 * Version: 1.0.0
 * 
 * This script creates a floating chat widget for Shopify stores
 */

(function() {
  'use strict';

  // Prevent multiple widget loads
  if (window.NaayWidget) {
    console.warn('Naay Widget already loaded');
    return;
  }

  class NaayWidget {
    constructor(config = {}) {
      this.config = {
        shopDomain: '',
        apiEndpoint: 'https://naay-agent-app1763504937.azurewebsites.net',
        position: 'bottom-right',
        primaryColor: '#008060',
        greeting: '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
        placeholder: 'Escribe tu mensaje...',
        theme: 'auto',
        avatar: '🤖',
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
      console.log('Initializing Naay Widget for shop:', this.config.shopDomain);
      
      // Load settings from server
      this.loadSettings().then(() => {
        this.createWidget();
        this.addEventListeners();
        this.loadConversationHistory();
      }).catch(error => {
        console.error('Failed to load widget settings, using defaults:', error);
        this.createWidget();
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
      
      // Create widget HTML
      this.container.innerHTML = `
        <div class="naay-widget__button" id="naay-widget-button">
          <span class="naay-widget__icon">${this.config.avatar}</span>
          <span class="naay-widget__close-icon">×</span>
        </div>
        
        <div class="naay-widget__chat" id="naay-widget-chat">
          <div class="naay-widget__header">
            <div class="naay-widget__title">
              <span class="naay-widget__avatar">${this.config.avatar}</span>
              <div>
                <div class="naay-widget__name">Naay Assistant</div>
                <div class="naay-widget__status">En línea</div>
              </div>
            </div>
            <button class="naay-widget__minimize" id="naay-widget-minimize">−</button>
          </div>
          
          <div class="naay-widget__messages" id="naay-widget-messages">
            <div class="naay-widget__message naay-widget__message--bot">
              <div class="naay-widget__message-avatar">${this.config.avatar}</div>
              <div class="naay-widget__message-content">${this.config.greeting}</div>
            </div>
          </div>
          
          <div class="naay-widget__input-area">
            <div class="naay-widget__input-container">
              <input type="text" id="naay-widget-input" class="naay-widget__input" placeholder="${this.config.placeholder}">
              <button class="naay-widget__send" id="naay-widget-send">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;

      // Add styles
      this.addStyles();

      // Add to page
      document.body.appendChild(this.container);
      
      // Store DOM references
      this.button = document.getElementById('naay-widget-button');
      this.chat = document.getElementById('naay-widget-chat');
      this.messages = document.getElementById('naay-widget-messages');
      this.input = document.getElementById('naay-widget-input');
      this.sendButton = document.getElementById('naay-widget-send');
      this.minimizeButton = document.getElementById('naay-widget-minimize');
    }

    addStyles() {
      if (document.getElementById('naay-widget-styles')) return;

      const style = document.createElement('style');
      style.id = 'naay-widget-styles';
      style.textContent = `
        .naay-widget {
          position: fixed;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.4;
        }

        .naay-widget--bottom-right {
          bottom: 20px;
          right: 20px;
        }

        .naay-widget--bottom-left {
          bottom: 20px;
          left: 20px;
        }

        .naay-widget--top-right {
          top: 20px;
          right: 20px;
        }

        .naay-widget--top-left {
          top: 20px;
          left: 20px;
        }

        .naay-widget__button {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${this.config.primaryColor};
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: all 0.3s ease;
          position: relative;
        }

        .naay-widget__button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(0,0,0,0.25);
        }

        .naay-widget__icon {
          font-size: 24px;
          transition: opacity 0.2s ease;
        }

        .naay-widget__close-icon {
          position: absolute;
          font-size: 24px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .naay-widget--open .naay-widget__icon {
          opacity: 0;
        }

        .naay-widget--open .naay-widget__close-icon {
          opacity: 1;
        }

        .naay-widget__chat {
          position: absolute;
          bottom: 70px;
          right: 0;
          width: 350px;
          height: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          display: none;
          flex-direction: column;
          overflow: hidden;
        }

        .naay-widget--bottom-left .naay-widget__chat {
          right: auto;
          left: 0;
        }

        .naay-widget--top-right .naay-widget__chat,
        .naay-widget--top-left .naay-widget__chat {
          bottom: auto;
          top: 70px;
        }

        .naay-widget--open .naay-widget__chat {
          display: flex;
        }

        .naay-widget__header {
          background: ${this.config.primaryColor};
          color: white;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .naay-widget__title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .naay-widget__avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .naay-widget__name {
          font-weight: 600;
          font-size: 15px;
        }

        .naay-widget__status {
          font-size: 12px;
          opacity: 0.9;
        }

        .naay-widget__minimize {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .naay-widget__messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .naay-widget__message {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .naay-widget__message--user {
          flex-direction: row-reverse;
        }

        .naay-widget__message-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }

        .naay-widget__message--user .naay-widget__message-avatar {
          background: ${this.config.primaryColor};
          color: white;
        }

        .naay-widget__message-content {
          background: #f5f5f5;
          padding: 10px 12px;
          border-radius: 12px;
          max-width: 250px;
          word-wrap: break-word;
        }

        .naay-widget__message--user .naay-widget__message-content {
          background: ${this.config.primaryColor};
          color: white;
        }

        .naay-widget__input-area {
          padding: 16px;
          border-top: 1px solid #eee;
        }

        .naay-widget__input-container {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .naay-widget__input {
          flex: 1;
          border: 1px solid #ddd;
          border-radius: 20px;
          padding: 10px 16px;
          outline: none;
          font-size: 14px;
        }

        .naay-widget__input:focus {
          border-color: ${this.config.primaryColor};
        }

        .naay-widget__send {
          background: ${this.config.primaryColor};
          color: white;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s ease;
        }

        .naay-widget__send:hover {
          opacity: 0.9;
        }

        .naay-widget__send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Mobile responsiveness */
        @media (max-width: 480px) {
          .naay-widget__chat {
            width: calc(100vw - 40px);
            height: calc(100vh - 140px);
          }

          .naay-widget--bottom-right,
          .naay-widget--bottom-left {
            bottom: 20px;
            left: 20px;
            right: 20px;
          }

          .naay-widget--bottom-right .naay-widget__chat,
          .naay-widget--bottom-left .naay-widget__chat {
            right: 0;
            left: 0;
          }
        }

        /* Dark theme support */
        @media (prefers-color-scheme: dark) {
          .naay-widget__chat {
            background: #2d2d2d;
            color: #ffffff;
          }

          .naay-widget__input-area {
            border-top-color: #444;
          }

          .naay-widget__input {
            background: #3d3d3d;
            border-color: #555;
            color: #ffffff;
          }

          .naay-widget__message-content {
            background: #3d3d3d;
            color: #ffffff;
          }

          .naay-widget__message-avatar {
            background: #444;
            color: #ffffff;
          }
        }
      `;

      document.head.appendChild(style);
    }

    addEventListeners() {
      // Toggle widget open/close
      this.button.addEventListener('click', () => {
        this.toggle();
      });

      // Minimize button
      this.minimizeButton.addEventListener('click', () => {
        this.close();
      });

      // Send message on Enter key
      this.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Send button click
      this.sendButton.addEventListener('click', () => {
        this.sendMessage();
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (this.isOpen && !this.container.contains(e.target)) {
          this.close();
        }
      });

      // Escape key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });
    }

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    open() {
      this.isOpen = true;
      this.container.classList.add('naay-widget--open');
      this.input.focus();
    }

    close() {
      this.isOpen = false;
      this.container.classList.remove('naay-widget--open');
    }

    async sendMessage() {
      const text = this.input.value.trim();
      if (!text) return;

      // Clear input
      this.input.value = '';

      // Add user message to UI
      this.addMessage(text, 'user');

      // Disable send button while processing
      this.sendButton.disabled = true;

      try {
        // Send to API
        const response = await fetch(`${this.config.apiEndpoint}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text,
            shop: this.config.shopDomain,
            conversationId: this.conversationId,
            context: this.config.context
          })
        });

        const data = await response.json();

        if (data.success) {
          // Add bot response
          this.addMessage(data.data.response, 'bot');
          
          // Update conversation ID
          if (data.data.conversationId) {
            this.conversationId = data.data.conversationId;
          }

          // Save conversation to localStorage
          this.saveConversation();
        } else {
          this.addMessage('Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.', 'bot');
        }
      } catch (error) {
        console.error('Chat API error:', error);
        this.addMessage('No pude conectarme al servidor. Por favor verifica tu conexión e intenta de nuevo.', 'bot');
      } finally {
        // Re-enable send button
        this.sendButton.disabled = false;
      }
    }

    addMessage(text, type) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `naay-widget__message naay-widget__message--${type}`;

      const avatar = document.createElement('div');
      avatar.className = 'naay-widget__message-avatar';
      avatar.textContent = type === 'bot' ? this.config.avatar : '👤';

      const content = document.createElement('div');
      content.className = 'naay-widget__message-content';
      content.textContent = text;

      messageDiv.appendChild(avatar);
      messageDiv.appendChild(content);

      this.messages.appendChild(messageDiv);

      // Scroll to bottom
      this.messages.scrollTop = this.messages.scrollHeight;

      // Store message
      this.messageHistory = this.messageHistory || [];
      this.messageHistory.push({ text, type, timestamp: Date.now() });
    }

    saveConversation() {
      if (!this.conversationId) return;

      const conversationData = {
        id: this.conversationId,
        messages: this.messageHistory,
        shop: this.config.shopDomain,
        lastUpdate: Date.now()
      };

      localStorage.setItem(`naay-conversation-${this.config.shopDomain}`, JSON.stringify(conversationData));
    }

    loadConversationHistory() {
      try {
        const saved = localStorage.getItem(`naay-conversation-${this.config.shopDomain}`);
        if (saved) {
          const data = JSON.parse(saved);
          
          // Only load if conversation is recent (within 24 hours)
          if (Date.now() - data.lastUpdate < 24 * 60 * 60 * 1000) {
            this.conversationId = data.id;
            this.messageHistory = data.messages || [];
            
            // Restore messages (skip the initial greeting)
            this.messages.innerHTML = `
              <div class="naay-widget__message naay-widget__message--bot">
                <div class="naay-widget__message-avatar">${this.config.avatar}</div>
                <div class="naay-widget__message-content">${this.config.greeting}</div>
              </div>
            `;
            
            data.messages.forEach(msg => {
              this.addMessage(msg.text, msg.type);
            });
          }
        }
      } catch (error) {
        console.warn('Could not load conversation history:', error);
      }
    }
  }

  // Expose to global scope
  window.NaayWidget = NaayWidget;

  // Auto-initialize if config is already available
  if (window.NaayConfig) {
    new NaayWidget(window.NaayConfig);
  }

})();