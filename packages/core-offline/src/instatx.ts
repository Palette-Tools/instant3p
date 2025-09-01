// Import transaction types from original package where available
import type {
  LinkParams,
  UpdateParams,
  RuleParams,
  TransactionChunk,
  TxChunk,
} from '@instantdb/core';

// Import types that are not exported by original package
import type {
  IContainEntitiesAndLinks,
  CreateParams,
  UpdateOpts,
} from './schemaTypes.ts';

type Action =
  | 'create'
  | 'update'
  | 'link'
  | 'unlink'
  | 'delete'
  | 'merge'
  | 'ruleParams';
type EType = string;
type Id = string;
type Args = any;
type LookupRef = [string, any];
type Lookup = string;
type Opts = UpdateOpts;
export type Op = [Action, EType, Id | LookupRef, Args, Opts?];

// Re-export the original TransactionChunk type AND runtime functions
// This ensures perfect nominal type compatibility - no more custom definitions!
export type { TransactionChunk, TxChunk } from '@instantdb/core';
export { tx, txInit, lookup, getOps } from '@instantdb/core';

// NOTE: We no longer define our own TransactionChunk interface
// We use the original one directly to ensure nominal type compatibility

// Keep only the functions that our offline functionality needs but aren't exported by original
export function isLookup(k: string): boolean {
  return k.startsWith('lookup__');
}

export function parseLookup(k: string): LookupRef {
  const [_, attribute, ...vJSON] = k.split('__');
  return [attribute, JSON.parse(vJSON.join('__'))];
}

// All other transaction functionality is re-exported from @instantdb/core above
// This gives us perfect nominal type compatibility while keeping offline functionality!
