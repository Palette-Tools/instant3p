// Import the offline InstantDB
import { init, i, id } from '@instant3p/core-offline';

// Network mode state
let isOnlineMode = false;
let currentAppId = null;
const STORAGE_KEY = 'instantdb-demo-appid';

// Demo state for testing date objects
let useDateObjectsMode = true;
let dbWithDates = null;
let dbWithoutDates = null;

// Console logging utilities
const consoleElement = document.getElementById('console');
let logs = [];

function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = {
    message,
    type,
    timestamp
  };
  
  logs.push(logEntry);
  
  const logDiv = document.createElement('div');
  logDiv.className = `log-entry ${type}`;
  
  if (type === 'data') {
    logDiv.innerHTML = `
      <span class="log-timestamp">[${timestamp}]</span>
      <pre>${message}</pre>
    `;
  } else {
    logDiv.innerHTML = `
      <span class="log-timestamp">[${timestamp}]</span> ${message}
    `;
  }
  
  consoleElement.appendChild(logDiv);
  consoleElement.scrollTop = consoleElement.scrollHeight;
}

function logError(message, error) {
  addLog(`❌ ${message}: ${error.message}`, 'error');
  addLog(`🔍 Error stack: ${error.stack}`, 'error');
  if (error.body) {
    addLog(`📋 Error body: ${JSON.stringify(error.body, null, 2)}`, 'error');
  }
  if (error.hint) {
    addLog(`💡 Hint: ${JSON.stringify(error.hint, null, 2)}`, 'error');
  }
  addLog(`🔧 Full error object: ${JSON.stringify(error, null, 2)}`, 'error');
}

function clearLogs() {
  logs = [];
  consoleElement.innerHTML = '';
}

function copyLogs() {
  const logText = logs.map(log => `[${log.timestamp}] ${log.message}`).join('\n');
  navigator.clipboard.writeText(logText).then(() => {
    addLog('✅ Logs copied to clipboard!', 'success');
  }).catch(() => {
    addLog('❌ Failed to copy logs', 'error');
  });
}

// Generate random IDs using InstantDB's proper UUID function
function generateId() {
  return id();
}

// Sample data generators with date testing
const sampleUsers = [
  { name: 'Alice Johnson', email: 'alice@example.com', age: 28, isActive: true, reputation: 150, bio: 'Full-stack developer passionate about offline-first applications', joinedAt: new Date('2023-01-15T10:30:00Z') },
  { name: 'Bob Smith', email: 'bob@example.com', age: 35, isActive: true, reputation: 89, bio: 'Senior backend engineer with expertise in distributed systems', joinedAt: new Date('2023-02-20T14:45:00Z') },
  { name: 'Carol Davis', email: 'carol@example.com', age: 31, isActive: true, reputation: 203, bio: 'UX designer focused on data-driven design decisions', joinedAt: new Date('2023-03-10T09:15:00Z') },
  { name: 'David Wilson', email: 'david@example.com', age: 42, isActive: true, reputation: 67, bio: 'Technical writer and documentation specialist', joinedAt: new Date('2023-04-05T16:20:00Z') },
  { name: 'Eva Brown', email: 'eva@example.com', age: 26, isActive: true, reputation: 312, bio: 'Frontend architect specializing in real-time applications', joinedAt: new Date('2023-05-12T11:55:00Z') }
];

const samplePosts = [
  { title: 'Introduction to Offline Databases', content: 'Exploring the benefits of offline-first architecture and offline data storage...', viewCount: 1250, isPublished: true, rating: 4.5, slug: 'intro-offline-databases', publishedAt: new Date('2024-01-15T08:00:00Z') },
  { title: 'Building Resilient Offline Web Apps', content: 'How to create applications that work without internet using offline capabilities...', viewCount: 890, isPublished: true, rating: 4.8, slug: 'resilient-offline-web-apps', publishedAt: new Date('2024-01-20T12:30:00Z') },
  { title: 'The Future of Offline-First Software', content: 'Why local-first is the next big thing in software, especially for offline applications...', viewCount: 2100, isPublished: true, rating: 4.9, slug: 'offline-first-software', publishedAt: new Date('2024-01-25T14:15:00Z') },
  { title: 'IndexedDB and Offline Best Practices', content: 'Tips and tricks for working with browser storage and offline data persistence...', viewCount: 650, isPublished: true, rating: 4.2, slug: 'indexeddb-offline-best-practices', publishedAt: new Date('2024-02-01T09:45:00Z') },
  { title: 'Offline Sync Strategies', content: 'Different approaches to syncing offline data when connectivity returns...', viewCount: 1800, isPublished: true, rating: 4.6, slug: 'offline-sync-strategies', publishedAt: new Date('2024-02-05T16:00:00Z') }
];

const sampleCategories = [
  { name: 'Technology', description: 'Latest tech trends and innovations', color: '#3B82F6', isActive: true },
  { name: 'Programming', description: 'Code tutorials and best practices', color: '#10B981', isActive: true },
  { name: 'Design', description: 'UI/UX design and user experience', color: '#F59E0B', isActive: true },
  { name: 'Business', description: 'Entrepreneurship and business strategy', color: '#EF4444', isActive: false },
];

const sampleTags = [
  { name: 'javascript', popularity: 95 },
  { name: 'offline-first', popularity: 78 },
  { name: 'database', popularity: 85 },
  { name: 'react', popularity: 92 },
  { name: 'performance', popularity: 67 },
  { name: 'architecture', popularity: 73 },
];

