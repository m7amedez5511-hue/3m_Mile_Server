import { asyncHandler } from "./errorHandler.js";
import { verifyJwt } from "../utils/jwt.utils.js";
import { getUser } from "../services/user.service.js";
import { createAppError } from "../utils/createAppError.js";

export const isAuthorized = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const tokenPrefix = process.env.TOKEN_PREFIX || "Bearer";

  // 1. Check if authorization header exists and starts with the correct prefix
  if (!authHeader || !authHeader.startsWith(tokenPrefix)) {
    throw createAppError(401, "Unauthorized");
  }

  // 2. Extract access token (handle multiple spaces and missing token)
  const parts = authHeader.split(" ");
  const accessToken = parts.length === 2 ? parts[1] : parts[0].slice(tokenPrefix.length).trim();

  if (!accessToken) {
    throw createAppError(401, "Unauthorized");
  }

  // 3. Verify access token
  const { decodedToken, expired, valid } = await verifyJwt(
    accessToken,
    "ACCESS_TOKEN_SECRET",
  );

  // If token is invalid or expired
  if (!valid || expired || !decodedToken) {
    throw createAppError(401, "Unauthorized");
  }

  // 4. Find and validate user
  const user = await getUser(decodedToken.aud,false);

  // If user not found, token is invalid
  if (!user) {
    throw createAppError(401, "Unauthorized");
  }

  // Check user status
  if (!user.isActive || user.isDeleted) {
    throw createAppError(401, "Unauthorized");
  }

  // 5. Check if password was changed after token issuance
  if (user.passwordChangedAt) {
    const passwordChangedAtTimestamp = Math.floor(
      new Date(user.passwordChangedAt).getTime() / 1000,
    );

    if (passwordChangedAtTimestamp > decodedToken.iat) {
      throw createAppError(401, "Unauthorized");
    }
  }

  // 6. Attach user data to request
  const { password: _, ...userWithoutPassword } = user;
  req.user = userWithoutPassword;
  req.token = decodedToken;

  return next();
});
