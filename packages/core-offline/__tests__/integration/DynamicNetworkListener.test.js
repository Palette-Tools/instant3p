import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { init, DynamicNetworkListener } from '../../src/index';
import { i } from '../../src/schema';
import IndexedDBStorage from '../../src/IndexedDBStorage';
import uuid from '../../src/utils/uuid';

// Mock WebSocket for testing online behavior
class MockWebSocket {
  static instances = [];
  
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this._id = MockWebSocket.instances.length;
    
    MockWebSocket.instances.push(this);
    
    // Simulate connection opening after a brief delay
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen({ target: this });
      }
    }, 10);
  }
  
  send(data) {
    const message = JSON.parse(data);
    
    // Mock response for init
    if (message.op === 'init') {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            target: this,
            data: JSON.stringify({
              op: 'init-ok',
              attrs: [],
              'session-id': 'mock-session-' + this._id
            })
          });
        }
      }, 10);
    }
    
    // Mock response for add-query - more robust structure
    if (message.op === 'add-query') {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            target: this,
            data: JSON.stringify({
              op: 'add-query-ok',
              q: message.q,
              result: [{
                data: {
                  'datalog-result': {
                    'join-rows': []
                  }
                },
                'child-nodes': []
              }],
              'processed-tx-id': 0
            })
          });
        }
      }, 10);
    }
    
    // Mock response for transactions
    if (message.op === 'transact') {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            target: this,
            data: JSON.stringify({
              op: 'transact-ok',
              'client-event-id': message['client-event-id'],
              'processed-tx-id': Date.now()
            })
          });
        }
      }, 10);
    }
  }
  
  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ target: this });
    }
  }
  
  static reset() {
    MockWebSocket.instances = [];
  }
}

// Mock NetworkListener for online testing
class MockNetworkListener {
  static async getIsOnline() {
    return true;
  }
  
  static listen(f) {
    f(true);
    return () => {};
  }
}

let db;
let appId;

const testSchema = i.schema({
  entities: {
    users: i.entity({
      name: i.string(),
      email: i.string(),
    }),
    posts: i.entity({
      title: i.string(),
      content: i.string(),
    }),
  },
  links: {
    authoredPosts: {
      forward: { on: 'posts', label: 'author', has: 'one' },
      reverse: { on: 'users', label: 'posts', has: 'many' }
    }
  }
});

