import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';

const auditCrud = crudService('AuditLog');

export const listAuditLogs = async ({ page = 1, limit = 10 } = {}) => {
  const { rows, total } = await auditCrud.findAndCountAll(
    {},
    { page, limit, sort: { createdAt: -1 } },
  );
  return { items: rows, total, page, limit };
};

export const getAuditLogById = async (id) => {
  const log = await auditCrud.findByPk(id);
  if (!log) {
    throw createAppError(404, 'audit_log_not_found');
  }
  return log;
};

export const createAuditLog = async ({ user, action, resource, details, ip }) => {
  return auditCrud.create({ user, action, resource, details, ip });
};