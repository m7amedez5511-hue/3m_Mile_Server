import rateLimit from 'express-rate-limit';

/**
 * Shared handler so every limiter returns the same
 * standardized error shape as the rest of the API.
 */
const rateLimitHandler = (req, res) => {
	res.status(429).json({
		success: false,
		message: 'Too many requests. Please try again later.',
	});
};

/**
 * General-purpose limiter for the whole API.
 * Generous enough not to bother normal browsing/shopping traffic,
 * but stops scripted abuse (scraping, brute-force probing, etc.).
 * Mount this once, globally, in app.js.
 */
export const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 300,
	standardHeaders: true,
	legacyHeaders: false,
	handler: rateLimitHandler,
});

/**
 * Strict limiter for authentication endpoints only.
 * Login/register/forgot-password are the classic brute-force targets,
 * so they get a much tighter window/limit than the rest of the API.
 * Mount this ONLY on /v1/auth/login, /v1/auth/register, etc.
 */
// export const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   limit: 10, // 10 attempts per IP per window
//   standardHeaders: true,
//   legacyHeaders: false,
//   skipSuccessfulRequests: true, // only failed login/register attempts count toward the limit
//   handler: rateLimitHandler,
// });

/**
 * Looser limiter for endpoints that legitimately get called often
 * from the same IP in normal use (e.g. product search/autocomplete),
 * where the default apiLimiter window would be too strict.
 */
// export const searchLimiter = rateLimit({
//   windowMs: 60 * 1000, // 1 minute
//   limit: 60, // 60 requests per IP per minute
//   standardHeaders: true,
//   legacyHeaders: false,
//   handler: rateLimitHandler,
// });