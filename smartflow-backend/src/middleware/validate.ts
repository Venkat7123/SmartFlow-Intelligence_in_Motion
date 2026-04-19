// ──────────────────────────────────────────────
//  Middleware: validate
//  Factory for required request body field checks.
//  Usage: validate(['field1', 'field2'])
// ──────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';

export function validate(requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = requiredFields.filter((field) => {
      const value = (req.body as Record<string, unknown>)[field];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`,
      });
      return;
    }

    next();
  };
}
