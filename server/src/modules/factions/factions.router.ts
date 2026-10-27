import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireRole } from '@middleware/requireRole';
import * as svc from './factions.service';

export const factionsRouter = Router();

const yearParam = z.object({ year: z.coerce.number().int() });

factionsRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ items: await svc.listFactions() });
  } catch (e) {
    next(e);
  }
});

factionsRouter.get('/at/:year', async (req, res, next) => {
  try {
    const { year } = yearParam.parse(req.params);
    res.json({ year, items: await svc.getFactionsAtYear(year) });
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/factions/at/:year/geometries — all faction polygons active that year
factionsRouter.get('/at/:year/geometries', async (req, res, next) => {
  try {
    const { year } = yearParam.parse(req.params);
    res.json(await svc.getFactionsGeometryAtYear(year));
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/factions/:id/geometry?year=-500 — PostGIS polygon as GeoJSON
factionsRouter.get('/:id/geometry', async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    if (year === undefined || Number.isNaN(year)) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'year query param required' });
      return;
    }
    const geojson = await svc.getFactionGeometry(req.params.id, year);
    if (!geojson) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'No geometry for this faction/year' });
      return;
    }
    res.json(geojson);
  } catch (e) {
    next(e);
  }
});

factionsRouter.get('/:id', async (req, res, next) => {
  try {
    res.json(await svc.getFactionById(req.params.id));
  } catch (e) {
    next(e);
  }
});

factionsRouter.post('/', requireRole('editor'), async (req, res, next) => {
  try {
    res.status(201).json(await svc.createFaction(req.body));
  } catch (e) {
    next(e);
  }
});

factionsRouter.put('/:id', requireRole('editor'), async (req, res, next) => {
  try {
    res.json(await svc.updateFaction(req.params.id, req.body));
  } catch (e) {
    next(e);
  }
});

factionsRouter.delete('/:id', requireRole('editor'), async (req, res, next) => {
  try {
    await svc.deleteFaction(req.params.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
