import React, { useState } from 'react'
import { id } from '../../src/index.ts'

// Sample data
const sampleUsers = [
  { name: 'Alice Johnson', email: 'alice@example.com', age: 28, isActive: true, reputation: 150, bio: 'Full-stack developer passionate about offline-first applications' },
  { name: 'Bob Smith', email: 'bob@example.com', age: 35, isActive: true, reputation: 89, bio: 'Senior backend engineer with expertise in distributed systems' },
  { name: 'Carol Davis', email: 'carol@example.com', age: 31, isActive: true, reputation: 203, bio: 'UX designer focused on data-driven design decisions' },
]

const samplePosts = [
  { title: 'Introduction to Offline Databases', content: 'Exploring the benefits of offline-first architecture...', viewCount: 1250, isPublished: true, rating: 4.5, slug: 'intro-offline-databases' },
  { title: 'Building Resilient Offline Web Apps', content: 'How to create applications that work without internet...', viewCount: 890, isPublished: true, rating: 4.8, slug: 'resilient-offline-web-apps' },
  { title: 'The Future of Offline-First Software', content: 'Why local-first is the next big thing in software...', viewCount: 2100, isPublished: true, rating: 4.9, slug: 'offline-first-software' },
]

const sampleCategories = [
  { name: 'Technology', description: 'Latest tech trends and innovations', color: '#3B82F6', isActive: true },
  { name: 'Programming', description: 'Code tutorials and best practices', color: '#10B981', isActive: true },
  { name: 'Design', description: 'UI/UX design and user experience', color: '#F59E0B', isActive: true },
]

