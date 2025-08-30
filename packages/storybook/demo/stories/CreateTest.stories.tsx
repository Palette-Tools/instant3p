import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { 
  i,           
  id,          
  instantDBStory,          
  type StoryReactDatabase, 
} from '@instant3p/storybook';

// Simple schema for testing create() vs update()
const schema = i.schema({
  entities: {
    todos: i.entity({
      text: i.string(),
      completed: i.boolean(),
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

function TestApp({ db }: { db: StoryReactDatabase<typeof schema> }) {
  const { data } = db.useQuery({
    todos: { owner: {} },
    users: {},
  });

  return (
    <div style={{ padding: 20 }}>
      <h2>Create() vs Update() Test</h2>
      <p>Users: {data?.users?.length || 0}</p>
      <p>Todos: {data?.todos?.length || 0}</p>
      <div>
        <h3>Users:</h3>
        {data?.users?.map((user: any) => (
          <div key={user.id}>{user.name} - {user.email}</div>
        ))}
      </div>
      <div>
        <h3>Todos:</h3>
        {data?.todos?.map((todo: any) => (
          <div key={todo.id}>{todo.text} (owner: {todo.owner?.name || 'none'})</div>
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: 'Debug/Create Test',
  component: TestApp,
} satisfies Meta<typeof TestApp>;

export default meta;
type Story = StoryObj<typeof meta>;

// Test using create() - this should trigger the error
export const UsingCreate = instantDBStory({
  schema,
  async seed(db) {
    console.log('Testing create() method...');
    
    const userId = id();
    const todoId = id();
    
    // Use create() instead of update()
    await db.transact([
      db.tx.users[userId].create({
        name: 'Test User',
        email: 'test@example.com',
      }),
    ]);

    await db.transact([
      db.tx.todos[todoId].create({
        text: 'Test Todo',
        completed: false,
      }),
    ]);

    // Try to link - this might trigger the error
    await db.transact([
      db.tx.todos[todoId].link({ owner: userId }),
    ]);
  },
  render: ({ db }) => <TestApp db={db} />,
});

// Test using update() - this should work fine
export const UsingUpdate = instantDBStory({
  schema,
  async seed(db) {
    console.log('Testing update() method...');
    
    const userId = id();
    const todoId = id();
    
    // Use update() 
    await db.transact([
      db.tx.users[userId].update({
        name: 'Test User',
        email: 'test@example.com',
      }),
    ]);

    await db.transact([
      db.tx.todos[todoId].update({
        text: 'Test Todo',
        completed: false,
      }),
    ]);

    // Try to link
    await db.transact([
      db.tx.todos[todoId].link({ owner: userId }),
    ]);
  },
  render: ({ db }) => <TestApp db={db} />,
});

// Test mixed approach - create entities, then link
export const MixedCreateThenLink = instantDBStory({
  schema,
  async seed(db) {
    console.log('Testing mixed create() then link...');
    
    const userId = id();
    const todoId = id();
    
    // Create both entities in one transaction
    await db.transact([
      db.tx.users[userId].create({
        name: 'Mixed User',
        email: 'mixed@example.com',
      }),
      db.tx.todos[todoId].create({
        text: 'Mixed Todo',
        completed: false,
      }),
    ]);

    // Then link in a separate transaction
    await db.transact([
      db.tx.todos[todoId].link({ owner: userId }),
    ]);
  },
  render: ({ db }) => <TestApp db={db} />,
});
