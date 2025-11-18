import { ChatAPI, CartUtils, BrowserUtils } from './api';
import { ChatMessage, WidgetConfig, WidgetState, ChatSession } from './types';
import './styles.css';

export class NaayWidget {
  private config: WidgetConfig;
  private api: ChatAPI;
  private state: WidgetState;
  private container!: HTMLElement;
  private elements: {
    fab?: HTMLElement;
    chatWindow?: HTMLElement;
    messagesContainer?: HTMLElement;
    input?: HTMLTextAreaElement;
    sendButton?: HTMLElement;
  } = {};

  private resizeObserver?: ResizeObserver;
  private typingTimeout?: NodeJS.Timeout;

  constructor(config: WidgetConfig) {
    this.config = this.validateAndNormalizeConfig(config);
    this.api = new ChatAPI(this.config);

    this.state = {
      isOpen: false,
      isMinimized: false,
      isLoading: false,
      messages: [],
      currentInput: '',
      sessionId: null,
      cartId: CartUtils.getCartId(),
      hasUnread: false,
    };

    this.init();
  }

  private validateAndNormalizeConfig(config: WidgetConfig): WidgetConfig {
    if (!config.shopDomain) {
      throw new Error('shopDomain is required');
    }

    if (!config.apiEndpoint) {
      throw new Error('apiEndpoint is required');
    }

    return {
      position: 'bottom-right',
      primaryColor: '#007bff',
      greeting: 'Hi! How can I help you today?',
      placeholder: 'Type your message...',
      theme: 'auto',
      language: 'en',
      ...config,
    };
  }

  private async init(): Promise<void> {
    try {
      // Create container
      this.createContainer();

      // Create UI elements
      this.createFloatingButton();
      this.createChatWindow();

      // Set up event listeners
      this.setupEventListeners();

      // Apply theme
      this.applyTheme();

      // Initialize session
      await this.initializeSession();

      // Add to DOM
      document.body.appendChild(this.container);

      console.log('Naay Widget initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Naay Widget:', error);
    }
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.className = `naay-widget position-${this.config.position}`;
    this.container.setAttribute(
      'data-theme',
      this.config.theme === 'auto'
        ? BrowserUtils.detectTheme()
        : this.config.theme || 'light'
    );

    if (this.config.customCSS) {
      const style = document.createElement('style');
      style.textContent = this.config.customCSS;
      this.container.appendChild(style);
    }

    BrowserUtils.addAccessibilityAttributes(this.container);
  }

  private createFloatingButton(): void {
    const fab = document.createElement('button');
    fab.className = 'naay-fab';
    fab.setAttribute('aria-label', 'Open chat');
    fab.innerHTML = `
      <svg class="naay-fab-icon" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
      </svg>
    `;

    fab.addEventListener('click', () => this.toggleChat());

    this.container.appendChild(fab);
    this.elements.fab = fab;
  }

