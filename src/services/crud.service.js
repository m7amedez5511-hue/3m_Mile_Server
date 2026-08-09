import mongoose from 'mongoose';
import { logger } from '../utils/winston.js';
import { buildPopulateOptions, convertFilterToMatch, convertOrderToSort, applyPopulateAliasesToDocs, buildLookupStages } from '../helpers/db.helper.js';
import pLimit from 'p-limit';
import createError from 'http-errors';



module.exports = (modelName) => {
    // Get the Mongoose model
    const getModel = () => {
        try {
            return mongoose.model(modelName);
        } catch (error) {
            throw createError(500, `Model '${modelName}' not found`);
        }
    };

    return {
        // find functions
        findByPk: async (pk, options = {}) => {
            try {
                const Model = getModel();
                if (options.populate || options.relations) {
                    const lookupStages = buildLookupStages(options.populate || options.relations);

                    const pipeline = [
                        { $match: { _id: new mongoose.Types.ObjectId(String(pk)) } },
                        ...lookupStages
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

                    const pipeline = [
                        { $match: mongoFilter },
                        ...lookupStages
                    ];

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
                // logger.info('CRUD findAll called', {
                //     model: modelName,
                //     filter: mongoFilter,
                //     options,
                //     hasPopulate
                // });
                // If population exists → use aggregation pipeline (like findOne)
                if (hasPopulate) {
                    const lookupStages = buildLookupStages(options.populate || options.relations);

                    const pipeline = [
                        { $match: mongoFilter }
                    ];

                    if (options.preSortPipeline) {
                        pipeline.push(...options.preSortPipeline);
                    }

                    // ---------- Sorting ----------
                    if (options.sort || options.order) {
                        const sortObj = options.sort || convertOrderToSort(options.order);
                        pipeline.push({ $sort: sortObj });
                    }
                    // ---------- Pagination ----------
                    const page = parseInt(options.page || 1);
                    const limit = options.limit ? parseInt(options.limit) : 0;
                    const skip = limit
                        ? (page - 1) * limit
                        : parseInt(options.skip || options.offset || 0);

                    // ---------- Build rows pipeline ----------
                    const rowsPipeline = [
                        ...(skip > 0 ? [{ $skip: skip }] : []),
                        ...(limit > 0 ? [{ $limit: limit }] : []),

                        // 🔥 lookups AFTER pagination
                        ...lookupStages
                    ];

                    // ---------- Select / Projection ----------
                    if (options.select || options.attributes) {
                        const selectStr =
                            options.select ||
                            (Array.isArray(options.attributes)
                                ? options.attributes.join(" ")
                                : options.attributes);

                        const projection = {};
                        selectStr.split(/\s+/).forEach(f => {
                            if (f.trim()) projection[f] = 1;
                        });

                        rowsPipeline.push({ $project: projection });
                    }
                    pipeline.push(...rowsPipeline);
                    if (options.cursor) {
                        return Model
                            .aggregate(pipeline)
                            .cursor({ batchSize: options.batchSize || 500 });
                    }
                    const results = await Model.aggregate(pipeline);
                    return results;
                }

                // Otherwise → use normal Mongoose query
                let query = Model.find(mongoFilter).lean();

                // Field selection
                if (options.select || options.attributes) {
                    const selectFields = options.select || (
                        Array.isArray(options.attributes)
                            ? options.attributes.join(' ')
                            : options.attributes
                    );
                    query = query.select(selectFields);
                }

                // Sorting
                if (options.sort || options.order) {
                    const sortObj = options.sort || convertOrderToSort(options.order);
                    query = query.sort(sortObj);
                }

                // Skip / offset
                if (options.skip || options.offset) {
                    query = query.skip(parseInt(options.skip || options.offset));
                }

                // Limit
                if (options.limit) {
                    query = query.limit(parseInt(options.limit));
                }

                // group by
                if (options.groupBy) {
                    query = query.group(options.groupBy);
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
                
                // -----------------------------------------------------
                // AGGREGATION MODE (when populate/relations is included)
                // -----------------------------------------------------
                if (hasPopulate) {
                    const lookupStages = buildLookupStages(options.populate || options.relations);

                    const pipeline = [
                        { $match: mongoFilter }
                    ];

                    // ---------- Sorting ----------
                    if (options.sort || options.order) {
                        const sortObj = options.sort || convertOrderToSort(options.order);
                        pipeline.push({ $sort: sortObj });
                    }
                    // ---------- Pagination ----------
                    const page = parseInt(options.page || 1);
                    const limit = options.limit ? parseInt(options.limit) : 0;
                    const skip = limit
                        ? (page - 1) * limit
                        : parseInt(options.skip || options.offset || 0);
                    logger.info(`findAndCountAll - pagination calculated`, { page, limit, skip });
                    // ---------- Build rows pipeline ----------
                    const rowsPipeline = [
                        ...(skip > 0 ? [{ $skip: skip }] : []),
                        ...(limit > 0 ? [{ $limit: limit }] : []),

                        // 🔥 lookups AFTER pagination
                        ...lookupStages
                    ];

                    // ---------- Select / Projection ----------
                    if (options.select || options.attributes) {
                        const selectStr =
                            options.select ||
                            (Array.isArray(options.attributes)
                                ? options.attributes.join(" ")
                                : options.attributes);

                        const projection = {};
                        selectStr.split(/\s+/).forEach(f => {
                            if (f.trim()) projection[f] = 1;
                        });

                        rowsPipeline.push({ $project: projection });
                    }

                    // ---------- Facet ----------
                    pipeline.push({
                        $facet: {
                            rows: rowsPipeline,
                            totalCount: [
                                { $count: "count" }
                            ]
                        }
                    });


                    const result = await Model.aggregate(pipeline);

                    const rows = result[0].rows;
                    const count = result[0].totalCount[0]?.count || 0;

                    // Apply aliasing to populated docs
                    let finalRows = rows;
                    if (options.populate) {
                        finalRows = applyPopulateAliasesToDocs(rows, options.populate);
                    }

                    return {
                        count,
                        rows: finalRows,
                        total: count,
                        data: finalRows
                    };
                }

                // -----------------------------------------------------
                // NORMAL MONGOOSE QUERY MODE (no population)
                // -----------------------------------------------------

                // Count
                const count = await Model.countDocuments(mongoFilter);

                let query = Model.find(mongoFilter).lean();

                // Select
                if (options.select || options.attributes) {
                    const selectFields = options.select ||
                        (Array.isArray(options.attributes)
                            ? options.attributes.join(" ")
                            : options.attributes);
                    query = query.select(selectFields);
                }

                // Sort
                if (options.sort || options.order) {
                    const sortObj = options.sort || convertOrderToSort(options.order);
                    query = query.sort(sortObj);
                }

                // Pagination
                if (options.limit) {
                    const limitNum = parseInt(options.limit);
                    query = query.limit(limitNum);

                    let skip = 0;
                    if (options.page) {
                        skip = (parseInt(options.page) - 1) * limitNum;
                    } else if (options.skip || options.offset) {
                        skip = parseInt(options.skip || options.offset);
                    }
                    query = query.skip(skip);
                }

                // Populate
                if (options.populate || options.relations) {
                    const populateOptions = buildPopulateOptions(options.populate || options.relations);
                    populateOptions.forEach(pop => {
                        query = query.populate(pop);
                    });
                }

                let rows = await query.exec();

                // Alias populated fields
                if (rows && options.populate) {
                    rows = applyPopulateAliasesToDocs(rows, options.populate);
                }

                return {
                    count,
                    rows,
                    total: count,
                    data: rows
                };

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
                    // Merge filter and defaults for creation
                    const createData = { ...defaults, ...filter };
                    record = await Model.create(createData);
                    created = true;
                }

                return { record, created, document: record, isNew: created };
            } catch (error) {
                throw createError(500, error);
            }
        },
        // MongoDB-specific atomic operations
        findOneAndUpdate: async (filter, updateData, options = {}) => {
            try {
                const Model = getModel();
                const mongoFilter = convertFilterToMatch(filter);
                const { populate, relations, ...restOptions } = options;

                const mongoOptions = {
                    new: true,
                    runValidators: true,
                    upsert: restOptions.upsert || false,
                    ...restOptions,
                };

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
                const mongoFilter = convertFilterToMatch(filter);
                return await Model.findOneAndDelete(mongoFilter, options).lean();
            } catch (error) {
                throw createError(500, error);
            }
        },

        findOneAndReplace: async (filter, replacement, options = {}) => {
            try {
                const Model = getModel();
                const mongoFilter = convertFilterToMatch(filter);
                const mongoOptions = {
                    new: true,
                    runValidators: true,
                    ...options
                };

                return await Model.findOneAndReplace(mongoFilter, replacement, mongoOptions).lean();
            } catch (error) {
                throw createError(500, error);
            }
        },
        // end functions

        create: async (dataModel, session = null) => {
            try {
                const Model = getModel();
                const options = session ? { session } : {};

                if (Array.isArray(dataModel)) {
                    return await Model.insertMany(dataModel, options, { ordered: false });
                } else {
                    return await Model.create([dataModel], options).then(docs => docs[0]);
                }
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
                        // const batchLabel = `Save-Batch-${i / BATCH_SIZE + 1}-${modelName}`;
                        try {

                            // console.time(batchLabel);
                            const operations = batch.map(doc => ({
                                insertOne: {
                                    document: doc
                                }
                            }));

                            const res = await Model.bulkWrite(operations, {
                                ordered: false,
                                lean: true,
                                upsert: true,
                                writeConcern: { w: 1, j: false }
                            });
                            // logger.info(`Bulk insert batch succeeded at offset ${i}`, { result: res });
                            insertedCount += res.insertedCount;
                            batch.length = 0;
                            global.gc?.();
                            // console.timeEnd(batchLabel);
                        } catch (err) {
                            // logger.info(`Bulk insert batch succeeded at offset ${i}`, { result: err?.result?.insertedCount });
                            if (err?.result?.insertedCount) {
                                insertedCount += err.result.insertedCount;
                            }
                            if (err.result?.nInserted) insertedCount += err.result.nInserted;
                            if (err.insertedDocs) insertedCount += err.insertedDocs.length;
                            console.error(`Batch failed at offset ${i}: ${err.message}`);
                        }
                    })
                );
            }

            await Promise.all(tasks);

            return { insertedCount, failedBatches };
        },
        bulkUpdateWorkerAllDocs: async (data, BATCH_SIZE = 1000, concurrency = 4) => {
            // logger.info(`bulkUpdateWorkerAllDocs called for model ${modelName} with ${data.length} items.`);
            const limit = pLimit(concurrency);
            const Model = getModel();

            let modifiedCount = 0;
            let failedBatches = 0;

            const tasks = [];

            for (let i = 0; i < data.length; i += BATCH_SIZE) {
                const batch = data.slice(i, i + BATCH_SIZE);
                // build bulk operations
                const ops = batch.map(d => ({
                    updateMany: {
                        filter: d.filter,
                        update: {
                            $set: {
                                ...d.updateData,
                                updatedAt: new Date()
                            },
                            $setOnInsert: d.setOnInsert || {},
                        },
                        upsert: true
                    }
                }));

                tasks.push(
                    limit(async () => {
                        try {
                            const res = await Model.bulkWrite(ops, {
                                ordered: false,
                                writeConcern: { w: 1, j: false }
                            });

                            modifiedCount += res.modifiedCount || 0;
                        } catch (err) {
                            failedBatches++;
                            if (err.result?.nModified) modifiedCount += err.result.nModified;
                            // console.error(`Batch failed at offset ${i}: ${err.message}`);
                        }
                    })
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

                const limit = pLimit(5); // 5 batches running at the same time
                const tasks = [];

                for (let i = 0; i < dataModel.length; i += BATCH_SIZE) {
                    const batch = dataModel.slice(i, i + BATCH_SIZE);

                    tasks.push(
                        limit(() =>
                            Model.insertMany(batch, { ordered: false, ...options })
                        )
                    );
                }

                const results = await Promise.allSettled(tasks);

                // Collect docs safely
                const insertedDocs = [];
                for (const result of results) {
                    if (result.status === "fulfilled") {
                        insertedDocs.push(...result.value);
                    } else {
                        console.error("❌ Batch insert failed:", result.reason?.message);
                    }
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

                const mongoOptions = {
                    runValidators: true,
                    ...options
                };

                const result = await Model.updateMany(mongoFilter, updateData, mongoOptions);

                // Return in multiple formats for compatibility
                return {
                    modifiedCount: result.modifiedCount,
                    matchedCount: result.matchedCount,
                    acknowledged: result.acknowledged,
                    // Legacy Sequelize format
                    affectedRows: result.modifiedCount,
                    0: result.modifiedCount // Array format [affectedCount]
                };
            } catch (error) {
                throw createError(500, error);
            }
        },

        count: async (filter = {}, options = {}) => {
            try {
                const Model = getModel();
                const mongoFilter = convertFilterToMatch(filter);
                return await Model.countDocuments(mongoFilter, options);
            } catch (error) {
                throw createError(500, error);
            }
        },
        softDelete: async (filter) => {
            try {
                const Model = getModel();
                const mongoFilter = convertFilterToMatch(filter);
                const result = await Model.updateMany(mongoFilter, { $set: { deletedAt: new Date() } });
                return {
                    deletedCount: result.modifiedCount,
                    acknowledged: result.acknowledged,
                };
            } catch (error) {
                throw createError(500, error);
            }
        },
        // MongoDB specific delete methods
        destroy: async (filter, options = {}) => {
            try {
                const Model = getModel();
                const mongoFilter = convertFilterToMatch(filter);

                if (options?.individualHooks) {
                    // For individual hooks, find and delete one by one
                    const docs = await Model.find(mongoFilter, null, options).exec();
                    let deletedCount = 0;

                    for (const doc of docs) {
                        await doc.deleteOne(options);
                        deletedCount++;
                    }

                    return {
                        deletedCount,
                        acknowledged: true,
                        // Legacy format
                        affectedRows: deletedCount
                    };
                } else {
                    const result = await Model.deleteMany(mongoFilter, options);
                    return {
                        deletedCount: result.deletedCount,
                        acknowledged: result.acknowledged,
                        // Legacy format
                        affectedRows: result.deletedCount
                    };
                }
            } catch (error) {
                throw createError(500, error);
            }
        },

        bulkDelete: async (filter, options = {}) => {
            try {
                const Model = getModel();
                const mongoFilter = convertFilterToMatch(filter);
                const result = await Model.deleteMany(mongoFilter, options);

                return {
                    deletedCount: result.deletedCount,
                    acknowledged: result.acknowledged,
                    affectedRows: result.deletedCount
                };
            } catch (error) {
                throw createError(500, error);
            }
        },



        // MongoDB advanced operations
        distinct: async (field, filter = {}, options = {}) => {
            try {
                const Model = getModel();
                const mongoFilter = convertFilterToMatch(filter);
                return await Model.distinct(field, mongoFilter, options);
            } catch (error) {
                throw createError(500, error);
            }
        },

        exists: async (filter, options = {}) => {
            try {
                const Model = getModel();
                const mongoFilter = convertFilterToMatch(filter);
                const result = await Model.exists(mongoFilter, options);
                return !!result;
            } catch (error) {
                throw createError(500, error);
            }
        },

        // Bulk operations
        bulkWrite: async (operations, options = {}) => {
            try {
                const Model = getModel();
                return await Model.bulkWrite(operations, options);
            } catch (error) {
                throw createError(500, error);
            }
        },

        // Transaction-aware methods (backward compatibility)
        createWithTransaction: async (dataModel, session) => {
            return this.create(dataModel, { session });
        },

        updateWithTransaction: async (updateData, filter, session) => {
            return this.update(updateData, filter, { session });
        },

        destroyWithTransaction: async (filter, session) => {
            return this.destroy(filter, { session });
        },
        aggregate: async (pipeline = [], options = {}) => {
            try {
                const Model = getModel();
                return await Model.aggregate(pipeline, options);
            } catch (error) {
                throw createError(500, error);
            }
        }
    };
};