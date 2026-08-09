import crudService from '../services/crud.service.js';

const auditCrud = crudService('AuditLog');

/**
 * Fire-and-forget audit log writer.
 * Every create/update/delete action across the app should call this.
 * It NEVER throws / blocks the calling request — a failed audit write
 * must not fail the real action that triggered it.
 *
 * @param {Object} params
 * @param {string} params.userId - req.user._id (the authenticated admin)
 * @param {string} params.action - 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN'
 * @param {string} params.resource - e.g. 'Service', 'Product', 'Branch'
 * @param {Object} [params.details] - any extra context (id, changed fields, ...)
 * @param {string} [params.ip] - req.ip
 */
export const logAudit = ({ userId, action, resource, details, ip }) => {
  auditCrud
    .create({ user: userId, action, resource, details, ip })
    .catch(() => {});
};

/**
 * Pulls (userId, ip) out of an Express req in one line, so services
 * stay short: `const actor = actorFromReq(req);`
 */
export const actorFromReq = (req) => ({
  userId: req.user?._id || req.user?.id,
  ip: req.ip,
});