  private createChatWindow(): void {
    const chatWindow = document.createElement('div');
    chatWindow.className = 'naay-chat-window';

    chatWindow.innerHTML = `
      <div class="naay-chat-header">
        <div class="naay-chat-title">
          <div class="naay-chat-avatar">${this.config.avatar || 'AI'}</div>
          <span>Support Assistant</span>
        </div>
        <div class="naay-chat-controls">
          <button class="naay-chat-control" aria-label="Minimize" data-action="minimize">
            <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
          </button>
          <button class="naay-chat-control" aria-label="Close" data-action="close">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      </div>
      <div class="naay-chat-messages" role="log" aria-live="polite"></div>
      <div class="naay-chat-input">
        <div class="naay-input-container">
          <textarea 
            class="naay-input" 
            placeholder="${this.config.placeholder || 'Type your message...'}"
            rows="1"
            aria-label="Type your message"
          ></textarea>
          <button class="naay-send-button" aria-label="Send message" disabled>
            <svg viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(chatWindow);
    this.elements.chatWindow = chatWindow;
    this.elements.messagesContainer = chatWindow.querySelector(
      '.naay-chat-messages'
    )!;
    this.elements.input = chatWindow.querySelector(
      '.naay-input'
    ) as HTMLTextAreaElement;
    this.elements.sendButton = chatWindow.querySelector('.naay-send-button')!;
  }

  private setupEventListeners(): void {
    // Chat controls
    this.elements.chatWindow?.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action]') as HTMLElement;

      if (button) {
        const action = button.getAttribute('data-action');
        if (action === 'close') {
          this.closeChat();
        } else if (action === 'minimize') {
          this.toggleMinimize();
        }
      }
    });

    // Input handling
    if (this.elements.input) {
      this.elements.input.addEventListener(
        'input',
        this.handleInputChange.bind(this)
      );
      this.elements.input.addEventListener(
        'keydown',
        this.handleKeyDown.bind(this)
      );
    }

    // Send button
    this.elements.sendButton?.addEventListener(
      'click',
      this.sendMessage.bind(this)
    );

    // Auto-resize textarea
    if (this.elements.input) {
      this.resizeObserver = new ResizeObserver(() => {
        this.adjustTextareaHeight();
      });
      this.resizeObserver.observe(this.elements.input);
    }

    // Theme change detection
    if (this.config.theme === 'auto') {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', e => {
          this.container.setAttribute(
            'data-theme',
            e.matches ? 'dark' : 'light'
          );
        });
    }

    // Page visibility for unread management
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.state.isOpen) {
        this.markAsRead();
      }
    });
  }

  private handleInputChange(): void {
    if (!this.elements.input) return;

    const value = this.elements.input.value.trim();
    this.state.currentInput = value;

    // Update send button state
    const canSend = value.length > 0 && !this.state.isLoading;
    this.elements.sendButton!.toggleAttribute('disabled', !canSend);

    // Auto-resize
    this.adjustTextareaHeight();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  private adjustTextareaHeight(): void {
    if (!this.elements.input) return;

    this.elements.input.style.height = 'auto';
    const scrollHeight = Math.min(this.elements.input.scrollHeight, 80);
    this.elements.input.style.height = scrollHeight + 'px';
  }

  private async initializeSession(): Promise<void> {
    try {
      const customerId = CartUtils.getCustomerId();
      const cartId = this.state.cartId;

      const session = await this.api.createSession(customerId || undefined, cartId || undefined);
      this.state.sessionId = session.id;

      // Show welcome message
      this.addMessage({
        id: 'welcome',
        role: 'assistant',
        content: this.config.greeting || 'Hi! How can I help you today?',
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to initialize session:', error);
      this.addMessage({
        id: 'error',
        role: 'system',
        content: 'Unable to connect to support. Please try again later.',
        timestamp: new Date(),
      });
    }
  }

  private async sendMessage(): Promise<void> {
    if (
      !this.state.currentInput.trim() ||
      this.state.isLoading ||
      !this.state.sessionId
    ) {
      return;
    }

    const messageText = this.state.currentInput.trim();
    this.state.currentInput = '';
    this.elements.input!.value = '';
    this.handleInputChange();

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    this.addMessage(userMessage);
    this.showTypingIndicator();
    this.setLoading(true);

    try {
      const response = await this.api.sendMessage(
        messageText,
        this.state.sessionId,
        this.state.cartId || undefined
      );

      this.hideTypingIndicator();

      if (response.success && response.data.messages.length > 0) {
        // Add assistant messages
        response.data.messages.forEach((content, index) => {
          const assistantMessage: ChatMessage = {
            id: (Date.now() + index).toString(),
            role: 'assistant',
            content,
            timestamp: new Date(),
            metadata: response.data.metadata,
          };
          this.addMessage(assistantMessage);
        });

        // Handle actions (cart updates, etc.)
        if (response.data.actions && response.data.actions.length > 0) {
          this.handleActions(response.data.actions);
        }
      } else {
        throw new Error(response.error || 'No response received');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.hideTypingIndicator();

      this.addMessage({
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      });
    } finally {
      this.setLoading(false);
    }
  }

  private addMessage(message: ChatMessage): void {
    this.state.messages.push(message);
    this.renderMessage(message);
    this.scrollToBottom();

    // Mark as unread if chat is closed
    if (!this.state.isOpen && message.role === 'assistant') {
      this.markAsUnread();
    }
  }

  private renderMessage(message: ChatMessage): void {
    if (!this.elements.messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = `naay-message ${message.role} naay-fade-in`;
    messageElement.setAttribute('data-message-id', message.id);

    // Format content (basic markdown support)
    let content = message.content;
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
    content = content.replace(/\n/g, '<br>');

    messageElement.innerHTML = content;

    this.elements.messagesContainer.appendChild(messageElement);
  }

  private showTypingIndicator(): void {
    if (!this.elements.messagesContainer) return;

    const typingElement = document.createElement('div');
    typingElement.className = 'naay-typing';
    typingElement.setAttribute('data-typing', 'true');
    typingElement.innerHTML = `
      <div class="naay-typing-dot"></div>
      <div class="naay-typing-dot"></div>
      <div class="naay-typing-dot"></div>
    `;

    this.elements.messagesContainer.appendChild(typingElement);
    this.scrollToBottom();
  }

  private hideTypingIndicator(): void {
    const typing =
      this.elements.messagesContainer?.querySelector('[data-typing]');
    if (typing) {
      typing.remove();
    }
  }

  private handleActions(actions: any[]): void {
    actions.forEach(action => {
      switch (action.type) {
        case 'cart.add':
          // Update cart ID if provided
          if (action.params.cartId) {
            this.state.cartId = action.params.cartId;
            CartUtils.setCartId(action.params.cartId);
          }
          console.log('Cart action executed:', action);
          break;
        default:
          console.log('Unknown action:', action);
      }
    });
  }

  private scrollToBottom(): void {
    if (this.elements.messagesContainer) {
      this.elements.messagesContainer.scrollTop =
        this.elements.messagesContainer.scrollHeight;
    }
  }

  private setLoading(loading: boolean): void {
    this.state.isLoading = loading;
    this.elements.sendButton?.toggleAttribute(
      'disabled',
      loading || !this.state.currentInput.trim()
    );
  }

  private toggleChat(): void {
    if (this.state.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  private openChat(): void {
    this.state.isOpen = true;
    this.state.isMinimized = false;

    this.elements.chatWindow?.classList.add('open');
    this.elements.fab?.classList.add('open');

    // Focus input
    setTimeout(() => {
      this.elements.input?.focus();
    }, 300);

    this.markAsRead();
  }

  private closeChat(): void {
    this.state.isOpen = false;

    this.elements.chatWindow?.classList.remove('open');
    this.elements.fab?.classList.remove('open');
  }

  private toggleMinimize(): void {
    this.state.isMinimized = !this.state.isMinimized;
    this.elements.chatWindow?.classList.toggle('minimized');
  }

  private markAsUnread(): void {
    this.state.hasUnread = true;
    this.elements.fab?.classList.add('has-unread');
  }

  private markAsRead(): void {
    this.state.hasUnread = false;
    this.elements.fab?.classList.remove('has-unread');
  }

  private applyTheme(): void {
    if (this.config.primaryColor) {
      this.container.style.setProperty(
        '--naay-primary',
        this.config.primaryColor
      );
    }
  }

  // Public API
  public destroy(): void {
    this.resizeObserver?.disconnect();
    this.container.remove();
  }

  public open(): void {
    this.openChat();
  }

  public close(): void {
    this.closeChat();
  }

  public sendProgrammaticMessage(message: string): void {
    if (this.state.sessionId) {
      this.state.currentInput = message;
      this.elements.input!.value = message;
      this.handleInputChange();
      this.sendMessage();
    }
  }

  public getState(): WidgetState {
    return { ...this.state };
  }
}

// Auto-initialize if config is provided globally
if (typeof window !== 'undefined') {
  // Export for global access
  (window as any).NaayWidget = NaayWidget;

  // Auto-initialize if config exists
  if ((window as any).NaayConfig) {
    new NaayWidget((window as any).NaayConfig);
  }
}
