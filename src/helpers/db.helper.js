import mongoose from 'mongoose';

 export const buildLookupStages = (relations = [], Model = null) => {
    if (!Array.isArray(relations)) return [];
    const stages = [];

    const buildSelectStage = (select) => {
        if (!select) return null;
        const projection = {};
        if (Array.isArray(select)) {
            select.forEach(f => projection[f] = 1);
            projection["_id"] = 1;
        } else if (typeof select === "object") {
            Object.assign(projection, select);
            if (!("_id" in projection)) projection["_id"] = 1;
        }
        return projection;
    };

    // Resolves the mongoose `ref` model for a schema path (handles both
    // direct refs and array-of-ObjectId refs via `.caster`).
    const resolveRefModel = (path) => {
        if (!Model || !path) return null;
        const schemaType = Model.schema.path(path);
        if (!schemaType) return null;
        const refName = schemaType.options?.ref || schemaType.caster?.options?.ref;
        if (!refName) return null;
        try {
            return mongoose.model(refName);
        } catch {
            return null;
        }
    };

    for (const rel of relations) {
        if (Object.keys(rel).some(k => k.startsWith('$'))) {
            stages.push(rel);
            continue;
        }

        // Auto-resolve the referenced model from the schema (e.g. `ref: 'User'`)
        // so callers can pass just `{ path: 'author' }` like mongoose populate,
        // without having to hardcode the target collection name every time.
        const refModel = resolveRefModel(rel.path);

        const asField = rel.as || rel.localField?.replace(/Id$/, "") || rel.path || rel.collection;
        const localField = rel.localField || rel.path;
        const fromCollection = rel.collection || refModel?.collection?.name || asField;
        const foreignField = rel.foreignField || "_id";
        const justOne = rel.justOne || false;

        if (rel.useFastLookup) {
            stages.push({
                $lookup: { from: fromCollection, localField, foreignField, as: asField }
            });

            if (rel.match) {
                const keys = Object.keys(rel.match);
                stages.push({
                    $addFields: {
                        [asField]: {
                            $filter: {
                                input: `$${asField}`,
                                as: "doc",
                                cond: {
                                    $and: keys.map(k => ({
                                        $regexMatch: { input: `$$doc.${k}`, regex: rel.match[k].$regex }
                                    }))
                                }
                            }
                        }
                    }
                });
            }

            if (rel.select) {
                const projection = buildSelectStage(rel.select);
                const arrayFields = Object.keys(projection);
                stages.push(
                    {
                        $project: {
                            merged: "$$ROOT",
                            [asField]: {
                                $map: {
                                    input: { $ifNull: [`$${asField}`, []] },
                                    as: "doc",
                                    in: arrayFields.reduce((acc, k) => { acc[k] = `$$doc.${k}`; return acc; }, {})
                                }
                            }
                        }
                    },
                    { $replaceRoot: { newRoot: { $mergeObjects: ["$merged", { [asField]: `$${asField}` }] } } }
                );
            }
        } else {
            const usePipeline = rel.match || rel.sort || rel.limit || rel.select || rel.pipeline || rel.p || rel.let;

            if (usePipeline) {
                const nestedPipeline = [];
                const hasCustomLet = !!rel.let;

                if (hasCustomLet) {
                    const letMatches = Object.keys(rel.let).map(k => ({ $eq: [`$${k}`, `$$${k}`] }));
                    const combinedMatch = rel.match
                        ? { $and: [...letMatches, rel.match.$expr ? rel.match.$expr : rel.match] }
                        : { $and: letMatches };
                    nestedPipeline.push({ $match: { $expr: combinedMatch } });
                } else {
                    if (localField) {
                        // $convert with onError fallback handles mixed string/ObjectId localField values
                        nestedPipeline.push({
                            $match: {
                                $expr: {
                                    $cond: [
                                        { $isArray: `$$localKey` },
                                        {
                                            $in: [
                                                `$${foreignField}`,
                                                { $map: { input: `$$localKey`, as: "id", in: { $convert: { input: "$$id", to: "objectId", onError: "$$id", onNull: null } } } }
                                            ]
                                        },
                                        { $eq: [`$${foreignField}`, { $convert: { input: "$$localKey", to: "objectId", onError: "$$localKey", onNull: null } }] }
                                    ]
                                }
                            }
                        });
                    }
                    if (rel.match) nestedPipeline.push({ $match: rel.match });
                }

                if (rel.sort) nestedPipeline.push({ $sort: rel.sort });
                if (rel.limit) nestedPipeline.push({ $limit: rel.limit });
                if (rel.pipeline || rel.p) nestedPipeline.push(...buildLookupStages(rel.pipeline || rel.p, refModel));

                const selectStage = buildSelectStage(rel.select);
                if (selectStage) nestedPipeline.push({ $project: selectStage });

                stages.push({
                    $lookup: {
                        from: fromCollection,
                        let: rel.let || { localKey: `$${localField}` },
                        pipeline: nestedPipeline,
                        as: asField
                    }
                });
            } else if (localField) {
                stages.push({
                    $lookup: { from: fromCollection, localField, foreignField, as: asField }
                });

                if (rel.select) {
                    const projection = buildSelectStage(rel.select);
                    const arrayFields = Object.keys(projection);
                    stages.push(
                        {
                            $project: {
                                merged: "$$ROOT",
                                [asField]: {
                                    $map: {
                                        input: { $ifNull: [`$${asField}`, []] },
                                        as: "doc",
                                        in: arrayFields.reduce((acc, k) => { acc[k] = `$$doc.${k}`; return acc; }, {})
                                    }
                                }
                            }
                        },
                        { $replaceRoot: { newRoot: { $mergeObjects: ["$merged", { [asField]: `$${asField}` }] } } }
                    );
                }
            }
        }

        if (justOne) {
            stages.push({ $unwind: { path: `$${asField}`, preserveNullAndEmptyArrays: true } });
        }

        if (rel.removeEmpty === true) stages.push({ $match: { [asField]: { $ne: [], $exists: true } } });

        if (rel.populate) stages.push(...buildLookupStages(rel.populate, refModel));
    }

    return stages;
};

 export const convertOrderToSort = (order) => {
    if (!order) return {};
    const sortObj = {};
    if (Array.isArray(order)) {
        if (Array.isArray(order[0])) {
            order.forEach(([field, direction]) => {
                if (typeof field === 'string' && typeof direction === 'string') {
                    sortObj[field] = direction.toLowerCase() === 'desc' ? -1 : 1;
                }
            });
        } else {
            order.forEach(field => { if (typeof field === 'string') sortObj[field] = 1; });
        }
    } else if (typeof order === 'object') {
        return order;
    }
    return sortObj;
};

 export const convertFilterToMatch = (filter) => {
    if (!filter || typeof filter !== 'object') return filter;
    const match = {};
    for (const [key, value] of Object.entries(filter)) {
        if ((key === '_id' || key.endsWith('Id')) && typeof value === 'string' && value.match(/^[0-9a-fA-F]{24}$/)) {
            match[key] = new mongoose.Types.ObjectId(value);
            continue;
        }
        if (key.startsWith('$')) {
            switch (key) {
                case '$or': case '$and': case '$nor':
                    match[key] = Array.isArray(value) ? value.map(convertFilterToMatch) : value;
                    break;
                case '$not':
                    match.$not = convertFilterToMatch(value);
                    break;
                case '$in': case '$nin': case '$all':
                    match[key] = Array.isArray(value)
                        ? value.map(v => (typeof v === 'string' && v.match(/^[0-9a-fA-F]{24}$/) ? new mongoose.Types.ObjectId(v) : v))
                        : value;
                    break;
                default:
                    match[key] = value;
            }
            continue;
        }
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId) && !(value instanceof RegExp)) {
            match[key] = convertFilterToMatch(value);
        } else {
            match[key] = value;
        }
    }
    return match;
};

 export const buildPopulateOptions = (relations) => {
    if (!Array.isArray(relations)) return [];
    return relations.map(relation => {
        if (typeof relation === 'string') return { path: relation };

        const populateObj = {
            path: relation.path || relation.as,
            select: Array.isArray(relation.select)
                ? relation.select.join(' ')
                : relation.select || (Array.isArray(relation.attributes) ? relation.attributes.join(' ') : relation.attributes),
            match: relation.match || (relation.where ? convertFilterToMatch(relation.where) : undefined),
            options: {}
        };

        if (relation.sort) {
            populateObj.options.sort = relation.sort;
        } else if (relation.order) {
            populateObj.options.sort = convertOrderToSort(relation.order);
        }

        if (relation.limit) populateObj.options.limit = parseInt(relation.limit, 10);
        if (relation.skip || relation.offset) populateObj.options.skip = parseInt(relation.skip || relation.offset, 10);

        if (relation.populate || relation.relations) {
            populateObj.populate = buildPopulateOptions(relation.populate || relation.relations);
        }

        if (Object.keys(populateObj.options).length === 0) delete populateObj.options;

        return populateObj;
    });
};

 export const applyPopulateAliasesToDocs = (documents, populateOptions) => {
    if (!documents) return documents;

    const applyToDocument = (document, pops) => {
        if (!document || typeof document !== 'object') return document;

        const apply = (target, pops) => {
            for (const pop of pops) {
                if (!pop || typeof pop !== 'object') continue;
                const from = pop.path;
                const to = pop.as;
                if (!from || !to || from === to) continue;

                if (target[from] !== undefined) {
                    target[to] = target[from];
                    delete target[from];
                }

                const nestedPopulate = Array.isArray(pop.populate)
                    ? pop.populate
                    : pop.populate ? [pop.populate] : [];

                const current = target[to];
                if (Array.isArray(current)) {
                    for (const item of current) {
                        if (item && typeof item === 'object') apply(item, nestedPopulate);
                    }
                } else if (current && typeof current === 'object') {
                    apply(current, nestedPopulate);
                }
            }
        };

        const docObj = typeof document.toObject === 'function'
            ? document.toObject({ virtuals: true, getters: true, minimize: false })
            : document;

        apply(docObj, pops);
        return docObj;
    };

    return Array.isArray(documents)
        ? documents.map(doc => applyToDocument(doc, populateOptions))
        : applyToDocument(documents, populateOptions);
};