// @ts-check
import weakHash from './utils/weakHash.ts';
import instaql from './instaql.js';
import * as instaml from './instaml.js';
import * as s from './store.js';
import uuid from './utils/uuid.ts';
import IndexedDBStorage from './IndexedDBStorage.js';
import WindowNetworkListener from './WindowNetworkListener.js';
import * as authAPI from './authAPI.ts';
import * as StorageApi from './StorageAPI.ts';
import * as flags from './utils/flags.ts';
import { buildPresenceSlice, hasPresenceResponseChanged } from './presence.ts';
import { Deferred } from './utils/Deferred.js';
import { PersistedObject } from './utils/PersistedObject.js';
import { extractTriples } from './model/instaqlResult.js';
import {
  areObjectsDeepEqual,
  assocInMutative,
  dissocInMutative,
  insertInMutative,
} from './utils/object.js';
import { createLinkIndex } from './utils/linkIndex.ts';
import version from './version.js';
import { create } from 'mutative';
import createLogger from './utils/log.ts';

/** @typedef {import('./utils/log.ts').Logger} Logger */

const STATUS = {
  CONNECTING: 'connecting',
  OPENED: 'opened',
  AUTHENTICATED: 'authenticated',
  CLOSED: 'closed',
  ERRORED: 'errored',
};

const QUERY_ONCE_TIMEOUT = 30_000;
const PENDING_TX_CLEANUP_TIMEOUT = 30_000;

const WS_CONNECTING_STATUS = 0;
const WS_OPEN_STATUS = 1;

const defaultConfig = {
  apiURI: 'https://api.instantdb.com',
  websocketURI: 'wss://api.instantdb.com/runtime/session',
};

// Param that the backend adds if this is an oauth redirect
const OAUTH_REDIRECT_PARAM = '_instant_oauth_redirect';

const currentUserKey = `currentUser`;

let _wsId = 0;
function createWebSocket(uri) {
  const ws = new WebSocket(uri);
  // @ts-ignore
  ws._id = _wsId++;
  return ws;
}

function isClient() {
  const hasWindow = typeof window !== 'undefined';
  // this checks if we are running in a chrome extension
  // @ts-expect-error
  const isChrome = typeof chrome !== 'undefined';

  return hasWindow || isChrome;
}

const ignoreLogging = {
  'set-presence': true,
  'set-presence-ok': true,
  'refresh-presence': true,
  'patch-presence': true,
};

function querySubsFromJSON(str, useDateObjects) {
  const parsed = JSON.parse(str);
  for (const key in parsed) {
    const v = parsed[key];
    if (v?.result?.store) {
      const storeJSON = v.result.store;
      v.result.store = s.fromJSON({
        ...storeJSON,
        useDateObjects: useDateObjects,
      });
    }
  }
  return parsed;
}

function querySubsToJSON(querySubs) {
  const jsonSubs = {};
  for (const key in querySubs) {
    const sub = querySubs[key];
    const jsonSub = { ...sub };
    if (sub.result?.store) {
      jsonSub.result = {
        ...sub.result,
        store: s.toJSON(sub.result.store),
      };
    }
    jsonSubs[key] = jsonSub;
  }
  return JSON.stringify(jsonSubs);
}

function sortedMutationEntries(entries) {
  return [...entries].sort((a, b) => {
    const [ka, muta] = a;
    const [kb, mutb] = b;
    const a_order = muta.order || 0;
    const b_order = mutb.order || 0;
    if (a_order == b_order) {
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    }
    return a_order - b_order;
  });
}

/**
 * @template {import('./presence.ts').RoomSchemaShape} [RoomSchema = {}]
 */
export default class Reactor {
  attrs;
  _isOnline = true;
  _isShutdown = false;
  status = STATUS.CONNECTING;

  /** @type {PersistedObject} */
  querySubs;
  /** @type {PersistedObject} */
  pendingMutations;

  /** @type {Record<string, Array<{ q: any, cb: (data: any) => any }>>} */
  queryCbs = {};
  /** @type {Record<string, Array<{ q: any, eventId: string, dfd: Deferred }>>} */
  queryOnceDfds = {};
  authCbs = [];
  attrsCbs = [];
  mutationErrorCbs = [];
  connectionStatusCbs = [];
  config;
  _persister;
  mutationDeferredStore = new Map();
  _reconnectTimeoutId = null;
  _reconnectTimeoutMs = 0;
  _ws;
  _localIdPromises = {};
  _errorMessage = null;
  /** @type {Promise<null | {error: {message: string}}>}**/
  _oauthCallbackResponse = null;

  /** @type {null | import('./utils/linkIndex.ts').LinkIndex}} */
  _linkIndex = null;

  /** @type BroadcastChannel | undefined */
  _broadcastChannel;

  /** @type {Record<string, {isConnected: boolean; error: any}>} */
  _rooms = {};
  /** @type {Record<string, boolean>} */
  _roomsPendingLeave = {};
  _presence = {};
  _broadcastQueue = [];
  _broadcastSubs = {};
  _currentUserCached = { isLoading: true, error: undefined, user: undefined };
  _beforeUnloadCbs = [];
  _dataForQueryCache = {};
  /** @type {Logger} */
  _log;

  constructor(
    config,
    Storage = IndexedDBStorage,
    NetworkListener = WindowNetworkListener,
    versions,
  ) {
    this.config = { ...defaultConfig, ...config };
    this.queryCacheLimit = this.config.queryCacheLimit ?? 10;

    this._log = createLogger(
      config.verbose || flags.devBackend || flags.instantLogs,
    );

    this.versions = { ...(versions || {}), '@instantdb/core': version };

    if (this.config.schema) {
      this._linkIndex = createLinkIndex(this.config.schema);
    }

    // This is to protect us against running
    // server-side.
    if (!isClient()) {
      return;
    }
    if (typeof BroadcastChannel === 'function') {
      this._broadcastChannel = new BroadcastChannel('@instantdb');
      this._broadcastChannel.addEventListener('message', async (e) => {
        try {
          if (e.data?.type === 'auth') {
            const res = await this.getCurrentUser();
            this.updateUser(res.user);
          }
        } catch (e) {
          this._log.error('[error] handle broadcast channel', e);
        }
      });
    }

    this._oauthCallbackResponse = this._oauthLoginInit();

    this._initStorage(Storage);

    // kick off a request to cache it
    this.getCurrentUser();

    NetworkListener.getIsOnline().then((isOnline) => {
      this._isOnline = isOnline;
      if (this._isOnline) {
        this._startSocket();
      } else {
        this._log.info(
          'Initial status change from',
          this.status,
          'to',
          STATUS.CLOSED,
        );
        this._setStatus(STATUS.CLOSED);
      }
      NetworkListener.listen((isOnline) => {
        // We do this because react native's NetInfo
        // fires multiple online events.
        // We only want to handle one state change
        if (isOnline === this._isOnline) {
          return;
        }
        this._log.info('[network] online =', isOnline);
        this._isOnline = isOnline;
        if (this._isOnline) {
          this._startSocket();
        } else {
          this._log.info(
            'Changing status from',
            this.status,
            'to',
            STATUS.CLOSED,
          );
          this._setStatus(STATUS.CLOSED);
        }
      });
    });

    if (typeof addEventListener !== 'undefined') {
      this._beforeUnload = this._beforeUnload.bind(this);
      addEventListener('beforeunload', this._beforeUnload);
    }

    // Initialize attrs from schema immediately if offline and schema provided
    // This prevents timing issues with async status changes
    if (!this._isOnline && this.config.schema) {
      this._initAttrsFromSchema();
    }
  }

  updateSchema(schema) {
    this.config = {
      ...this.config,
      schema: schema,
      cardinalityInference: Boolean(schema),
    };
    this._linkIndex = schema ? createLinkIndex(this.config.schema) : null;
  }

  _initStorage(Storage) {
    this._persister = new Storage(`instant_${this.config.appId}_5`);
    this.querySubs = new PersistedObject(
      this._persister,
      'querySubs',
      {},
      this._onMergeQuerySubs,
      querySubsToJSON,
      (str) => querySubsFromJSON(str, this.config.useDateObjects),
    );
    this.pendingMutations = new PersistedObject(
      this._persister,
      'pendingMutations',
      new Map(),
      this._onMergePendingMutations,
      (x) => {
        return JSON.stringify([...x.entries()]);
      },
      (x) => {
        return new Map(JSON.parse(x));
      },
    );
    this._beforeUnloadCbs.push(() => {
      this.pendingMutations.flush();
      this.querySubs.flush();
    });
  }

  _beforeUnload() {
    for (const cb of this._beforeUnloadCbs) {
      cb();
    }
  }

