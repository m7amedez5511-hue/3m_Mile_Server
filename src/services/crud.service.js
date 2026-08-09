import mongoose from 'mongoose';
import createError from 'http-errors';
import pLimit from 'p-limit';
import { logger } from '../utils/winston.js';
import {
  buildPopulateOptions,
  convertFilterToMatch,
  convertOrderToSort,
  applyPopulateAliasesToDocs,
  buildLookupStages,
} from '../helpers/db.helper.js';

/**
 * Generic CRUD service factory for any Mongoose model.
 * Usage: const productCrud = crudService('Product');
 */
const crudService = (modelName) => {
  const getModel = () => {
    try {
      return mongoose.model(modelName);
    } catch (error) {
      throw createError(500, `Model '${modelName}' not found`);
    }
  };

  // Defined as a plain object so every method can safely reference
  // sibling methods via `api.xxx` instead of relying on `this` binding.
  const api = {
    findByPk: async (pk, options = {}) => {
      try {
        const Model = getModel();
        if (options.populate || options.relations) {
          const lookupStages = buildLookupStages(options.populate || options.relations);
          const pipeline = [
            { $match: { _id: new mongoose.Types.ObjectId(String(pk)) } },
            ...lookupStages,
          ];
          const result = await Model.aggregate(pipeline);
          return result[0] || null;
        }
        return await Model.findById(pk).exec();
      } catch (err) {
        throw createError(500, err);
      }
    },

    findOne: async (filter, options = {}) => {
      try {
        const Model = getModel();
        const mongoFilter = convertFilterToMatch(filter);
        if (options.populate || options.relations) {
          const lookupStages = buildLookupStages(options.populate || options.relations);
          const pipeline = [{ $match: mongoFilter }, ...lookupStages];
          const result = await Model.aggregate(pipeline);
          return result[0] || null;
        }
        return await Model.findOne(mongoFilter, null, { ...options, lean: true }).exec();
      } catch (error) {
        throw createError(500, error);
      }
    },

    findAll: async (filter = {}, options = {}) => {
      try {
        const Model = getModel();
        const mongoFilter = convertFilterToMatch(filter);
        const hasPopulate = options.populate || options.relations;

        if (hasPopulate) {
          const lookupStages = buildLookupStages(options.populate || options.relations);
          const pipeline = [{ $match: mongoFilter }];

          if (options.preSortPipeline) pipeline.push(...options.preSortPipeline);

          if (options.sort || options.order) {
            const sortObj = options.sort || convertOrderToSort(options.order);
            pipeline.push({ $sort: sortObj });
          }

          const page = parseInt(options.page || 1);
          const limit = options.limit ? parseInt(options.limit) : 0;
          const skip = limit ? (page - 1) * limit : parseInt(options.skip || options.offset || 0);

          const rowsPipeline = [
            ...(skip > 0 ? [{ $skip: skip }] : []),
            ...(limit > 0 ? [{ $limit: limit }] : []),
            ...lookupStages,
          ];

          if (options.select || options.attributes) {
            const selectStr =
              options.select ||
              (Array.isArray(options.attributes) ? options.attributes.join(' ') : options.attributes);
            const projection = {};
            selectStr.split(/\s+/).forEach((f) => {
              if (f.trim()) projection[f] = 1;
            });
            rowsPipeline.push({ $project: projection });
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

        if (options.skip || options.offset) {
          query = query.skip(parseInt(options.skip || options.offset));
        }

        if (options.limit) {
          query = query.limit(parseInt(options.limit));
        }

        return await query.exec();
      } catch (error) {
        throw createError(500, error);
      }
    },

    findAndCountAll: async (filter = {}, options = {}) => {
      try {
        const Model = getModel();
        const mongoFilter = convertFilterToMatch(filter);
        const hasPopulate = options.populate || options.relations;

        if (hasPopulate) {
          const lookupStages = buildLookupStages(options.populate || options.relations);
          const pipeline = [{ $match: mongoFilter }];

          if (options.sort || options.order) {
            pipeline.push({ $sort: options.sort || convertOrderToSort(options.order) });
          }

          const page = parseInt(options.page || 1);
          const limit = options.limit ? parseInt(options.limit) : 0;
          const skip = limit ? (page - 1) * limit : parseInt(options.skip || options.offset || 0);

          const rowsPipeline = [
            ...(skip > 0 ? [{ $skip: skip }] : []),
            ...(limit > 0 ? [{ $limit: limit }] : []),
            ...lookupStages,
          ];

          if (options.select || options.attributes) {
            const selectStr =
              options.select ||
              (Array.isArray(options.attributes) ? options.attributes.join(' ') : options.attributes);
            const projection = {};
            selectStr.split(/\s+/).forEach((f) => {
              if (f.trim()) projection[f] = 1;
            });
            rowsPipeline.push({ $project: projection });
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

        if (options.limit) {
          const limitNum = parseInt(options.limit);
          query = query.limit(limitNum);
          let skip = 0;
          if (options.page) skip = (parseInt(options.page) - 1) * limitNum;
          else if (options.skip || options.offset) skip = parseInt(options.skip || options.offset);
          query = query.skip(skip);
        }

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
        throw createError(500, error);
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
        throw createError(500, error);
      }
    },

    findOneAndUpdate: async (filter, updateData, options = {}) => {
      try {
        const Model = getModel();
        const mongoFilter = convertFilterToMatch(filter);
        const { populate, relations, ...restOptions } = options;
        const mongoOptions = { new: true, runValidators: true, upsert: restOptions.upsert || false, ...restOptions };
        const result = await Model.findOneAndUpdate(mongoFilter, updateData, mongoOptions).lean();
        if (!result || !(populate || relations)) return result;
        const lookupStages = buildLookupStages(populate || relations);
        const pipeline = [{ $match: { _id: result._id } }, ...lookupStages];
        const populated = await Model.aggregate(pipeline);
        return populated[0] || result;
      } catch (error) {
        throw createError(500, error);
      }
    },

    findOneAndDelete: async (filter, options = {}) => {
      try {
        const Model = getModel();
        return await Model.findOneAndDelete(convertFilterToMatch(filter), options).lean();
      } catch (error) {
        throw createError(500, error);
      }
    },

    findOneAndReplace: async (filter, replacement, options = {}) => {
      try {
        const Model = getModel();
        const mongoOptions = { new: true, runValidators: true, ...options };
        return await Model.findOneAndReplace(convertFilterToMatch(filter), replacement, mongoOptions).lean();
      } catch (error) {
        throw createError(500, error);
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
        throw createError(500, error);
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
        throw createError(500, err);
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
        throw createError(500, error);
      }
    },

    count: async (filter = {}, options = {}) => {
      try {
        const Model = getModel();
        return await Model.countDocuments(convertFilterToMatch(filter), options);
      } catch (error) {
        throw createError(500, error);
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
        throw createError(500, error);
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
        throw createError(500, error);
      }
    },

    bulkDelete: async (filter, options = {}) => {
      try {
        const Model = getModel();
        const result = await Model.deleteMany(convertFilterToMatch(filter), options);
        return { deletedCount: result.deletedCount, acknowledged: result.acknowledged, affectedRows: result.deletedCount };
      } catch (error) {
        throw createError(500, error);
      }
    },

    distinct: async (field, filter = {}, options = {}) => {
      try {
        const Model = getModel();
        return await Model.distinct(field, convertFilterToMatch(filter), options);
      } catch (error) {
        throw createError(500, error);
      }
    },

    exists: async (filter, options = {}) => {
      try {
        const Model = getModel();
        return !!(await Model.exists(convertFilterToMatch(filter), options));
      } catch (error) {
        throw createError(500, error);
      }
    },

    bulkWrite: async (operations, options = {}) => {
      try {
        const Model = getModel();
        return await Model.bulkWrite(operations, options);
      } catch (error) {
        throw createError(500, error);
      }
    },

    // Fixed: reference `api` directly instead of relying on `this` binding
    createWithTransaction: async (dataModel, session) => api.create(dataModel, session),
    updateWithTransaction: async (updateData, filter, session) => api.update(updateData, filter, { session }),
    destroyWithTransaction: async (filter, session) => api.destroy(filter, { session }),

    aggregate: async (pipeline = [], options = {}) => {
      try {
        const Model = getModel();
        return await Model.aggregate(pipeline, options);
      } catch (error) {
        throw createError(500, error);
      }
    },
  };

  return api;
};

export default crudService;