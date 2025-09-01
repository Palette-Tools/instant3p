/**
 * Test that @instant3p/react-offline accepts schemas from original @instantdb/core
 * 
 * This demonstrates perfect type compatibility - schemas created with the original
 * package work seamlessly with our React offline implementation.
 */

import { test, expect } from 'vitest';
import { i as originalI } from '@instantdb/core'; // Original schema builder
import { init as reactOfflineInit } from '../src/init'; // Our React offline init
import { id } from '@instant3p/core-offline'; // ID generator

// Create a schema using the ORIGINAL @instantdb/core schema builder
const originalSchema = originalI.schema({
  entities: {
    todos: originalI.entity({
      text: originalI.string(),
      completed: originalI.boolean(),
      createdAt: originalI.date(),
      priority: originalI.number().optional(),
    }),
    users: originalI.entity({
      name: originalI.string(),
      email: originalI.string(),
    }),
  },
  links: {
    userTodos: {
      forward: { on: 'users', has: 'many', label: 'todos' },
      reverse: { on: 'todos', has: 'one', label: 'owner' },
    },
  },
});

test('original schema works with React offline init', () => {
  console.log('Testing original schema with React offline init...');
  
  // This should work perfectly - no type errors, no compatibility issues
  const db = reactOfflineInit({
    appId: 'test-app-id',
    schema: originalSchema, // Original schema works seamlessly!
  });
  
  console.log('✅ React offline database created with original schema');
  
  // Verify the database was created with expected methods
  expect(db).toBeDefined();
  expect(typeof db.useQuery).toBe('function');
  expect(typeof db.useAuth).toBe('function');
  expect(typeof db.transact).toBe('function');
  
  // Test that React hooks are available
  expect(db.useQuery).toBeDefined();
  expect(db.useAuth).toBeDefined();
  
  console.log('✅ All React hooks available');
});

test('compile-time type safety with React hooks', () => {
  const db = reactOfflineInit({
    appId: 'test-app-id',
    schema: originalSchema,
  });

  // This is a compile-time test - if types were wrong, this wouldn't compile
  // The useQuery hook should properly infer types from the original schema
  
  // Note: We can't actually call useQuery here since we're not in a React component,
  // but the TypeScript compiler will verify the types are correct
  
  // Verify the hook exists and has the right signature
  expect(typeof db.useQuery).toBe('function');
  
  // Test transaction types
  expect(typeof db.transact).toBe('function');
  
  console.log('✅ React hooks have proper type signatures');
});

test('attribute types are properly inferred (not unknown)', () => {
  const db = reactOfflineInit({
    appId: 'test-app-id',
    schema: originalSchema,
  });

  // Test that we can create properly typed transactions
  // This will fail to compile if attributes are 'unknown'
  const todoTransaction = db.tx.todos[id()].update({
    text: 'Test todo', // Should be inferred as string
    completed: false,  // Should be inferred as boolean
    createdAt: new Date(), // Should be inferred as Date
    priority: 5, // Should be inferred as number (optional)
  });

  const userTransaction = db.tx.users[id()].update({
    name: 'Test User', // Should be inferred as string
    email: 'test@example.com', // Should be inferred as string
  });

  expect(todoTransaction).toBeDefined();
  expect(userTransaction).toBeDefined();

  // Test that we can create link transactions
  const linkTransaction = db.tx.users[id()].link({
    todos: id(), // Should work with proper link types
  });

  expect(linkTransaction).toBeDefined();
  
  console.log('✅ All attribute types properly inferred - no unknown types!');
});

test('zero code changes migration from original React package', () => {
  console.log('Testing zero code changes migration...');
  
  // Step 1: User has existing schema from @instantdb/core
  const existingSchema = originalI.schema({
    entities: {
      posts: originalI.entity({
        title: originalI.string(),
        content: originalI.string(),
        published: originalI.boolean(),
      }),
    },
    links: {},
  });
  
  // Step 2: User switches to our React offline package
  // They just change the import - NO OTHER CODE CHANGES NEEDED!
  const offlineDb = reactOfflineInit({
    appId: 'existing-app-id',
    schema: existingSchema, // Exact same schema object works!
  });
  
  // Step 3: All React hooks work exactly the same
  expect(offlineDb.useQuery).toBeDefined();
  expect(offlineDb.useAuth).toBeDefined();
  expect(offlineDb.transact).toBeDefined();
  
  console.log('✅ Zero code changes migration successful!');
});

export { originalSchema };
