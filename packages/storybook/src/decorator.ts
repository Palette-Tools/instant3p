import React, { useEffect, useState, useCallback } from 'react';
import { init as coreInit, type InstantSchemaDef, type InstantCoreDatabase, type InstantConfig, type InstaQLParams, type InstaQLOptions, type InstaQLLifecycleState } from '@instant3p/core-offline';
import { addons } from '@storybook/preview-api';
import type { InstantDBParameters, InstantDBContext } from './types.js';
import { getStoryAppId, clearDatabase } from './utils.js';
import { InstantDBPlaceholder } from './components/InstantDBPlaceholder.js';

// Create a proper React database implementation
class StoryReactDatabase<Schema extends InstantSchemaDef<any, any, any>> {
  public _core: InstantCoreDatabase<Schema>;
  public tx: any;
  public auth: any;
  public storage: any;

  constructor(coreDb: InstantCoreDatabase<Schema>) {
    this._core = coreDb;
    this.tx = coreDb.tx;
    this.auth = coreDb.auth;
    this.storage = coreDb.storage;
  }

  // React hook for querying - this is what components expect!
  useQuery<Q extends InstaQLParams<Schema>>(
    query: null | Q,
    opts?: InstaQLOptions,
  ): InstaQLLifecycleState<Schema, Q> {
    const [state, setState] = useState<any>({
      isLoading: true,
      data: undefined,
      error: undefined,
      pageInfo: undefined,
    });

    useEffect(() => {
      if (!query) {
        setState({ 
          isLoading: false, 
          data: undefined,
          error: undefined,
          pageInfo: undefined,
        });
        return;
      }

      let mounted = true;
      const unsubscribe = this._core.subscribeQuery(query, (result) => {
        if (!mounted) return;
        setState({
          isLoading: false,
          data: result.data,
          error: result.error,
          pageInfo: result.pageInfo,
        });
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    }, [query, opts]);

    return state as InstaQLLifecycleState<Schema, Q>;
  }

  // Pass-through methods to core database
  transact = (chunks: any) => this._core.transact(chunks);
  queryOnce = (query: any, opts?: any) => this._core.queryOnce(query, opts);
  subscribeQuery = (query: any, callback: any) => this._core.subscribeQuery(query, callback);
  getAuth = () => this._core.getAuth();
  useAuth = () => {
    throw new Error('useAuth should be implemented with proper React hooks in real usage');
  };
  useConnectionStatus = () => {
    throw new Error('useConnectionStatus should be implemented with proper React hooks in real usage');
  };
  getLocalId = (name: string) => this._core.getLocalId(name);
  useLocalId = (name: string) => {
    throw new Error('useLocalId should be implemented with proper React hooks in real usage');
  };
  // Remove room method for now since it doesn't exist on core database
}

interface DecoratorState<Schema extends InstantSchemaDef<any, any, any> = InstantSchemaDef<any, any, any>> {
  db: StoryReactDatabase<Schema> | null;
  isReady: boolean;
  isResetting: boolean;
  error?: string;
}

const RESET_EVENT = 'instant-db/reset';

export const withInstantDB = (Story: any, context: any) => {
  const { parameters, id: storyId, viewMode, title } = context;
  const instantParams = parameters.instantdb as InstantDBParameters['instantdb'];
  
  // Thoughtful limitation: In docs mode, show placeholder instead of initializing database
  if (viewMode === 'docs' && instantParams) {
    const navigateToStory = () => {
      // Try to navigate to the individual story
      if (window.parent && window.parent.location) {
        const currentUrl = new URL(window.parent.location.href);
        currentUrl.searchParams.set('path', `/story/${storyId}`);
        window.parent.location.href = currentUrl.toString();
      }
    };

    return React.createElement(InstantDBPlaceholder, {
      storyName: title || storyId,
      schema: instantParams.schema,
      onViewStory: navigateToStory,
    });
  }
  
  const [state, setState] = useState<DecoratorState>({
    db: null,
    isReady: false,
    isResetting: false,
    error: undefined,
  });

  const initializeDB = useCallback(async () => {
    if (!instantParams) {
      setState({ db: null, isReady: true, isResetting: false, error: undefined });
      return;
    }

    try {
      // Generate unique app ID for this story
      const appId = getStoryAppId(storyId);
      
      // Initialize database with schema
      const db = coreInit({
        appId,
        schema: instantParams.schema,
        isOnline: false, // Always offline for storybook
      });

      // Clear any existing data (more efficient now)
      await clearDatabase(db);

      // Run seed function if provided
      if (instantParams.seed) {
        await instantParams.seed(db);
      }

      setState({ db: new StoryReactDatabase(db), isReady: true, isResetting: false, error: undefined });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to initialize InstantDB for story:', error);
      setState({ db: null, isReady: true, isResetting: false, error: errorMessage });
    }
  }, [storyId, instantParams]);

  const reset = useCallback(async () => {
    if (!state.db || !instantParams) return;
    
    setState(prev => ({ ...prev, isResetting: true }));
    
    try {
      // Clear database first
      await clearDatabase(state.db._core);
      
      // Then re-run seed function
      if (instantParams.seed) {
        await instantParams.seed(state.db._core);
      }
    } catch (error) {
      console.error('Failed to reset InstantDB for story:', error);
    } finally {
      setState(prev => ({ ...prev, isResetting: false }));
    }
  }, [state.db, instantParams]);

  // Listen for reset events from the toolbar
  useEffect(() => {
    const channel = addons.getChannel();
    
    const handleReset = () => {
      reset();
    };
    
    channel.on(RESET_EVENT, handleReset);
    
    return () => {
      channel.off(RESET_EVENT, handleReset);
    };
  }, [reset]);

  // Initialize on mount or when story changes
  useEffect(() => {
    initializeDB();
  }, [initializeDB]);

  // Don't render until DB is ready
  if (!state.isReady) {
    return React.createElement('div', { 
      style: { 
        padding: '20px', 
        textAlign: 'center', 
        color: '#666',
        fontFamily: 'system-ui, sans-serif'
      } 
    }, 'Initializing InstantDB...');
  }

  // For stories with instantdb parameters, db should always be available
  if (instantParams && !state.db) {
    return React.createElement('div', { 
      style: { 
        padding: '20px', 
        textAlign: 'center', 
        color: '#d32f2f',
        fontFamily: 'system-ui, sans-serif',
        border: '1px solid #f44336',
        borderRadius: '4px',
        backgroundColor: '#ffebee',
        margin: '20px',
      } 
    }, [
      React.createElement('h3', { key: 'title', style: { margin: '0 0 10px 0' } }, 'InstantDB Initialization Failed'),
      React.createElement('p', { key: 'error', style: { margin: '0 0 10px 0', fontFamily: 'monospace' } }, 
        state.error || 'Unknown error occurred during database initialization'
      ),
      React.createElement('p', { key: 'instructions', style: { margin: '0', fontSize: '14px', color: '#666' } }, 
        'Check the browser console for more details.'
      ),
    ]);
  }

  // Create context object - db is guaranteed to exist for instantdb stories
  const instantContext: StoryReactDatabase<any> = state.db!;

  // Always pass db to render context for instantdb stories
  const enhancedContext = instantParams ? {
    ...context,
    args: {
      ...context.args,
      db: instantContext,
    },
  } : context;

  if (state.isResetting) {
    return React.createElement('div', { 
      style: { 
        padding: '20px', 
        textAlign: 'center', 
        color: '#666',
        fontFamily: 'system-ui, sans-serif'
      } 
    }, 'Resetting database...');
  }

  return React.createElement(Story, enhancedContext);
}; 