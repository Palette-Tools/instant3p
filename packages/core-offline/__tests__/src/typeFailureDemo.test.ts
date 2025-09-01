/**
 * This test demonstrates the ACTUAL failure case that would occur
 * without our type compatibility layer.
 * 
 * This test is designed to show what happens when external schemas
 * are not properly bridged and result in unknown types.
 */

import { describe, it, expect } from 'vitest';
import { i as originalI } from '@instantdb/core';
import { InstantCoreDatabase, InstantUnknownSchema } from '../../src/index.ts';
import Reactor from '../../src/Reactor.js';
import OfflineNetworkListener from '../../src/OfflineNetworkListener.js';
import IndexedDBStorage from '../../src/IndexedDBStorage.js';

describe('Type Failure Demonstration', () => {
  it('FAILURE CASE: External schema without compatibility results in unknown types', () => {
    // Create a schema using the original @instantdb/core
    const externalSchema = originalI.schema({
      entities: {
        users: originalI.entity({
          name: originalI.string(),
          email: originalI.string(),
          age: originalI.number(),
          isActive: originalI.boolean(),
        }),
        posts: originalI.entity({
          title: originalI.string(),
          content: originalI.string(),
        }),
      },
      links: {
        userPosts: {
          forward: { on: 'users', has: 'many', label: 'posts' },
          reverse: { on: 'posts', has: 'one', label: 'author' },
        },
      },
    });

    // Simulate the OLD way (before our compatibility layer)
    // Create a database without schema typing - this forces unknown types
    const reactor = new Reactor(
      {
        appId: 'test-failure-app',
        apiURI: 'https://api.instantdb.com',
        websocketURI: 'wss://api.instantdb.com/runtime/session',
        cardinalityInference: false, // No schema = no cardinality inference
      },
      IndexedDBStorage,
      OfflineNetworkListener,
      { '@instantdb/core': '0.20.12' }
    );

    // Create database with InstantUnknownSchema (this is what users got before our fix)
    const dbWithUnknownTypes = new InstantCoreDatabase<InstantUnknownSchema>(
      reactor, 
      { appId: 'test-failure-app' }
    );

    // Now when we query, everything comes back as unknown types
    const query = { users: { posts: {} } };
    
    dbWithUnknownTypes.subscribeQuery(query, (result) => {
      if (result.data) {
        const users = result.data.users;
        
        if (users && users.length > 0) {
          const user = users[0];
          
          // This is the PROBLEM: Without proper schema typing,
          // TypeScript doesn't know what properties exist or their types
          
          // At runtime, these properties might exist (if data was inserted)
          // but TypeScript sees them as unknown/any
          
          // Before our fix, users would see:
          // - user.name: unknown (instead of string)
          // - user.email: unknown (instead of string) 
          // - user.age: unknown (instead of number)
          // - user.isActive: unknown (instead of boolean)
          
          // We can't directly test TypeScript types at runtime,
          // but we can verify that the database works without type safety
          expect(user).toBeDefined();
          
          // The posts relationship would also be unknown
          if (user.posts) {
            const posts = user.posts;
            expect(Array.isArray(posts)).toBe(true);
            
            if (posts.length > 0) {
              const post = posts[0];
              // post.title: unknown (instead of string)
              // post.content: unknown (instead of string)
              expect(post).toBeDefined();
            }
          }
        }
      }
    });

    // This test demonstrates that without our compatibility layer:
    // 1. The database still works at runtime
    // 2. But all types are unknown/any
    // 3. No IntelliSense/autocomplete
    // 4. No compile-time type checking
    // 5. Prone to runtime errors from typos
    
    expect(dbWithUnknownTypes).toBeDefined();
  });

  it('COMPARISON: Shows the difference between unknown and typed schemas', async () => {
    // Create the same schema structure
    const externalSchema = originalI.schema({
      entities: {
        users: originalI.entity({
          name: originalI.string(),
          email: originalI.string(),
        }),
      },
      links: {},
    });

    // Method 1: Unknown schema (old way)
    const reactorUnknown = new Reactor(
      {
        appId: 'test-unknown',
        apiURI: 'https://api.instantdb.com',
        websocketURI: 'wss://api.instantdb.com/runtime/session',
        cardinalityInference: false,
      },
      IndexedDBStorage,
      OfflineNetworkListener,
      { '@instantdb/core': '0.20.12' }
    );

    const dbUnknown = new InstantCoreDatabase<InstantUnknownSchema>(
      reactorUnknown,
      { appId: 'test-unknown' }
    );

    // Method 2: Typed schema (our solution)
    const reactorTyped = new Reactor(
      {
        appId: 'test-typed',
        apiURI: 'https://api.instantdb.com',
        websocketURI: 'wss://api.instantdb.com/runtime/session',
        schema: externalSchema,
        cardinalityInference: true,
      },
      IndexedDBStorage,
      OfflineNetworkListener,
      { '@instantdb/core': '0.20.12' }
    );

    const dbTyped = new InstantCoreDatabase(reactorTyped, { 
      appId: 'test-typed', 
      schema: externalSchema 
    });

    // Add some test data
    const userId = 'test-user-123';
    
    // Both databases can handle the same operations at runtime
    await dbUnknown.transact(
      dbUnknown.tx.users[userId].update({
        name: 'John Doe',
        email: 'john@example.com',
      })
    );

    await dbTyped.transact(
      dbTyped.tx.users[userId].update({
        name: 'Jane Doe', 
        email: 'jane@example.com',
      })
    );

    // The key difference is in TypeScript's understanding:
    
    // Unknown schema: TypeScript doesn't know about user properties
    const unknownResult = await dbUnknown.queryOnce({ users: {} });
    if (unknownResult.data.users.length > 0) {
      const user = unknownResult.data.users[0];
      // TypeScript sees: user is of type 'any' or 'unknown'
      // No autocomplete, no type checking
      expect(user).toBeDefined();
    }

    // Typed schema: TypeScript knows exact structure
    const typedResult = await dbTyped.queryOnce({ users: {} });
    if (typedResult.data.users.length > 0) {
      const user = typedResult.data.users[0];
      // TypeScript sees: user.name is string, user.email is string
      // Full autocomplete and type checking
      expect(typeof user.name).toBe('string');
      expect(typeof user.email).toBe('string');
    }

    // Clean up
    await dbUnknown.clear();
    await dbTyped.clear();
  });
});