const sampleOrganizations = [
  { name: 'TechCorp Inc.', type: 'Technology', memberCount: 1200 },
  { name: 'StartupHub', type: 'Incubator', memberCount: 250 },
  { name: 'DevCollective', type: 'Community', memberCount: 8900 },
];

const sampleComments = [
  { content: 'Great article! This really helped me understand the concepts.', upvotes: 23, isDeleted: false },
  { content: 'I disagree with some points, but overall well written.', upvotes: 8, isDeleted: false },
  { content: 'Could you elaborate on the sync strategies section?', upvotes: 15, isDeleted: false },
  { content: 'This is exactly what I was looking for, thanks!', upvotes: 12, isDeleted: false },
  { content: 'Amazing work on the offline functionality!', upvotes: 18, isDeleted: false },
  { content: 'The examples really clarify the concepts.', upvotes: 7, isDeleted: false },
];

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
      createdAt: i.date(),
    }),
    organizations: i.entity({
      name: i.string(),
      type: i.string(),
      memberCount: i.number(),
      createdAt: i.date(),
    }),
    userProfiles: i.entity({
      avatarUrl: i.string(),
      website: i.string(),
      location: i.string(),
      isVerified: i.boolean(),
    }),
  },
  links: {
    // User relationships
    authoredPosts: {
      forward: { on: 'posts', label: 'author', has: 'one' },
      reverse: { on: 'users', label: 'posts', has: 'many' }
    },
    userComments: {
      forward: { on: 'comments', label: 'author', has: 'one' },
      reverse: { on: 'users', label: 'comments', has: 'many' }
    },
    userProfile: {
      forward: { on: 'userProfiles', label: 'user', has: 'one' },
      reverse: { on: 'users', label: 'profile', has: 'one' }
    },
    userOrganization: {
      forward: { on: 'users', label: 'organization', has: 'one' },
      reverse: { on: 'organizations', label: 'members', has: 'many' }
    },
    // Post relationships
    postComments: {
      forward: { on: 'comments', label: 'post', has: 'one' },
      reverse: { on: 'posts', label: 'comments', has: 'many' }
    },
    postCategory: {
      forward: { on: 'posts', label: 'category', has: 'one' },
      reverse: { on: 'categories', label: 'posts', has: 'many' }
    },
    postTags: {
      forward: { on: 'posts', label: 'tags', has: 'many' },
      reverse: { on: 'tags', label: 'posts', has: 'many' }
    },
  }
});

// Initialize the database
let db;
let userIds = [];
let postIds = [];
let categoryIds = [];
let tagIds = [];
let organizationIds = [];
let commentIds = [];

async function initDatabase(appId = null, useOnlineMode = false) {
  try {
    updateNetworkStatus('connecting');
    
    // If app ID is provided, we need to recreate the database
    if (appId && appId !== currentAppId) {
      addLog(`🔄 Switching to App ID: ${appId}`, 'info');
      
      // Destroy existing database if it exists
      if (db) {
        db.shutdown();
        db = null;
      }
      
      // Create new database with the new app ID
      db = init({
        appId: appId,
        schema,
        isOnline: useOnlineMode,
        useDateObjects: useDateObjectsMode
      });
      
      currentAppId = appId;
      isOnlineMode = useOnlineMode;
      
      // Store the App ID for future use
      localStorage.setItem(STORAGE_KEY, appId);
      
      addLog('✅ Database recreated with new App ID', 'success');
    } else if (!db) {
      // First time initialization
      const targetAppId = appId || `offline-demo-${generateId()}`;
      
      if (useOnlineMode) {
        addLog('🌐 Initializing InstantDB (Online Mode)...', 'info');
      } else {
        addLog('🚀 Initializing InstantDB (Offline Mode)...', 'info');
      }
      
      db = init({
        appId: targetAppId,
        schema,
        isOnline: useOnlineMode,
        useDateObjects: useDateObjectsMode
      });
      
      isOnlineMode = useOnlineMode;
      currentAppId = targetAppId;
      
      // Store the App ID for future use
      if (appId) {
        localStorage.setItem(STORAGE_KEY, appId);
      }
    } else {
      // Just switching online/offline mode on existing database
      if (useOnlineMode !== isOnlineMode) {
        if (useOnlineMode) {
          addLog('🌐 Switching to online mode...', 'info');
          db.setOnline(true);
        } else {
          addLog('🚀 Switching to offline mode...', 'info');
          db.setOnline(false);
        }
        
        isOnlineMode = useOnlineMode;
      }
    }

    addLog('✅ Database initialized successfully!', 'success');
    addLog(`📊 App ID: ${db._reactor.config.appId}`, 'info');
    
    // Wait for storage to be ready
    await db._reactor.querySubs.waitForLoaded();
    await db._reactor.pendingMutations.waitForLoaded();
    
    // Subscribe to connection status changes
    db.subscribeConnectionStatus((status) => {
      addLog(`🔌 Connection Status: ${status}`, 'info');
      
      // Update UI based on connection status
      if (status === 'authenticated') {
        updateNetworkStatus('online');
      } else if (status === 'connecting' || status === 'opened') {
        updateNetworkStatus('connecting');
      } else {
        updateNetworkStatus('offline');
      }
    });
    
    // Wait a bit for network status to settle
    await new Promise(resolve => setTimeout(resolve, 300));
    
    addLog(`🔌 Connection Status: ${db._reactor.status}`, 'info');
    addLog(`📱 Online Mode: ${db._reactor._isOnline}`, 'info');
    
    updateNetworkStatus(isOnlineMode && db._reactor._isOnline ? 'online' : 'offline');
    updateToggleButton();
    
    if (isOnlineMode) {
      addLog('✅ Successfully switched to online mode!', 'success');
      addLog('📡 Network connectivity enabled', 'info');
    } else {
      addLog('✅ Successfully switched to offline mode!', 'success');
      addLog('💾 Using offline storage only', 'info');
    }
    
    return true;
  } catch (error) {
    logError('Failed to initialize database', error);
    updateNetworkStatus('offline');
    return false;
  }
}

