/**
 * Naay AI Chat Widget
 * Version: 2.1.0 - 2025.11.19
 * Modern Design with Promotional Message
 * 
 * This script creates a modern floating chat widget with promotional message
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
        primaryColor: '#8B5A3C', // Naay natural brown
        secondaryColor: '#F5F1EB', // Naay cream
        accentColor: '#6B8E23', // Naay natural green
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
      console.log('🌿 Initializing Naay Widget v2.1.0 - Modern Design:', new Date().getTime());
      console.log('Shop:', this.config.shopDomain);
      
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
        <div class="naay-widget__promotional-message" id="naay-promotional-message">
          ¿Necesitas ayuda para tu compra? ¡Habla aquí!
          <div class="naay-widget__promotional-arrow"></div>
        </div>
        
        <div class="naay-widget__button" id="naay-widget-button">
          <div class="naay-widget__button-content">
            <span class="naay-widget__icon">${this.config.avatar}</span>
            <span class="naay-widget__close-icon">×</span>
          </div>
          <div class="naay-widget__pulse"></div>
        </div>
        
        <div class="naay-widget__chat" id="naay-widget-chat">
          <div class="naay-widget__header">
            <div class="naay-widget__brand">
              <div class="naay-widget__brand-icon">${this.config.avatar}</div>
              <div class="naay-widget__brand-info">
                <div class="naay-widget__brand-name">${this.config.brandName}</div>
                <div class="naay-widget__brand-tagline">Cosmética Ecológica • Experta en Cuidado Natural</div>
                <div class="naay-widget__status">
                  <span class="naay-widget__status-dot"></span>
                  Asistente IA disponible
                </div>
              </div>
            </div>
            <div class="naay-widget__header-actions">
              <button class="naay-widget__minimize" id="naay-widget-minimize" title="Minimizar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M19 13H5v-2h14v2z" fill="currentColor"/>
                </svg>
              </button>
              <button class="naay-widget__close" id="naay-widget-close" title="Cerrar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                </svg>
              </button>
            </div>
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

      // Add styles
      this.addStyles();

      // Add to page
      document.body.appendChild(this.container);
      
      // Store DOM references
      this.button = document.getElementById('naay-widget-button');
      this.promotionalMessage = document.getElementById('naay-promotional-message');
      this.chat = document.getElementById('naay-widget-chat');
      this.messages = document.getElementById('naay-widget-messages');
      this.input = document.getElementById('naay-widget-input');
      this.sendButton = document.getElementById('naay-widget-send');
      this.minimizeButton = document.getElementById('naay-widget-minimize');
      this.closeButton = document.getElementById('naay-widget-close');
    }

    addStyles() {
      if (document.getElementById('naay-widget-styles')) return;

      const style = document.createElement('style');
      style.id = 'naay-widget-styles';
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        
        .naay-widget {
          position: fixed;
          z-index: 999999;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #2D2D2D;
        }

        .naay-widget--bottom-right {
          bottom: 24px;
          right: 24px;
        }

        .naay-widget--bottom-left {
          bottom: 24px;
          left: 24px;
        }

        .naay-widget--top-right {
          top: 24px;
          right: 24px;
        }

        .naay-widget--top-left {
          top: 24px;
          left: 24px;
        }

        /* Promotional Message */
        .naay-widget__promotional-message {
          position: absolute;
          bottom: 80px;
          right: 0;
          background: linear-gradient(135deg, ${this.config.primaryColor} 0%, #A0672A 100%);
          color: white;
          padding: 12px 16px;
          border-radius: 20px 20px 4px 20px;
          font-weight: 500;
          font-size: 13px;
          line-height: 1.3;
          max-width: 200px;
          box-shadow: 0 4px 16px rgba(139, 90, 60, 0.3);
          opacity: 1;
          transform: translateY(0);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeInUp 0.5s ease-out 2s both, pulse 2s infinite 3s;
          cursor: pointer;
        }

        .naay-widget__promotional-message:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 8px 24px rgba(139, 90, 60, 0.4);
        }

        .naay-widget--open .naay-widget__promotional-message {
          opacity: 0;
          transform: translateY(10px);
          pointer-events: none;
        }

        .naay-widget__promotional-arrow {
          position: absolute;
          bottom: -4px;
          right: 20px;
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 8px solid ${this.config.primaryColor};
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        /* Naay Chat Button */
        .naay-widget__button {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${this.config.primaryColor} 0%, #A0672A 100%);
          border: none;
          cursor: pointer;
          position: relative;
          box-shadow: 0 4px 16px rgba(139, 90, 60, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        .naay-widget__button:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 8px 24px rgba(139, 90, 60, 0.4);
        }

        .naay-widget__button-content {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .naay-widget__pulse {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: ${this.config.primaryColor};
          animation: naayPulse 2s infinite;
          z-index: 1;
        }

        @keyframes naayPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
          100% { transform: scale(1.2); opacity: 0; }
        }

        .naay-widget__icon {
          font-size: 28px;
          transition: all 0.3s ease;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));
        }

        .naay-widget__close-icon {
          position: absolute;
          font-size: 24px;
          opacity: 0;
          transition: all 0.3s ease;
          color: white;
        }

        .naay-widget--open .naay-widget__icon {
          opacity: 0;
          transform: rotate(90deg);
        }

        .naay-widget--open .naay-widget__close-icon {
          opacity: 1;
          transform: rotate(0deg);
        }

        .naay-widget--open .naay-widget__pulse {
          animation: none;
        }

        /* Naay Chat Window */
        .naay-widget__chat {
          position: absolute;
          bottom: 76px;
          right: 0;
          width: 380px;
          height: 520px;
          background: ${this.config.secondaryColor};
          border-radius: 16px;
          box-shadow: 0 12px 32px rgba(139, 90, 60, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1);
          display: none;
          flex-direction: column;
          overflow: hidden;
          backdrop-filter: blur(20px);
          transform: translateY(20px) scale(0.95);
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .naay-widget--bottom-left .naay-widget__chat {
          right: auto;
          left: 0;
        }

        .naay-widget--top-right .naay-widget__chat,
        .naay-widget--top-left .naay-widget__chat {
          bottom: auto;
          top: 76px;
        }

        .naay-widget--open .naay-widget__chat {
          display: flex;
          transform: translateY(0) scale(1);
          opacity: 1;
        }

        /* Naay Header */
        .naay-widget__header {
          background: linear-gradient(135deg, ${this.config.primaryColor} 0%, #A0672A 100%);
          color: white;
          padding: 16px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .naay-widget__header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M30 30c0-11.046 8.954-20 20-20s20 8.954 20 20-8.954 20-20 20-20-8.954-20-20zm0 0c0 11.046-8.954 20-20 20S-10 41.046-10 30s8.954-20 20-20 20 8.954 20 20z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
          pointer-events: none;
        }

        .naay-widget__brand {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          z-index: 2;
        }

        .naay-widget__brand-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .naay-widget__brand-info {
          flex: 1;
        }

        .naay-widget__brand-name {
          font-weight: 600;
          font-size: 18px;
          margin-bottom: 2px;
          letter-spacing: 0.5px;
        }

        .naay-widget__brand-tagline {
          font-size: 11px;
          opacity: 0.9;
          font-weight: 300;
          letter-spacing: 0.3px;
          margin-bottom: 4px;
        }

        .naay-widget__status {
          font-size: 12px;
          opacity: 0.9;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 400;
        }

        .naay-widget__status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${this.config.accentColor};
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .naay-widget__header-actions {
          display: flex;
          gap: 8px;
          position: relative;
          z-index: 2;
        }

        .naay-widget__minimize,
        .naay-widget__close {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: white;
          cursor: pointer;
          padding: 6px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
        }

        .naay-widget__minimize:hover,
        .naay-widget__close:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }

        /* Naay Messages Area */
        .naay-widget__messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: linear-gradient(to bottom, ${this.config.secondaryColor} 0%, #FEFCFA 100%);
        }

        .naay-widget__welcome {
          padding: 20px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(139, 90, 60, 0.1);
          margin-bottom: 12px;
          box-shadow: 0 4px 16px rgba(139, 90, 60, 0.05);
        }

        .naay-widget__welcome-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .naay-widget__welcome-icon {
          font-size: 28px;
          background: linear-gradient(135deg, ${this.config.primaryColor} 0%, #A0672A 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .naay-widget__welcome-title {
          font-size: 16px;
          font-weight: 600;
          color: ${this.config.primaryColor};
          margin: 0;
        }

        .naay-widget__welcome-message {
          color: #5D4037;
          font-size: 14px;
          line-height: 1.5;
          font-weight: 400;
          margin-bottom: 16px;
          text-align: left;
        }

        .naay-widget__welcome-features {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .naay-widget__feature {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: #666;
          padding: 6px 0;
        }

        .naay-widget__feature-icon {
          font-size: 16px;
          width: 20px;
          text-align: center;
        }

        .naay-widget__message {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          max-width: 85%;
          animation: messageSlideIn 0.3s ease-out;
        }

        @keyframes messageSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .naay-widget__message--user {
          flex-direction: row-reverse;
          align-self: flex-end;
        }

        .naay-widget__message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, #E8DDD4 0%, #D7C7B7 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
          border: 1px solid rgba(139, 90, 60, 0.2);
        }

        .naay-widget__message--user .naay-widget__message-avatar {
          background: linear-gradient(135deg, ${this.config.primaryColor} 0%, #A0672A 100%);
          color: white;
        }

        .naay-widget__message-content {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(139, 90, 60, 0.1);
          border-radius: 16px;
          padding: 12px 16px;
          font-size: 14px;
          line-height: 1.5;
          color: #5D4037;
          position: relative;
          box-shadow: 0 2px 8px rgba(139, 90, 60, 0.08);
        }

        .naay-widget__message--user .naay-widget__message-content {
          background: linear-gradient(135deg, ${this.config.primaryColor} 0%, #A0672A 100%);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 2px 8px rgba(139, 90, 60, 0.15);
        }

        /* Naay Input Area */
        .naay-widget__input-area {
          border-top: 1px solid rgba(139, 90, 60, 0.1);
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          padding: 16px;
        }

        .naay-widget__input-container {
          display: flex;
          gap: 10px;
          align-items: flex-end;
          background: white;
          border-radius: 24px;
          padding: 6px;
          border: 1px solid rgba(139, 90, 60, 0.2);
          box-shadow: 0 2px 8px rgba(139, 90, 60, 0.05);
          transition: all 0.2s ease;
        }

        .naay-widget__input-container:focus-within {
          border-color: ${this.config.primaryColor};
          box-shadow: 0 0 0 3px rgba(139, 90, 60, 0.1);
        }

        .naay-widget__input {
          flex: 1;
          border: none;
          border-radius: 20px;
          padding: 10px 16px;
          font-size: 14px;
          outline: none;
          font-family: inherit;
          background: transparent;
          color: #2D2D2D;
          resize: none;
          line-height: 1.4;
        }

        .naay-widget__input::placeholder {
          color: #8E8E8E;
        }

        .naay-widget__send {
          background: linear-gradient(135deg, ${this.config.primaryColor} 0%, #A0672A 100%);
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(139, 90, 60, 0.2);
          flex-shrink: 0;
        }

        .naay-widget__send:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(139, 90, 60, 0.3);
        }

        .naay-widget__send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .naay-widget__powered {
          text-align: center;
          font-size: 11px;
          color: #8E8E8E;
          margin-top: 8px;
          font-weight: 300;
        }

        /* Mobile Responsiveness */
        @media (max-width: 480px) {
          .naay-widget__chat {
            width: calc(100vw - 32px);
            height: calc(100vh - 120px);
            max-height: 600px;
          }

          .naay-widget--bottom-right,
          .naay-widget--bottom-left {
            bottom: 16px;
            left: 16px;
            right: 16px;
          }

          .naay-widget--bottom-right .naay-widget__chat,
          .naay-widget--bottom-left .naay-widget__chat {
            right: 0;
            left: 0;
            bottom: 72px;
          }

          .naay-widget__button {
            width: 56px;
            height: 56px;
          }

          .naay-widget__icon {
            font-size: 24px;
          }

          .naay-widget__brand-name {
            font-size: 16px;
          }

          .naay-widget__brand-tagline {
            font-size: 10px;
          }

          .naay-widget__input-container {
            padding: 4px;
          }

          .naay-widget__input {
            padding: 8px 12px;
            font-size: 16px; /* Prevent zoom on iOS */
          }

          .naay-widget__send {
            width: 36px;
            height: 36px;
          }
        }

        /* Tablet Adjustments */
        @media (max-width: 768px) and (min-width: 481px) {
          .naay-widget__chat {
            width: 360px;
            height: 480px;
          }
        }

        /* Improved Scrollbar Styling */
        .naay-widget__messages::-webkit-scrollbar {
          width: 4px;
        }

        .naay-widget__messages::-webkit-scrollbar-track {
          background: rgba(139, 90, 60, 0.1);
          border-radius: 2px;
        }

        .naay-widget__messages::-webkit-scrollbar-thumb {
          background: rgba(139, 90, 60, 0.3);
          border-radius: 2px;
        }

        .naay-widget__messages::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 90, 60, 0.5);
        }
      `;

      document.head.appendChild(style);
    }

    addEventListeners() {
      // Toggle widget open/close
      this.button.addEventListener('click', () => {
        this.toggle();
      });

      // Promotional message click
      if (this.promotionalMessage) {
        this.promotionalMessage.addEventListener('click', () => {
          this.open();
        });
      }

      // Minimize button
      this.minimizeButton.addEventListener('click', () => {
        this.close();
      });

      // Close button
      if (this.closeButton) {
        this.closeButton.addEventListener('click', () => {
          this.close();
        });
      }

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
        // Provide fallback responses for better user experience
        const fallbackResponse = this.getFallbackResponse(text);
        this.addMessage(fallbackResponse, 'bot');
      } finally {
        // Re-enable send button
        this.sendButton.disabled = false;
      }
    }

    getFallbackResponse(userMessage) {
      const message = userMessage.toLowerCase();
      
      // Naay-specific fallback responses
      const fallbackResponses = {
        // Productos y cuidado de piel
        productos: [
          '🌿 En Naay ofrecemos una línea completa de cosmética ecológica funcional. ¿Te interesa algún tipo específico de producto para el cuidado de la piel?',
          '✨ Nuestros productos están formulados con ingredientes naturales y orgánicos. ¿Qué tipo de piel tienes para recomendarte lo mejor?'
        ],
        piel: [
          '🌱 Para el cuidado de la piel, Naay ofrece productos específicos según tu tipo de piel. ¿Tienes piel grasa, seca, mixta o sensible?',
          '💚 Nuestros productos de cuidado facial están hechos con ingredientes naturales. ¿Buscas algo específico como limpieza, hidratación o anti-edad?'
        ],
        precio: [
          '💰 Nuestros precios varían según el producto. Puedes explorar nuestra tienda para ver toda la información detallada de cada producto.',
          '🛍️ Te invito a navegar por nuestros productos para conocer precios y ofertas especiales que tenemos disponibles.'
        ],
        envio: [
          '📦 Ofrecemos diferentes opciones de envío. Para información específica sobre tiempos y costos, te recomiendo revisar nuestra página de envíos.',
          '🚚 Los envíos se procesan rápidamente. Puedes ver las opciones disponibles durante el proceso de compra.'
        ],
        natural: [
          '🌿 ¡Exacto! Todos nuestros productos son de cosmética ecológica funcional, formulados con ingredientes naturales y sostenibles.',
          '🌱 En Naay nos enfocamos en ingredientes naturales y procesos ecológicos para cuidar tu piel y el medio ambiente.'
        ],
        ayuda: [
          '😊 ¡Estoy aquí para ayudarte! Puedes preguntarme sobre nuestros productos, cuidado de la piel, o cualquier duda sobre Naay.',
          '💚 ¿En qué puedo ayudarte? Puedo orientarte sobre productos, rutinas de cuidado o cualquier consulta sobre Naay.'
        ]
      };
      
      // Check for keywords and provide relevant responses
      for (const [keyword, responses] of Object.entries(fallbackResponses)) {
        if (message.includes(keyword)) {
          return responses[Math.floor(Math.random() * responses.length)];
        }
      }
      
      // Generic helpful responses
      const genericResponses = [
        '🌿 ¡Hola! Aunque tengo algunos problemas de conexión, estoy aquí para ayudarte con Naay. ¿Te interesa conocer sobre nuestros productos de cosmética ecológica?',
        '💚 Temporalmente estoy en modo offline, pero puedo contarte que Naay ofrece productos naturales para el cuidado de la piel. ¿Qué te gustaría saber?',
        '✨ Estoy experimentando algunas dificultades técnicas, pero puedo ayudarte con información básica sobre Naay. ¿Buscas algo específico para el cuidado de tu piel?',
        '🌱 Aunque mi conexión está limitada, puedo compartir que en Naay nos especializamos en cosmética ecológica funcional. ¿Qué tipo de producto te interesa?'
      ];
      
      return genericResponses[Math.floor(Math.random() * genericResponses.length)];
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