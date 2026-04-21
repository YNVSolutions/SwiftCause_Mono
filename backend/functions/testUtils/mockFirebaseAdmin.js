const collections = new Map();
let transactionQueue = Promise.resolve();
let autoIdCounter = 0;

const clone = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
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

const createSnapshot = (id, data) => ({
  id,
  exists: data !== undefined,
  data: () => clone(data),
});

const doc = (collectionName, id) => ({
  id,
  async get() {
    const stored = getCollectionStore(collectionName).get(id);
    return createSnapshot(id, stored);
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
});

const firestoreInstance = {
  collection(name) {
    return {
      doc(id) {
        return doc(name, id);
      },
      async get() {
        const store = getCollectionStore(name);
        const docs = Array.from(store.entries()).map(([id, value]) => createSnapshot(id, value));
        return { docs };
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
};

const admin = {
  firestore() {
    return firestoreInstance;
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
  now: () => ({
    __type: 'timestamp',
    ms: Date.now(),
    toMillis() {
      return this.ms;
    },
  }),
  fromDate: (date) => ({
    __type: 'timestamp',
    ms: date.getTime(),
    toMillis() {
      return this.ms;
    },
  }),
};

admin.firestore.FieldValue = {
  increment: (amount) => ({ __op: 'increment', amount }),
};

admin.__reset = () => {
  collections.clear();
  transactionQueue = Promise.resolve();
  autoIdCounter = 0;
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