// Demo functions
async function addUser() {
  try {
    const randomUser = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
    const userId = generateId();
    userIds.push(userId);
    
    // Add joinedAt timestamp
    const userData = {
      ...randomUser,
      joinedAt: Date.now()
    };
    
    addLog(`👤 Adding user: ${randomUser.name}`, 'info');
    
    const result = await db.transact([
      db.tx.users[userId].update(userData)
    ]);
    
    addLog(`✅ User added successfully!`, 'success');
    addLog(`📝 Transaction status: ${result.status}`, 'info');
    if (result.eventId) {
      addLog(`🆔 Event ID: ${result.eventId} (v0.20.12 format)`, 'success');
    } else if (result.clientId) {
      addLog(`🆔 Client ID: ${result.clientId} (old format)`, 'error');
    }
    
    return userId;
  } catch (error) {
    logError('Failed to add user', error);
  }
}

async function addPost() {
  try {
    if (userIds.length === 0) {
      addLog('⚠️ No users available. Adding a user first...', 'info');
      await addUser();
    }
    
    const randomPost = samplePosts[Math.floor(Math.random() * samplePosts.length)];
    const postId = generateId();
    const authorId = userIds[Math.floor(Math.random() * userIds.length)];
    postIds.push(postId);
    
    // Add publishedAt timestamp
    const postData = {
      ...randomPost,
      publishedAt: Date.now()
    };
    
    addLog(`📝 Adding post: "${randomPost.title}"`, 'info');
    addLog(`👤 Author ID: ${authorId}`, 'info');
    
    const result = await db.transact([
      db.tx.posts[postId].update(postData),
      db.tx.posts[postId].link({ author: authorId })
    ]);
    
    addLog(`✅ Post added and linked to author!`, 'success');
    addLog(`📝 Transaction status: ${result.status}`, 'info');
    if (result.eventId) {
      addLog(`🆔 Event ID: ${result.eventId} (v0.20.12 format)`, 'success');
    } else if (result.clientId) {
      addLog(`🆔 Client ID: ${result.clientId} (old format)`, 'error');
    }
    
    return postId;
  } catch (error) {
    logError('Failed to add post', error);
  }
}

async function queryUsers() {
  try {
    addLog('🔍 Querying all users...', 'info');
    
    const result = await db.queryOnce({
      users: {}
    });
    
    addLog(`✅ Query completed successfully!`, 'success');
    addLog(`📊 Found ${result.data.users.length} users`, 'info');
    
    if (result.data.users.length > 0) {
      const formatted = JSON.stringify(result.data.users, null, 2);
      addLog(`📄 Users data:\n${formatted}`, 'data');
    }
    
    return result.data.users;
  } catch (error) {
    logError('Failed to query users', error);
  }
}

async function queryPosts() {
  try {
    addLog('🔍 Querying all posts with authors...', 'info');
    
    const result = await db.queryOnce({
      posts: {
        author: {}
      }
    });
    
    addLog(`✅ Query completed successfully!`, 'success');
    addLog(`📊 Found ${result.data.posts.length} posts`, 'info');
    
    if (result.data.posts.length > 0) {
      const formatted = JSON.stringify(result.data.posts, null, 2);
      addLog(`📄 Posts with authors:\n${formatted}`, 'data');
    }
    
    return result.data.posts;
  } catch (error) {
    logError('Failed to query posts', error);
  }
}

async function deepQuery() {
  try {
    addLog('🔍 Performing deep relationship query...', 'info');
    addLog('📚 Querying: users -> posts -> author -> posts (circular)', 'info');
    
    const result = await db.queryOnce({
      users: {
        posts: {
          author: {
            posts: {}
          }
        }
      }
    });
    
    addLog(`✅ Deep query completed successfully!`, 'success');
    addLog(`📊 Found ${result.data.users.length} users`, 'info');
    
    if (result.data.users.length > 0) {
      const formatted = JSON.stringify(result.data.users, null, 2);
      addLog(`📄 Deep query result:\n${formatted}`, 'data');
      
      // Show some statistics
      const totalPosts = result.data.users.reduce((sum, user) => sum + user.posts.length, 0);
      addLog(`📈 Statistics: ${result.data.users.length} users, ${totalPosts} total posts`, 'info');
    }
    
    return result.data.users;
  } catch (error) {
    logError('Failed to perform deep query', error);
  }
}

