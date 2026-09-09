import { jest } from '@jest/globals';

// No module mocks needed: getOrCreateSingleton only talks to the Model it is handed,
// so a hand-built model with chainable query stubs is enough.
const { getOrCreateSingleton } = await import('../../utils/singletonUpsert.js');

const DOC_ID = '64a1f0c2e4b0a1b2c3d4e5f6';
const lean = (value) => ({ lean: () => Promise.resolve(value) });
const leanReject = (error) => ({ lean: () => Promise.reject(error) });

/**
 * Build a fake Mongoose model. `modelName` must be unique per test that reaches the
 * keyed branch, because the module remembers which models it already warned about.
 */
const buildModel = (modelName, { keyed = null, unkeyed = [], adopted, upserted, orphanCount = 0 } = {}) => {
  const findOne = jest.fn(() => lean(keyed));
  const find = jest.fn(() => ({ select: jest.fn(() => lean(unkeyed)) }));
  const findOneAndUpdate = jest.fn(() => lean(unkeyed.length === 1 ? adopted : upserted));
  const countDocuments = jest.fn(() => Promise.resolve(orphanCount));
  return { modelName, findOne, find, findOneAndUpdate, countDocuments };
};

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

let warnSpy;
beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('getOrCreateSingleton — keyed document exists', () => {
  // 1. Fast path: the keyed document is returned as-is with no writes
  it('should return the keyed document and skip adoption/upsert', async () => {
    const keyed = { _id: DOC_ID, singletonKey: 'main' };
    const Model = buildModel('KeyedA', { keyed });

    const result = await getOrCreateSingleton(Model);

    expect(Model.findOne).toHaveBeenCalledWith({ singletonKey: 'main' });
    expect(result).toBe(keyed);
    expect(Model.find).not.toHaveBeenCalled();
    expect(Model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // 2. Orphan check runs in the background and warns when unkeyed shadows exist
  it('should warn about unkeyed shadow documents coexisting with the keyed one', async () => {
    const Model = buildModel('KeyedB', { keyed: { _id: DOC_ID }, orphanCount: 2 });

    await getOrCreateSingleton(Model);
    await flushMicrotasks();

    expect(Model.countDocuments).toHaveBeenCalledWith({ singletonKey: { $exists: false } });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/KeyedB: 2 document\(s\) WITHOUT singletonKey/);
  });

  // 3. No orphans → no warning
  it('should not warn when no unkeyed documents exist', async () => {
    const Model = buildModel('KeyedC', { keyed: { _id: DOC_ID }, orphanCount: 0 });

    await getOrCreateSingleton(Model);
    await flushMicrotasks();

    expect(Model.countDocuments).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // 4. The orphan check runs once per model name for the process lifetime
  it('should run the orphan check only once per model name', async () => {
    const first = buildModel('KeyedD', { keyed: { _id: DOC_ID } });
    const second = buildModel('KeyedD', { keyed: { _id: DOC_ID } });

    await getOrCreateSingleton(first);
    await getOrCreateSingleton(second);

    expect(first.countDocuments).toHaveBeenCalledTimes(1);
    expect(second.countDocuments).not.toHaveBeenCalled();
  });

  // 5. A failing orphan count is swallowed and never affects the read
  it('should swallow a countDocuments failure', async () => {
    const Model = buildModel('KeyedE', { keyed: { _id: DOC_ID } });
    Model.countDocuments.mockImplementation(() => Promise.reject(new Error('db down')));

    const result = await getOrCreateSingleton(Model);
    await flushMicrotasks();

    expect(result).toEqual({ _id: DOC_ID });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('getOrCreateSingleton — adopting a pre-migration document', () => {
  // 1. Exactly one unkeyed document is adopted by stamping singletonKey
  it('should adopt the single unkeyed document with overwriteImmutable', async () => {
    const adopted = { _id: DOC_ID, singletonKey: 'main', heading: 'old' };
    const Model = buildModel('Adopt', { unkeyed: [{ _id: DOC_ID }], adopted });

    const result = await getOrCreateSingleton(Model);

    expect(Model.find).toHaveBeenCalledWith({ singletonKey: { $exists: false } });
    expect(Model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: DOC_ID, singletonKey: { $exists: false } },
      { $set: { singletonKey: 'main' } },
      { returnDocument: 'after', overwriteImmutable: true },
    );
    expect(result).toBe(adopted);
  });

  // 2. If someone else adopted it first, fall back to reading the keyed document
  it('should re-read the keyed document when adoption returns null (lost race)', async () => {
    const Model = buildModel('AdoptRace', { unkeyed: [{ _id: DOC_ID }], adopted: null });
    const racedIn = { _id: DOC_ID, singletonKey: 'main' };
    Model.findOne.mockReturnValueOnce(lean(null)).mockReturnValueOnce(lean(racedIn));

    const result = await getOrCreateSingleton(Model);

    expect(Model.findOne).toHaveBeenCalledTimes(2);
    expect(Model.findOne).toHaveBeenLastCalledWith({ singletonKey: 'main' });
    expect(result).toBe(racedIn);
  });

  // 3. More than one unkeyed document is ambiguous → refuse with a plain Error
  it('should throw when more than one unkeyed document exists and not write', async () => {
    const Model = buildModel('Ambiguous', { unkeyed: [{ _id: 'a' }, { _id: 'b' }] });

    await expect(getOrCreateSingleton(Model)).rejects.toThrow(/Ambiguous has 2 documents without a singletonKey.*Refusing to guess/s);
    expect(Model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('getOrCreateSingleton — creating on first read', () => {
  // 1. Nothing exists → atomic upsert with defaults applied
  it('should upsert an empty keyed document when the collection is empty', async () => {
    const created = { _id: DOC_ID, singletonKey: 'main' };
    const Model = buildModel('Fresh', { unkeyed: [], upserted: created });

    const result = await getOrCreateSingleton(Model);

    expect(Model.findOneAndUpdate).toHaveBeenCalledWith(
      { singletonKey: 'main' },
      { $setOnInsert: { singletonKey: 'main' } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    expect(result).toBe(created);
  });

  // 2. A duplicate-key race on the unique index falls back to a read
  it('should read the keyed document when the upsert loses a duplicate-key race', async () => {
    const Model = buildModel('FreshRace', { unkeyed: [] });
    const dup = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    Model.findOneAndUpdate.mockReturnValue(leanReject(dup));
    const winner = { _id: DOC_ID, singletonKey: 'main' };
    Model.findOne.mockReturnValueOnce(lean(null)).mockReturnValueOnce(lean(winner));

    const result = await getOrCreateSingleton(Model);

    expect(result).toBe(winner);
    expect(Model.findOne).toHaveBeenCalledTimes(2);
  });

  // 3. Any other upsert error is rethrown untouched
  it('should rethrow non-duplicate upsert errors', async () => {
    const Model = buildModel('FreshError', { unkeyed: [] });
    Model.findOneAndUpdate.mockReturnValue(leanReject(Object.assign(new Error('boom'), { code: 500 })));

    await expect(getOrCreateSingleton(Model)).rejects.toThrow('boom');
    expect(Model.findOne).toHaveBeenCalledTimes(1);
  });
});
