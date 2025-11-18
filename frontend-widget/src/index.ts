import { NaayWidget } from './widget';
import { WidgetConfig } from './types';

// Export main class and types
export { NaayWidget } from './widget';
export * from './types';
export { ChatAPI, CartUtils, BrowserUtils } from './api';

// Default export
export default NaayWidget;

// Initialize widget if running in browser with config
if (typeof window !== 'undefined') {
  // Make available globally
  (window as any).NaayWidget = NaayWidget;

  // Helper function for easy initialization
  (window as any).initNaayWidget = (config: WidgetConfig) => {
    return new NaayWidget(config);
  };
}
