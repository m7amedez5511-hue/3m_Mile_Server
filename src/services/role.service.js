import crudService from './crud.service.js';
import { createAppError } from '../utils/createAppError.js';
import { buildFullPermissionSet } from '../constants/permissions.constant.js';
import { logAudit, actorFromReq } from '../utils/auditLogger.js';

const roleCrud = crudService('Role');

// get the (single) role in the system
export const listRoles = async () => {
  //1 there is at most one role, so return it as a single-item list
  return roleCrud.findAll({});
};

// create the one-and-only System Administrator role
export const createRole = async (req) => {
  //1 enforce the single-role constraint
  const existingCount = await roleCrud.count({});
  if (existingCount > 0) {
    throw createAppError(400, 'only_one_system_administrator_role_allowed');
  }
  //2 build the role with the full, non-negotiable permission set
  const role = await roleCrud.create({
    name: 'Admin',
    permissions: buildFullPermissionSet(),
    isSystem: true,
  });
  //3 log audit for role creation
  /*logAudit({ ...actorFromReq(req), action: 'CREATE', resource: 'Role', details: { id: role._id } });*/
  //4 return the created role
  return role;
};

// guarded delete — the system role can never be removed via the API
export const deleteRole = async (id, req) => {
  //1 fetch the existing role by ID
  const existing = await roleCrud.findByPk(id);
  if (!existing) {
    throw createAppError(404, 'role_not_found');
  }
  //2 block deletion of the system role
  if (existing.isSystem) {
    throw createAppError(403, 'system_role_cannot_be_deleted');
  }
  //3 (unreachable today since every role is system, but kept for completeness)
  const result = await roleCrud.destroy({ _id: id });
  /*logAudit({ ...actorFromReq(req), action: 'DELETE', resource: 'Role', details: { id } });*/
  return result;
};