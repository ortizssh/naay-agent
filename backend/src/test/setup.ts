// Test environment setup - config imported but not used to trigger validation

// Set test environment
process.env.NODE_ENV = 'test';

// Mock environment variables for tests
process.env.SHOPIFY_API_KEY = 'test_api_key';
process.env.SHOPIFY_API_SECRET = 'test_api_secret';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test_anon_key';
process.env.SUPABASE_SERVICE_KEY = 'test_service_key';
process.env.OPENAI_API_KEY = 'test_openai_key';
process.env.JWT_SECRET = 'test_jwt_secret';

// Extend global type for test utilities
declare global {
  // eslint-disable-next-line no-var
  var originalConsoleLog: typeof console.log;
  // eslint-disable-next-line no-var
  var originalConsoleError: typeof console.error;
  // eslint-disable-next-line no-var
  var originalConsoleWarn: typeof console.warn;
}

// Global test setup
beforeAll(() => {
  // Disable console logs during tests unless explicitly needed
  global.originalConsoleLog = console.log;
  global.originalConsoleError = console.error;
  global.originalConsoleWarn = console.warn;

  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore console methods
  console.log = global.originalConsoleLog;
  console.error = global.originalConsoleError;
  console.warn = global.originalConsoleWarn;
});

// Mock fetch globally for tests
global.fetch = jest.fn();

// Mock timers
jest.useFakeTimers();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});