describe('DynamicNetworkListener Integration Tests', () => {
  beforeEach(async () => {
    appId = uuid();
    MockWebSocket.reset();
    
    // Mock WebSocket globally for tests
    global.WebSocket = MockWebSocket;
  });

  afterEach(async () => {
    if (db) {
      db.shutdown();
    }
    MockWebSocket.reset();
  });

  test('initializes in offline mode by default', async () => {
    db = init({
      appId,
      schema: testSchema
    });

    await db._reactor.querySubs.waitForLoaded();
    await db._reactor.pendingMutations.waitForLoaded();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(db._reactor._isOnline).toBe(false);
    expect(db._reactor.status).toBe('closed');
    expect(db.isOnline()).toBe(false);
  });

  test('initializes in offline mode when isOnline is false', async () => {
    db = init({
      appId,
      schema: testSchema,
      isOnline: false
    });

    await db._reactor.querySubs.waitForLoaded();
    await db._reactor.pendingMutations.waitForLoaded();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(db._reactor._isOnline).toBe(false);
    expect(db._reactor.status).toBe('closed');
    expect(db.isOnline()).toBe(false);
    expect(db._dynamicNetworkListener).toBeDefined();
  });

  test('initializes in online mode when isOnline is true', async () => {
    db = init({
      appId,
      schema: testSchema,
      isOnline: true
    });

    await db._reactor.querySubs.waitForLoaded();
    await db._reactor.pendingMutations.waitForLoaded();
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(db._reactor._isOnline).toBe(true);
    expect(db.isOnline()).toBe(true);
    expect(db._dynamicNetworkListener).toBeDefined();
    expect(MockWebSocket.instances.length).toBeGreaterThan(0);
  });

  test('switches from offline to online at runtime', async () => {
    db = init({
      appId,
      schema: testSchema,
      isOnline: false
    });

    await db._reactor.querySubs.waitForLoaded();
    await db._reactor.pendingMutations.waitForLoaded();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Initially offline
    expect(db.isOnline()).toBe(false);
    expect(db._reactor.status).toBe('closed');

    // Switch to online
    db.setOnline(true);
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(db.isOnline()).toBe(true);
    expect(MockWebSocket.instances.length).toBeGreaterThan(0);
  });

  test('switches from online to offline at runtime', async () => {
    db = init({
      appId,
      schema: testSchema,
      isOnline: true
    });

    await db._reactor.querySubs.waitForLoaded();
    await db._reactor.pendingMutations.waitForLoaded();
    await new Promise(resolve => setTimeout(resolve, 200));

    // Initially online
    expect(db.isOnline()).toBe(true);
    expect(MockWebSocket.instances.length).toBeGreaterThan(0);

    // Switch to offline
    db.setOnline(false);
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(db.isOnline()).toBe(false);
    expect(db._reactor.status).toBe('closed');
  });

  test('queries work in both offline and online modes', async () => {
    db = init({
      appId,
      schema: testSchema,
      isOnline: false
    });

    await db._reactor.querySubs.waitForLoaded();
    await db._reactor.pendingMutations.waitForLoaded();
    await new Promise(resolve => setTimeout(resolve, 100));

    const userId = uuid();
    
    // Add data while offline
    await db.transact([
      db.tx.users[userId].update({ name: 'John', email: 'john@example.com' })
    ]);

    // Query while offline
    const offlineResult = await db.queryOnce({ users: {} });
    expect(offlineResult.data.users).toHaveLength(1);
    expect(offlineResult.data.users[0].name).toBe('John');

    // Switch to online
    db.setOnline(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Query while online - data should still be available
    const onlineResult = await db.queryOnce({ users: {} });
    expect(onlineResult.data.users).toHaveLength(1);
    expect(onlineResult.data.users[0].name).toBe('John');

    // Switch back to offline
    db.setOnline(false);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Query while offline again
    const offlineAgainResult = await db.queryOnce({ users: {} });
    expect(offlineAgainResult.data.users).toHaveLength(1);
    expect(offlineAgainResult.data.users[0].name).toBe('John');
  }, 15000);

  test('subscriptions work across mode switches', async () => {
    db = init({
      appId,
      schema: testSchema,
      isOnline: false
    });

    await db._reactor.querySubs.waitForLoaded();
    await db._reactor.pendingMutations.waitForLoaded();
    await new Promise(resolve => setTimeout(resolve, 100));

    const subscriptionResults = [];
    const unsub = db.subscribeQuery({ users: {} }, (result) => {
      subscriptionResults.push(result);
    });

    const userId = uuid();

    // Add data while offline
    await db.transact([
      db.tx.users[userId].update({ name: 'Alice', email: 'alice@example.com' })
    ]);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Switch to online
    db.setOnline(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Add more data while online
    const userId2 = uuid();
    await db.transact([
      db.tx.users[userId2].update({ name: 'Bob', email: 'bob@example.com' })
    ]);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Switch back to offline
    db.setOnline(false);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Add more data while offline again
    const userId3 = uuid();
    await db.transact([
      db.tx.users[userId3].update({ name: 'Charlie', email: 'charlie@example.com' })
    ]);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that subscription received updates throughout all mode switches
    expect(subscriptionResults.length).toBeGreaterThan(0);
    
    const latestResult = subscriptionResults[subscriptionResults.length - 1];
    expect(latestResult.data.users).toHaveLength(3);
    
    const names = latestResult.data.users.map(u => u.name).sort();
    expect(names).toEqual(['Alice', 'Bob', 'Charlie']);

    unsub();
  }, 15000);

  test('multiple mode switches work correctly', async () => {
    db = init({
      appId,
      schema: testSchema,
      isOnline: false
    });

    await db._reactor.querySubs.waitForLoaded();
    await db._reactor.pendingMutations.waitForLoaded();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Rapid switching between modes
    for (let i = 0; i < 5; i++) {
      db.setOnline(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(db.isOnline()).toBe(true);

      db.setOnline(false);
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(db.isOnline()).toBe(false);
    }

    // Database should still be functional
    const userId = uuid();
    await db.transact([
      db.tx.users[userId].update({ name: 'Test User', email: 'test@example.com' })
    ]);

    const result = await db.queryOnce({ users: {} });
    expect(result.data.users).toHaveLength(1);
    expect(result.data.users[0].name).toBe('Test User');
  });

  test('DynamicNetworkListener can be used directly', () => {
    const listener = new DynamicNetworkListener(false);
    
    expect(listener.isOnline).toBe(false);
    
    const callbacks = [];
    const unsub = listener.listen((isOnline) => {
      callbacks.push(isOnline);
    });

    // Should immediately call with current state
    expect(callbacks).toEqual([false]);

    // Switch to online
    listener.setOnline(true);
    expect(listener.isOnline).toBe(true);
    expect(callbacks).toEqual([false, true]);

    // Switch back to offline
    listener.setOnline(false);
    expect(listener.isOnline).toBe(false);
    expect(callbacks).toEqual([false, true, false]);

    unsub();
  });

  test('works with existing NetworkListener parameter', async () => {
    // When NetworkListener is provided, isOnline config should be ignored
    db = init(
      {
        appId,
        schema: testSchema,
        isOnline: true // This should be ignored
      },
      IndexedDBStorage,
      MockNetworkListener // This should take precedence
    );

    await db._reactor.querySubs.waitForLoaded();
    await db._reactor.pendingMutations.waitForLoaded();
    await new Promise(resolve => setTimeout(resolve, 200));

    // Should use MockNetworkListener (which reports online) instead of DynamicNetworkListener
    expect(db._reactor._isOnline).toBe(true);
    expect(db._dynamicNetworkListener).toBeUndefined();
  });

  test('backwards compatibility - no isOnline defaults to OfflineNetworkListener', async () => {
    db = init({
      appId,
      schema: testSchema
      // No isOnline specified
    });

    await db._reactor.querySubs.waitForLoaded();
    await db._reactor.pendingMutations.waitForLoaded();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(db._reactor._isOnline).toBe(false);
    expect(db._dynamicNetworkListener).toBeUndefined();
    expect(db.setOnline).toBeDefined(); // Method exists but won't do anything
    expect(db.isOnline()).toBe(false);
  });
}); 