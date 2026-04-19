// ──────────────────────────────────────────────
//  Routes: /api/gates
// ──────────────────────────────────────────────
import { Router, Request, Response, NextFunction } from 'express';
import gateService from '../services/gateService';

const router = Router();

// GET /api/gates
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const gates = await gateService.getAllGates();
    res.json(gates);
  } catch (err) {
    next(err);
  }
});

// GET /api/gates/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gate = await gateService.getGateById(req.params.id);
    if (!gate) {
      res.status(404).json({ error: 'Gate not found' });
      return;
    }
    res.json(gate);
  } catch (err) {
    next(err);
  }
});

export default router;
