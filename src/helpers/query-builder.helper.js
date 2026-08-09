
import mongoose from 'mongoose';
import { logger } from '../utils/winston.js';
const ObjectId = mongoose.Types.ObjectId;

const toUTCDate = (val) => {
    const s = String(val).replace(/^"|"$/g, '');
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00.000Z') : new Date(s);
};

module.exports = {
    buildQueryPrams: (query, fields, type, collectionField) => {
        const queryParams = {};
        fields.forEach(field => {
            if (type === 'number') {
                if (query[field] !== undefined && query[field] !== null && query[field] !== '') {
                    queryParams[field] = Number(query[field]);
                }
            } else if (type === 'string' || type === 'search') {
                if (query[field] !== undefined) {
                    queryParams[field] = { $regex: new RegExp(query[field], 'i') };
                }
            } else if (type === 'rangeNumber' || type === 'range') {
                const rangeQuery = {};
                if (query[`${field}[gte]`] !== undefined) rangeQuery.$gte = Number(query[`${field}[gte]`]);
                if (query[`${field}[lte]`] !== undefined) rangeQuery.$lte = Number(query[`${field}[lte]`]);
                if (query[`${field}[lte]`] === undefined && query[`${field}[gte]`] === undefined && query[field] !== undefined) {
                    rangeQuery.$eq = Number(query[field]);
                }
                if (Object.keys(rangeQuery).length > 0) queryParams[field] = rangeQuery;
            } else if (type === 'date' || type === 'rangeDate') {
                const rangeQuery = {};
                const conditionalField = collectionField || field;

                if (field === 'toDate' && query.toDate !== undefined) {
                    query[`${field}[lte]`] = String(query.toDate).replace(/-/g, '/');
                }
                if (field === 'fromDate' && query.fromDate !== undefined) {
                    query[`${field}[gte]`] = String(query.fromDate).replace(/-/g, '/');
                }

                if (query[`${field}[gte]`] !== undefined) rangeQuery.$gte = toUTCDate(query[`${field}[gte]`]);
                if (query[`${field}[lte]`] !== undefined) rangeQuery.$lte = toUTCDate(query[`${field}[lte]`]);
                if (query[`${field}[lte]`] === undefined && query[`${field}[gte]`] === undefined && query[field] !== undefined) {
                    rangeQuery.$eq = toUTCDate(query[field]);
                }

                if (
                    Object.keys(rangeQuery).length > 0 &&
                    (rangeQuery.$eq === undefined || !isNaN(rangeQuery.$eq.getTime())) &&
                    (rangeQuery.$gte === undefined || !isNaN(rangeQuery.$gte.getTime())) &&
                    (rangeQuery.$lte === undefined || !isNaN(rangeQuery.$lte.getTime()))
                ) {
                    if (!queryParams[conditionalField]) queryParams[conditionalField] = {};
                    if (rangeQuery.$gte) queryParams[conditionalField].$gte = rangeQuery.$gte;
                    if (rangeQuery.$lte) queryParams[conditionalField].$lte = rangeQuery.$lte;
                }
            } else if (type === 'boolean') {
                if (query[field] !== undefined) {
                    queryParams[field] = query[field] === 'true' || query[field] === true;
                }
            } else if (type === 'objectId') {
                if (query[field] !== undefined) queryParams[field] = new ObjectId(query[field]);
            } else if (type === 'nullable') {
                const conditionalField = collectionField || field;
                if (query[field] == true || query[field] == 'true') {
                    queryParams[conditionalField] = { $ne: null };
                } else if (query[field] == false || query[field] == 'false') {
                    queryParams[conditionalField] = null;
                }
            } else if (type === 'array') {
                if (query[field] !== undefined) {
                    queryParams[field] = Array.isArray(query[field]) ? { $in: query[field] } : query[field];
                }
            } else if (type === 'mixedId') {
                if (query[field] !== undefined && query[field] !== '') {
                    const numVal = Number(query[field]);
                    queryParams[field] = !isNaN(numVal)
                        ? { $in: [numVal, String(query[field])] }
                        : { $regex: new RegExp(query[field], 'i') };
                }
            } else {
                if (query[field] !== undefined) queryParams[field] = query[field];
            }
        });
        return queryParams;
    },


    buildSortObject: (sortParam) => {
        if (!sortParam) return { createdAt: -1 };
        const sortObject = {};
        sortParam.split(',').forEach(field => {
            field = field.trim();
            if (field.includes(':')) {
                const [fieldName, order] = field.split(':');
                sortObject[fieldName.trim()] = order.trim() === '1' ? 1 : -1;
            } else if (field.startsWith('-')) {
                sortObject[field.substring(1)] = -1;
            } else {
                sortObject[field] = 1;
            }
        });
        return sortObject;
    },

    buildPaginationOptions: (page = 1, limit = 20) => {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(10000, Math.max(1, parseInt(limit) || 20));
        return { skip: (pageNum - 1) * limitNum, limit: limitNum, page: pageNum };
    },
};
