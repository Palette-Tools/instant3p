import type { InstantCoreDatabase, InstantSchemaDef } from '@instant3p/core-offline';

/**
 * Generate a unique app ID for a story
 */
export function getStoryAppId(storyId: string): string {
  // Create a deterministic but unique app ID for each story
  const hash = simpleHash(storyId);
  return `storybook-${hash}`;
}

/**
 * Simple hash function for generating consistent IDs
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Clear all data from the database using the built-in clear method
 */
export async function clearDatabase<Schema extends InstantSchemaDef<any, any, any>>(
  db: InstantCoreDatabase<Schema>
): Promise<void> {
  try {
    await db.clear();
  } catch (error) {
    console.warn('Failed to clear database:', error);
    // If clearing fails, we'll just proceed - the app ID isolation should help
  }
} 