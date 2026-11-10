import { z } from 'zod';

export const battleSchema = z.object({
  id: z.string().uuid(), code: z.string(), hostId: z.string().uuid(),
  phase: z.enum(['waiting','countdown','question_open','question_result','finished']),
  serverTime: z.string(), answered: z.boolean(),
  players: z.array(z.object({ userId:z.string(), name:z.string(), score:z.number(), ready:z.boolean(), connected:z.boolean() })),
  question: z.object({position:z.number(),closesAt:z.string(),content:z.string(),options:z.array(z.string()),correctIndex:z.number().optional(),explanation:z.string().optional()}).nullable(),
});
export type Battle = z.infer<typeof battleSchema>;
