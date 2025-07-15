import type { InstantSchemaDef } from '@instant3p/core-offline';
import InstantReactAbstractDatabase from './InstantReactAbstractDatabase.ts';

export default class InstantReactWebDatabase<
  Schema extends InstantSchemaDef<any, any, any>,
> extends InstantReactAbstractDatabase<Schema> {}
