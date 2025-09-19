import { z } from 'zod';

// Request validation schemas
export const SheetCreateSchema = z.object({
  name: z.string().min(1).max(100),
  rows: z.number().int().min(1).max(1000),
  cols: z.number().int().min(1).max(100)
});

export const CellEditSchema = z.object({
  addr: z.string().regex(/^\$?[A-Z]+\$?[0-9]+$/),
  kind: z.enum(['literal', 'formula', 'clear']),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  formula: z.string().optional()
});

export const SheetPatchSchema = z.object({
  edits: z.array(CellEditSchema).min(1).max(1000)
});

export const EvalRequestSchema = z.object({
  id: z.string(),
  addr: z.string().regex(/^\$?[A-Z]+\$?[0-9]+$/)
});

// Response validation schemas
export const SheetResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  rows: z.number(),
  cols: z.number(),
  cells: z.record(z.any()), // TODO: Define cell schema
  updatedAt: z.date()
});

export const EvalResponseSchema = z.object({
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
  error: z.object({
    code: z.string(),
    message: z.string()
  }).optional(),
  explain: z.array(z.object({
    cell: z.string(),
    formula: z.string().optional(),
    dependencies: z.array(z.string()),
    ranges: z.array(z.object({
      start: z.string(),
      end: z.string()
    })),
    value: z.union([z.number(), z.string(), z.boolean(), z.null()])
  })).optional()
});

// Validation helpers
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      };
    }
    return { success: false, error: 'Invalid request' };
  }
}