  /**
   * @param {'enqueued' | 'pending' | 'synced' | 'timeout' |  'error' } status
   * @param string eventId
   * @param {{message?: string, hint?: string, error?: Error}} [errDetails]
   */
  _finishTransaction(status, eventId, errDetails) {
    const dfd = this.mutationDeferredStore.get(eventId);
    this.mutationDeferredStore.delete(eventId);
    const ok = status !== 'error' && status !== 'timeout';

    if (!dfd && !ok) {
      // console.erroring here, as there are no listeners to let know
      console.error('Mutation failed', { status, eventId, ...errDetails });
    }
    if (!dfd) {
      return;
    }
    if (ok) {
      dfd.resolve({ status, eventId });
    } else {
      dfd.reject({ status, eventId, ...errDetails });
    }
  }

  _setStatus(status, err) {
    this.status = status;
    this._errorMessage = err;
    this.notifyConnectionStatusSubs(status);
  }

  /**
   *  merge querySubs from storage and in memory. Has the following side
   *  effects:
   *  - We notify all queryCbs because results may been added during merge
   */
  _onMergeQuerySubs = (_storageSubs, inMemorySubs) => {
    const storageSubs = _storageSubs || {};
    const ret = { ...inMemorySubs };

    // Consider an inMemorySub with no result;
    // If we have a result from storageSubs, let's add it
    Object.entries(inMemorySubs).forEach(([hash, querySub]) => {
      const storageResult = storageSubs?.[hash]?.result;
      const memoryResult = querySub.result;
      if (storageResult && !memoryResult) {
        ret[hash].result = storageResult;
      }
    });

    // Consider a storageSub with no corresponding inMemorySub
    // This means that at least at this point,
    // the user has not asked to subscribe to the query.
    // We may _still_ want to add it, because in just a
    // few milliseconds, the user will ask to subscribe to the
    // query.
    // For now, we can't really tell if the user will ask to subscribe
    // or not. So for now let's just add the first 10 queries from storage.
    // Eventually, we could be smarter about this. For example,
    // we can keep usage information about which queries are popular.
    const storageKsToAdd = Object.keys(storageSubs)
      .filter((k) => !inMemorySubs[k])
      .sort((a, b) => {
        // Sort by lastAccessed, newest first
        const aTime = storageSubs[a]?.lastAccessed || 0;
        const bTime = storageSubs[b]?.lastAccessed || 0;
        return bTime - aTime;
      })
      .slice(0, this.queryCacheLimit);

    storageKsToAdd.forEach((k) => {
      ret[k] = storageSubs[k];
    });

    // Okay, now we have merged our querySubs
    this.querySubs.set((_) => ret);

    this.loadedNotifyAll();
  };

  /**
   * merge pendingMutations from storage and in memory. Has a side effect of
   * sending mutations that were stored but not acked
   */
  _onMergePendingMutations = (storageMuts, inMemoryMuts) => {
    const ret = new Map([...storageMuts.entries(), ...inMemoryMuts.entries()]);
    this.pendingMutations.set((_) => ret);
    this.loadedNotifyAll();
    const rewrittenStorageMuts = this._rewriteMutationsSorted(
      this.attrs,
      storageMuts,
    );
    rewrittenStorageMuts.forEach(([k, mut]) => {
      if (!inMemoryMuts.has(k) && !mut['tx-id']) {
        this._sendMutation(k, mut);
      }
    });
  };

  _flushEnqueuedRoomData(roomId) {
    const enqueuedUserPresence = this._presence[roomId]?.result?.user;
    const enqueuedBroadcasts = this._broadcastQueue[roomId];

    this._broadcastQueue[roomId] = [];

    if (enqueuedUserPresence) {
      this._trySetPresence(roomId, enqueuedUserPresence);
    }

    if (enqueuedBroadcasts) {
      for (const item of enqueuedBroadcasts) {
        const { topic, roomType, data } = item;
        this._tryBroadcast(roomId, roomType, topic, data);
      }
    }
  }

  _handleReceive(wsId, msg) {
    // opt-out, enabled by default if schema
    const enableCardinalityInference =
      Boolean(this.config.schema) &&
      ('cardinalityInference' in this.config
        ? Boolean(this.config.cardinalityInference)
        : true);
    if (!ignoreLogging[msg.op]) {
      this._log.info('[receive]', wsId, msg.op, msg);
    }
    switch (msg.op) {
      case 'init-ok':
        this._setStatus(STATUS.AUTHENTICATED);
        this._reconnectTimeoutMs = 0;
        this._setAttrs(msg.attrs);
        this._flushPendingMessages();
        // (EPH): set session-id, so we know
        // which item is us
        this._sessionId = msg['session-id'];

        for (const roomId of Object.keys(this._rooms)) {
          const enqueuedUserPresence = this._presence[roomId]?.result?.user;
          this._tryJoinRoom(roomId, enqueuedUserPresence);
        }
        break;
      case 'add-query-exists':
        this.notifyOneQueryOnce(weakHash(msg.q));
        break;
      case 'add-query-ok':
        const { q, result } = msg;
        const hash = weakHash(q);
        const pageInfo = result?.[0]?.data?.['page-info'];
        const aggregate = result?.[0]?.data?.['aggregate'];
        const triples = extractTriples(result);
        const store = s.createStore(
          this.attrs,
          triples,
          enableCardinalityInference,
          this._linkIndex,
          this.config.useDateObjects,
        );
        this.querySubs.set((prev) => {
          prev[hash].result = {
            store,
            pageInfo,
            aggregate,
            processedTxId: msg['processed-tx-id'],
          };
          return prev;
        });
        this._cleanupPendingMutationsQueries();
        this.notifyOne(hash);
        this.notifyOneQueryOnce(hash);
        this._cleanupPendingMutationsTimeout();
        break;
      case 'refresh-ok':
        const { computations, attrs } = msg;
        this._setAttrs(attrs);

        this._cleanupPendingMutationsTimeout();

        const mutations = this._rewriteMutationsSorted(
          attrs,
          this.pendingMutations.currentValue,
        );

        const processedTxId = msg['processed-tx-id'];

        const updates = computations.map((x) => {
          const q = x['instaql-query'];
          const result = x['instaql-result'];
          const hash = weakHash(q);
          const triples = extractTriples(result);
          const store = s.createStore(
            this.attrs,
            triples,
            enableCardinalityInference,
            this._linkIndex,
            this.config.useDateObjects,
          );
          const newStore = this._applyOptimisticUpdates(
            store,
            mutations,
            processedTxId,
          );

          const pageInfo = result?.[0]?.data?.['page-info'];
          const aggregate = result?.[0]?.data?.['aggregate'];
          return { hash, store: newStore, pageInfo, aggregate };
        });

        updates.forEach(({ hash, store, pageInfo, aggregate }) => {
          this.querySubs.set((prev) => {
            prev[hash].result = { store, pageInfo, aggregate, processedTxId };
            return prev;
          });
        });

        this._cleanupPendingMutationsQueries();

        updates.forEach(({ hash }) => {
          this.notifyOne(hash);
        });
        break;
      case 'transact-ok':
        const { 'client-event-id': eventId, 'tx-id': txId } = msg;

        const muts = this._rewriteMutations(
          this.attrs,
          this.pendingMutations.currentValue,
        );
        const prevMutation = muts.get(eventId);
        if (!prevMutation) {
          break;
        }

        // update pendingMutation with server-side tx-id
        this.pendingMutations.set((prev) => {
          prev.set(eventId, {
            ...prev.get(eventId),
            'tx-id': txId,
            confirmed: Date.now(),
          });
          return prev;
        });

        this._cleanupPendingMutationsTimeout();

        const newAttrs = prevMutation['tx-steps']
          .filter(([action, ..._args]) => action === 'add-attr')
          .map(([_action, attr]) => attr)
          .concat(Object.values(this.attrs));

        this._setAttrs(newAttrs);

        this._finishTransaction('synced', eventId);
        break;
      case 'patch-presence': {
        const roomId = msg['room-id'];
        this._patchPresencePeers(roomId, msg['edits']);
        this._notifyPresenceSubs(roomId);
        break;
      }
      case 'refresh-presence': {
        const roomId = msg['room-id'];
        this._setPresencePeers(roomId, msg['data']);
        this._notifyPresenceSubs(roomId);
        break;
      }
      case 'server-broadcast':
        const room = msg['room-id'];
        const topic = msg.topic;
        this._notifyBroadcastSubs(room, topic, msg);
        break;
      case 'join-room-ok':
        const loadingRoomId = msg['room-id'];
        const joinedRoom = this._rooms[loadingRoomId];

        if (!joinedRoom) {
          if (this._roomsPendingLeave[loadingRoomId]) {
            this._tryLeaveRoom(loadingRoomId);
            delete this._roomsPendingLeave[loadingRoomId];
          }

          break;
        }

        joinedRoom.isConnected = true;
        this._notifyPresenceSubs(loadingRoomId);
        this._flushEnqueuedRoomData(loadingRoomId);
        break;
      case 'join-room-error':
        const errorRoomId = msg['room-id'];
        const errorRoom = this._rooms[errorRoomId];
        if (errorRoom) {
          errorRoom.error = msg['error'];
        }
        this._notifyPresenceSubs(errorRoomId);
        break;
      case 'error':
        this._handleReceiveError(msg);
        break;
      default:
        break;
    }
  }