async function generateComplexData() {
  try {
    addLog('🏗️ Generating complex data structure for monster query...', 'info');
    
    // Create organizations first
    const orgIds = [];
    for (let i = 0; i < sampleOrganizations.length; i++) {
      const orgId = generateId();
      orgIds.push(orgId);
      organizationIds.push(orgId);
      
      const orgData = {
        ...sampleOrganizations[i],
        createdAt: Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000
      };
      
      await db.transact([
        db.tx.organizations[orgId].update(orgData)
      ]);
    }
    
    // Create categories
    const catIds = [];
    for (let i = 0; i < sampleCategories.length; i++) {
      const catId = generateId();
      catIds.push(catId);
      categoryIds.push(catId);
      
      await db.transact([
        db.tx.categories[catId].update(sampleCategories[i])
      ]);
    }
    
    // Create tags
    const tagIdList = [];
    for (let i = 0; i < sampleTags.length; i++) {
      const tagId = generateId();
      tagIdList.push(tagId);
      tagIds.push(tagId);
      
      const tagData = {
        ...sampleTags[i],
        createdAt: Date.now() - Math.random() * 200 * 24 * 60 * 60 * 1000
      };
      
      await db.transact([
        db.tx.tags[tagId].update(tagData)
      ]);
    }
    
    // Create users with profiles and organizations
    const userIdList = [];
    for (let i = 0; i < sampleUsers.length; i++) {
      const userId = generateId();
      const profileId = generateId();
      userIdList.push(userId);
      userIds.push(userId);
      
      const userData = {
        ...sampleUsers[i],
        joinedAt: Date.now() - Math.random() * 500 * 24 * 60 * 60 * 1000
      };
      
      const profileData = {
        avatarUrl: `https://avatar.vercel.sh/${userData.name.replace(' ', '')}`,
        website: `https://${userData.name.toLowerCase().replace(' ', '')}.dev`,
        location: ['San Francisco', 'New York', 'London', 'Tokyo', 'Berlin'][Math.floor(Math.random() * 5)],
        isVerified: Math.random() > 0.5
      };
      
      const orgId = orgIds[Math.floor(Math.random() * orgIds.length)];
      
      await db.transact([
        db.tx.users[userId].update(userData),
        db.tx.userProfiles[profileId].update(profileData),
        db.tx.users[userId].link({ profile: profileId }),
        db.tx.users[userId].link({ organization: orgId })
      ]);
    }
    
    // Create posts with complex relationships
    const postIdList = [];
    for (let i = 0; i < samplePosts.length; i++) {
      const postId = generateId();
      postIdList.push(postId);
      postIds.push(postId);
      
      const postData = {
        ...samplePosts[i],
        publishedAt: Date.now() - Math.random() * 100 * 24 * 60 * 60 * 1000
      };
      
      const authorId = userIdList[Math.floor(Math.random() * userIdList.length)];
      const catId = catIds[Math.floor(Math.random() * catIds.length)];
      
      await db.transact([
        db.tx.posts[postId].update(postData),
        db.tx.posts[postId].link({ author: authorId }),
        db.tx.posts[postId].link({ category: catId })
      ]);
      
      // Add random tags to posts
      const numTags = Math.floor(Math.random() * 3) + 1;
      const selectedTags = [];
      for (let j = 0; j < numTags; j++) {
        const tagId = tagIdList[Math.floor(Math.random() * tagIdList.length)];
        if (!selectedTags.includes(tagId)) {
          selectedTags.push(tagId);
          await db.transact([
            db.tx.posts[postId].link({ tags: tagId })
          ]);
        }
      }
      
      // Add comments to posts
      const numComments = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numComments; j++) {
        const commentId = generateId();
        commentIds.push(commentId);
        
        const commentData = {
          ...sampleComments[j % sampleComments.length],
          createdAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        };
        
        const commentAuthorId = userIdList[Math.floor(Math.random() * userIdList.length)];
        
        await db.transact([
          db.tx.comments[commentId].update(commentData),
          db.tx.comments[commentId].link({ author: commentAuthorId }),
          db.tx.comments[commentId].link({ post: postId })
        ]);
      }
    }
    
    addLog(`✅ Complex data generated!`, 'success');
    addLog(`📊 Created: ${userIdList.length} users, ${postIdList.length} posts, ${commentIds.length} comments`, 'info');
    addLog(`🏷️ Categories: ${catIds.length}, Tags: ${tagIdList.length}, Organizations: ${orgIds.length}`, 'info');
    
  } catch (error) {
    logError('Failed to generate complex data', error);
  }
}

