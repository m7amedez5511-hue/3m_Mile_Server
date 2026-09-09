import mongoose from 'mongoose';
import createError from 'http-errors';
import pLimit from 'p-limit';
import { logger } from '../utils/winston.js';
import { createAppError } from '../utils/createAppError.js';
import {
  buildPopulateOptions,
  convertFilterToMatch,
  convertOrderToSort,
  applyPopulateAliasesToDocs,
  buildLookupStages,
} from '../helpers/db.helper.js';

/** Hard ceiling on rows per query, so `?limit=1000000` cannot exhaust memory. */
const MAX_LIMIT = 200;

/** Normalise page/limit/skip from untrusted query input: MongoDB rejects a negative
 *  skip, and NaN (`?page=abc`) propagates silently. */
const normalizePaging = (options = {}) => {
  const rawLimit =
    options.limit === undefined || options.limit === null || options.limit === ''
      ? 0
      : Number.parseInt(options.limit, 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : 0;

  const rawPage = Number.parseInt(options.page, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  let skip;
  if (limit && options.page !== undefined && options.page !== null && options.page !== '') {
    skip = (page - 1) * limit;
  } else {
    const rawSkip = Number.parseInt(options.skip ?? options.offset ?? 0, 10);
    skip = Number.isFinite(rawSkip) ? rawSkip : 0;
  }

  return { page, limit, skip: Math.max(0, skip) };
};

/**
 * Convert a Mongoose `select` string into an aggregation `$project`.
 * A `-field` prefix means exclude in Mongoose but include in `$project`, and Mongo
 * forbids mixing inclusion and exclusion in one projection.
 */
const buildProjection = (selectStr) => {
  const fields = String(selectStr).split(/\s+/).map((f) => f.trim()).filter(Boolean);
  if (!fields.length) return null;

  const exclusions = fields.filter((f) => f.startsWith('-')).map((f) => f.slice(1));
  const inclusions = fields.filter((f) => !f.startsWith('-'));

  if (exclusions.length && inclusions.length) {
    throw createError(500, 'select cannot mix inclusion and exclusion fields');
  }

  const projection = {};
  if (exclusions.length) exclusions.forEach((f) => { projection[f] = 0; });
  else inclusions.forEach((f) => { projection[f] = 1; });
  return projection;
};

/**
 * Preserve errors that already carry accurate HTTP semantics: `createError(500, err)`
 * mutates its argument, stamping status 500 onto CastError/ValidationError/duplicate-key
 * errors that errorHandler would otherwise classify as 400/409.
 */
const MEANINGFUL_ERRORS = new Set(['CastError', 'ValidationError', 'ZodError']);
const wrapError = (error) => {
  if (error && (error.isOperational || error.status || error.statusCode)) return error;
  if (error && (MEANINGFUL_ERRORS.has(error.name) || error.code === 11000)) return error;
  return createError(500, error);
};

/** Generic CRUD service factory: `crudService('Product')`. */
const crudService = (modelName) => {
  const getModel = () => {
    try {
      return mongoose.model(modelName);
    } catch (error) {
      throw createError(500, `Model '${modelName}' not found`);
    }
  };

  // Plain object so methods can call siblings via `api.xxx` without `this` binding.
  const api = {
    findByPk: async (pk, options = {}) => {
      try {
        const Model = getModel();
        // rather than null/404, so a malformed id answers the same way here as on
        // routes that query findById directly.
        if (!mongoose.isValidObjectId(pk)) {
          throw createAppError(400, 'invalid_resource_id');
        }
        if (options.populate || options.relations) {
          const lookupStages = buildLookupStages(options.populate || options.relations, Model);
          const pipeline = [
            { $match: { _id: new mongoose.Types.ObjectId(String(pk)) } },
            ...lookupStages,
          ];
          const result = await Model.aggregate(pipeline);
          return result[0] || null;
        }
        return await Model.findById(pk).exec();
      } catch (err) {
        throw wrapError(err);
      }
    },

    findOne: async (filter, options = {}) => {
      try {
        const Model = getModel();
        const mongoFilter = convertFilterToMatch(filter);
        if (options.populate || options.relations) {
          const lookupStages = buildLookupStages(options.populate || options.relations, Model);
          const pipeline = [{ $match: mongoFilter }, ...lookupStages];
          const result = await Model.aggregate(pipeline);
          return result[0] || null;
        }
        return await Model.findOne(mongoFilter, null, { ...options, lean: true }).exec();
      } catch (error) {
        throw wrapError(error);
      }
    },

    findAll: async (filter = {}, options = {}) => {
      try {
        const Model = getModel();
        const mongoFilter = convertFilterToMatch(filter);
        const hasPopulate = options.populate || options.relations;

        if (hasPopulate) {
          const lookupStages = buildLookupStages(options.populate || options.relations, Model);
          const pipeline = [{ $match: mongoFilter }];

          if (options.preSortPipeline) pipeline.push(...options.preSortPipeline);

          if (options.sort || options.order) {
            const sortObj = options.sort || convertOrderToSort(options.order);
            pipeline.push({ $sort: sortObj });
          }

          const { limit, skip } = normalizePaging(options);

          const rowsPipeline = [
            ...(skip > 0 ? [{ $skip: skip }] : []),
            ...(limit > 0 ? [{ $limit: limit }] : []),
            ...lookupStages,
          ];

          if (options.select || options.attributes) {
            const selectStr =
              options.select ||
              (Array.isArray(options.attributes) ? options.attributes.join(' ') : options.attributes);
            const projection = buildProjection(selectStr);
            if (projection) rowsPipeline.push({ $project: projection });
          }

          pipeline.push(...rowsPipeline);

          if (options.cursor) {
            return Model.aggregate(pipeline).cursor({ batchSize: options.batchSize || 500 });
          }

          return await Model.aggregate(pipeline);
        }

        let query = Model.find(mongoFilter).lean();

        if (options.select || options.attributes) {
          const selectFields =
            options.select || (Array.isArray(options.attributes) ? options.attributes.join(' ') : options.attributes);
          query = query.select(selectFields);
        }

        if (options.sort || options.order) {
          query = query.sort(options.sort || convertOrderToSort(options.order));
        }

        const { limit: findAllLimit, skip: findAllSkip } = normalizePaging(options);
        if (findAllSkip > 0) query = query.skip(findAllSkip);
        if (findAllLimit > 0) query = query.limit(findAllLimit);

        return await query.exec();
      } catch (error) {
        throw wrapError(error);
      }
    },

    findAndCountAll: async (filter = {}, options = {}) => {
      try {
        const Model = getModel();
        const mongoFilter = convertFilterToMatch(filter);
        const hasPopulate = options.populate || options.relations;

        if (hasPopulate) {
          const lookupStages = buildLookupStages(options.populate || options.relations, Model);
          const pipeline = [{ $match: mongoFilter }];

          if (options.sort || options.order) {
            pipeline.push({ $sort: options.sort || convertOrderToSort(options.order) });
          }

          const { limit, skip } = normalizePaging(options);

          const rowsPipeline = [
            ...(skip > 0 ? [{ $skip: skip }] : []),
            ...(limit > 0 ? [{ $limit: limit }] : []),
            ...lookupStages,
          ];

          if (options.select || options.attributes) {
            const selectStr =
              options.select ||
              (Array.isArray(options.attributes) ? options.attributes.join(' ') : options.attributes);
            const projection = buildProjection(selectStr);
            if (projection) rowsPipeline.push({ $project: projection });
          }

          pipeline.push({
            $facet: {
              rows: rowsPipeline,
              totalCount: [{ $count: 'count' }],
            },
          });

          const result = await Model.aggregate(pipeline);
          const rows = result[0].rows;
          const count = result[0].totalCount[0]?.count || 0;

          const finalRows = options.populate ? applyPopulateAliasesToDocs(rows, options.populate) : rows;

          return { count, rows: finalRows, total: count, data: finalRows };
        }

        const count = await Model.countDocuments(mongoFilter);
        let query = Model.find(mongoFilter).lean();

        if (options.select || options.attributes) {
          const selectFields =
            options.select || (Array.isArray(options.attributes) ? options.attributes.join(' ') : options.attributes);
          query = query.select(selectFields);
        }

        if (options.sort || options.order) {
          query = query.sort(options.sort || convertOrderToSort(options.order));
        }

        const { limit: pagedLimit, skip: pagedSkip } = normalizePaging(options);
        if (pagedLimit > 0) query = query.limit(pagedLimit);
        if (pagedSkip > 0) query = query.skip(pagedSkip);

        if (options.populate || options.relations) {
          const populateOptions = buildPopulateOptions(options.populate || options.relations);
          populateOptions.forEach((pop) => {
            query = query.populate(pop);
          });
        }

        let rows = await query.exec();
        if (rows && options.populate) rows = applyPopulateAliasesToDocs(rows, options.populate);

        return { count, rows, total: count, data: rows };
      } catch (error) {
        throw wrapError(error);
      }
    },

    findOrCreate: async (filter, defaults = {}, options = {}) => {
      try {
        const Model = getModel();
        const mongoFilter = convertFilterToMatch(filter);
        let record = await Model.findOne(mongoFilter, null, options).exec();
        let created = false;
        if (!record) {
          record = await Model.create({ ...defaults, ...filter });
          created = true;
        }
        return { record, created, document: record, isNew: created };
      } catch (error) {
        throw wrapError(error);
      }
    },

    findOneAndUpdate: async (filter, updateData, options = {}) => {
      try {
        const Model = getModel();
        const mongoFilter = convertFilterToMatch(filter);
        const { populate, relations, ...restOptions } = options;
        const mongoOptions = { returnDocument: 'after', runValidators: true, upsert: restOptions.upsert || false, ...restOptions };
        const result = await Model.findOneAndUpdate(mongoFilter, updateData, mongoOptions).lean();
        if (!result || !(populate || relations)) return result;
        const lookupStages = buildLookupStages(populate || relations, Model);
        const pipeline = [{ $match: { _id: result._id } }, ...lookupStages];
        const populated = await Model.aggregate(pipeline);
        return populated[0] || result;
      } catch (error) {
        throw wrapError(error);
      }
    },

    findOneAndDelete: async (filter, options = {}) => {
      try {
        const Model = getModel();
        return await Model.findOneAndDelete(convertFilterToMatch(filter), options).lean();
      } catch (error) {
        throw wrapError(error);
      }
    },

    findOneAndReplace: async (filter, replacement, options = {}) => {
      try {
        const Model = getModel();
        const mongoOptions = { returnDocument: 'after', runValidators: true, ...options };
        return await Model.findOneAndReplace(convertFilterToMatch(filter), replacement, mongoOptions).lean();
      } catch (error) {
        throw wrapError(error);
      }
    },

    create: async (dataModel, session = null) => {
      try {
        const Model = getModel();
        const options = session ? { session } : {};
        if (Array.isArray(dataModel)) {
          return await Model.insertMany(dataModel, { ...options, ordered: false });
        }
        const [doc] = await Model.create([dataModel], options);
        return doc;
      } catch (error) {
        throw wrapError(error);
      }
    },

    bulkInsertWorkerAllDocs: async (data, BATCH_SIZE = 1000, concurrency = 4) => {
      const limit = pLimit(concurrency);
      const Model = getModel();
      let insertedCount = 0;
      let failedBatches = 0;
      const tasks = [];

      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        tasks.push(
          limit(async () => {
            try {
              const operations = batch.map((doc) => ({ insertOne: { document: doc } }));
              const res = await Model.bulkWrite(operations, {
                ordered: false,
                writeConcern: { w: 1, j: false },
              });
              insertedCount += res.insertedCount;
            } catch (err) {
              failedBatches += 1;
              if (err?.result?.insertedCount) insertedCount += err.result.insertedCount;
              logger.error(`Batch failed at offset ${i}: ${err.message}`);
            }
          }),
        );
      }

      await Promise.all(tasks);
      return { insertedCount, failedBatches };
    },

    bulkUpdateWorkerAllDocs: async (data, BATCH_SIZE = 1000, concurrency = 4) => {
      const limit = pLimit(concurrency);
      const Model = getModel();
      let modifiedCount = 0;
      let failedBatches = 0;
      const tasks = [];

      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        const ops = batch.map((d) => ({
          updateMany: {
            filter: d.filter,
            update: { $set: { ...d.updateData, updatedAt: new Date() }, $setOnInsert: d.setOnInsert || {} },
            upsert: true,
          },
        }));

        tasks.push(
          limit(async () => {
            try {
              const res = await Model.bulkWrite(ops, { ordered: false, writeConcern: { w: 1, j: false } });
              modifiedCount += res.modifiedCount || 0;
            } catch (err) {
              failedBatches += 1;
              if (err.result?.nModified) modifiedCount += err.result.nModified;
            }
          }),
        );
      }

      await Promise.all(tasks);
      return { modifiedCount, failedBatches };
    },

    bulkCreate: async (dataModel, session = null) => {
      try {
        const Model = getModel();
        const BATCH_SIZE = 1000;
        const options = session ? { session } : {};
        const limit = pLimit(5);
        const tasks = [];

        for (let i = 0; i < dataModel.length; i += BATCH_SIZE) {
          const batch = dataModel.slice(i, i + BATCH_SIZE);
          tasks.push(limit(() => Model.insertMany(batch, { ordered: false, ...options })));
        }

        const results = await Promise.allSettled(tasks);
        const insertedDocs = [];
        for (const result of results) {
          if (result.status === 'fulfilled') insertedDocs.push(...result.value);
          else logger.error(`Bulk insert batch failed: ${result.reason?.message}`);
        }
        return insertedDocs;
      } catch (err) {
        throw wrapError(err);
      }
    },

    update: async (updateData, filter, options = {}) => {
      try {
        const Model = getModel();
        const mongoFilter = Array.isArray(filter)
          ? { $and: filter.map(convertFilterToMatch) }
          : convertFilterToMatch(filter);
        const mongoOptions = { runValidators: true, ...options };
        const result = await Model.updateMany(mongoFilter, updateData, mongoOptions);
        return {
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount,
          acknowledged: result.acknowledged,
          affectedRows: result.modifiedCount,
        };
      } catch (error) {
        throw wrapError(error);
      }
    },

    count: async (filter = {}, options = {}) => {
      try {
        const Model = getModel();
        return await Model.countDocuments(convertFilterToMatch(filter), options);
      } catch (error) {
        throw wrapError(error);
      }
    },

    softDelete: async (filter) => {
      try {
        const Model = getModel();
        const result = await Model.updateMany(convertFilterToMatch(filter), {
          $set: { isDeleted: true, deletedAt: new Date() },
        });
        return { deletedCount: result.modifiedCount, acknowledged: result.acknowledged };
      } catch (error) {
        throw wrapError(error);
      }
    },

    destroy: async (filter, options = {}) => {
      try {
        const Model = getModel();
        const mongoFilter = convertFilterToMatch(filter);

        if (options?.individualHooks) {
          const docs = await Model.find(mongoFilter, null, options).exec();
          let deletedCount = 0;
          for (const doc of docs) {
            await doc.deleteOne(options);
            deletedCount += 1;
          }
          return { deletedCount, acknowledged: true, affectedRows: deletedCount };
        }

        const result = await Model.deleteMany(mongoFilter, options);
        return { deletedCount: result.deletedCount, acknowledged: result.acknowledged, affectedRows: result.deletedCount };
      } catch (error) {
        throw wrapError(error);
      }
    },

    bulkDelete: async (filter, options = {}) => {
      try {
        const Model = getModel();
        const result = await Model.deleteMany(convertFilterToMatch(filter), options);
        return { deletedCount: result.deletedCount, acknowledged: result.acknowledged, affectedRows: result.deletedCount };
      } catch (error) {
        throw wrapError(error);
      }
    },

    distinct: async (field, filter = {}, options = {}) => {
      try {
        const Model = getModel();
        return await Model.distinct(field, convertFilterToMatch(filter), options);
      } catch (error) {
        throw wrapError(error);
      }
    },

    exists: async (filter, options = {}) => {
      try {
        const Model = getModel();
        return !!(await Model.exists(convertFilterToMatch(filter), options));
      } catch (error) {
        throw wrapError(error);
      }
    },

    bulkWrite: async (operations, options = {}) => {
      try {
        const Model = getModel();
        return await Model.bulkWrite(operations, options);
      } catch (error) {
        throw wrapError(error);
      }
    },

    createWithTransaction: async (dataModel, session) => api.create(dataModel, session),
    updateWithTransaction: async (updateData, filter, session) => api.update(updateData, filter, { session }),
    destroyWithTransaction: async (filter, session) => api.destroy(filter, { session }),

    aggregate: async (pipeline = [], options = {}) => {
      try {
        const Model = getModel();
        return await Model.aggregate(pipeline, options);
      } catch (error) {
        throw wrapError(error);
      }
    },
  };

  return api;
};

export default crudService;