  /**
   * @param {'timeout' | 'error'} status
   * @param {string} eventId
   * @param {{message?: string, hint?: string, error?: Error}} errDetails
   */
  _handleMutationError(status, eventId, errDetails) {
    const mut = this.pendingMutations.currentValue.get(eventId);

    if (mut && (status !== 'timeout' || !mut['tx-id'])) {
      this.pendingMutations.set((prev) => {
        prev.delete(eventId);
        return prev;
      });
      this.notifyAll();
      this.notifyAttrsSubs();
      this.notifyMutationErrorSubs(errDetails);
      this._finishTransaction(status, eventId, errDetails);
    }
  }

  _handleReceiveError(msg) {
    const eventId = msg['client-event-id'];
    const prevMutation = this.pendingMutations.currentValue.get(eventId);
    const errorMessage = {
      message: msg.message || 'Uh-oh, something went wrong. Ping Joe & Stopa.',
    };

    if (msg.hint) {
      errorMessage.hint = msg.hint;
    }

    if (prevMutation) {
      // This must be a transaction error
      const errDetails = {
        message: msg.message,
        hint: msg.hint,
      };
      this._handleMutationError('error', eventId, errDetails);
      return;
    }

    if (
      msg['original-event']?.hasOwnProperty('q') &&
      msg['original-event']?.op === 'add-query'
    ) {
      const q = msg['original-event']?.q;
      const hash = weakHash(q);
      this.notifyQueryError(weakHash(q), errorMessage);
      this.notifyQueryOnceError(q, hash, eventId, errorMessage);
      return;
    }

    const isInitError = msg['original-event']?.op === 'init';
    if (isInitError) {
      if (
        msg.type === 'record-not-found' &&
        msg.hint?.['record-type'] === 'app-user'
      ) {
        // User has been logged out
        this.changeCurrentUser(null);
        return;
      }

      // We failed to init

      this._setStatus(STATUS.ERRORED, errorMessage);
      this.notifyAll();
      return;
    }
    // We've caught some error which has no corresponding listener.
    // Let's console.error to let the user know.
    const errorObj = { ...msg };
    delete errorObj.message;
    delete errorObj.hint;
    console.error(msg.message, errorObj);
    if (msg.hint) {
      console.error(
        'This error comes with some debugging information. Here it is: \n',
        msg.hint,
      );
    }
  }

  notifyQueryOnceError(q, hash, eventId, e) {
    const r = this.queryOnceDfds[hash]?.find((r) => r.eventId === eventId);
    if (!r) return;
    r.dfd.reject(e);
    this._completeQueryOnce(q, hash, r.dfd);
  }

  _setAttrs(attrs) {
    // Debug: Log attrs being set to understand schema differences
    this._log.info('[attrs] Setting attrs:', attrs.length);
    
    // Check for testEvents entity and eventDate field specifically
    const testEventAttrs = attrs.filter(attr => 
      attr['forward-identity'] && 
      attr['forward-identity'][1] === 'testEvents'
    );
    
    if (testEventAttrs.length > 0) {
      this._log.info('[attrs] Found testEvents attrs:', testEventAttrs.map(attr => ({
        field: attr['forward-identity'][2],
        'checked-data-type': attr['checked-data-type'],
        'value-type': attr['value-type']
      })));
    } else {
      this._log.info('[attrs] No testEvents entity found in server attrs');
    }
    
    // Check for any date fields
    const dateAttrs = attrs.filter(attr => attr['checked-data-type'] === 'date');
    this._log.info('[attrs] Date fields found:', dateAttrs.map(attr => ({
      entity: attr['forward-identity']?.[1],
      field: attr['forward-identity']?.[2],
      'checked-data-type': attr['checked-data-type']
    })));

    // Merge with local schema information to preserve checked-data-type
    const mergedAttrs = this._mergeAttrsWithLocalSchema(attrs);

    this.attrs = mergedAttrs.reduce((acc, attr) => {
      acc[attr.id] = attr;
      return acc;
    }, {});

    this.notifyAttrsSubs();
  }

  _mergeAttrsWithLocalSchema(serverAttrs) {
    // If no local schema or no existing attrs, just use server attrs
    if (!this.config.schema || !this.attrs) {
      return serverAttrs;
    }

    this._log.info('[attrs] Merging server attrs with local schema information');

    // Create a lookup for existing local attrs by entity.field
    const localAttrsByKey = {};
    if (this.attrs) {
      for (const attr of Object.values(this.attrs)) {
        if (attr['forward-identity'] && attr['forward-identity'].length >= 3) {
          const [_, entity, field] = attr['forward-identity'];
          const key = `${entity}.${field}`;
          localAttrsByKey[key] = attr;
        }
      }
    }

    // Merge server attrs with local schema data type information
    const mergedAttrs = serverAttrs.map(serverAttr => {
      if (!serverAttr['forward-identity'] || serverAttr['forward-identity'].length < 3) {
        return serverAttr;
      }

      const [_, entity, field] = serverAttr['forward-identity'];
      const key = `${entity}.${field}`;
      const localAttr = localAttrsByKey[key];

      // If we have a local attr with checked-data-type info, preserve it
      if (localAttr && localAttr['checked-data-type'] && !serverAttr['checked-data-type']) {
        this._log.info(`[attrs] Preserving local checked-data-type for ${key}: ${localAttr['checked-data-type']}`);
        return {
          ...serverAttr,
          'checked-data-type': localAttr['checked-data-type']
        };
      }

      return serverAttr;
    });

    // Add any local attrs that don't exist on the server (for demo entities like testEvents)
    const serverAttrKeys = new Set(serverAttrs
      .filter(attr => attr['forward-identity'] && attr['forward-identity'].length >= 3)
      .map(attr => `${attr['forward-identity'][1]}.${attr['forward-identity'][2]}`));

    for (const [key, localAttr] of Object.entries(localAttrsByKey)) {
      if (!serverAttrKeys.has(key) && localAttr.isUnsynced) {
        this._log.info(`[attrs] Adding unsynced local attr: ${key}`);
        mergedAttrs.push(localAttr);
      }
    }

    return mergedAttrs;
  }

  _initAttrsFromSchema() {
    if (!this.config.schema) {
      this._log.info('[schema] No schema provided, skipping attrs initialization');
      return;
    }

    this._log.info('[schema] Initializing attrs from local schema for offline mode');
    
    const attrs = [];
    const schema = this.config.schema;
    
    // Convert each entity and its attributes to internal attrs format
    for (const [entityName, entityDef] of Object.entries(schema.entities)) {
      // Add id attribute for each entity
      const idAttr = {
        id: uuid(),
        'forward-identity': [uuid(), entityName, 'id'],
        'value-type': 'blob',
        cardinality: 'one',
        'unique?': true,
        'index?': false,
        isUnsynced: true,
      };
      attrs.push(idAttr);

      // Add all other attributes for this entity
      for (const [attrName, attrDef] of Object.entries(entityDef.attrs)) {
        const attr = {
          id: uuid(),
          'forward-identity': [uuid(), entityName, attrName],
          'value-type': 'blob',
          cardinality: 'one',
          'unique?': attrDef.config?.unique || false,
          'index?': attrDef.config?.indexed || false,
          'checked-data-type': instaml.checkedDataTypeOfValueType(attrDef.valueType),
          isUnsynced: true,
        };
        attrs.push(attr);
      }
    }

    this._log.info(`[schema] Generated ${attrs.length} attrs from schema`);
    
    // Set the attrs using the existing method
    this._setAttrs(attrs);
  }

  // ---------------------------
  // Queries

  getPreviousResult = (q) => {
    const hash = weakHash(q);
    return this.dataForQuery(hash);
  };

  _startQuerySub(q, hash) {
    const eventId = uuid();
    this.querySubs.set((prev) => {
      prev[hash] = prev[hash] || { q, result: null, eventId };
      return prev;
    });
    this._trySendAuthed(eventId, { op: 'add-query', q });

    return eventId;
  }