async function monsterQuery() {
  try {
    addLog('🐲 Executing MONSTER QUERY - Complex multi-namespace query with operators!', 'info');
    addLog('⚡ This query demonstrates the full power of InstantDB offline querying', 'info');
    
    // First, let's make sure we have complex data to query
    if (userIds.length === 0 || categoryIds.length === 0 || tagIds.length === 0) {
      addLog('📊 No complex data found - generating comprehensive dataset...', 'info');
      await generateComplexData();
    }
    
    const currentTime = Date.now();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    addLog('🔍 Query Structure:', 'info');
    addLog('  📊 Multiple WHERE clauses with operators: $in, $not, $isNull, $gt, $like', 'info');
    addLog('  🔗 Deep nested relationships: users -> posts -> author -> posts', 'info');
    addLog('  📚 Multiple namespaces: users, posts, comments, categories, tags', 'info');
    addLog('  🎯 Complex filtering and conditional logic with and/or', 'info');
    
    // THE MONSTER QUERY - This is a complex query that uses multiple operators and nested relationships
    const monsterResult = await db.queryOnce({
      // Query active users with specific criteria
      users: {
        $: {
          where: {
            and: [
              { isActive: true },
              { age: { $gt: 25 } },
              { reputation: { $not: 0 } },
              { name: { $isNull: false } }
            ]
          }
        },
        // Get their posts with complex filtering
        posts: {
          $: {
            where: {
              or: [
                { isPublished: true },
                { and: [{ rating: { $gt: 4.0 } }, { viewCount: { $gt: 1000 } }] }
              ]
            }
          },
          // Get the author of each post (recursive relationship)
          author: {
            // Get profile information
            profile: {},
            // Get organization info
            organization: {
              $: {
                where: {
                  memberCount: { $gt: 100 }
                }
              }
            }
          },
          // Get comments on each post
          comments: {
            $: {
              where: {
                and: [
                  { isDeleted: false },
                  { upvotes: { $gt: 5 } }
                ]
              }
            },
            // Get comment authors
            author: {}
          },
          // Get post category
          category: {
            $: {
              where: {
                isActive: true
              }
            }
          },
          // Get post tags
          tags: {
            $: {
              where: {
                popularity: { $gt: 70 }
              }
            }
          }
        }
      }
    });
    
    addLog(`✅ Monster Query completed successfully!`, 'success');
    addLog(`📊 Query Stats:`, 'info');
    addLog(`  👥 Users found: ${monsterResult.data.users.length}`, 'info');
    
    let totalPosts = 0;
    let totalComments = 0;
    monsterResult.data.users.forEach(user => {
      totalPosts += user.posts.length;
      user.posts.forEach(post => {
        totalComments += post.comments.length;
      });
    });
    
    addLog(`  📝 Total posts: ${totalPosts}`, 'info');
    addLog(`  💬 Total comments: ${totalComments}`, 'info');
    
    if (monsterResult.data.users.length > 0) {
      const formatted = JSON.stringify(monsterResult.data.users, null, 2);
      addLog(`📄 Monster Query Result:\n${formatted}`, 'data');
    }
    
    // Additional complex queries to demonstrate more operators
    addLog('🔬 Running additional complex queries...', 'info');
    
    // Query with $in operator
    const inQuery = await db.queryOnce({
      users: {
        $: {
          where: {
            age: { $in: [25, 26, 28, 30, 35] }
          }
        }
      }
    });
    
    addLog(`📊 Users with ages in [25,26,28,30,35]: ${inQuery.data.users.length}`, 'info');
    
    // Query with text search (contains)
    const textQuery = await db.queryOnce({
      posts: {
        $: {
          where: {
            title: { $like: '%Offline%' }
          }
        }
      }
    });
    
    addLog(`📊 Posts containing 'Offline': ${textQuery.data.posts.length}`, 'info');
    
    // Query with range conditions
    const rangeQuery = await db.queryOnce({
      posts: {
        $: {
          where: {
            $and: [
              { viewCount: { $gt: 500 } },
              { viewCount: { $lt: 2000 } },
              { rating: { $gte: 4.0 } }
            ]
          }
        }
      }
    });
    
    addLog(`📊 Posts with 500-2000 views and rating ≥4.0: ${rangeQuery.data.posts.length}`, 'info');
    
    addLog('🎉 Monster Query demonstration complete!', 'success');
    addLog('💪 This proves InstantDB offline can handle complex queries with proper syntax!', 'success');
    
    return monsterResult.data;
    
  } catch (error) {
    logError('Monster Query failed', error);
  }
}

async function clearData() {
  try {
    addLog('🗑️ Clearing all local data...', 'info');
    
    await db.clear();
    
    // Reset our tracking arrays
    userIds = [];
    postIds = [];
    categoryIds = [];
    tagIds = [];
    organizationIds = [];
    commentIds = [];
    
    addLog(`✅ All data cleared successfully!`, 'success');
    addLog('📊 Database reset to empty state', 'info');
    
    // Verify data is gone
    const result = await db.queryOnce({
      users: { posts: {} }
    });
    
    addLog(`✅ Verification: ${result.data.users.length} users remaining`, 'info');
    
  } catch (error) {
    logError('Failed to clear data', error);
  }
}

// === v0.20.12 TESTING FUNCTIONS ===

