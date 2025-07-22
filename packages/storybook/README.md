# @instant3p/storybook

A Storybook plugin for InstantDB that provides isolated offline database instances for each story.

## Features

- **Isolated Database per Story**: Each story gets its own unique app ID and database instance
- **Schema Support**: Define typed schemas for your stories with full TypeScript support
- **Seed Data**: Provide seed functions to populate your database with test data
- **Reset Functionality**: Built-in reset button in Storybook toolbar to clear and re-seed data
- **Offline Mode**: All databases run in offline mode using the core-offline package
- **Docs Mode Support**: Shows elegant placeholders in docs mode with links to interactive stories
- **Zero Manual Typing**: Component interfaces AND seed functions are automatically typed based on story parameters

## Installation

```bash
npm install @instant3p/storybook
```

## Setup

### 1. Add to your Storybook configuration

In your `.storybook/main.js`:

```javascript
module.exports = {
  addons: [
    '@instant3p/storybook',
    // ... other addons
  ],
};
```

### 2. Use in your stories (Zero Manual Typing!)

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { i } from '@instant3p/core-offline';
import { defineInstantDBStory } from '@instant3p/storybook';
import { MyComponent } from './MyComponent';

// Define your schema
const schema = i.schema({
  entities: {
    todos: i.entity({
      text: i.string(),
      completed: i.boolean(),
      createdAt: i.date(),
    }),
    users: i.entity({
      name: i.string(),
      email: i.string().unique(),
    }),
  },
  links: {
    todoOwner: {
      forward: { on: 'todos', label: 'owner', has: 'one' },
      reverse: { on: 'users', label: 'todos', has: 'many' },
    },
  },
});

// 🎉 Your component interface - ZERO manual typing required!
interface MyComponentProps {
  title?: string;
  // Just add this optional prop - everything is automatically typed!
  instantdb?: {
    db: InstantCoreDatabase<any>; // Becomes fully typed automatically!
    reset: () => Promise<void>;
  };
}

