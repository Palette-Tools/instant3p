import React, { useState, useEffect } from 'react'
import { init, i, id } from '../../src/index.ts'
import './App.css'
import BlogDemo from './BlogDemo'
import V20_12ValidationTests from './V20_12ValidationTests'

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
    // Added for v0.20.12 validation tests
    testEvents: i.entity({
      name: i.string(),
      eventDate: i.date(),
      metadata: i.json(),
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

function App() {
  const [isOnlineMode, setIsOnlineMode] = useState(false)
  const [appId, setAppId] = useState('')
  const [showAppIdModal, setShowAppIdModal] = useState(false)
  const [dbKey, setDbKey] = useState(0) // Key to force component remount
  
  // Start with initial offline app ID
  const [currentAppId, setCurrentAppId] = useState(`demo-offline-react-${id()}`)
  
  // Initialize with current app ID
  const [currentDb, setCurrentDb] = useState(() => init({
    appId: `demo-offline-react-${id()}`,
    schema,
    isOnline: false,
    useDateObjects: true,
    verbose: true, // Enable verbose logging
  } as any))

  const { isLoading, user, error } = currentDb.useAuth()
  const connectionStatus = currentDb.useConnectionStatus()

  const toggleNetworkMode = () => {
    if (!isOnlineMode) {
      // Going online - ask for app ID
      setShowAppIdModal(true)
    } else {
      // Going offline - switch current database to offline mode (keep same app ID)
      currentDb.setOnline(false)
      setIsOnlineMode(false)
    }
  }

  const goOnline = () => {
    if (appId.trim()) {
      // Create new database with user's app ID in online mode
      const newDb = init({
        appId: appId.trim(),
        schema,
        isOnline: true,
        useDateObjects: true,
        verbose: true, // Enable verbose logging
      } as any)
      
      setCurrentDb(newDb)
      setCurrentAppId(appId.trim())
      setIsOnlineMode(true)
      setShowAppIdModal(false)
      setDbKey(prev => prev + 1) // Force component remount
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
    <div className="app" key={dbKey}>
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
            {isOnlineMode ? `Online Mode - Connected to ${currentAppId}` : 'Offline Mode - Using Real IndexedDB'}
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

      <BlogDemo db={currentDb} key={`blog-${dbKey}`} />
      
      <div className="section-divider">
        <h2>🧪 v0.20.12 Validation</h2>
      </div>
      
      <V20_12ValidationTests db={currentDb} key={`validation-${dbKey}`} />
    </div>
  )
}

export default App 