// Test date object functionality
async function testDateObjectHandling() {
  if (!db) {
    addLog('❌ No database initialized', 'error');
    return;
  }
  
  addLog('🧪 === Testing Date Object Handling ===', 'info');
  addLog(`📅 useDateObjects mode: ${useDateObjectsMode}`, 'info');
  
  // Debug: Check if the database has the correct config
  if (db && db._reactor && db._reactor.config) {
    addLog(`🔍 Database useDateObjects config: ${db._reactor.config.useDateObjects}`, 'info');
  }
  
  // Debug: Check database structure
  addLog(`🔍 Database structure check:`, 'info');
  addLog(`  db exists: ${!!db}`, 'data');
  addLog(`  db._reactor exists: ${!!(db && db._reactor)}`, 'data');
  addLog(`  db._reactor.store exists: ${!!(db && db._reactor && db._reactor.store)}`, 'data');
  addLog(`  db._reactor.store.attrs exists: ${!!(db && db._reactor && db._reactor.store && db._reactor.store.attrs)}`, 'data');
  
  if (db && db._reactor && db._reactor.store && db._reactor.store.attrs) {
    const attrs = db._reactor.store.attrs;
    addLog(`  Total store attrs count: ${Object.keys(attrs).length}`, 'data');
    
    // Show first few attrs as examples
    const firstFewAttrs = Object.entries(attrs).slice(0, 3);
    addLog(`  First few store attrs:`, 'data');
    firstFewAttrs.forEach(([id, attr]) => {
      addLog(`    ${id}: ${JSON.stringify({
        'checked-data-type': attr['checked-data-type'], 
        'forward-identity': attr['forward-identity']
      })}`, 'data');
    });
  }
  
  // Also check reactor.attrs directly
  if (db && db._reactor && db._reactor.attrs) {
    const attrs = db._reactor.attrs;
    addLog(`  Total reactor attrs count: ${Object.keys(attrs).length}`, 'data');
    
    // Look specifically for date fields
    const dateAttrs = Object.entries(attrs).filter(([id, attr]) => attr['checked-data-type'] === 'date');
    addLog(`  Date attrs found: ${dateAttrs.length}`, 'data');
    dateAttrs.forEach(([id, attr]) => {
      const fwdIdentity = attr['forward-identity'] || [];
      const entityField = fwdIdentity.length >= 3 ? `${fwdIdentity[1]}.${fwdIdentity[2]}` : id;
      addLog(`    ${entityField}: checked-data-type = ${attr['checked-data-type']}`, 'data');
    });
  }
  
  try {
    // Test data with various date formats (using valid schema fields)
    // Test both ISO strings and Date objects for both entities
    const testDate = new Date();
    const testISOString = testDate.toISOString();
    
    const testPost1 = {
      title: `Date Test Post 1 ${Date.now()}`,
      content: 'Testing date object handling with Date object input',
      publishedAt: testDate, // Date object
      viewCount: 42,
      isPublished: true,
      rating: 4.5,
      slug: `date-test-1-${Date.now()}`
    };
    
    const testPost2 = {
      title: `Date Test Post 2 ${Date.now()}`,
      content: 'Testing date object handling with ISO string input',
      publishedAt: testISOString, // ISO string
      viewCount: 43,
      isPublished: true,
      rating: 4.6,
      slug: `date-test-2-${Date.now()}`
    };
    
    const testComment1 = {
      content: 'Test comment with Date object',
      createdAt: testDate, // Date object
      upvotes: 5,
      isDeleted: false
    };
    
    const testComment2 = {
      content: 'Test comment with ISO string',
      createdAt: testISOString, // ISO string
      upvotes: 6,
      isDeleted: false
    };
    
    addLog('📝 Creating posts and comments with different date input types...', 'info');
    addLog(`Input data types:`, 'data');
    addLog(`  post1.publishedAt: ${testPost1.publishedAt} (${typeof testPost1.publishedAt})`, 'data');
    addLog(`  post2.publishedAt: ${testPost2.publishedAt} (${typeof testPost2.publishedAt})`, 'data');
    addLog(`  comment1.createdAt: ${testComment1.createdAt} (${typeof testComment1.createdAt})`, 'data');
    addLog(`  comment2.createdAt: ${testComment2.createdAt} (${typeof testComment2.createdAt})`, 'data');
    
    // Create the posts and comments (using correct API pattern)
    const testPost1Id = generateId();
    const testPost2Id = generateId();
    const testComment1Id = generateId();
    const testComment2Id = generateId();
    const createResult = await db.transact([
      db.tx.posts[testPost1Id].update(testPost1),
      db.tx.posts[testPost2Id].update(testPost2),
      db.tx.comments[testComment1Id].update(testComment1),
      db.tx.comments[testComment2Id].update(testComment2)
    ]);
    
    // Test response format - should have eventId, not clientId
    addLog('📤 Transaction response format:', 'info');
    const responseKeys = Object.keys(createResult);
    addLog(`Response keys: [${responseKeys.join(', ')}]`, 'data');
    
    if ('eventId' in createResult) {
      addLog('✅ Response has eventId (correct v0.20.12 format)', 'success');
    } else {
      addLog('❌ Response missing eventId', 'error');
    }
    
    if ('clientId' in createResult) {
      addLog('❌ Response has clientId (old format, should be removed)', 'error');
    } else {
      addLog('✅ Response does not have clientId (correct)', 'success');
    }
    
    // Query the data back to check date coercion
    const queryResult = await db.queryOnce({
      posts: {},
      comments: {}
    });
    
    // Filter to our test data
    const testPosts = queryResult.data.posts.filter(p => p.title.includes('Date Test Post'));
    const testComments = queryResult.data.comments.filter(c => c.content.includes('Test comment with'));
    
    // Test results for posts
    testPosts.forEach((post, index) => {
      addLog(`📤 Retrieved post ${index + 1} data types:`, 'info');
      addLog(`  title: ${post.title}`, 'data');
      addLog(`  publishedAt: ${post.publishedAt} (${typeof post.publishedAt})`, 'data');
      
      const isDateObject = post.publishedAt instanceof Date;
      addLog(`🔍 publishedAt is ${isDateObject ? 'Date object' : 'not Date object'}: ${post.publishedAt}`, 'data');
      
      if (useDateObjectsMode) {
        if (isDateObject) {
          addLog(`✅ Post ${index + 1} publishedAt correctly coerced to Date object`, 'success');
        } else {
          addLog(`❌ Post ${index + 1} publishedAt should be Date object but is string`, 'error');
        }
      }
    });

    // Test results for comments  
    testComments.forEach((comment, index) => {
      addLog(`📤 Retrieved comment ${index + 1} data types:`, 'info');
      addLog(`  content: ${comment.content}`, 'data');
      addLog(`  createdAt: ${comment.createdAt} (${typeof comment.createdAt})`, 'data');
      
      const isDateObject = comment.createdAt instanceof Date;
      addLog(`🔍 createdAt is ${isDateObject ? 'Date object' : 'not Date object'}: ${comment.createdAt}`, 'data');
      
      if (useDateObjectsMode) {
        if (isDateObject) {
          addLog(`✅ Comment ${index + 1} createdAt correctly coerced to Date object`, 'success');
        } else {
          addLog(`❌ Comment ${index + 1} createdAt should be Date object but is string`, 'error');
        }
      }
    });
    
  } catch (error) {
    logError('Date object test failed', error);
  }
}

