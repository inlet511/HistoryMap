import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireRole } from '@middleware/requireRole';
import * as svc from './dynasties.service';

export const dynastiesRouter = Router();

const yearParam = z.object({ year: z.coerce.number().int() });

// GET /api/v1/dynasties — list all (for timeline rendering)
dynastiesRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ items: await svc.listDynasties() });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/dynasties/at/:year — concurrent dynasties at year
dynastiesRouter.get('/at/:year', async (req, res, next) => {
  try {
    const { year } = yearParam.parse(req.params);
    res.json({ year, items: await svc.getDynastiesAtYear(year) });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/dynasties/:id
dynastiesRouter.get('/:id', async (req, res, next) => {
  try {
    res.json(await svc.getDynastyById(req.params.id));
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/dynasties — editor+
dynastiesRouter.post('/', requireRole('editor'), async (req, res, next) => {
  try {
    res.status(201).json(await svc.createDynasty(req.body));
  } catch (e) {
    next(e);
  }
});

// PUT /api/v1/dynasties/:id — editor+
dynastiesRouter.put('/:id', requireRole('editor'), async (req, res, next) => {
  try {
    res.json(await svc.updateDynasty(req.params.id, req.body));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/v1/dynasties/:id — editor+
dynastiesRouter.delete('/:id', requireRole('editor'), async (req, res, next) => {
  try {
    await svc.deleteDynasty(req.params.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
