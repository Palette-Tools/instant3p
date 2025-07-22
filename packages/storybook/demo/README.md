# InstantDB Storybook Plugin Demo

This is a working demonstration of the `@instant3p/storybook` plugin. It shows how to integrate InstantDB with Storybook for isolated database testing and component development.

## Getting Started

```bash
# Install dependencies
npm install

# Start Storybook
npm run dev
```

The demo will be available at [http://localhost:6006](http://localhost:6006).

## What's Included

### Stories

- **WithInitialData** - Shows the todo app with pre-seeded users and todos
- **EmptyState** - Shows the todo app starting from an empty database
- **UsersOnly** - Shows the todo app with only users, no todos

### Features Demonstrated

- **Schema Definition** - How to define entities and relationships
- **Database Seeding** - How to populate test data for stories
- **Real-time Queries** - How components subscribe to database changes
- **Transactions** - How to create, update, and delete data
- **Reset Functionality** - How to use the built-in reset button

### Plugin Usage

Each story uses the `instantdb` parameter to configure:

```typescript
export const MyStory: Story = {
  parameters: {
    instantdb: {
      schema: mySchema,
      seed: async (db) => {
        // Populate test data
        await db.transact([
          db.tx.users['user-1'].update({
            name: 'John Doe',
            email: 'john@example.com',
          }),
        ]);
      },
    },
  },
};
```

## Project Structure

```
demo/
├── .storybook/          # Storybook configuration
├── stories/             # Demo stories
├── package.json         # Demo dependencies
└── README.md           # This file
```

The demo project uses the plugin from the parent directory via workspace dependencies. 