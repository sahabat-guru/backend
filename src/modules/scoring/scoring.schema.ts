import { z } from "zod";

// Override score schema
export const overrideScoreSchema = z.object({
	finalScore: z.number().min(0).max(100),
	feedback: z.string().optional(),
});

export type OverrideScoreInput = z.infer<typeof overrideScoreSchema>;

// Trigger scoring schema
export const triggerScoringSchema = z.object({
	participantIds: z.array(z.string().uuid()).optional(), // If empty, score all
});

export type TriggerScoringInput = z.infer<typeof triggerScoringSchema>;
