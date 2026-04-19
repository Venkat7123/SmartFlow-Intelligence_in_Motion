// ──────────────────────────────────────────────
//  Routes: /api/users/:uid/orders
// ──────────────────────────────────────────────
import { Router, Response, NextFunction } from 'express';
import orderService from '../services/orderService';
import { verifyToken, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

// GET /api/users/:uid/orders
router.get('/', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orders = await orderService.getMyOrders(req.params.uid);
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// POST /api/users/:uid/orders
router.post('/', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await orderService.createOrder(req.params.uid, req.body);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:uid/orders/:oid/status
router.patch('/:oid/status', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await orderService.updateOrderStatus(
      req.params.uid,
      req.params.oid,
      req.body.status
    );
    res.json(order);
  } catch (err) {
    next(err);
  }
});

export default router;
