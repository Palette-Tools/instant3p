import {
  weakHash,
  coerceQuery,
  type Query,
  type Exactly,
  type LifecycleSubscriptionState,
  type InstaQLParams,
  type InstaQLOptions,
  type InstantGraph,
  InstantCoreDatabase,
  InstaQLLifecycleState,
  InstantSchemaDef,
} from '@instant3p/core-offline';
import { useCallback, useRef, useSyncExternalStore } from 'react';

const defaultState = {
  isLoading: true,
  error: { message: 'Loading...' },
  data: undefined,
  pageInfo: undefined,
};

function stateForResult<Schema, Q>(result: any): InstaQLLifecycleState<Schema, Q> {
  if (!result) {
    return {
      isLoading: true,
      data: undefined,
      pageInfo: undefined,
      error: undefined,
    } as InstaQLLifecycleState<Schema, Q>;
  }
  
  // Type cast the JavaScript result to match TypeScript schema
  // The core engine builds correct structures but loses TypeScript types
  return Object.assign({}, result, { isLoading: false }) as InstaQLLifecycleState<Schema, Q>;
}

export function useQueryInternal<
  Q extends InstaQLParams<Schema>,
  Schema extends InstantSchemaDef<any, any, any>,
>(
  _core: InstantCoreDatabase<Schema>,
  _query: null | Q,
  _opts?: InstaQLOptions,
): {
  state: InstaQLLifecycleState<Schema, Q>;
  query: any;
} {
  if (_query && _opts && 'ruleParams' in _opts) {
    _query = { $$ruleParams: _opts['ruleParams'], ..._query };
  }
  const query = _query ? coerceQuery(_query) : null;
  const queryHash = weakHash(query);

  // We use a ref to store the result of the query.
  // This is becuase `useSyncExternalStore` uses `Object.is`
  // to compare the previous and next state.
  // If we don't use a ref, the state will always be considered different, so
  // the component will always re-render.
  const resultCacheRef = useRef<InstaQLLifecycleState<Schema, Q>>(
    stateForResult<Schema, Q>(_core._reactor.getPreviousResult(query)),
  );

  // Similar to `resultCacheRef`, `useSyncExternalStore` will unsubscribe
  // if `subscribe` changes, so we use `useCallback` to memoize the function.
  const subscribe = useCallback(
    (cb: () => void) => {
      // Don't subscribe if query is null
      if (!query) {
        const unsubscribe = () => {};
        return unsubscribe;
      }

      const unsubscribe = _core.subscribeQuery<Q>(query, (result) => {
        resultCacheRef.current = result ? 
          Object.assign({}, result, { isLoading: false }) as InstaQLLifecycleState<Schema, Q> : {
          isLoading: true,
          data: undefined,
          pageInfo: undefined,
          error: undefined,
        } as InstaQLLifecycleState<Schema, Q>;

        cb();
      });

      return unsubscribe;
    },
    // Build a new subscribe function if the query changes
    [queryHash],
  );

  const state = useSyncExternalStore<InstaQLLifecycleState<Schema, Q>>(
    subscribe,
    () => resultCacheRef.current,
    () => defaultState,
  );
  return { state, query };
}
