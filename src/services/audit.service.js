import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';

const auditCrud = crudService('AuditLog');
// get paginated list of audit logs
export const listAuditLogs = async ({ page = 1, limit = 10 } = {}) => {
  //1 fetch paginated results sorted by createdAt in descending order
  const { rows, total } = await auditCrud.findAndCountAll(
    {},
    { page, limit, sort: { createdAt: -1 } },
  );
  //2 return the paginated results along with total count, current page, and limit
  return { items: rows, total, page, limit };
};
// get a single audit log by ID
export const getAuditLogById = async (id) => {
  //1 fetch the audit log by ID
  const log = await auditCrud.findByPk(id);
  //2 if not found, throw a 404 error
  if (!log) {
    throw createAppError(404, 'audit_log_not_found');
  }
  //3 return the fetched audit log
  return log;
};
// create a new audit log entry
export const createAuditLog = async ({ user, action, resource, details, ip }) => {
  //1 create the audit log entry with provided details
  return auditCrud.create({ user, action, resource, details, ip });
};