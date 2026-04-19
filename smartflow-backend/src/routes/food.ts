// ──────────────────────────────────────────────
//  Routes: /api/food
// ──────────────────────────────────────────────
import { Router, Request, Response, NextFunction } from 'express';
import foodService from '../services/foodService';

const router = Router();

// GET /api/food
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await foodService.getAllFoodItems();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

export default router;
