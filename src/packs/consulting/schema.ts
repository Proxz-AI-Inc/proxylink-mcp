import { z } from 'zod';

export const scheduleCallInputSchema = z.object({});

export const scheduleCallOutputSchema = z.object({
  success: z.boolean(),
  schedulingUrl: z.string().url().optional(),
  message: z.string(),
});
