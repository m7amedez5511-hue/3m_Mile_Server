import { asyncHandler } from '../middleware/errorHandler.js';
import { sendResponse } from '../utils/response.js';
import { listAuditLogs } from '../services/audit.service.js';

export const getAuditLogs = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await listAuditLogs({ page, limit });
  return sendResponse(res, 200, 'audit_logs_fetched', result);
});