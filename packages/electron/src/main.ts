// This file is specifically for the main process
// It will be referenced by the "electron-main" export condition
export * from './main/init.js';
export { ElectronAuthBridge } from './main/auth-bridge.js';
export * from './main/types.js';

// Re-export all core types for convenience
export type {
  User,
  AuthState,
  ConnectionStatus,
  InstantConfig,
  InstantSchemaDef,
  InstantUnknownSchema,
  IInstantDatabase,
  InstantCoreDatabase,
  InstaQLParams,
  InstaQLSubscriptionState,
  TransactionChunk,
  SendMagicCodeParams,
  SendMagicCodeResponse,
  VerifyMagicCodeParams,
  VerifyResponse,
  SignInWithIdTokenParams,
  ExchangeCodeForTokenParams,
  
  // Query and Entity utility types
  InstaQLEntity,
  InstaQLResult,
  InstaQLFields,
  QueryResponse,
  InstaQLResponse,
  InstaQLOptions,
  InstaQLQueryParams,
  PageInfoResponse,
  InstantObject,
  Query,
  Exactly,
  
  // Schema utility types
  AttrsDefs,
  CardinalityKind,
  DataAttrDef,
  EntitiesDef,
  EntitiesWithLinks,
  EntityDef,
  InstantGraph,
  LinkAttrDef,
  LinkDef,
  LinksDef,
  ResolveAttrs,
  ValueTypes,
  RoomsDef,
  RoomsOf,
  PresenceOf,
  TopicsOf,
  
  // Legacy types (marked as deprecated but still useful)
  InstantQuery,
  InstantQueryResult,
  InstantSchema,
  InstantEntity,
  InstantSchemaDatabase,
  
  // Transaction types
  UpdateParams,
  LinkParams,
  RuleParams,
  TxChunk,
  
  // Rules types
  InstantRules,
  
  // Storage types
  FileOpts,
  UploadFileResponse,
  DeleteFileResponse,

  // Auth types
  AuthToken,
  
  // Presence types
  PresenceOpts,
  PresenceSlice,
  PresenceResponse,
  RoomSchemaShape,
  
  // Other utility types
  BackwardsCompatibleSchema,
  LifecycleSubscriptionState,
  InstaQLLifecycleState,
  SubscriptionState,
  
  // Attribute types
  InstantDBAttr,
  InstantDBAttrOnDelete,
  InstantDBCheckedDataType,
  InstantDBIdent,
  InstantDBInferredType,
  
  // Error types
  InstantIssue
} from '@instantdb/core'; 