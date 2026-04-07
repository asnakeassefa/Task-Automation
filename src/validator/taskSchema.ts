import { z } from 'zod';

export const ExtractedTaskSchema = z.object({
  task_name: z.string().min(1).max(200),
  notes: z.string(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  priority: z.enum(['low', 'medium', 'high']),
  is_actionable: z.boolean(),
  suggested_tags: z.array(z.string()),
  suggested_role: z.string().nullable().default(null),
  suggested_level: z.string().nullable().default(null),
});

export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;

export function validateExtractedTask(raw: unknown): ExtractedTask {
  const result = ExtractedTaskSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Gemini output failed validation:\n${issues}\n\nRaw output: ${JSON.stringify(raw, null, 2)}`);
  }
  return result.data;
}
