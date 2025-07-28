import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { 
  i,           
  id,          
  defineInstantDBStory,    
  instantDBRender,         
  instantDBStory,          
  type StoryReactDatabase, 
} from '@instant3p/storybook';

// Define a simple schema for todos
const schema = i.schema({
  entities: {
    todos: i.entity({
      text: i.string(),
      completed: i.boolean(),
      createdAt: i.date(),
      priority: i.string().optional(),
    }),
    users: i.entity({
      name: i.string(),
      email: i.string().unique(),
      avatar: i.string().optional(),
    }),
  },
  links: {
    todoOwner: {
      forward: { on: 'todos', label: 'owner', has: 'one' },
      reverse: { on: 'users', label: 'todos', has: 'many' },
    },
  },
});

// Example component that uses InstantDB
interface TodoAppProps {
  // 🎉 Now properly typed with React database that has useQuery and other hooks!
  db: StoryReactDatabase<typeof schema>;
}

function TodoApp({ db }: TodoAppProps) {
  const [newTodoText, setNewTodoText] = React.useState('');

  // 🚀 NOW YOU CAN USE useQuery! This is what you wanted!
  const { data, isLoading, error } = db.useQuery({
    todos: {
      owner: {},
    },
    users: {},
  });

  const todos = data?.todos || [];
  const users = data?.users || [];

  const addTodo = async () => {
    if (!newTodoText.trim()) return;
    
    const todoId = `todo-${Date.now()}`;
    await db.transact([
      db.tx.todos[todoId].update({
        text: newTodoText,
        completed: false,
        createdAt: new Date().getTime(),
        priority: 'medium',
      }),
    ]);
    
    setNewTodoText('');
  };

  const toggleTodo = async (todoId: string, completed: boolean) => {
    await db.transact([
      db.tx.todos[todoId].update({ completed: !completed }),
    ]);
  };

  const deleteTodo = async (todoId: string) => {
    await db.transact([
      db.tx.todos[todoId].delete(),
    ]);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 600, margin: '0 auto', padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <h1>Todo App with InstantDB</h1>
        <p style={{ color: '#666', fontSize: '14px', margin: '8px 0 0 0' }}>
          Use the 🗄️ button in the toolbar above to reset the database
        </p>
        <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 0 0', fontStyle: 'italic' }}>
          One import from @instant3p/storybook gives you everything: i, id, React hooks, and full typing!
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3>Users ({users.length})</h3>
        {users.map((user: any) => (
          <div key={user.id} style={{ 
            background: '#f5f5f5', 
            padding: 10, 
            marginBottom: 10, 
            borderRadius: 4 
          }}>
            <strong>{user.name}</strong> - {user.email}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          placeholder="Enter a new todo..."
          style={{
            width: '70%',
            padding: 8,
            marginRight: 10,
            border: '1px solid #ddd',
            borderRadius: 4,
          }}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
        />
        <button 
          onClick={addTodo}
          style={{
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Add Todo
        </button>
      </div>

      <div>
        <h3>Todos ({todos.length})</h3>
        {todos.length === 0 ? (
          <p style={{ color: '#666' }}>No todos yet. Add one above!</p>
        ) : (
          todos.map((todo: any) => (
            <div 
              key={todo.id} 
              style={{ 
                background: '#f9f9f9',
                padding: 10,
                marginBottom: 10,
                borderRadius: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id, todo.completed)}
                  style={{ marginRight: 10 }}
                />
                <span 
                  style={{ 
                    textDecoration: todo.completed ? 'line-through' : 'none',
                    color: todo.completed ? '#666' : '#000',
                  }}
                >
                  {todo.text}
                </span>
                <span style={{ 
                  marginLeft: 10, 
                  fontSize: '0.8em', 
                  color: '#666',
                  background: '#e0e0e0',
                  padding: '2px 6px',
                  borderRadius: 3,
                }}>
                  {todo.priority}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.8em', color: '#999', marginRight: 10 }}>
                  {new Date(todo.createdAt).toLocaleDateString()}
                </span>
                <button 
                  onClick={() => deleteTodo(todo.id)}
                  style={{
                    background: '#ff6b6b',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: '0.8em',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Simple wrapper for Meta type
function MetaWrapper() {
  return null;
}

// 🚀 Storybook configuration - Zero typing required anywhere!
const meta = {
  title: 'InstantDB/Todo Example',
  component: MetaWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A complete todo application demonstrating automatic schema inference with ZERO manual typing required anywhere!',
      },
    },
  },
} satisfies Meta<typeof MetaWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

// 🎯 Clean, properly typed InstantDB stories with automatic schema inference!
export const WithInitialData: Story = {
  parameters: defineInstantDBStory({
    schema,
    async seed(db) {
      console.log('Seeding database with initial data...');
      
      // Generate IDs for linking
      const user1 = id();
      const user2 = id();
      const todo1 = id();
      const todo2 = id();
      const todo3 = id();
      const todo4 = id();
      
      // Create users - all operations are fully typed!
      await db.transact([
        db.tx.users[user1].update({
          name: 'Alice Johnson',
          email: 'alice@example.com',
          avatar: '👩‍💻',
        }),
        db.tx.users[user2].update({
          name: 'Bob Smith', 
          email: 'bob@example.com',
          avatar: '👨‍💼',
        }),
      ]);

      // Create some initial todos
      await db.transact([
        db.tx.todos[todo1].update({
          text: 'Learn InstantDB',
          completed: false,
          createdAt: new Date('2024-01-01'),
          priority: 'high',
        }),
        db.tx.todos[todo2].update({
          text: 'Build a todo app',
          completed: true,
          createdAt: new Date('2024-01-02'),
          priority: 'medium',
        }),
        db.tx.todos[todo3].update({
          text: 'Write documentation',
          completed: false,
          createdAt: new Date('2024-01-03'),
          priority: 'low',
        }),
        db.tx.todos[todo4].update({
          text: 'Deploy to production',
          completed: false,
          createdAt: new Date('2024-01-04'),
          priority: 'high',
        }),
      ]);

      // Link todos to users
      await db.transact([
        db.tx.todos[todo1].link({ owner: user1 }),
        db.tx.todos[todo2].link({ owner: user1 }),
        db.tx.todos[todo3].link({ owner: user2 }),
        db.tx.todos[todo4].link({ owner: user2 }),
      ]);

      console.log('Database seeding completed!');
    },
  }),
  render: instantDBRender(({ db }) => <TodoApp db={db} />),
};

// Story with empty database  
export const EmptyState: Story = {
  parameters: defineInstantDBStory({
    schema,
    async seed(db) {
      console.log('Database cleared - starting with empty state');
      // No seeding - starts empty
    },
  }),
  render: instantDBRender(({ db }) => <TodoApp db={db} />),
};

// Alternative approach: all-in-one helper that eliminates ALL redundancy
export const UsersOnly: Story = instantDBStory({
  schema,
  async seed(db) {
    console.log('Seeding with users only...');
    
    await db.transact([
      db.tx.users[id()].update({
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        avatar: '🧑‍🎨',
      }),
      db.tx.users[id()].update({
        name: 'Diana Prince',
        email: 'diana@example.com', 
        avatar: '👸',
      }),
      db.tx.users[id()].update({
        name: 'Edward Norton',
        email: 'edward@example.com',
        avatar: '🎭',
      }),
    ]);
  },
  render: ({ db }) => {
    // Demonstrate using the React useQuery hook in the story render
    const { data } = db.useQuery({
      todos: {
        owner: {},
      },
      users: {},
    });
    console.log('UsersOnly story data:', data);
    
    return <TodoApp db={db} />;
  },
});