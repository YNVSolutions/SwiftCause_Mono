const collections = new Map();
let transactionQueue = Promise.resolve();
let autoIdCounter = 0;
const authTokens = new Map();

const makeTimestamp = (ms) => ({
  __type: 'timestamp',
  ms,
  toMillis() {
    return this.ms;
  },
  toDate() {
    return new Date(this.ms);
  },
});

const clone = (value) => {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (value.__type === 'timestamp' && typeof value.ms === 'number') {
    return makeTimestamp(value.ms);
  }
  if (Array.isArray(value)) {
    return value.map((item) => clone(item));
  }

  const next = {};
  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item.toMillis === 'function' && typeof item.toDate === 'function') {
      next[key] = makeTimestamp(item.toMillis());
    } else {
      next[key] = clone(item);
    }
  }
  return next;
};

const getCollectionStore = (name) => {
  if (!collections.has(name)) {
    collections.set(name, new Map());
  }
  return collections.get(name);
};

const applyValue = (currentValue, incomingValue) => {
  if (incomingValue && incomingValue.__op === 'increment') {
    return (Number(currentValue) || 0) + incomingValue.amount;
  }
  return clone(incomingValue);
};

const mergeData = (current = {}, incoming = {}) => {
  const next = { ...clone(current) };
  for (const [key, value] of Object.entries(incoming)) {
    next[key] = applyValue(next[key], value);
  }
  return next;
};

const doc = (collectionName, id) => ({
  id,
  async get() {
    const stored = getCollectionStore(collectionName).get(id);
    return createSnapshot(collectionName, id, stored);
  },
  async set(data, options = {}) {
    const store = getCollectionStore(collectionName);
    const current = store.get(id);
    const next = options.merge ? mergeData(current, data) : mergeData({}, data);
    store.set(id, next);
  },
  async update(data) {
    const store = getCollectionStore(collectionName);
    const current = store.get(id);
    if (current === undefined) {
      throw new Error(`Document does not exist: ${collectionName}/${id}`);
    }
    store.set(id, mergeData(current, data));
  },
  async delete() {
    getCollectionStore(collectionName).delete(id);
  },
});

const createSnapshot = (collectionName, id, data) => ({
  id,
  ref: doc(collectionName, id),
  exists: data !== undefined,
  data: () => clone(data),
});

const getFieldValue = (data, field) => {
  const parts = field.split('.');
  let actual = data;
  for (const part of parts) {
    actual = actual != null ? actual[part] : undefined;
  }
  return actual;
};

const comparableValue = (value) => {
  if (value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (value && value.__type === 'timestamp' && typeof value.ms === 'number') {
    return value.ms;
  }
  return value;
};

const matchesFilter = (actualValue, op, expectedValue) => {
  const actual = comparableValue(actualValue);
  const expected = comparableValue(expectedValue);
  if (op === '==') return actual === expected;
  if (op === '!=') return actual !== expected;
  if (op === '>') return actual > expected;
  if (op === '>=') return actual >= expected;
  if (op === '<') return actual < expected;
  if (op === '<=') return actual <= expected;
  return false;
};

const createQuerySnapshot = (docs) => ({
  docs,
  empty: docs.length === 0,
  size: docs.length,
  forEach(fn) {
    docs.forEach(fn);
  },
});

const firestoreInstance = {
  collection(name) {
    // Build a chainable query object that filters the in-memory store
    const buildQuery = (collectionName, filters, limitCount) => ({
      where(field, op, value) {
        return buildQuery(collectionName, [...filters, { field, op, value }], limitCount);
      },
      limit(n) {
        return buildQuery(collectionName, filters, n);
      },
      async get() {
        const store = getCollectionStore(collectionName);
        let entries = Array.from(store.entries());

        for (const { field, op, value } of filters) {
          entries = entries.filter(([, data]) => {
            // Support nested field paths like "metadata.donorEmail"
            return matchesFilter(getFieldValue(data, field), op, value);
          });
        }

        if (limitCount != null) {
          entries = entries.slice(0, limitCount);
        }

        const docs = entries.map(([id, data]) => createSnapshot(collectionName, id, data));
        return createQuerySnapshot(docs);
      },
    });

    return {
      doc(id) {
        return doc(name, id);
      },
      where(field, op, value) {
        return buildQuery(name, [{ field, op, value }], null);
      },
      limit(n) {
        return buildQuery(name, [], n);
      },
      async get() {
        const store = getCollectionStore(name);
        const docs = Array.from(store.entries()).map(([id, value]) =>
          createSnapshot(name, id, value),
        );
        return createQuerySnapshot(docs);
      },
      async add(data) {
        autoIdCounter += 1;
        const generatedId = `auto-${autoIdCounter}`;
        await doc(name, generatedId).set(data);
        return doc(name, generatedId);
      },
    };
  },
  async runTransaction(callback) {
    const previous = transactionQueue;
    let release;
    transactionQueue = new Promise((resolve) => {
      release = resolve;
    });

    await previous;

    const operations = [];
    const tx = {
      async get(ref) {
        return ref.get();
      },
      set(ref, data, options) {
        operations.push(() => ref.set(data, options));
      },
      update(ref, data) {
        operations.push(() => ref.update(data));
      },
      delete(ref) {
        operations.push(() => ref.delete());
      },
    };

    try {
      const result = await callback(tx);
      for (const operation of operations) {
        await operation();
      }
      release();
      return result;
    } catch (error) {
      release();
      throw error;
    }
  },
  batch() {
    const operations = [];
    return {
      set(ref, data, options) {
        operations.push(() => ref.set(data, options));
      },
      update(ref, data) {
        operations.push(() => ref.update(data));
      },
      delete(ref) {
        operations.push(() => ref.delete());
      },
      async commit() {
        for (const operation of operations) {
          await operation();
        }
      },
    };
  },
};

const admin = {
  firestore() {
    return firestoreInstance;
  },
  auth() {
    return {
      async verifyIdToken(token) {
        if (authTokens.has(token)) {
          return clone(authTokens.get(token));
        }
        if (typeof token === 'string' && token.startsWith('uid:')) {
          return { uid: token.slice(4) };
        }
        throw new Error('Invalid token');
      },
      async createCustomToken(uid, claims = {}) {
        return `custom-token:${uid}:${JSON.stringify(claims)}`;
      },
    };
  },
  app() {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'demo-project';
    return {
      options: {
        storageBucket: `${projectId}.appspot.com`,
      },
    };
  },
};

admin.firestore.Timestamp = {
  now: () => makeTimestamp(Date.now()),
  fromDate: (date) => makeTimestamp(date.getTime()),
  fromMillis: (ms) => makeTimestamp(ms),
};

admin.firestore.FieldValue = {
  increment: (amount) => ({ __op: 'increment', amount }),
};

admin.__reset = () => {
  collections.clear();
  authTokens.clear();
  transactionQueue = Promise.resolve();
  autoIdCounter = 0;
};

admin.__setAuthToken = (token, decoded) => {
  authTokens.set(token, clone(decoded));
};

admin.__getDoc = (collectionName, id) => {
  const store = getCollectionStore(collectionName);
  return clone(store.get(id));
};

admin.__getCollection = (collectionName) => {
  const store = getCollectionStore(collectionName);
  return Array.from(store.entries()).map(([id, value]) => ({
    id,
    data: clone(value),
  }));
};

module.exports = admin;
