// ──────────────────────────────────────────────
//  Middleware: errorHandler
//  Central error-handler – must be registered
//  LAST in server.ts after all routes.
// ──────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
  status?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error(
    `[${new Date().toISOString()}] ERROR ${req.method} ${req.path}:`,
    err.message
  );

  const statusCode = err.statusCode ?? err.status ?? 500;
  const message    = err.message ?? 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
