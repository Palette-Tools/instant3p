import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Allow tests to run even with unhandled promise rejections
    // (useful for testing offline behavior)
    dangerouslyIgnoreUnhandledErrors: true,
    // Increase timeout for async operations
    testTimeout: 10000,
    // Enable fake timers for setTimeout/setInterval
    fakeTimers: {
      toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval']
    }
  }
}); 