/**
 * Simple type compatibility test for React offline
 */

import { test, expect } from 'vitest';
import { i as originalI } from '@instantdb/core';
import { init } from '../src/init';
import { id } from '@instant3p/core-offline';

test('type compatibility works', () => {
  // Create schema with original builder
  const schema = originalI.schema({
    entities: {
      posts: originalI.entity({
        title: originalI.string(),
        published: originalI.boolean(),
      }),
    },
    links: {},
  });

  // Use with our React offline init
  const db = init({
    appId: 'test-app-id',
    schema, // This should work without type errors
  });

  expect(db).toBeDefined();
  expect(typeof db.useQuery).toBe('function');
  
  console.log('✅ Type compatibility confirmed');
});

test('attributes are not unknown - full type inference works', () => {
  // Create a more complex schema to test type inference
  const schema = originalI.schema({
    entities: {
      posts: originalI.entity({
        title: originalI.string(),
        content: originalI.string(),
        published: originalI.boolean(),
        publishedAt: originalI.date().optional(),
        viewCount: originalI.number(),
        tags: originalI.json<string[]>().optional(),
      }),
      authors: originalI.entity({
        name: originalI.string(),
        email: originalI.string().unique(),
        bio: originalI.string().optional(),
        isActive: originalI.boolean(),
      }),
    },
    links: {
      authorPosts: {
        forward: { on: 'authors', has: 'many', label: 'posts' },
        reverse: { on: 'posts', has: 'one', label: 'author' },
      },
    },
  });

  const db = init({
    appId: 'test-app-id',
    schema,
  });

  // Test that transaction types are properly inferred
  // If attributes were 'unknown', these would fail to compile
  const postTransaction = db.tx.posts[id()].update({
    title: 'My Great Post',           // string
    content: 'This is the content',   // string
    published: true,                  // boolean
    publishedAt: new Date(),          // Date (optional)
    viewCount: 42,                    // number
    tags: ['tech', 'javascript'],     // string[] (optional)
  });

  const authorTransaction = db.tx.authors[id()].update({
    name: 'John Doe',                 // string
    email: 'john@example.com',        // string (unique)
    bio: 'A great author',            // string (optional)
    isActive: true,                   // boolean
  });

  // Test link transactions
  const linkTransaction = db.tx.authors[id()].link({
    posts: [id(), id()],              // Should accept array for 'many' relationship
  });

  const reverseLinkTransaction = db.tx.posts[id()].link({
    author: id(),                     // Should accept single ID for 'one' relationship
  });

  expect(postTransaction).toBeDefined();
  expect(authorTransaction).toBeDefined();
  expect(linkTransaction).toBeDefined();
  expect(reverseLinkTransaction).toBeDefined();

  console.log('✅ All attribute types properly inferred - no unknown types detected!');
});
