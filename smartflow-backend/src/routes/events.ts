// ──────────────────────────────────────────────
//  Routes: /api/events  &  /api/users/:uid/events
// ──────────────────────────────────────────────
import { Router, Response, NextFunction } from 'express';
import eventService from '../services/eventService';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// GET /api/events  — all public events
router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const events = await eventService.getAllEvents();
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id  — single event
router.get('/:id', async (req, res: Response, next: NextFunction) => {
  try {
    const event = await eventService.getEventById(req.params.id);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// POST /api/events  — create event
router.post(
  '/',
  validate(['title', 'venue', 'date', 'time', 'category']),
  async (req, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.createEvent(req.body);
      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/events/:id  — update event
router.put('/:id', async (req, res: Response, next: NextFunction) => {
  try {
    const event = await eventService.updateEvent(req.params.id, req.body);
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/events/:id  — delete event
router.delete('/:id', async (req, res: Response, next: NextFunction) => {
  try {
    await eventService.deleteEvent(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── User-specific events (auth required) ────────

// GET /api/users/:uid/events
router.get(
  '/users/:uid/events',
  verifyToken,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const events = await eventService.getUserEvents(req.params.uid);
      res.json(events);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/users/:uid/events
router.post(
  '/users/:uid/events',
  verifyToken,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.addUserEvent(req.params.uid, req.body);
      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/users/:uid/events/:eid
router.delete(
  '/users/:uid/events/:eid',
  verifyToken,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await eventService.removeUserEvent(req.params.uid, req.params.eid);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
