import type { 
  InstantSchemaDef, 
  InstantCoreDatabase,
  InstaQLParams,
  InstaQLOptions,
  InstaQLLifecycleState,
  InstaQLResponse,
} from '@instant3p/core-offline';
import { init as reactInit } from '@instant3p/react-offline';

// Re-export commonly used types for convenience - one import to rule them all!
export type { 
  InstantSchemaDef, 
  InstantCoreDatabase,
  InstaQLParams,
  InstaQLLifecycleState,
  InstaQLResponse,
} from '@instant3p/core-offline';

/**
 * React database type - using the actual InstantReactWebDatabase from @instant3p/react-offline
 * This provides all the React hooks with perfect compatibility
 */
export type StoryReactDatabase<Schema extends InstantSchemaDef<any, any, any>> = ReturnType<typeof reactInit<Schema>>;

/**
 * Extract schema type from InstantDB parameters
 */
type ExtractSchema<T> = T extends { instantdb?: { schema?: infer S } } 
  ? S extends InstantSchemaDef<any, any, any> 
    ? S 
    : InstantSchemaDef<any, any, any>
  : InstantSchemaDef<any, any, any>;

/**
 * Parameters for configuring InstantDB in stories
 */
export interface InstantDBParameters<
  Schema extends InstantSchemaDef<any, any, any> = InstantSchemaDef<any, any, any>
> {
  instantdb?: {
    schema?: Schema;
    seed?: (db: StoryReactDatabase<Schema>) => Promise<void> | void;
  };
}

/**
 * InstantDB context provided to stories when instantdb parameter is present
 */
export interface InstantDBContext<
  Schema extends InstantSchemaDef<any, any, any> = InstantSchemaDef<any, any, any>
> {
  db: StoryReactDatabase<Schema>;
}

/**
 * Automatically inferred InstantDB context based on story parameters
 * This is the magic type that eliminates manual typing!
 */
export type InferredInstantDBContext<TParameters> = TParameters extends { instantdb?: infer IDBParams }
  ? IDBParams extends { schema?: infer Schema }
    ? Schema extends InstantSchemaDef<any, any, any>
      ? StoryReactDatabase<Schema>
      : StoryReactDatabase<InstantSchemaDef<any, any, any>>
    : StoryReactDatabase<InstantSchemaDef<any, any, any>>
  : never;

/**
 * Enhanced story args that automatically include typed InstantDB context
 */
export type WithInstantDBArgs<TArgs, TParameters> = TArgs & {
  db: InferredInstantDBContext<TParameters>;
};

/**
 * Helper type for InstantDB story render functions
 * This creates a clean interface that works with Storybook's type system
 */
export type InstantDBStoryRender<Schema extends InstantSchemaDef<any, any, any>> = 
  (args: { db: StoryReactDatabase<Schema> }) => JSX.Element;

/**
 * Helper function to define InstantDB story parameters with automatic type inference
 * This eliminates the need for manual typing in both components AND seed functions!
 * 
 * @example
 * ```typescript
 * export const MyStory: Story = {
 *   parameters: defineInstantDBStory({
 *     schema,
 *     seed: async (db) => { // db is automatically typed!
 *       await db.transact([...]);
 *     },
 *   }),
 *   render: instantDBRender(({ db }) => <MyComponent db={db} />)
 * };
 * ```
 */
export function defineInstantDBStory<Schema extends InstantSchemaDef<any, any, any>>(config: {
  schema: Schema;
  seed?: (db: StoryReactDatabase<Schema>) => Promise<void> | void;
}) {
  return { instantdb: config };
}

/**
 * All-in-one helper for InstantDB stories that eliminates redundancy
 * Uses the actual InstantReactWebDatabase for perfect React compatibility
 * 
 * @example
 * ```typescript
 * export const MyStory: Story = instantDBStory({
 *   schema,
 *   seed: async (db) => { ... },  // db is the React offline database for seeding
 *   render: ({ db }) => <MyComponent db={db} />  // db is the same React offline database with hooks
 * });
 * ```
 */
export function instantDBStory<Schema extends InstantSchemaDef<any, any, any>>(config: {
  schema: Schema;
  seed?: (db: StoryReactDatabase<Schema>) => Promise<void> | void;
  render: (args: { db: StoryReactDatabase<Schema> }) => JSX.Element;
}) {
  return {
    parameters: { instantdb: { schema: config.schema, seed: config.seed } },
    render: (args: any) => config.render({ db: args.db as StoryReactDatabase<Schema> }),
  };
}

/**
 * Helper function for typed InstantDB story render functions
 * This provides clean typing without any type assertions or explicit schema types
 * The schema is automatically inferred from your story parameters!
 */
export function instantDBRender<Schema extends InstantSchemaDef<any, any, any>>(
  renderFn: (args: { db: StoryReactDatabase<Schema> }) => JSX.Element
): (args: any) => JSX.Element {
  return (args: any) => renderFn({ db: args.db as StoryReactDatabase<Schema> });
}

/**
 * Legacy type for backwards compatibility.
 * @deprecated Use standard Storybook types instead. The `db` arg is automatically available when you add the `instantdb` parameter.
 */
export type StoryWithInstantDB<
  Schema extends InstantSchemaDef<any, any, any> = InstantSchemaDef<any, any, any>
> = {
  db: StoryReactDatabase<Schema>;
};

/**
 * More ergonomic alias that infers the correct types
 */
export type InstantDBStoryParameters<
  Schema extends InstantSchemaDef<any, any, any> = InstantSchemaDef<any, any, any>
> = InstantDBParameters<Schema>; 