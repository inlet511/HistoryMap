import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireRole } from '@middleware/requireRole';
import * as svc from './wars.service';

export const warsRouter = Router();

const yearParam = z.object({ year: z.coerce.number().int() });

warsRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ items: await svc.listWars() });
  } catch (e) {
    next(e);
  }
});

warsRouter.get('/at/:year', async (req, res, next) => {
  try {
    const { year } = yearParam.parse(req.params);
    res.json({ year, items: await svc.getWarsAtYear(year) });
  } catch (e) {
    next(e);
  }
});

warsRouter.get('/near/:year', async (req, res, next) => {
  try {
    const { year } = yearParam.parse(req.params);
    const range = req.query.range ? Number(req.query.range) : 50;
    res.json({ year, range, items: await svc.getWarsNearYear(year, range) });
  } catch (e) {
    next(e);
  }
});

warsRouter.get('/:id', async (req, res, next) => {
  try {
    res.json(await svc.getWarById(req.params.id));
  } catch (e) {
    next(e);
  }
});

warsRouter.post('/', requireRole('editor'), async (req, res, next) => {
  try {
    res.status(201).json(await svc.createWar(req.body));
  } catch (e) {
    next(e);
  }
});

warsRouter.put('/:id', requireRole('editor'), async (req, res, next) => {
  try {
    res.json(await svc.updateWar(req.params.id, req.body));
  } catch (e) {
    next(e);
  }
});

warsRouter.delete('/:id', requireRole('editor'), async (req, res, next) => {
  try {
    await svc.deleteWar(req.params.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
