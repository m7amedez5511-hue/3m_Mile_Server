import { asyncHandler } from "./errorHandler.js";

/**
 * Generic validation middleware for Zod schemas
 * Supports validating body, params, or query
 */
export const validate = (schema, source = "body") => 
  asyncHandler(async (req, res, next) => {
    // Validate the specified part of the request
    const validatedData = await schema.parseAsync(req[source]);
    
    // Replace the request data with the validated/transformed data
    req[source] = validatedData;
    
    next();
  });
