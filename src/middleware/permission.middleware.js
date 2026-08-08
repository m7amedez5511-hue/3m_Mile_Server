import { createAppError } from "../utils/createAppError.js";
import { asyncHandler } from "./errorHandler.js";


export const restrictTo = (requiredPermission) => {
  return asyncHandler(async (req, res, next) => {
    // 1) Get permissions from user object attached by isAuthorized
    const userPermissions = req.user?.role?.permissions || [];

    // 2) Check if user has the required permission slug
    const hasPermission = userPermissions.some(
      (rp) => rp.permission?.slug === requiredPermission
    );

    if (!hasPermission) {
      throw createAppError(403, "user_not_authorized");
    }

    next();
  });
};
