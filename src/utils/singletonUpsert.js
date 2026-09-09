const orphanWarned = new Set();
const warnIfOrphansCoexist = (Model) => {
  if (orphanWarned.has(Model.modelName)) return;
  orphanWarned.add(Model.modelName);
  Model.countDocuments({ singletonKey: { $exists: false } })
    .then((n) => {
      if (n > 0) {
        console.warn(
          `[singleton] ${Model.modelName}: ${n} document(s) WITHOUT singletonKey coexist with the ` +
            'keyed one and are being ignored — the public site may be reading an empty shadow. ' +
            'Run scripts/dedupe-singletons.js (--db <name>, then --keep <Model>:<_id>).',
        );
      }
    })
    .catch(() => {});
};

export const getOrCreateSingleton = async (Model) => {
  const keyed = await Model.findOne({ singletonKey: 'main' }).lean();
  if (keyed) {
    warnIfOrphansCoexist(Model);
    return keyed;
  }

  // Nothing keyed yet — before treating that as "empty", look for a document predating
  // the singletonKey migration.
  const unkeyed = await Model.find({ singletonKey: { $exists: false } }).select('_id').lean();

  if (unkeyed.length > 1) {
    throw new Error(
      `getOrCreateSingleton: ${Model.modelName} has ${unkeyed.length} documents without a ` +
        'singletonKey. Refusing to guess which one is the real singleton — resolve this ' +
        'collection manually (see scripts/dedupe-singletons.js) before it is read again.',
    );
  }

  if (unkeyed.length === 1) {
    // `overwriteImmutable` is required: `singletonKey` is `immutable: true` on these
    // schemas, and Mongoose's guard also blocks the *first* write via a query update —
    // without it the $set is dropped silently and adoption does nothing.
    const adopted = await Model.findOneAndUpdate(
      { _id: unkeyed[0]._id, singletonKey: { $exists: false } },
      { $set: { singletonKey: 'main' } },
      { returnDocument: 'after', overwriteImmutable: true },
    ).lean();
    return adopted ?? Model.findOne({ singletonKey: 'main' }).lean();
  }

  try {
    return await Model.findOneAndUpdate(
      { singletonKey: 'main' },
      { $setOnInsert: { singletonKey: 'main' } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Model.findOne({ singletonKey: 'main' }).lean();
  }
};
