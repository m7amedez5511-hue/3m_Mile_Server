import rateLimit from 'express-rate-limit';
import { sendResponse } from '../utils/response.js';

/**
 * Shared handler so every limiter returns the same
 * standardized error shape as the rest of the API.
 */
const rateLimitHandler = (req, res /*, next, options */) => {
  return sendResponse(res, 429, 'too_many_requests', {
    retryAfterSeconds: Math.ceil(req.rateLimit.resetTime ? (req.rateLimit.resetTime - Date.now()) / 1000 : 60),
  });
};

/**
 * General-purpose limiter for the whole API.
 * Generous enough not to bother normal browsing/shopping traffic,
 * but stops scripted abuse (scraping, brute-force probing, etc.).
 * Mount this once, globally, in app.js.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // 300 requests per IP per window
  standardHeaders: true, // adds RateLimit-* response headers
  legacyHeaders: false, // disables the deprecated X-RateLimit-* headers
  handler: rateLimitHandler,
});

/**
 * Strict limiter for authentication endpoints only.
 * Login/register/forgot-password are the classic brute-force targets,
 * so they get a much tighter window/limit than the rest of the API.
 * Mount this ONLY on /v1/auth/login, /v1/auth/register, etc.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only failed login/register attempts count toward the limit
  handler: rateLimitHandler,
});

/**
 * Looser limiter for endpoints that legitimately get called often
 * from the same IP in normal use (e.g. product search/autocomplete),
 * where the default apiLimiter window would be too strict.
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 60, // 60 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});