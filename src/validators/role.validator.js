
import { z } from 'zod';

// The System Administrator role is fixed — there's nothing for the
// client to configure. This schema exists purely so `validate()`
// rejects unexpected/extra fields in the request body.
export const createRoleSchema = z.object({}).strict();