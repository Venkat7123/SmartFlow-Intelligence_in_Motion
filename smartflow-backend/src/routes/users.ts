// ──────────────────────────────────────────────
//  Routes: /api/users/:uid
// ──────────────────────────────────────────────
import { Router, Response, NextFunction } from 'express';
import userService from '../services/userService';
import { verifyToken, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

// GET /api/users/:uid
router.get('/', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await userService.getUserProfile(req.params.uid);
    if (!profile) {
      res.status(204).send();
      return;
    }
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:uid
router.patch('/', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await userService.updateUserProfile(req.params.uid, req.body);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

export default router;
