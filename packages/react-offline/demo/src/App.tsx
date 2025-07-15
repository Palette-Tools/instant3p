import React, { useState, useEffect } from 'react'
import { init, i, id } from '../../src/index.ts'
import './App.css'
import BlogDemo from './BlogDemo'

// Define the schema - A comprehensive blog platform
const schema = i.schema({
  entities: {
    users: i.entity({
      name: i.string(),
      email: i.string(),
      age: i.number(),
      isActive: i.boolean(),
      joinedAt: i.date(),
      reputation: i.number(),
      bio: i.string(),
    }),
    posts: i.entity({
      title: i.string(),
      content: i.string(),
      publishedAt: i.date(),
      viewCount: i.number(),
      isPublished: i.boolean(),
      rating: i.number(),
      slug: i.string(),
    }),
    comments: i.entity({
      content: i.string(),
      createdAt: i.date(),
      upvotes: i.number(),
      isDeleted: i.boolean(),
    }),
    categories: i.entity({
      name: i.string(),
      description: i.string(),
      color: i.string(),
      isActive: i.boolean(),
    }),
    tags: i.entity({
      name: i.string(),
      popularity: i.number(),
    }),
    organizations: i.entity({
      name: i.string(),
      type: i.string(),
      memberCount: i.number(),
    }),
  },
  links: {
    userPosts: {
      forward: { on: 'users', has: 'many', label: 'posts' },
      reverse: { on: 'posts', has: 'one', label: 'author' },
    },
    postComments: {
      forward: { on: 'posts', has: 'many', label: 'comments' },
      reverse: { on: 'comments', has: 'one', label: 'post' },
    },
    userComments: {
      forward: { on: 'users', has: 'many', label: 'comments' },
      reverse: { on: 'comments', has: 'one', label: 'commenter' },
    },
    postCategories: {
      forward: { on: 'posts', has: 'many', label: 'categories' },
      reverse: { on: 'categories', has: 'many', label: 'posts' },
    },
    postTags: {
      forward: { on: 'posts', has: 'many', label: 'tags' },
      reverse: { on: 'tags', has: 'many', label: 'posts' },
    },
    userOrganizations: {
      forward: { on: 'users', has: 'many', label: 'organizations' },
      reverse: { on: 'organizations', has: 'many', label: 'members' },
    },
  },
})

// Initialize the database in offline mode
const db = init({
  appId: 'demo-offline-react',
  schema,
  isOnline: false, // Start in offline mode
})

function App() {
  const [isOnlineMode, setIsOnlineMode] = useState(false)
  const [appId, setAppId] = useState('')
  const [showAppIdModal, setShowAppIdModal] = useState(false)

  const { isLoading, user, error } = db.useAuth()
  const connectionStatus = db.useConnectionStatus()

  const toggleNetworkMode = () => {
    if (!isOnlineMode) {
      // Going online - ask for app ID
      setShowAppIdModal(true)
    } else {
      // Going offline
      // db.setOnline(false) // TODO: Add setOnline method to react-offline
      setIsOnlineMode(false)
    }
  }

  const goOnline = () => {
    if (appId.trim()) {
      // In a real implementation, you'd need to reinitialize the db with the new appId
      // For demo purposes, we'll just toggle the online state
      // db.setOnline(true) // TODO: Add setOnline method to react-offline
      setIsOnlineMode(true)
      setShowAppIdModal(false)
      localStorage.setItem('instantdb-demo-appid', appId)
    }
  }

  useEffect(() => {
    const savedAppId = localStorage.getItem('instantdb-demo-appid')
    if (savedAppId) {
      setAppId(savedAppId)
    }
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1>🚀 InstantDB React Offline Demo</h1>
        <p>Demonstrating 100% offline database operations with React hooks</p>
        <div className="features">
          <span className="feature">🔄 Real Browser IndexedDB</span>
          <span className="feature">📱 Offline-First Architecture</span>
          <span className="feature">🔗 Deep Relationships</span>
          <span className="feature">⚛️ React Hooks</span>
        </div>
        
        <div className="status-indicator">
          <span className={`status-dot ${isOnlineMode ? 'online' : 'offline'}`}></span>
          <span className="status-text">
            {isOnlineMode ? 'Online Mode - Syncing with Server' : 'Offline Mode - Using Real IndexedDB'}
          </span>
        </div>

        <div className="network-controls">
          <button onClick={toggleNetworkMode} className="btn btn-toggle">
            {isOnlineMode ? '📱 Go Offline' : '🌐 Go Online'}
          </button>
          
          <div className="connection-status">
            <strong>Connection:</strong> {connectionStatus}
          </div>

          {!isLoading && (
            <div className="auth-status">
              <strong>Auth:</strong> {user ? `Logged in as ${user.email}` : 'Not logged in'}
              {error && <span className="error"> (Error: {error.message})</span>}
            </div>
          )}
        </div>

        {showAppIdModal && (
          <div className="modal">
            <div className="modal-content">
              <h3>Enter InstantDB App ID</h3>
              <p>To go online, you need to provide your InstantDB App ID.</p>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="Enter your App ID"
                className="app-id-input"
              />
              <div className="modal-buttons">
                <button onClick={goOnline} className="btn btn-primary" disabled={!appId.trim()}>
                  Connect
                </button>
                <button onClick={() => setShowAppIdModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <BlogDemo db={db} />
    </div>
  )
}

export default App 