  /**
   *  When a user subscribes to a query the following side effects occur:
   *
   *  - We update querySubs to include the new query
   *  - We update queryCbs to include the new cb
   *  - If we already have a result for the query we call cb immediately
   *  - We send the server an `add-query` message
   *
   *  Returns an unsubscribe function
   */
  subscribeQuery(q, cb, opts) {
    if (opts && 'ruleParams' in opts) {
      q = { $$ruleParams: opts['ruleParams'], ...q };
    }

    const hash = weakHash(q);

    const prevResult = this.getPreviousResult(q);
    if (prevResult) {
      cb(prevResult);
    } else if (!this._isOnline) {
      // In offline mode, ensure we have a querySub so notifications work
      this.querySubs.set((prev) => {
        if (!prev[hash]) {
          prev[hash] = {
            q,
            result: {
              store: s.createStore(this.optimisticAttrs(), [], true, this._linkIndex),
              pageInfo: null,
              aggregate: null,
              processedTxId: null,
            },
            eventId: uuid(),
          };
        }
        return prev;
      });

      // Call the callback immediately with current data
      const currentResult = this.dataForQuery(hash);
      if (currentResult) {
        cb(currentResult);
      }
    }

    this.queryCbs[hash] = this.queryCbs[hash] ?? [];
    this.queryCbs[hash].push({ q, cb });

    if (this._isOnline) {
      this._startQuerySub(q, hash);
    }

    return () => {
      this._unsubQuery(q, hash, cb);
    };
  }

  /**
   * Generate empty result structure based on query shape
   * @param {Object} query - The query object
   * @returns {Object} Empty result matching query structure
   */
  _generateEmptyResult(query) {
    const data = {};
    
    // Extract entity names from query (skip special keys like $$ruleParams)
    Object.keys(query).forEach(key => {
      if (!key.startsWith('$$')) {
        data[key] = [];
      }
    });
    
    return { data };
  }

  queryOnce(q, opts) {
    if (opts && 'ruleParams' in opts) {
      q = { $$ruleParams: opts['ruleParams'], ...q };
    }

    const dfd = new Deferred();

    if (!this.querySubs) {
      dfd.reject(
        new Error(
          "We can't run `queryOnce` on the backend. Use adminAPI.query instead: https://www.instantdb.com/docs/backend#query",
        ),
      );
      return dfd.promise;
    }

    const hash = weakHash(q);

    // For offline mode, return cached data immediately if available
    if (!this._isOnline) {
      const cachedResult = this.getPreviousResult(q);
      if (cachedResult) {
        dfd.resolve(cachedResult);
        return dfd.promise;
      }
      
      // If no cached data, create a minimal querySub with empty store
      // so that dataForQuery can process pending mutations
      this.querySubs.set((prev) => {
        if (!prev[hash]) {
          prev[hash] = {
            q,
            result: {
              store: s.createStore(this.optimisticAttrs(), [], true, this._linkIndex),
              pageInfo: null,
              aggregate: null,
              processedTxId: null,
            },
            eventId: uuid(),
          };
        }
        return prev;
      });
      
      // Now use dataForQuery to get the result with pending mutations applied
      const result = this.dataForQuery(hash);
      if (result) {
        dfd.resolve(result);
      } else {
        // Fallback to empty result if dataForQuery fails
        const emptyResult = this._generateEmptyResult(q);
        dfd.resolve(emptyResult);
      }
      return dfd.promise;
    }

    const eventId = this._startQuerySub(q, hash);

    this.queryOnceDfds[hash] = this.queryOnceDfds[hash] ?? [];
    this.queryOnceDfds[hash].push({ q, dfd, eventId });

    setTimeout(
      () => dfd.reject(new Error('Query timed out')),
      QUERY_ONCE_TIMEOUT,
    );

    return dfd.promise;
  }

  _completeQueryOnce(q, hash, dfd) {
    if (!this.queryOnceDfds[hash]) return;

    this.queryOnceDfds[hash] = this.queryOnceDfds[hash].filter(
      (r) => r.dfd !== dfd,
    );

    this._cleanupQuery(q, hash);
  }

  _unsubQuery(q, hash, cb) {
    if (!this.queryCbs[hash]) return;

    this.queryCbs[hash] = this.queryCbs[hash].filter((r) => r.cb !== cb);

    this._cleanupQuery(q, hash);
  }

  _cleanupQuery(q, hash) {
    const hasListeners =
      this.queryCbs[hash]?.length || this.queryOnceDfds[hash]?.length;

    if (hasListeners) return;

    delete this.queryCbs[hash];
    delete this.queryOnceDfds[hash];

    this._trySendAuthed(uuid(), { op: 'remove-query', q });
  }

  // When we `pushTx`, it's possible that we don't yet have `this.attrs`
  // This means that `tx-steps` in `pendingMutations` will include `add-attr`
  // commands for attrs that already exist.
  //
  // This will also affect `add-triple` and `retract-triple` which
  // reference attr-ids that do not match the server.
  //
  // We fix this by rewriting `tx-steps` in each `pendingMutation`.
  // We remove `add-attr` commands for attrs that already exist.
  // We update `add-triple` and `retract-triple` commands to use the
  // server attr-ids.
  _rewriteMutations(attrs, muts) {
    if (!attrs) return muts;
    const findExistingAttr = (attr) => {
      const [_, etype, label] = attr['forward-identity'];
      const existing = instaml.getAttrByFwdIdentName(attrs, etype, label);
      return existing;
    };
    const findReverseAttr = (attr) => {
      const [_, etype, label] = attr['forward-identity'];
      const revAttr = instaml.getAttrByReverseIdentName(attrs, etype, label);
      return revAttr;
    };
    const mapping = { attrIdMap: {}, refSwapAttrIds: new Set() };
    const rewriteTxSteps = (txSteps) => {
      const retTxSteps = [];
      for (const txStep of txSteps) {
        const [action] = txStep;

        // Handles add-attr
        // If existing, we drop it, and track it
        // to update add/retract triples
        if (action === 'add-attr') {
          const [_action, attr] = txStep;
          const existing = findExistingAttr(attr);
          if (existing) {
            mapping.attrIdMap[attr.id] = existing.id;
            continue;
          }
          if (attr['value-type'] === 'ref') {
            const revAttr = findReverseAttr(attr);
            if (revAttr) {
              mapping.attrIdMap[attr.id] = revAttr.id;
              mapping.refSwapAttrIds.add(attr.id);
              continue;
            }
          }
        }

        // Handles add-triple|retract-triple
        // If in mapping, we update the attr-id
        const newTxStep = instaml.rewriteStep(mapping, txStep);

        retTxSteps.push(newTxStep);
      }
      return retTxSteps;
    };
    const rewritten = new Map();
    for (const [k, mut] of muts.entries()) {
      rewritten.set(k, { ...mut, 'tx-steps': rewriteTxSteps(mut['tx-steps']) });
    }
    return rewritten;
  }

  _rewriteMutationsSorted(attrs, muts) {
    return sortedMutationEntries(this._rewriteMutations(attrs, muts).entries());
  }

  // ---------------------------
  // Transact

  optimisticAttrs() {
    const pendingMutationSteps = [
      ...this.pendingMutations.currentValue.values(),
    ] // hack due to Map()
      .flatMap((x) => x['tx-steps']);

    const deletedAttrIds = new Set(
      pendingMutationSteps
        .filter(([action, _attr]) => action === 'delete-attr')
        .map(([_action, id]) => id),
    );

    const pendingAttrs = [];
    for (const [_action, attr] of pendingMutationSteps) {
      if (_action === 'add-attr') {
        pendingAttrs.push(attr);
      } else if (
        _action === 'update-attr' &&
        attr.id &&
        this.attrs?.[attr.id]
      ) {
        const fullAttr = { ...this.attrs[attr.id], ...attr };
        pendingAttrs.push(fullAttr);
      }
    }

    const attrsWithoutDeleted = [
      ...Object.values(this.attrs || {}),
      ...pendingAttrs,
    ].filter((a) => !deletedAttrIds.has(a.id));

    const attrsRecord = Object.fromEntries(
      attrsWithoutDeleted.map((a) => [a.id, a]),
    );

    return attrsRecord;
  }

  /** Runs instaql on a query and a store */
  dataForQuery(hash) {
    const errorMessage = this._errorMessage;
    if (errorMessage) {
      return { error: errorMessage };
    }
    if (!this.querySubs) return;
    if (!this.pendingMutations) return;
    const querySubVersion = this.querySubs.version();
    const querySubs = this.querySubs.currentValue;
    const pendingMutationsVersion = this.pendingMutations.version();
    const pendingMutations = this.pendingMutations.currentValue;

    const { q, result } = querySubs[hash] || {};
    if (!result) return;

    const cached = this._dataForQueryCache[hash];
    if (
      cached &&
      querySubVersion === cached.querySubVersion &&
      pendingMutationsVersion === cached.pendingMutationsVersion
    ) {
      return cached.data;
    }

    const { store, pageInfo, aggregate, processedTxId } = result;
    const mutations = this._rewriteMutationsSorted(
      store.attrs,
      pendingMutations,
    );
    const newStore = this._applyOptimisticUpdates(
      store,
      mutations,
      processedTxId,
    );
    const resp = instaql({ store: newStore, pageInfo, aggregate }, q);

    this._dataForQueryCache[hash] = {
      querySubVersion,
      pendingMutationsVersion,
      data: resp,
    };

    return resp;
  }

