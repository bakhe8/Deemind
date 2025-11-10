// @reuse-from: service/lib/logger.ts, tools/brand-apply.js
// @description: Provides isolated Brand Wizard endpoints for listing, importing, exporting, and applying brand DNA.
/**
 * @layer Service (mutation layer)
 * Only this layer can trigger builds, validation, packaging, or filesystem mutations.
 */
import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import AsyncLock from 'async-lock';
import { brandLog } from '../lib/logger.js';

const router = Router();
const applyLock = new AsyncLock({ timeout: 120000 });
const brandsDir = path.join(process.cwd(), 'core', 'brands');

const respondOk = (res: any, data: any) => res.json({ ok: true, data });
const respondError = (res: any, error: any) => {
  brandLog({ level: 'error', op: 'brand:error', error: String(error) });
  return res.status(500).json({ ok: false, error: String(error) });
};

router.get('/', async (_req, res) => {
  try {
    await fs.ensureDir(brandsDir);
    const files = (await fs.readdir(brandsDir)).filter((f) => f.endsWith('.json'));
    const items = await Promise.all(
      files.map(async (file) => {
        const full = path.join(brandsDir, file);
        const json = await fs.readJson(full).catch(() => ({}));
        return {
          id: path.basename(file, '.json'),
          file,
          preset: json,
        };
      }),
    );
    respondOk(res, { items });
  } catch (error) {
    respondError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const file = path.join(brandsDir, `${req.params.id}.json`);
    const data = await fs.readJson(file);
    respondOk(res, { brand: data });
  } catch (error) {
    respondError(res, error);
  }
});

router.post('/import', async (req, res) => {
  try {
    const { id, brand } = req.body || {};
    if (!id || !brand) {
      return res.status(400).json({ ok: false, error: 'id and brand required' });
    }
    await fs.ensureDir(brandsDir);
    const file = path.join(brandsDir, `${id}.json`);
    await fs.writeJson(file, brand, { spaces: 2 });
    const source = (req.headers['x-deemind-source'] as string) || 'dashboard';
    brandLog({ level: 'info', op: 'brand:import', id, source });
    respondOk(res, { id });
  } catch (error) {
    respondError(res, error);
  }
});

router.post('/:id', async (req, res) => {
  try {
    const brandId = req.params.id;
    const data = req.body;
    if (!brandId) return res.status(400).json({ ok: false, error: 'id required' });
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'brand payload required' });
    }
    await fs.ensureDir(brandsDir);
    const file = path.join(brandsDir, `${brandId}.json`);
    await fs.writeJson(file, data, { spaces: 2 });
    brandLog({ level: 'info', op: 'brand:save', id: brandId });
    respondOk(res, { id: brandId });
  } catch (error) {
    respondError(res, error);
  }
});

router.post('/:id/apply', async (req, res) => {
  const brandId = req.params.id;
  try {
    await applyLock.acquire('applyBrand', async () => {
      const { theme } = req.body || {};
      if (!theme) {
        throw new Error('theme is required');
      }
      const source = (req.headers['x-deemind-source'] as string) || 'dashboard';
      brandLog({ level: 'info', op: 'brand:apply', id: brandId, theme, source });
      const script = path.join(process.cwd(), 'tools', 'brand-apply.js');
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [script, `--brand=${brandId}`, `--theme=${theme}`], {
          stdio: 'inherit',
        });
        child.on('error', reject);
        child.on('exit', (code) => {
          if (code === 0) return resolve();
          reject(new Error(`brand-apply exited with code ${code}`));
        });
      });
      respondOk(res, { applied: true, id: brandId, theme });
    });
  } catch (error) {
    if (String(error?.message).includes('theme is required')) {
      return res.status(400).json({ ok: false, error: 'theme is required' });
    }
    respondError(res, error);
  }
});

router.get('/:id/export', async (req, res) => {
  try {
    const file = path.join(brandsDir, `${req.params.id}.json`);
    if (!(await fs.pathExists(file))) {
      return res.status(404).json({ ok: false, error: 'brand not found' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.json"`);
    res.send(await fs.readFile(file, 'utf8'));
  } catch (error) {
    respondError(res, error);
  }
});

export default router;