const meta = {
  title: 'Example/MyComponent',
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// 🚀 Ultimate ergonomics: Zero typing ANYWHERE!
export const WithTodos: Story = {
  parameters: defineInstantDBStory({
    schema,
    seed: async (db) => { // 🎉 No types needed - db is automatically typed!
      // Create a user
      const userId = 'user-1';
      await db.transact([
        db.tx.users[userId].update({
          name: 'John Doe',
          email: 'john@example.com',
        }),
      ]);

      // Create some todos - all operations are fully typed!
      await db.transact([
        db.tx.todos['todo-1'].update({
          text: 'Learn InstantDB',
          completed: false,
          createdAt: new Date().getTime(),
        }),
        db.tx.todos['todo-2'].update({
          text: 'Build awesome apps',
          completed: true,
          createdAt: new Date().getTime(),
        }),
      ]);

      // Link todos to user
      await db.transact([
        db.tx.todos['todo-1'].link({ owner: userId }),
        db.tx.todos['todo-2'].link({ owner: userId }),
      ]);
    },
  }),
};
```

## Usage in Components

The InstantDB plugin automatically provides a typed `instantdb` prop to your component when you use `defineInstantDBStory`. The `db` instance is automatically typed based on your schema with ZERO manual typing required anywhere!

```typescript
import React, { useEffect, useState } from 'react';
import type { InstantCoreDatabase } from '@instant3p/core-offline';

interface TodoListProps {
  // ✨ ZERO manual typing - everything is automatically typed!
  instantdb?: {
    db: InstantCoreDatabase<any>; // Becomes fully typed automatically!
    reset: () => Promise<void>;
  };
}

export function TodoList({ instantdb }: TodoListProps) {
  const [todos, setTodos] = useState([]);
  const { db } = instantdb || {};

  useEffect(() => {
    if (!db) return;
    
    const unsubscribe = db.subscribeQuery(
      { todos: {} }, // 👈 All queries are fully typed based on schema!
      (result) => {
        if (result.data) {
          setTodos(result.data.todos);
        }
      }
    );

    return unsubscribe;
  }, [db]);

  const addTodo = async (text: string) => {
    if (!db) return;
    
    // 👈 All transactions are fully typed!
    await db.transact([
      db.tx.todos[`todo-${Date.now()}`].update({
        text,
        completed: false,
        createdAt: new Date().getTime(),
      }),
    ]);
  };

  if (!db) {
    return <div>Loading InstantDB...</div>;
  }

  return (
    <div>
      <h2>Todos</h2>
      <p style={{ color: '#666', fontSize: '14px' }}>
        Use the 🗄️ button in the toolbar above to reset the database
      </p>
      {/* Your todo list UI */}
    </div>
  );
}
```

## Reset Button

The plugin automatically adds a reset button (🗄️) to the Storybook toolbar when a story uses InstantDB. **Always use this toolbar button to reset the database** rather than adding reset buttons within your components. 

Clicking the toolbar button will:

1. Clear all data from the story's database using the built-in `db.clear()` method
2. Re-run the seed function if provided
3. Update the UI to reflect the reset state

## Docs Mode Support

When multiple stories are displayed simultaneously (such as in Storybook's docs mode or overview pages), the plugin shows elegant placeholder cards instead of initializing multiple databases. Each placeholder includes:

- Information about the story's schema (entities and links)
- A button to navigate to the individual interactive story
- Clear messaging about why the full story isn't shown

This "thoughtful limitation" prevents database conflicts while providing excellent user experience.

## TypeScript Support

The plugin provides **zero-configuration TypeScript support with automatic schema inference**:

- ✅ **Zero manual typing**: Use `defineInstantDBStory()` and everything is automatically typed
- ✅ **Automatic component typing**: Just add optional `instantdb` prop - it becomes fully typed
- ✅ **Automatic seed typing**: Seed function parameters are automatically typed based on schema
- ✅ **Schema-based inference**: All database operations are completely type-safe with autocomplete
- ✅ **Standard Storybook patterns**: Uses normal `Meta` and `StoryObj` types

### How Zero Typing Works

1. **Use `defineInstantDBStory()`**: This helper automatically infers types from your schema
2. **Add optional `instantdb` prop**: Component gets automatic typing based on story parameters  
3. **Magic happens**: Both component AND seed functions become fully typed
4. **Full type safety**: All queries, transactions, and operations are completely type-safe

### Migration from Previous Versions

**Before (manual typing required):**
```typescript
export const MyStory: Story = {
  parameters: {
    instantdb: {
      schema,
      seed: async (db: InstantCoreDatabase<typeof schema>) => {
        // Manual typing required
      },
    },
  },
};
```

**After (zero typing required):**
```typescript
export const MyStory: Story = {
  parameters: defineInstantDBStory({
    schema,
    seed: async (db) => { // 🎉 No types needed!
      // Automatically typed based on schema
    },
  }),
};
```

## API Reference

### `defineInstantDBStory(config)`

The ultimate helper function that eliminates all manual typing:

```typescript
defineInstantDBStory({
  schema: InstantSchemaDef;                           // Your InstantDB schema
  seed?: (db: InstantCoreDatabase<Schema>) => Promise<void> | void;  // Optional seed function (automatically typed!)
})
```

### `InstantDBContext`

The context automatically provided to your component:

```typescript
interface InstantDBContext<Schema> {
  db: InstantCoreDatabase<Schema>;  // The database instance (automatically typed!)
  reset: () => Promise<void>;       // Reset function (prefer toolbar button)
}
```

## How It Works

1. **Schema Detection**: `defineInstantDBStory()` captures your schema and automatically types everything
2. **Automatic Enhancement**: Component's `instantdb` prop is automatically enhanced with typed `db` instance
3. **Type Inference**: TypeScript automatically provides full type safety based on your schema
4. **Seed Function Typing**: Seed functions are automatically typed based on the schema parameter
5. **Isolation**: Each story gets a unique app ID for complete database isolation
6. **Lifecycle Management**: Database is cleared and seeded automatically for each story
7. **Docs Mode**: Multiple stories show placeholders with navigation to individual interactive stories

This ensures that your stories are completely isolated, reproducible, and type-safe with **ZERO manual typing required anywhere**! 