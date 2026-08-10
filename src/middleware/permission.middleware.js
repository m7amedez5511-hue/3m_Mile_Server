import { createAppError } from "../utils/createAppError.js";
import { asyncHandler } from "./errorHandler.js";

export const restrictTo = (requiredPermission) => {
  return asyncHandler(async (req, res, next) => {
    // System Administrators bypass granular permission checks entirely
    if (req.user?.role?.name === 'Admin') {
      return next();
    }

    const userPermissions = req.user?.role?.permissions || [];
    const hasPermission = userPermissions.some(
      (rp) => rp.permission?.slug === requiredPermission
    );
    console.log('User Permissions:', userPermissions.map(p => p.permission?.slug));
    if (!hasPermission) {
      throw createAppError(403, "user_not_authorized");
    }

    next();
  });
};