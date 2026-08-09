import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import { listAuditLogs, getAuditLogById } from '../services/audit.service.js';
// get paginated list of audit logs
export const getAuditLogs = asyncHandler(async (req, res) => {
  //1 extract query parameters for pagination
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  //2 fetch the paginated list of audit logs using the service function
  const result = await listAuditLogs({ page, limit });
  //3 send the response with the fetched audit logs
  return sendResponse(res, 200, 'audit_logs_fetched', result);
});
// get a single audit log by ID
export const getAuditLog = asyncHandler(async (req, res) => {
  //1 fetch the audit log by ID using the service function
  const log = await getAuditLogById(req.params.id);
  //2 send the response with the fetched audit log
  return sendResponse(res, 200, 'audit_log_fetched', log);
});