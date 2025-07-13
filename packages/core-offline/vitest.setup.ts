// Global test setup for vitest
import 'fake-indexeddb/auto';

// Only apply MockWebSocket for integration tests
const isIntegrationTest = process.argv.some(arg => 
  arg.includes('integration') || arg.includes('__tests__/integration')
);

// Counter for WebSocket IDs
let wsIdCounter = 0;

// Mock WebSocket for offline testing (only for integration tests)
class MockWebSocket {
  url: string;
  readyState: number;
  onerror: ((error: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  _id: number;

  constructor(url: string) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this._id = wsIdCounter++;
    
    // Simulate connection failure for offline mode
    setTimeout(() => {
      this.readyState = 3; // CLOSED
      if (this.onerror) {
        this.onerror(new Event('error'));
      }
      if (this.onclose) {
        this.onclose(new CloseEvent('close'));
      }
    }, 10);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  send(data: string) {
    // No-op for offline mode
  }
}

// Replace the global WebSocket with our mock (only for integration tests)
if (isIntegrationTest) {
  global.WebSocket = MockWebSocket as any;
}

// Mock BroadcastChannel if not available
if (typeof BroadcastChannel === 'undefined') {
  global.BroadcastChannel = class MockBroadcastChannel {
    constructor(public name: string) {}
    addEventListener() {}
    removeEventListener() {}
    postMessage() {}
    close() {}
  } as any;
}

// Ensure we have a proper window object
if (typeof window !== 'undefined') {
  // jsdom provides window, but we may need to add specific properties
  if (!window.location) {
    window.location = { search: '' } as any;
  }
} 