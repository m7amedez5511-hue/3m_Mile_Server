import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const faqCrud = crudService('Faq');

// whitelist of fields allowed to be updated directly by the client
const UPDATABLE_FIELDS = ['question', 'answer', 'order', 'isActive'];

// get paginated list of faqs
export const listFaqs = async ({ page = 1, limit = 50 } = {}) => {
  //1 build filter object
  const filter = { isDeleted: false };
  //2 fetch paginated results sorted by order and createdAt
  return faqCrud.findAndCountAll(filter, { page, limit, sort: { order: 1, createdAt: -1 } });
};

// get a single faq by ID
export const getFaqById = async (id) => {
  //1 fetch the faq by ID
  const faq = await faqCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!faq || faq.isDeleted) {
    throw createAppError(404, 'faq_not_found');
  }
  //3 return the fetched faq
  return faq;
};

// create a new faq
export const createFaq = async (req) => {
  //1 extract faq data from request body using the whitelist
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //2 create the faq in the database
  const faq = await faqCrud.create(data);
  //3 log audit for faq creation
  logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Faq', details: { id: faq._id } });
  //4 return the created faq
  return faq;
};

// update an existing faq by ID
export const updateFaq = async (id, req) => {
  //1 fetch the existing faq by ID
  const existing = await faqCrud.findByPk(id);
  //2 if not found or isDeleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'faq_not_found');
  }
  //3 build update data from a strict whitelist only (prevents mass assignment of isDeleted, etc.)
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  //4 update the faq in the database
  const updated = await faqCrud.findOneAndUpdate({ _id: id }, data);
  //5 log audit for faq update
  logAudit({ ...actorFromReq(req), action: 'UPDATE', resource: 'Faq', details: { id } });
  //6 return the updated faq
  return updated;
};

// soft-delete a faq by ID
export const deleteFaq = async (id, req) => {
  //1 fetch the existing faq by ID
  const existing = await faqCrud.findByPk(id);
  //2 if not found or already deleted, throw a 404 error
  if (!existing || existing.isDeleted) {
    throw createAppError(404, 'faq_not_found');
  }
  //3 soft-delete: mark isDeleted instead of removing the document
  const result = await faqCrud.findOneAndUpdate({ _id: id }, { isDeleted: true, isActive: false });
  //4 log audit for faq deletion
  logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Faq', details: { id } });
  //5 return the result of the soft deletion
  return result;
};