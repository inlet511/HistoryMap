import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireRole } from '@middleware/requireRole';
import * as svc from './events.service';

export const eventsRouter = Router();

const yearParam = z.object({ year: z.coerce.number().int() });

// GET /api/v1/events
eventsRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ items: await svc.listEvents() });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/events/near/:year?range=50
eventsRouter.get('/near/:year', async (req, res, next) => {
  try {
    const { year } = yearParam.parse(req.params);
    const range = req.query.range ? Number(req.query.range) : 50;
    res.json({ year, range, items: await svc.getEventsNearYear(year, range) });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/events/at/:year
eventsRouter.get('/at/:year', async (req, res, next) => {
  try {
    const { year } = yearParam.parse(req.params);
    res.json({ year, items: await svc.getEventsAtYear(year) });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/events/:id
eventsRouter.get('/:id', async (req, res, next) => {
  try {
    res.json(await svc.getEventById(req.params.id));
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/events — editor+
eventsRouter.post('/', requireRole('editor'), async (req, res, next) => {
  try {
    res.status(201).json(await svc.createEvent(req.body));
  } catch (e) {
    next(e);
  }
});

// PUT /api/v1/events/:id — editor+
eventsRouter.put('/:id', requireRole('editor'), async (req, res, next) => {
  try {
    res.json(await svc.updateEvent(req.params.id, req.body));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/v1/events/:id — editor+
eventsRouter.delete('/:id', requireRole('editor'), async (req, res, next) => {
  try {
    await svc.deleteEvent(req.params.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
