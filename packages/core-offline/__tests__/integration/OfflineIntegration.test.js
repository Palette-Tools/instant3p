import { test, expect, describe, beforeEach, afterEach } from 'vitest';

import { init } from '../../src/index';
import { i } from '../../src/schema';
import IndexedDBStorage from '../../src/IndexedDBStorage';
import uuid from '../../src/utils/uuid';

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

describe('Offline Integration Tests', () => {
  beforeEach(async () => {
    appId = uuid();
    db = init(
      { appId, schema: testSchema },
      IndexedDBStorage
    );

    // Wait for storage to be loaded
    await db._reactor.querySubs.waitForLoaded();
    await db._reactor.pendingMutations.waitForLoaded();
    
    // Wait for network listener to set offline status
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterEach(async () => {
    if (db) {
      db.shutdown();
    }
  });

  test('initializes successfully in offline mode', async () => {
    expect(db).toBeDefined();
    expect(db._reactor).toBeDefined();
    expect(db._reactor.querySubs).toBeDefined();
    expect(db._reactor.pendingMutations).toBeDefined();
  });

  test('connection status is always offline', async () => {
    // Wait for connection status to be set
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(db._reactor.status).toBe('closed');
    expect(db._reactor._isOnline).toBe(false);
  });

  test('transactions are enqueued in offline mode', async () => {
    const userId = uuid();
    const result = await db.transact([
      db.tx.users[userId].update({ name: 'John', email: 'john@example.com' })
    ]);
    
    expect(result.status).toBe('enqueued');
    expect(result.clientId).toBeDefined();
  });

  test('simple queries work with local data', async () => {
    const userId = uuid();
    
    // Add data locally
    await db.transact([
      db.tx.users[userId].update({ name: 'John', email: 'john@example.com' })
    ]);
    
    // Query the data
    const result = await db.queryOnce({ users: {} });
    
    expect(result.data.users).toHaveLength(1);
    expect(result.data.users[0].name).toBe('John');
    expect(result.data.users[0].email).toBe('john@example.com');
  });

  test('relationship queries work with linked data', async () => {
    const userId = uuid();
    const postId = uuid();
    
    // Add related data
    await db.transact([
      db.tx.users[userId].update({ name: 'John', email: 'john@example.com' }),
      db.tx.posts[postId].update({ title: 'Hello World', content: 'This is a test post' }),
      db.tx.posts[postId].link({ author: userId })
    ]);
    
    // Query with relationships
    const result = await db.queryOnce({
      users: {
        posts: {}
      }
    });
    
    expect(result.data.users).toHaveLength(1);
    expect(result.data.users[0].posts).toHaveLength(1);
    expect(result.data.users[0].posts[0].title).toBe('Hello World');
  });

  test('deep nested relationship queries work', async () => {
    const userId = uuid();
    const postId = uuid();
    
    // Add nested data
    await db.transact([
      db.tx.users[userId].update({ name: 'John', email: 'john@example.com' }),
      db.tx.posts[postId].update({ title: 'Hello World', content: 'This is a test post' }),
      db.tx.posts[postId].link({ author: userId })
    ]);
    
    // Query with deep nesting
    const result = await db.queryOnce({
      posts: {
        author: {
          posts: {}
        }
      }
    });
    
    expect(result.data.posts).toHaveLength(1);
    expect(result.data.posts[0].author.name).toBe('John');
    expect(result.data.posts[0].author.posts).toHaveLength(1);
  });

  test('multiple entities with complex relationships', async () => {
    const user1Id = uuid();
    const user2Id = uuid();
    const post1Id = uuid();
    const post2Id = uuid();
    
    // Add complex data
    await db.transact([
      db.tx.users[user1Id].update({ name: 'John', email: 'john@example.com' }),
      db.tx.users[user2Id].update({ name: 'Jane', email: 'jane@example.com' }),
      db.tx.posts[post1Id].update({ title: 'Post 1', content: 'Content 1' }),
      db.tx.posts[post2Id].update({ title: 'Post 2', content: 'Content 2' }),
      db.tx.posts[post1Id].link({ author: user1Id }),
      db.tx.posts[post2Id].link({ author: user2Id })
    ]);
    
    // Query all data
    const result = await db.queryOnce({
      users: {
        posts: {}
      }
    });
    
    expect(result.data.users).toHaveLength(2);
    expect(result.data.users.find(u => u.name === 'John').posts).toHaveLength(1);
    expect(result.data.users.find(u => u.name === 'Jane').posts).toHaveLength(1);
  });

  test('queryOnce works with cached data', async () => {
    const userId = uuid();
    
    // Add data
    await db.transact([
      db.tx.users[userId].update({ name: 'John', email: 'john@example.com' })
    ]);
    
    // Query once
    const result1 = await db.queryOnce({ users: {} });
    const result2 = await db.queryOnce({ users: {} });
    
    expect(result1.data.users).toHaveLength(1);
    expect(result2.data.users).toHaveLength(1);
    expect(result1.data.users[0].name).toBe('John');
    expect(result2.data.users[0].name).toBe('John');
  });

  test('data persists across database reinitializations', async () => {
    const userId = uuid();
    
    // Add data
    await db.transact([
      db.tx.users[userId].update({ name: 'John', email: 'john@example.com' })
    ]);
    
    // Wait for data to be persisted
    await db._reactor.querySubs.waitForSync();
    await db._reactor.pendingMutations.waitForSync();
    
    // Shutdown and reinitialize
    db.shutdown();
    
    const newDb = init(
      { appId, schema: testSchema },
      IndexedDBStorage
    );
    
    await newDb._reactor.querySubs.waitForLoaded();
    await newDb._reactor.pendingMutations.waitForLoaded();
    
    // Query should return persisted data
    const result = await newDb.queryOnce({ users: {} });
    
    expect(result.data.users).toHaveLength(1);
    expect(result.data.users[0].name).toBe('John');
    
    newDb.shutdown();
  });

  test('subscription updates work when data changes', async () => {
    const userId = uuid();
    let subscriptionResults = [];
    
    // Set up subscription
    const unsub = db.subscribeQuery({ users: {} }, (result) => {
      subscriptionResults.push(result);
    });
    
    // Add data
    await db.transact([
      db.tx.users[userId].update({ name: 'John', email: 'john@example.com' })
    ]);
    
    // Wait a bit for subscription to fire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Update data
    await db.transact([
      db.tx.users[userId].update({ name: 'John Updated' })
    ]);
    
    // Wait a bit for subscription to fire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(subscriptionResults.length).toBeGreaterThan(1);
    
    // Latest result should have updated data
    const latestResult = subscriptionResults[subscriptionResults.length - 1];
    expect(latestResult.data.users[0].name).toBe('John Updated');
    
    unsub();
  });

  test('clear() method removes all local data', async () => {
    const userId = uuid();
    const postId = uuid();
    
    // First add some data
    const transactionResult = await db.transact([
      db.tx.users[userId].update({
        name: 'Test User',
        email: 'test@example.com'
      }),
      db.tx.posts[postId].update({
        title: 'Test Post',
        content: 'Test content'
      }),
      db.tx.posts[postId].link({ author: userId })
    ]);

    expect(transactionResult.status).toBe('enqueued');

    // Verify data exists
    const beforeClear = await db.queryOnce({
      users: {
        posts: {}
      }
    });

    expect(beforeClear.data.users).toHaveLength(1);
    expect(beforeClear.data.users[0].posts).toHaveLength(1);

    // Clear all data
    await db.clear();

    // Verify data is gone
    const afterClear = await db.queryOnce({
      users: {
        posts: {}
      }
    });

    expect(afterClear.data.users).toHaveLength(0);

    // Verify we can add data again after clearing
    const userId2 = uuid();
    const newTransactionResult = await db.transact([
      db.tx.users[userId2].update({
        name: 'New User',
        email: 'new@example.com'
      })
    ]);

    expect(newTransactionResult.status).toBe('enqueued');

    const afterNewData = await db.queryOnce({
      users: {}
    });

    expect(afterNewData.data.users).toHaveLength(1);
    expect(afterNewData.data.users[0].name).toBe('New User');
  });
}); 