/**
 * Schema types - direct re-export from @instantdb/core
 * 
 * We use the original schema system entirely since we didn't change anything
 * about schemas in our offline implementation.
 */

// Re-export EVERYTHING from the original package
export * from '@instantdb/core';

// Copy the exact type definitions from the original since they're not exported in the main index
// These are copied directly from @instantdb/core/src/schemaTypes.ts to ensure perfect compatibility

// Helper types needed for CreateParams
type RequiredKeys<Attrs extends AttrsDefs> = {
  [K in keyof Attrs]: Attrs[K] extends DataAttrDef<any, infer R, any>
    ? R extends true
      ? K
      : never
    : never;
}[keyof Attrs];

type OptionalKeys<Attrs extends AttrsDefs> = {
  [K in keyof Attrs]: Attrs[K] extends DataAttrDef<any, infer R, any>
    ? R extends false
      ? K
      : never
    : never;
}[keyof Attrs];

type MappedAttrs<Attrs extends AttrsDefs, UseDates extends boolean = false> = {
  [K in RequiredKeys<Attrs>]: Attrs[K] extends DataAttrDef<infer V, any, any>
    ? UseDates extends true
      ? V
      : V extends Date
      ? string | number
      : V
    : never;
} & {
  [K in OptionalKeys<Attrs>]?: Attrs[K] extends DataAttrDef<infer V, any, any>
    ? UseDates extends true
      ? V
      : V extends Date
      ? string | number
      : V
    : never;
};

export type CreateParams<
  Schema extends IContainEntitiesAndLinks<any, any>,
  EntityName extends keyof Schema['entities'],
> = {
  [AttrName in RequiredKeys<
    Schema['entities'][EntityName]['attrs']
  >]: Schema['entities'][EntityName]['attrs'][AttrName] extends DataAttrDef<
    infer ValueType,
    any,
    any
  >
    ? ValueType extends Date
      ? string | number | Date
      : ValueType
    : never;
} & {
  [AttrName in OptionalKeys<
    Schema['entities'][EntityName]['attrs']
  >]?: Schema['entities'][EntityName]['attrs'][AttrName] extends DataAttrDef<
    infer ValueType,
    any,
    any
  >
    ? ValueType extends Date
      ? string | number | Date | null
      : ValueType | null
    : never;
};

export type ResolveEntityAttrs<
  EDef extends EntityDef<any, any, any>,
  UseDates extends boolean = false,
  ResolvedAttrs = MappedAttrs<EDef['attrs'], UseDates>,
> =
  EDef extends EntityDef<any, any, infer AsType>
    ? AsType extends void
      ? ResolvedAttrs
      : Omit<ResolvedAttrs, keyof AsType> & AsType
    : ResolvedAttrs;

// Only keep our internal types that aren't exported by the original
import type { RoomSchemaShape } from './presence.ts';

// Define only the types that are NOT exported by the original package
// but are needed for our internal implementation
export type RequirementKind = true | false;

// Internal types needed by our implementation but not exported by the original
export interface IContainEntitiesAndLinks<
  Entities extends EntitiesDef,
  Links extends LinksDef<Entities>,
> {
  entities: Entities;
  links: Links;
}

// Import the original types we need
import type { EntitiesDef, LinksDef, AttrsDefs, DataAttrDef, EntityDef } from '@instantdb/core';

// Only define UpdateOpts since it's not exported by the original
export type UpdateOpts = {
  upsert?: boolean | undefined;
};

// All schema classes (DataAttrDef, EntityDef, InstantSchemaDef, etc.) 
// are now imported directly from the original @instantdb/core package.
// This ensures perfect compatibility!