// Test response format changes
async function testResponseFormat() {
  if (!db) {
    addLog('❌ No database initialized', 'error');
    return;
  }
  
  addLog('🧪 === Testing Response Format ===', 'info');
  
  try {
    // Test successful mutation response format
    const testUser = {
      name: `Test User ${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      age: 25,
      isActive: true,
      reputation: 100,
      bio: 'Testing response format',
      joinedAt: new Date()
    };
    
    addLog('📝 Testing successful mutation response...', 'info');
    const testUserId = generateId();
    const successResult = await db.transact([
      db.tx.users[testUserId].update(testUser)
    ]);
    
    addLog('✅ Success response format:', 'success');
    addLog(JSON.stringify(successResult, null, 2), 'data');
    
    // Test error response format (try to create duplicate or invalid data)
    try {
      // This could potentially cause an error (testing error response format)
      const duplicateUserId = generateId();
      await db.transact([
        db.tx.users[duplicateUserId].update(testUser) // Same user data again
      ]);
    } catch (mutationError) {
      addLog('📝 Testing error response format...', 'info');
      addLog('✅ Error response format:', 'success');
      addLog(JSON.stringify(mutationError, null, 2), 'data');
      
      if ('eventId' in mutationError) {
        addLog('✅ Error response has eventId', 'success');
      } else {
        addLog('❌ Error response missing eventId', 'error');
      }
      
      if ('clientId' in mutationError) {
        addLog('❌ Error response has clientId (should be removed)', 'error');
      } else {
        addLog('✅ Error response does not have clientId', 'success');
      }
    }
    
  } catch (error) {
    logError('Response format test failed', error);
  }
}

// Toggle date objects mode
async function toggleDateObjectsMode() {
  useDateObjectsMode = !useDateObjectsMode;
  addLog(`🔄 Toggled useDateObjects to: ${useDateObjectsMode}`, 'info');
  
  // Update button text
  const button = document.getElementById('toggleDateMode');
  if (button) {
    button.textContent = useDateObjectsMode ? '📅 Disable Date Objects' : '📅 Enable Date Objects';
  }
  
  // Reinitialize database with new setting if it exists
  if (db && currentAppId) {
    addLog('🔄 Reinitializing database with new date setting...', 'info');
    
    // Store current state
    const currentOnlineMode = isOnlineMode;
    
    // Shutdown and recreate
    db.shutdown();
    db = init({
      appId: currentAppId,
      schema,
      isOnline: currentOnlineMode,
      useDateObjects: useDateObjectsMode
    });
    
    addLog(`✅ Database reinitialized with useDateObjects: ${useDateObjectsMode}`, 'success');
    
    // Debug: Verify the config was set correctly
    if (db._reactor && db._reactor.config) {
      addLog(`🔍 New database config useDateObjects: ${db._reactor.config.useDateObjects}`, 'info');
    }
  }
}

// Comprehensive v0.20.12 feature test
async function runV20_12FeatureTests() {
  addLog('🧪 === Running v0.20.12 Feature Tests ===', 'info');
  addLog('This will test date objects, response format, and offline functionality', 'info');
  
  await testDateObjectHandling();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
  
  await testResponseFormat();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
  
  // Test that offline mode still works
  if (isOnlineMode) {
    addLog('🧪 Testing offline mode functionality...', 'info');
    const prevMode = isOnlineMode;
    
    // Switch to offline temporarily
    db.setOnline(false);
    isOnlineMode = false;
    updateNetworkStatus('offline');
    updateToggleButton();
    
         // Do an offline operation
     try {
       const offlineUserId = generateId();
       await db.transact([
         db.tx.users[offlineUserId].update({
           name: 'Offline Test User',
           email: `offline${Date.now()}@example.com`,
           age: 30,
           isActive: true,
           reputation: 50,
           bio: 'Created in offline mode',
           joinedAt: new Date()
         })
       ]);
      addLog('✅ Offline mutations still work correctly', 'success');
    } catch (error) {
      addLog('❌ Offline functionality regression detected', 'error');
      logError('Offline test failed', error);
    }
    
    // Restore online mode
    if (prevMode) {
      db.setOnline(true);
      isOnlineMode = true;
      updateNetworkStatus('online');
      updateToggleButton();
    }
  } else {
    addLog('✅ Already in offline mode - offline functionality confirmed', 'success');
  }
  
  addLog('🎉 === v0.20.12 Feature Tests Complete ===', 'success');
}

// Network mode management functions
function updateNetworkStatus(status) {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  statusDot.className = 'status-dot';
  
  switch (status) {
    case 'online':
      statusDot.classList.add('online');
      statusText.textContent = `Online Mode - Connected to InstantDB (${currentAppId})`;
      break;
    case 'connecting':
      statusDot.classList.add('connecting');
      statusText.textContent = 'Connecting to InstantDB...';
      break;
    case 'offline':
    default:
      statusDot.classList.add('offline');
      statusText.textContent = 'Offline Mode - Using Local IndexedDB';
      break;
  }
}

function updateToggleButton() {
  const toggleButton = document.getElementById('toggleNetworkMode');
  
  if (isOnlineMode) {
    toggleButton.textContent = '📱 Go Offline';
    toggleButton.classList.add('online');
  } else {
    toggleButton.textContent = '🌐 Go Online';
    toggleButton.classList.remove('online');
  }
}

function showAppIdModal() {
  const modal = document.getElementById('appIdModal');
  const input = document.getElementById('appIdInput');
  
  // Pre-fill with stored App ID if available
  const storedAppId = localStorage.getItem(STORAGE_KEY);
  if (storedAppId) {
    input.value = storedAppId;
  }
  
  modal.classList.remove('hidden');
  input.focus();
}

function hideAppIdModal() {
  const modal = document.getElementById('appIdModal');
  modal.classList.add('hidden');
}

async function switchToOnlineMode(appId) {
  if (!appId || appId.trim() === '') {
    addLog('❌ App ID is required to go online', 'error');
    return;
  }
  
  // Switch to online mode (may recreate database if app ID changed)
  const success = await initDatabase(appId.trim(), true);
  
  if (!success) {
    addLog('❌ Failed to switch to online mode', 'error');
    // Fall back to offline mode
    await switchToOfflineMode();
  }
}

async function switchToOfflineMode() {
  // Switch to offline mode (same database instance)
  const success = await initDatabase(currentAppId, false);
  
  if (!success) {
    addLog('❌ Failed to switch to offline mode', 'error');
  }
}

async function handleNetworkToggle() {
  if (isOnlineMode) {
    await switchToOfflineMode();
  } else {
    showAppIdModal();
  }
}

function setupNetworkEventListeners() {
  const toggleButton = document.getElementById('toggleNetworkMode');
  const confirmButton = document.getElementById('confirmAppId');
  const cancelButton = document.getElementById('cancelAppId');
  const appIdInput = document.getElementById('appIdInput');
  const modal = document.getElementById('appIdModal');
  
  toggleButton.addEventListener('click', handleNetworkToggle);
  
  confirmButton.addEventListener('click', async () => {
    const appId = appIdInput.value.trim();
    if (appId) {
      hideAppIdModal();
      await switchToOnlineMode(appId);
    } else {
      addLog('❌ Please enter a valid App ID', 'error');
    }
  });
  
  cancelButton.addEventListener('click', hideAppIdModal);
  
  // Handle Enter key in input
  appIdInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const appId = appIdInput.value.trim();
      if (appId) {
        hideAppIdModal();
        await switchToOnlineMode(appId);
      }
    }
  });
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideAppIdModal();
    }
  });
}

// Initialize and set up event listeners
async function init_demo() {
      addLog('🎉 Welcome to InstantDB Offline Demo!', 'success');
    addLog('This demo showcases 100% offline database operations', 'info');
    addLog('💡 Switch App IDs to connect to different databases, toggle online/offline on the same instance!', 'info');
  
  const initialized = await initDatabase();
  
  if (initialized) {
    addLog('🎮 Ready to go! Try the buttons above to test functionality.', 'success');
    
    // Set up event listeners
    // Main demo event listeners
document.getElementById('addUser').addEventListener('click', addUser);
document.getElementById('addPost').addEventListener('click', addPost);
document.getElementById('generateComplexData').addEventListener('click', generateComplexData);
document.getElementById('queryUsers').addEventListener('click', queryUsers);
document.getElementById('queryPosts').addEventListener('click', queryPosts);
document.getElementById('deepQuery').addEventListener('click', deepQuery);
document.getElementById('monsterQuery').addEventListener('click', monsterQuery);
document.getElementById('clearData').addEventListener('click', clearData);
document.getElementById('copyLogs').addEventListener('click', copyLogs);
document.getElementById('clearLogs').addEventListener('click', clearLogs);

// v0.20.12 testing event listeners
document.getElementById('runV20_12Tests').addEventListener('click', runV20_12FeatureTests);
document.getElementById('toggleDateMode').addEventListener('click', toggleDateObjectsMode);
document.getElementById('testDateHandling').addEventListener('click', testDateObjectHandling);
document.getElementById('testResponseFormat').addEventListener('click', testResponseFormat);
    
    // Set up network toggle event listeners
    setupNetworkEventListeners();
    
    addLog('🔧 Event listeners attached to all buttons', 'info');
    addLog('🌐 Use the "Go Online" button to enter your app ID and connect to InstantDB', 'info');
  }
}

// Start the demo when page loads
document.addEventListener('DOMContentLoaded', init_demo); 