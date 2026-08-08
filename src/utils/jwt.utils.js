import JWT from "jsonwebtoken";
import createError from "http-errors";
import { logger } from "./winston.js";
import CONSTANTS from "../constants/index.js";

const { JWT_CONFIG } = CONSTANTS;

export const decodeJWT = (token) => {
  try {
    return JWT.decode(token);
  } catch (error) {
    console.error("Error decoding JWT:", error.message);
    return null;
  }
};

export const signJwt = (userId, secretKey, issuer = null, params = null) => {
  return new Promise((resolve, reject) => {
    const payload = params || {};
    const secret = process.env[secretKey];
    const options = {
      expiresIn:
        secretKey == "ACCESS_TOKEN_SECRET"
          ? JWT_CONFIG.ACCESS_TOKEN_EXPIRE_IN
          : JWT_CONFIG.REFRESH_TOKEN_EXPIRE_IN,
      audience: `${userId}`,
    };

    // Add issuer if provided (to identify the model type)
    if (issuer) {
      options.issuer = issuer;
    }

    JWT.sign(payload, secret, options, (error, token) => {
      if (error) {
        logger.error(error);
        reject(createError.InternalServerError());
      }
      resolve(token);
    });
  });
};

export const verifyJwt = async (token, secretKey) => {
  try {
    const decodedToken = JWT.verify(token, process.env[secretKey]);
    return {
      valid: true,
      expired: false,
      decodedToken,
    };
  } catch (error) {
    const message =
      error.name == "JsonWebTokenError" ? "Unauthorized" : error.message;

    return {
      valid: false,
      expired: message == "jwt expired" ? true : message,
      decoded: null,
    };
  }
};
