// ──────────────────────────────────────────────
//  Routes: /api/metrics
// ──────────────────────────────────────────────
import { Router, Request, Response, NextFunction } from 'express';
import metricsService from '../services/metricsService';

const router = Router();

// GET /api/metrics/crowd
router.get('/crowd', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await metricsService.getCrowdData();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
