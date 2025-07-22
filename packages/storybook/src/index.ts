export { withInstantDB } from './decorator.js';
export { instant } from './addon.js';
// 😈 Sinful re-exports - everything you need in one place!
export { id, i, tx, lookup } from '@instant3p/core-offline';

// Export types - new improved ergonomics with automatic schema inference
export type { 
  InstantDBParameters, 
  InstantDBContext,
  InstantDBStoryParameters,
  InstantDBStoryRender,
  StoryReactDatabase,
  // Advanced types for automatic schema inference
  InferredInstantDBContext,
  WithInstantDBArgs,
  // Legacy type for backwards compatibility
  StoryWithInstantDB,
  // Common types users might need - no more multiple imports!
  InstantCoreDatabase,
  InstantSchemaDef,
  InstaQLParams,
  InstaQLLifecycleState,
  InstaQLResponse,
} from './types.js';

// Export helper functions for ultimate type inference
export { defineInstantDBStory, instantDBRender, instantDBStory } from './types.js'; 