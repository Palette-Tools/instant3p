/**
 * Schema builder - re-export from @instantdb/core
 * 
 * We use the original schema builder entirely since we didn't change anything
 * about schemas in our offline implementation.
 */

// Re-export the original schema builder
export { i } from '@instantdb/core';

// That's it! No need to redefine anything.
// Users can now use the exact same schema builder as the original package.