function BlogDemo({ db }: { db: any }) {
  const [logs, setLogs] = useState<Array<{ message: string; type: string; timestamp: string }>>([])

  // Query hooks
  const usersQuery = db.useQuery({ users: {} })
  const postsQuery = db.useQuery({ 
    posts: { 
      author: {},
      comments: { commenter: {} },
      categories: {},
      tags: {} 
    } 
  })
  const categoriesQuery = db.useQuery({ categories: {} })

  const addLog = (message: string, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { message, type, timestamp }])
  }

  const clearLogs = () => {
    setLogs([])
  }

  const createSampleData = async () => {
    try {
      addLog('🚀 Creating sample data...', 'info')
      
      // Create users
      const userIds = sampleUsers.map(() => id())
      const userTransactions = sampleUsers.map((user, index) => 
        db.tx.users[userIds[index]].update({
          ...user,
          joinedAt: new Date(),
        })
      )
      
      await db.transact(userTransactions)
      addLog('✅ Created sample users', 'success')

      // Create categories
      const categoryIds = sampleCategories.map(() => id())
      const categoryTransactions = sampleCategories.map((category, index) =>
        db.tx.categories[categoryIds[index]].update(category)
      )
      
      await db.transact(categoryTransactions)
      addLog('✅ Created sample categories', 'success')

      // Create posts with relationships
      const postIds = samplePosts.map(() => id())
      const postTransactions = samplePosts.map((post, index) => {
        const authorId = userIds[index % userIds.length]
        const categoryId = categoryIds[index % categoryIds.length]
        
        return [
          db.tx.posts[postIds[index]].update({
            ...post,
            publishedAt: new Date(),
          }),
          db.tx.posts[postIds[index]].link({ author: authorId }),
          db.tx.posts[postIds[index]].link({ categories: categoryId }),
        ]
      }).flat()
      
      await db.transact(postTransactions)
      addLog('✅ Created sample posts with relationships', 'success')

      addLog('🎉 Sample data creation complete!', 'success')
    } catch (error: any) {
      addLog(`❌ Error creating sample data: ${error.message}`, 'error')
    }
  }

  const createPost = async () => {
    try {
      if (usersQuery.data?.users?.length === 0) {
        addLog('⚠️ No users found. Create sample data first.', 'warning')
        return
      }

      const postId = id()
      const authorId = usersQuery.data.users[0].id
      
      await db.transact([
        db.tx.posts[postId].update({
          title: `New Post ${Date.now()}`,
          content: 'This is a new post created in the demo!',
          publishedAt: new Date(),
          viewCount: 0,
          isPublished: true,
          rating: 5.0,
          slug: `new-post-${Date.now()}`,
        }),
        db.tx.posts[postId].link({ author: authorId }),
      ])
      
      addLog('✅ Created new post', 'success')
    } catch (error: any) {
      addLog(`❌ Error creating post: ${error.message}`, 'error')
    }
  }

  const deleteAllData = async () => {
    try {
      addLog('🗑️ Clearing all data...', 'info')
      
      // Delete all entities
      const deleteTransactions: any[] = []
      
      if (postsQuery.data?.posts) {
        postsQuery.data.posts.forEach((post: any) => {
          deleteTransactions.push(db.tx.posts[post.id].delete())
        })
      }
      
      if (usersQuery.data?.users) {
        usersQuery.data.users.forEach((user: any) => {
          deleteTransactions.push(db.tx.users[user.id].delete())
        })
      }
      
      if (categoriesQuery.data?.categories) {
        categoriesQuery.data.categories.forEach((category: any) => {
          deleteTransactions.push(db.tx.categories[category.id].delete())
        })
      }
      
      if (deleteTransactions.length > 0) {
        await db.transact(deleteTransactions)
      }
      
      addLog('✅ All data cleared', 'success')
    } catch (error: any) {
      addLog(`❌ Error clearing data: ${error.message}`, 'error')
    }
  }

  const clearDatabase = async () => {
    try {
      addLog('🗑️ Clearing entire database...', 'info')
      await db.clear()
      addLog('✅ Database cleared completely', 'success')
    } catch (error: any) {
      addLog(`❌ Error clearing database: ${error.message}`, 'error')
    }
  }

  return (
    <div className="demo-container">
      <div className="demo-controls">
        <h2>Demo Controls</h2>
        <div className="button-group">
          <button onClick={createSampleData} className="btn btn-primary">
            🎯 Create Sample Data
          </button>
          <button onClick={createPost} className="btn btn-secondary">
            ➕ Add New Post
          </button>
          <button onClick={deleteAllData} className="btn btn-warning">
            🗑️ Clear All Data
          </button>
          <button onClick={clearDatabase} className="btn btn-danger">
            💣 Clear Database
          </button>
        </div>
      </div>

      <div className="data-display">
        <div className="data-section">
          <h3>Users ({usersQuery.data?.users?.length || 0})</h3>
          {usersQuery.isLoading && <p>Loading users...</p>}
          {usersQuery.error && <p className="error">Error: {usersQuery.error.message}</p>}
          {usersQuery.data?.users?.map((user: any) => (
            <div key={user.id} className="data-item">
              <strong>{user.name}</strong> - {user.email} 
              <small> (Reputation: {user.reputation})</small>
            </div>
          ))}
        </div>

        <div className="data-section">
          <h3>Posts ({postsQuery.data?.posts?.length || 0})</h3>
          {postsQuery.isLoading && <p>Loading posts...</p>}
          {postsQuery.error && <p className="error">Error: {postsQuery.error.message}</p>}
          {postsQuery.data?.posts?.map((post: any) => (
            <div key={post.id} className="data-item">
              <strong>{post.title}</strong>
              <p>{post.content}</p>
              {post.author && <small>By: {post.author.name}</small>}
              <div className="post-meta">
                Views: {post.viewCount} | Rating: {post.rating}
              </div>
            </div>
          ))}
        </div>

        <div className="data-section">
          <h3>Categories ({categoriesQuery.data?.categories?.length || 0})</h3>
          {categoriesQuery.isLoading && <p>Loading categories...</p>}
          {categoriesQuery.error && <p className="error">Error: {categoriesQuery.error.message}</p>}
          {categoriesQuery.data?.categories?.map((category: any) => (
            <div key={category.id} className="data-item">
              <span 
                className="category-dot" 
                style={{ backgroundColor: category.color }}
              ></span>
              <strong>{category.name}</strong> - {category.description}
            </div>
          ))}
        </div>
      </div>

      <div className="console-section">
        <div className="console-header">
          <h3>Console Output</h3>
          <button onClick={clearLogs} className="btn btn-small">Clear</button>
        </div>
        <div className="console">
          {logs.map((log, index) => (
            <div key={index} className={`log-entry ${log.type}`}>
              <span className="log-timestamp">[{log.timestamp}]</span> {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default BlogDemo 