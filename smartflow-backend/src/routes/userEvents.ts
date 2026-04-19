// ──────────────────────────────────────────────
//  Routes: /api/users/:uid/events
// ──────────────────────────────────────────────
import { Router, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { verifyToken, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

// GET /api/users/:uid/events – list user's saved events
router.get('/', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const snapshot = await db
      .collection('users')
      .doc(req.params.uid)
      .collection('events')
      .get();
    const events = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// POST /api/users/:uid/events – save an event for the user
router.post('/', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ref = await db
      .collection('users')
      .doc(req.params.uid)
      .collection('events')
      .add(req.body);
    res.status(201).json({ id: ref.id, ...req.body });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:uid/events/:eid – remove a saved event
router.delete('/:eid', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await db
      .collection('users')
      .doc(req.params.uid)
      .collection('events')
      .doc(req.params.eid)
      .delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
