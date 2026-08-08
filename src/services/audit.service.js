import auditLogModel from "../DB/models/auditLog.model.js";


export const listAuditLogs = async ({ page = 1, limit = 10 } = {}) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    auditLogModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    auditLogModel.countDocuments(),
  ]);
  return { items, total, page, limit };
};

export const createAuditLog = async ({ user, action, resource, details, ip }) => {
  return auditLogModel.create({ user, action, resource, details, ip });
};