  _applyOptimisticUpdates(store, mutations, processedTxId) {
    for (const [_, mut] of mutations) {
      if (!mut['tx-id'] || (processedTxId && mut['tx-id'] > processedTxId)) {
        store = s.transact(store, mut['tx-steps']);
      }
    }
    return store;
  }

  /** Re-run instaql and call all callbacks with new data */
  notifyOne = (hash) => {
    const cbs = this.queryCbs[hash] ?? [];
    const prevData = this._dataForQueryCache[hash]?.data;
    const data = this.dataForQuery(hash);

    console.log('[DEBUG NOTIFY ONE] hash:', hash, 'callbacks:', cbs.length, 'hasData:', !!data, 'dataChanged:', !areObjectsDeepEqual(data, prevData));
    if (data && data.data) {
      console.log('[DEBUG NOTIFY ONE] data keys:', Object.keys(data.data), 'sample values:', Object.values(data.data).map(arr => Array.isArray(arr) ? arr.length : 'not array'));
    }

    // Don't return early if there's no data - we need to notify with empty state
    // if (!data) return;  // <-- REMOVED: This was preventing callbacks from being called with empty data
    if (areObjectsDeepEqual(data, prevData)) return;

    console.log('[DEBUG NOTIFY ONE] *** CALLING ***', cbs.length, 'callbacks with data:', !!data);
    cbs.forEach((r) => r.cb(data));
  };

  notifyOneQueryOnce = (hash) => {
    const dfds = this.queryOnceDfds[hash] ?? [];
    const data = this.dataForQuery(hash);

    dfds.forEach((r) => {
      this._completeQueryOnce(r.q, hash, r.dfd);
      r.dfd.resolve(data);
    });
  };

  notifyQueryError = (hash, error) => {
    const cbs = this.queryCbs[hash] || [];
    cbs.forEach((r) => r.cb({ error }));
  };

  /** Re-compute all subscriptions */
  notifyAll() {
    console.log('[DEBUG NOTIFY] notifyAll called, queryCbs keys:', Object.keys(this.queryCbs).length);
    Object.keys(this.queryCbs).forEach((hash) => {
      console.log('[DEBUG NOTIFY] notifying hash:', hash, 'callbacks:', this.queryCbs[hash]?.length);
      this.notifyOne(hash);
    });
    console.log('[DEBUG NOTIFY] notifyAll completed');
  }

  loadedNotifyAll() {
    if (this.pendingMutations.isLoading() || this.querySubs.isLoading()) return;
    this.notifyAll();
  }

  /** Applies transactions locally and sends transact message to server */
  pushTx = (chunks) => {
    try {
      const txSteps = instaml.transform(
        {
          attrs: this.optimisticAttrs(),
          schema: this.config.schema,
          useDateObjects: this.config.useDateObjects,
          stores: Object.values(this.querySubs.currentValue).map(
            (sub) => sub?.result?.store,
          ),
        },
        chunks,
      );
      return this.pushOps(txSteps);
    } catch (e) {
      return this.pushOps([], e);
    }
  };

  /**
   * @param {*} txSteps
   * @param {*} [error]
   * @returns
   */
  pushOps = (txSteps, error) => {
    const eventId = uuid();
    const mutations = [...this.pendingMutations.currentValue.values()];
    const order = Math.max(0, ...mutations.map((mut) => mut.order || 0)) + 1;
    const mutation = {
      op: 'transact',
      'tx-steps': txSteps,
      created: Date.now(),
      error,
      order,
    };
    this.pendingMutations.set((prev) => {
      prev.set(eventId, mutation);
      return prev;
    });

    const dfd = new Deferred();
    this.mutationDeferredStore.set(eventId, dfd);
    this._sendMutation(eventId, mutation);

    this.notifyAll();

    return dfd.promise;
  };

  shutdown() {
    this._log.info('[shutdown]', this.config.appId);
    this._isShutdown = true;
    this._ws?.close();
  }

  /**
   * Clears all local data from IndexedDB and resets the database to an empty state
   */
  async clear() {
    this._log.info('[clear]', this.config.appId, 'Clearing all local data');
    console.log('[DEBUG CLEAR] Starting clear operation, callbacks before:', Object.keys(this.queryCbs).length);
    
    // Clear IndexedDB storage completely
    if (this._persister && this._persister._dbPromise) {
      try {
        const db = await this._persister._dbPromise;
        const transaction = db.transaction([this._persister._storeName], 'readwrite');
        const objectStore = transaction.objectStore(this._persister._storeName);
        await new Promise((resolve, reject) => {
          const request = objectStore.clear();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
        console.log('[DEBUG CLEAR] IndexedDB cleared successfully');
      } catch (error) {
        this._log.error('[clear] Failed to clear IndexedDB:', error);
        console.error('[DEBUG CLEAR] IndexedDB clear failed:', error);
      }
    }

    // Reset PersistedObjects to their default values
    // Don't clear querySubs completely - just clear their results but keep the query structures
    this.querySubs.set((prev) => {
      const cleared = {};
      Object.keys(prev).forEach(hash => {
        cleared[hash] = {
          ...prev[hash],
          result: {
            store: s.createStore(this.optimisticAttrs(), [], true, this._linkIndex),
            pageInfo: null,
            aggregate: null,
            processedTxId: null,
          }
        };
      });
      return cleared;
    });
    this.pendingMutations.set(() => new Map());
    console.log('[DEBUG CLEAR] PersistedObjects reset (keeping query structures)');

    // Notify all subscribers that data has been cleared BEFORE clearing callbacks
    console.log('[DEBUG CLEAR] About to call notifyAll(), callbacks:', Object.keys(this.queryCbs).length);
    this.notifyAll();
    console.log('[DEBUG CLEAR] notifyAll() completed');

    // Clear in-memory state (but keep queryCbs so React components stay subscribed)
    // this.queryCbs = {};  // <-- DON'T clear this! React components need to stay subscribed
    this.queryOnceDfds = {};
    this.mutationDeferredStore.clear();
    this._dataForQueryCache = {};
    this._localIdPromises = {};
    this.attrs = null;
    this._errorMessage = null;
    console.log('[DEBUG CLEAR] In-memory state cleared (keeping queryCbs for React subscriptions)');

    // Clear room and presence data
    this._rooms = {};
    this._roomsPendingLeave = {};
    this._presence = {};
    this._broadcastQueue = [];
    this._broadcastSubs = {};

    // Clear auth data
    this._currentUserCached = { isLoading: true, error: undefined, user: undefined };

    // Notify all connection status subscribers that we've reset
    this.notifyConnectionStatusSubs(this.status);
    
    this._log.info('[clear]', this.config.appId, 'Local data cleared successfully');
    console.log('[DEBUG CLEAR] Clear operation completed');
  }

  /**
   * Sends mutation to server and schedules a timeout to cancel it if
   * we don't hear back in time.
   * Note: If we're offline we don't schedule a timeout, we'll schedule it
   * later once we're back online and send the mutation again
   *
   */
  _sendMutation(eventId, mutation) {
    if (mutation.error) {
      this._handleMutationError('error', eventId, {
        error: mutation.error,
        message: mutation.error.message,
      });
      return;
    }
    if (this.status !== STATUS.AUTHENTICATED) {
      this._finishTransaction('enqueued', eventId);
      return;
    }
    const timeoutMs = Math.max(
      5000,
      this.pendingMutations.currentValue.size * 5000,
    );

    if (!this._isOnline) {
      this._finishTransaction('enqueued', eventId);
    } else {
      this._trySend(eventId, mutation);

      setTimeout(() => {
        if (!this._isOnline) {
          return;
        }
        // If we are here, this means that we have sent this mutation, we are online
        // but we have not received a response. If it's this long, something must be wrong,
        // so we error with a timeout.
        this._handleMutationError('timeout', eventId, {
          message: 'transaction timed out',
        });
      }, timeoutMs);
    }
  }

  // ---------------------------
  // Websocket

  /** Send messages we accumulated while we were connecting */
  _flushPendingMessages() {
    const subs = Object.keys(this.queryCbs).map((hash) => {
      return this.querySubs.currentValue[hash];
    });
    // Note: we should not have any nulls in subs, but we're
    // doing this defensively just in case.
    const safeSubs = subs.filter((x) => x);
    safeSubs.forEach(({ eventId, q }) => {
      this._trySendAuthed(eventId, { op: 'add-query', q });
    });

    Object.values(this.queryOnceDfds)
      .flat()
      .forEach(({ eventId, q }) => {
        this._trySendAuthed(eventId, { op: 'add-query', q });
      });

    const muts = this._rewriteMutationsSorted(
      this.attrs,
      this.pendingMutations.currentValue,
    );
    muts.forEach(([eventId, mut]) => {
      if (!mut['tx-id']) {
        this._sendMutation(eventId, mut);
      }
    });
  }

  /**
   * Clean up pendingMutations that all queries have seen
   */
  _cleanupPendingMutationsQueries() {
    let minProcessedTxId = Number.MAX_SAFE_INTEGER;
    for (const { result } of Object.values(this.querySubs.currentValue)) {
      if (result?.processedTxId) {
        minProcessedTxId = Math.min(minProcessedTxId, result?.processedTxId);
      }
    }

    this.pendingMutations.set((prev) => {
      for (const [eventId, mut] of Array.from(prev.entries())) {
        if (mut['tx-id'] && mut['tx-id'] <= minProcessedTxId) {
          prev.delete(eventId);
        }
      }
      return prev;
    });
  }

  /**
   * After mutations is confirmed by server, we give each query 30 sec
   * to update its results. If that doesn't happen, we assume query is
   * unaffected by this mutation and it's safe to delete it from local queue
   */
  _cleanupPendingMutationsTimeout() {
    const now = Date.now();

    if (this.pendingMutations.currentValue.size < 200) {
      return;
    }

    this.pendingMutations.set((prev) => {
      let deleted = false;
      let timeless = false;

      for (const [eventId, mut] of Array.from(prev.entries())) {
        if (!mut.confirmed) {
          timeless = true;
        }
        if (mut.confirmed && mut.confirmed + PENDING_TX_CLEANUP_TIMEOUT < now) {
          prev.delete(eventId);
          deleted = true;
        }
      }

      // backwards compat for mutations with no `confirmed`
      if (deleted && timeless) {
        for (const [eventId, mut] of Array.from(prev.entries())) {
          if (!mut.confirmed) {
            prev.delete(eventId);
          }
        }
      }
      return prev;
    });
  }

  _trySendAuthed(...args) {
    if (this.status !== STATUS.AUTHENTICATED) {
      return;
    }
    this._trySend(...args);
  }

  _trySend(eventId, msg, opts) {
    if (this._ws.readyState !== WS_OPEN_STATUS) {
      return;
    }
    if (!ignoreLogging[msg.op]) {
      this._log.info('[send]', this._ws._id, msg.op, msg);
    }
    this._ws.send(JSON.stringify({ 'client-event-id': eventId, ...msg }));
  }

  _wsOnOpen = (e) => {
    const targetWs = e.target;
    if (this._ws !== targetWs) {
      this._log.info(
        '[socket][open]',
        targetWs._id,
        'skip; this is no longer the current ws',
      );
      return;
    }
    this._log.info('[socket][open]', this._ws._id);
    this._setStatus(STATUS.OPENED);
    this.getCurrentUser()
      .then((resp) => {
        this._trySend(uuid(), {
          op: 'init',
          'app-id': this.config.appId,
          'refresh-token': resp.user?.['refresh_token'],
          versions: this.versions,
          // If an admin token is provided for an app, we will
          // skip all permission checks. This is an advanced feature,
          // to let users write internal tools
          // This option is not exposed in `Config`, as it's
          // not ready for prime time
          '__admin-token': this.config.__adminToken,
        });
      })
      .catch((e) => {
        this._log.error('[socket][error]', targetWs._id, e);
      });
  };

  _wsOnMessage = (e) => {
    const targetWs = e.target;
    const m = JSON.parse(e.data.toString());
    if (this._ws !== targetWs) {
      this._log.info(
        '[socket][message]',
        targetWs._id,
        m,
        'skip; this is no longer the current ws',
      );
      return;
    }
    this._handleReceive(targetWs._id, JSON.parse(e.data.toString()));
  };

  _wsOnError = (e) => {
    const targetWs = e.target;
    if (this._ws !== targetWs) {
      this._log.info(
        '[socket][error]',
        targetWs._id,
        'skip; this is no longer the current ws',
      );
      return;
    }
    this._log.error('[socket][error]', targetWs._id, e);
  };

  _wsOnClose = (e) => {
    const targetWs = e.target;
    if (this._ws !== targetWs) {
      this._log.info(
        '[socket][close]',
        targetWs._id,
        'skip; this is no longer the current ws',
      );
      return;
    }

    this._setStatus(STATUS.CLOSED);

    for (const room of Object.values(this._rooms)) {
      room.isConnected = false;
    }

    if (this._isShutdown) {
      this._log.info(
        '[socket][close]',
        targetWs._id,
        'Reactor has been shut down and will not reconnect',
      );
      return;
    }
    this._log.info(
      '[socket][close]',
      targetWs._id,
      'schedule reconnect, ms =',
      this._reconnectTimeoutMs,
    );
    setTimeout(() => {
      this._reconnectTimeoutMs = Math.min(
        this._reconnectTimeoutMs + 1000,
        10000,
      );
      if (!this._isOnline) {
        this._log.info(
          '[socket][close]',
          targetWs._id,
          'we are offline, no need to start socket',
        );
        return;
      }
      this._startSocket();
    }, this._reconnectTimeoutMs);
  };

  _startSocket() {
    if (this._isShutdown) {
      this._log.info(
        '[socket][start]',
        this.config.appId,
        'Reactor has been shut down and will not start a new socket',
      );
      return;
    }
    if (this._ws && this._ws.readyState == WS_CONNECTING_STATUS) {
      // Our current websocket is in a 'connecting' state.
      // There's no need to start another one, as the socket is
      // effectively fresh.
      this._log.info(
        '[socket][start]',
        this._ws._id,
        'maintained as current ws, we were still in a connecting state',
      );
      return;
    }
    const prevWs = this._ws;
    this._ws = createWebSocket(
      `${this.config.websocketURI}?app_id=${this.config.appId}`,
    );
    this._ws.onopen = this._wsOnOpen;
    this._ws.onmessage = this._wsOnMessage;
    this._ws.onclose = this._wsOnClose;
    this._ws.onerror = this._wsOnError;
    this._log.info('[socket][start]', this._ws._id);
    if (prevWs?.readyState === WS_OPEN_STATUS) {
      // When the network dies, it doesn't always mean that our
      // socket connection will fire a close event.
      //
      // We _could_ re-use the old socket, if the network drop was a
      // few seconds. But, to be safe right now we always create a new socket.
      //
      // This means that we have to make sure to kill the previous one ourselves.
      // c.f https://issues.chromium.org/issues/41343684
      this._log.info(
        '[socket][start]',
        this._ws._id,
        'close previous ws id = ',
        prevWs._id,
      );
      prevWs.close();
    }
  }

  /**
   * Given a key, returns a stable local id, unique to this device and app.
   *
   * This can be useful if you want to create guest ids for example.
   *
   * Note: If the user deletes their local storage, this id will change.
   *
   * We use this._localIdPromises to ensure that we only generate a local
   * id once, even if multiple callers call this function concurrently.
   */
  async getLocalId(name) {
    const k = `localToken_${name}`;
    const id = await this._persister.getItem(k);
    if (id) return id;
    if (this._localIdPromises[k]) {
      return this._localIdPromises[k];
    }
    const newId = uuid();
    this._localIdPromises[k] = this._persister
      .setItem(k, newId)
      .then(() => newId);
    return this._localIdPromises[k];
  }

  // ----
  // Auth
  _replaceUrlAfterOAuth() {
    if (typeof URL === 'undefined') {
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get(OAUTH_REDIRECT_PARAM)) {
      const startUrl = url.toString();
      url.searchParams.delete(OAUTH_REDIRECT_PARAM);
      url.searchParams.delete('code');
      url.searchParams.delete('error');
      const newPath =
        url.pathname +
        (url.searchParams.size ? '?' + url.searchParams : '') +
        url.hash;
      // Note: In next.js, this will revert to the old state if user navigates
      //       back. We would need to allow framework specific routing to work
      //       around that problem.
      history.replaceState(history.state, '', newPath);

      // navigation is part of the HTML spec, but not supported by Safari
      // or Firefox yet:
      // https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API#browser_compatibility
      if (
        // @ts-ignore (waiting for ts support)
        typeof navigation === 'object' &&
        // @ts-ignore (waiting for ts support)
        typeof navigation.addEventListener === 'function' &&
        // @ts-ignore (waiting for ts support)
        typeof navigation.removeEventListener === 'function'
      ) {
        let ran = false;

        // The next.js app router will reset the URL when the router loads.
        // This puts it back after the router loads.
        const listener = (e) => {
          if (!ran) {
            ran = true;
            // @ts-ignore (waiting for ts support)
            navigation.removeEventListener('navigate', listener);
            if (
              !e.userInitiated &&
              e.navigationType === 'replace' &&
              e.destination?.url === startUrl
            ) {
              history.replaceState(history.state, '', newPath);
            }
          }
        };
        // @ts-ignore (waiting for ts support)
        navigation.addEventListener('navigate', listener);
      }
    }
  }

  /**
   *
   * @returns Promise<null | {error: {message: string}}>
   */
  async _oauthLoginInit() {
    if (
      typeof window === 'undefined' ||
      typeof window.location === 'undefined' ||
      typeof URLSearchParams === 'undefined'
    ) {
      return null;
    }
    const params = new URLSearchParams(window.location.search);
    if (!params.get(OAUTH_REDIRECT_PARAM)) {
      return null;
    }

    const error = params.get('error');
    if (error) {
      this._replaceUrlAfterOAuth();
      return { error: { message: error } };
    }
    const code = params.get('code');
    if (!code) {
      return null;
    }
    this._replaceUrlAfterOAuth();
    try {
      const { user } = await authAPI.exchangeCodeForToken({
        apiURI: this.config.apiURI,
        appId: this.config.appId,
        code,
      });
      this.setCurrentUser(user);
      return null;
    } catch (e) {
      if (
        e?.body?.type === 'record-not-found' &&
        e?.body?.hint?.['record-type'] === 'app-oauth-code' &&
        (await this._hasCurrentUser())
      ) {
        // We probably just weren't able to clean up the URL, so
        // let's just ignore this error
        return null;
      }
      const message = e?.body?.message || 'Error logging in.';
      return { error: { message } };
    }
  }

  async _waitForOAuthCallbackResponse() {
    return await this._oauthCallbackResponse;
  }

  __subscribeMutationErrors(cb) {
    this.mutationErrorCbs.push(cb);

    return () => {
      this.mutationErrorCbs = this.mutationErrorCbs.filter((x) => x !== cb);
    };
  }

  subscribeAuth(cb) {
    this.authCbs.push(cb);
    const currUserCached = this._currentUserCached;
    if (!currUserCached.isLoading) {
      cb(this._currentUserCached);
    }
    let unsubbed = false;
    this.getCurrentUser().then((resp) => {
      if (unsubbed) return;
      if (areObjectsDeepEqual(resp, currUserCached)) return;
      cb(resp);
    });
    return () => {
      unsubbed = true;
      this.authCbs = this.authCbs.filter((x) => x !== cb);
    };
  }

  async getAuth() {
    const { user, error } = await this.getCurrentUser();
    if (error) {
      throw error;
    }
    return user;
  }

  subscribeConnectionStatus(cb) {
    this.connectionStatusCbs.push(cb);

    return () => {
      this.connectionStatusCbs = this.connectionStatusCbs.filter(
        (x) => x !== cb,
      );
    };
  }

  subscribeAttrs(cb) {
    this.attrsCbs.push(cb);

    if (this.attrs) {
      cb(this.attrs);
    }

    return () => {
      this.attrsCbs = this.attrsCbs.filter((x) => x !== cb);
    };
  }

  notifyAuthSubs(user) {
    this.authCbs.forEach((cb) => cb(user));
  }

  notifyMutationErrorSubs(error) {
    this.mutationErrorCbs.forEach((cb) => cb(error));
  }

  notifyAttrsSubs() {
    if (!this.attrs) return;
    const oas = this.optimisticAttrs();
    this.attrsCbs.forEach((cb) => cb(oas));
  }

  notifyConnectionStatusSubs(status) {
    this.connectionStatusCbs.forEach((cb) => cb(status));
  }

  async setCurrentUser(user) {
    await this._persister.setItem(currentUserKey, JSON.stringify(user));
  }

  getCurrentUserCached() {
    return this._currentUserCached;
  }

  async getCurrentUser() {
    const oauthResp = await this._waitForOAuthCallbackResponse();
    if (oauthResp?.error) {
      const errorV = { error: oauthResp.error, user: undefined };
      this._currentUserCached = { isLoading: false, ...errorV };
      return errorV;
    }
    const user = await this._persister.getItem(currentUserKey);
    const userV = { user: JSON.parse(user), error: undefined };
    this._currentUserCached = {
      isLoading: false,
      ...userV,
    };
    return userV;
  }

  async _hasCurrentUser() {
    const user = await this._persister.getItem(currentUserKey);
    return JSON.parse(user) != null;
  }

  async changeCurrentUser(newUser) {
    const { user: oldUser } = await this.getCurrentUser();
    if (areObjectsDeepEqual(oldUser, newUser)) {
      // We were already logged in as the newUser, don't
      // bother updating
      return;
    }
    await this.setCurrentUser(newUser);
    // We need to remove all `result` from querySubs,
    // as they are no longer valid for the new user
    this.updateUser(newUser);

    try {
      this._broadcastChannel?.postMessage({ type: 'auth' });
    } catch (error) {
      console.error('Error posting message to broadcast channel', error);
    }
  }

  updateUser(newUser) {
    const newV = { error: undefined, user: newUser };
    this._currentUserCached = { isLoading: false, ...newV };
    this._dataForQueryCache = {};
    this.querySubs.set((prev) => {
      Object.keys(prev).forEach((k) => {
        delete prev[k].result;
      });
      return prev;
    });
    this._reconnectTimeoutMs = 0;
    this._ws.close();
    this._oauthCallbackResponse = null;
    this.notifyAuthSubs(newV);
  }

  sendMagicCode({ email }) {
    return authAPI.sendMagicCode({
      apiURI: this.config.apiURI,
      appId: this.config.appId,
      email: email,
    });
  }

  async signInWithMagicCode({ email, code }) {
    const res = await authAPI.verifyMagicCode({
      apiURI: this.config.apiURI,
      appId: this.config.appId,
      email,
      code,
    });
    await this.changeCurrentUser(res.user);
    return res;
  }

  async signInWithCustomToken(authToken) {
    const res = await authAPI.verifyRefreshToken({
      apiURI: this.config.apiURI,
      appId: this.config.appId,
      refreshToken: authToken,
    });
    await this.changeCurrentUser(res.user);
    return res;
  }

  potentiallyInvalidateToken(currentUser, opts) {
    const refreshToken = currentUser?.user?.refresh_token;
    if (!refreshToken) {
      return;
    }
    const wantsToSkip = opts.invalidateToken === false;
    if (wantsToSkip) {
      this._log.info('[auth-invalidate] skipped invalidateToken');
      return;
    }
    authAPI
      .signOut({
        apiURI: this.config.apiURI,
        appId: this.config.appId,
        refreshToken,
      })
      .then(() => {
        this._log.info('[auth-invalidate] completed invalidateToken');
      })
      .catch((e) => {});
  }

  async signOut(opts) {
    const currentUser = await this.getCurrentUser();
    this.potentiallyInvalidateToken(currentUser, opts);
    await this.changeCurrentUser(null);
  }

  /**
   * Creates an OAuth authorization URL.
   * @param {Object} params - The parameters to create the authorization URL.
   * @param {string} params.clientName - The name of the client requesting authorization.
   * @param {string} params.redirectURL - The URL to redirect users to after authorization.
   * @returns {string} The created authorization URL.
   */
  createAuthorizationURL({ clientName, redirectURL }) {
    const { apiURI, appId } = this.config;
    return `${apiURI}/runtime/oauth/start?app_id=${appId}&client_name=${clientName}&redirect_uri=${redirectURL}`;
  }

  /**
   * @param {Object} params
   * @param {string} params.code - The code received from the OAuth service.
   * @param {string} [params.codeVerifier] - The code verifier used to generate the code challenge.
   */
  async exchangeCodeForToken({ code, codeVerifier }) {
    const res = await authAPI.exchangeCodeForToken({
      apiURI: this.config.apiURI,
      appId: this.config.appId,
      code: code,
      codeVerifier,
    });
    await this.changeCurrentUser(res.user);
    return res;
  }

  issuerURI() {
    const { apiURI, appId } = this.config;
    return `${apiURI}/runtime/${appId}`;
  }

  /**
   * @param {Object} params
   * @param {string} params.clientName - The name of the client requesting authorization.
   * @param {string} params.idToken - The id_token from the external service
   * @param {string | null | undefined} [params.nonce] - The nonce used when requesting the id_token from the external service
   */
  async signInWithIdToken({ idToken, clientName, nonce }) {
    const currentUser = await this.getCurrentUser();
    const refreshToken = currentUser?.user?.refresh_token;

    const res = await authAPI.signInWithIdToken({
      apiURI: this.config.apiURI,
      appId: this.config.appId,
      idToken,
      clientName,
      nonce,
      refreshToken,
    });
    await this.changeCurrentUser(res.user);
    return res;
  }

  // --------
  // Rooms

  /**
   * @param {string} roomId
   * @param {any | null | undefined} [initialData] -- initial presence data to send when joining the room
   * @returns () => void
   */
  joinRoom(roomId, initialData) {
    if (!this._rooms[roomId]) {
      this._rooms[roomId] = {
        isConnected: false,
        error: undefined,
      };
    }

    this._presence[roomId] = this._presence[roomId] || {};

    if (initialData) {
      this._presence[roomId].result = this._presence[roomId].result || {};
      this._presence[roomId].result.user = initialData;
      this._notifyPresenceSubs(roomId);
    }

    this._tryJoinRoom(roomId, initialData);

    return () => {
      this._cleanupRoom(roomId);
    };
  }

  _cleanupRoom(roomId) {
    if (
      !this._presence[roomId]?.handlers?.length &&
      !Object.keys(this._broadcastSubs[roomId] ?? {}).length
    ) {
      const isConnected = this._rooms[roomId]?.isConnected;

      delete this._rooms[roomId];
      delete this._presence[roomId];
      delete this._broadcastSubs[roomId];

      if (isConnected) {
        this._tryLeaveRoom(roomId);
      } else {
        this._roomsPendingLeave[roomId] = true;
      }
    }
  }

  // --------
  // Presence

  // TODO: look into typing again
  getPresence(roomType, roomId, opts = {}) {
    const room = this._rooms[roomId];
    const presence = this._presence[roomId];
    if (!room || !presence || !presence.result) return null;

    return {
      ...buildPresenceSlice(presence.result, opts, this._sessionId),
      isLoading: !room.isConnected,
      error: room.error,
    };
  }

  // TODO: look into typing again
  publishPresence(roomType, roomId, partialData) {
    const room = this._rooms[roomId];
    const presence = this._presence[roomId];

    if (!room || !presence) {
      return;
    }

    presence.result = presence.result || {};
    const data = {
      ...presence.result.user,
      ...partialData,
    };

    presence.result.user = data;

    if (!room.isConnected) {
      return;
    }

    this._trySetPresence(roomId, data);
    this._notifyPresenceSubs(roomId);
  }

  _trySetPresence(roomId, data) {
    this._trySendAuthed(uuid(), {
      op: 'set-presence',
      'room-id': roomId,
      data,
    });
  }

  _tryJoinRoom(roomId, data) {
    this._trySendAuthed(uuid(), { op: 'join-room', 'room-id': roomId, data });
    delete this._roomsPendingLeave[roomId];
  }

  _tryLeaveRoom(roomId) {
    this._trySendAuthed(uuid(), { op: 'leave-room', 'room-id': roomId });
  }

  // TODO: look into typing again
  subscribePresence(roomType, roomId, opts, cb) {
    const leaveRoom = this.joinRoom(roomId, opts.data);

    const handler = { ...opts, roomId, cb, prev: null };

    this._presence[roomId] = this._presence[roomId] || {};
    this._presence[roomId].handlers = this._presence[roomId].handlers || [];
    this._presence[roomId].handlers.push(handler);

    this._notifyPresenceSub(roomId, handler);

    return () => {
      this._presence[roomId].handlers =
        this._presence[roomId]?.handlers?.filter((x) => x !== handler) ?? [];

      leaveRoom();
    };
  }

  _notifyPresenceSubs(roomId) {
    this._presence[roomId]?.handlers?.forEach((handler) => {
      this._notifyPresenceSub(roomId, handler);
    });
  }

  _notifyPresenceSub(roomId, handler) {
    const slice = this.getPresence('', roomId, handler);

    if (!slice) {
      return;
    }

    if (handler.prev && !hasPresenceResponseChanged(slice, handler.prev)) {
      return;
    }

    handler.prev = slice;
    handler.cb(slice);
  }

  _patchPresencePeers(roomId, edits) {
    const peers = this._presence[roomId]?.result?.peers || {};
    let sessions = Object.fromEntries(
      Object.entries(peers).map(([k, v]) => [k, { data: v }]),
    );
    const myPresence = this._presence[roomId]?.result;
    const newSessions = create(sessions, (draft) => {
      for (let [path, op, value] of edits) {
        switch (op) {
          case '+':
            insertInMutative(draft, path, value);
            break;
          case 'r':
            assocInMutative(draft, path, value);
            break;
          case '-':
            dissocInMutative(draft, path);
            break;
        }
      }
      // Ignore our own edits
      delete draft[this._sessionId];
    });

    this._setPresencePeers(roomId, newSessions);
  }

  _setPresencePeers(roomId, data) {
    const sessions = { ...data };
    // no need to keep track of `user`
    delete sessions[this._sessionId];
    const peers = Object.fromEntries(
      Object.entries(sessions).map(([k, v]) => [k, v.data]),
    );

    this._presence = create(this._presence, (draft) => {
      assocInMutative(draft, [roomId, 'result', 'peers'], peers);
    });
  }

  // --------
  // Broadcast

  publishTopic({ roomType, roomId, topic, data }) {
    const room = this._rooms[roomId];

    if (!room) {
      return;
    }

    if (!room.isConnected) {
      this._broadcastQueue[roomId] = this._broadcastQueue[roomId] ?? [];
      this._broadcastQueue[roomId].push({ topic, roomType, data });

      return;
    }

    this._tryBroadcast(roomId, roomType, topic, data);
  }

  _tryBroadcast(roomId, roomType, topic, data) {
    this._trySendAuthed(uuid(), {
      op: 'client-broadcast',
      'room-id': roomId,
      roomType,
      topic,
      data,
    });
  }

  subscribeTopic(roomId, topic, cb) {
    const leaveRoom = this.joinRoom(roomId);

    this._broadcastSubs[roomId] = this._broadcastSubs[roomId] || {};
    this._broadcastSubs[roomId][topic] =
      this._broadcastSubs[roomId][topic] || [];
    this._broadcastSubs[roomId][topic].push(cb);
    this._presence[roomId] = this._presence[roomId] || {};

    return () => {
      this._broadcastSubs[roomId][topic] = this._broadcastSubs[roomId][
        topic
      ].filter((x) => x !== cb);

      if (!this._broadcastSubs[roomId][topic].length) {
        delete this._broadcastSubs[roomId][topic];
      }

      leaveRoom();
    };
  }

  _notifyBroadcastSubs(room, topic, msg) {
    this._broadcastSubs?.[room]?.[topic]?.forEach((cb) => {
      const data = msg.data?.data;

      const peer =
        msg.data['peer-id'] === this._sessionId
          ? this._presence[room]?.result?.user
          : this._presence[room]?.result?.peers?.[msg.data['peer-id']];

      return cb(data, peer);
    });
  }

  // --------
  // Storage

  async uploadFile(path, file, opts) {
    const currentUser = await this.getCurrentUser();
    const refreshToken = currentUser?.user?.refresh_token;
    return StorageApi.uploadFile({
      ...opts,
      apiURI: this.config.apiURI,
      appId: this.config.appId,
      path: path,
      file,
      refreshToken: refreshToken,
    });
  }

  async deleteFile(path) {
    const currentUser = await this.getCurrentUser();
    const refreshToken = currentUser?.user?.refresh_token;
    const result = await StorageApi.deleteFile({
      apiURI: this.config.apiURI,
      appId: this.config.appId,
      path,
      refreshToken: refreshToken,
    });

    return result;
  }

  // Deprecated Storage API (Jan 2025)
  // ---------------------------------

  async upload(path, file) {
    const currentUser = await this.getCurrentUser();
    const refreshToken = currentUser?.user?.refresh_token;
    const fileName = path || file.name;
    const url = await StorageApi.getSignedUploadUrl({
      apiURI: this.config.apiURI,
      appId: this.config.appId,
      fileName: fileName,
      refreshToken: refreshToken,
    });
    const isSuccess = await StorageApi.upload(url, file);

    return isSuccess;
  }

  async getDownloadUrl(path) {
    const currentUser = await this.getCurrentUser();
    const refreshToken = currentUser?.user?.refresh_token;
    const url = await StorageApi.getDownloadUrl({
      apiURI: this.config.apiURI,
      appId: this.config.appId,
      path: path,
      refreshToken: refreshToken,
    });

    return url;
  }
}
