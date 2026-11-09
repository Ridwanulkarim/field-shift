import { Router } from 'express';
import { freshnessFor } from '../utils/dataLabel.js';

// GET /api/health        is the API process alive? (no database needed)
// GET /api/health/db     can it reach the database? 503 if not
// GET /api/health/data   which districts have NASA / synthetic / no climate data, plus recent failures
export function createHealthRouter(repository) {
  const router = Router();

  router.get('/', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'field-shift-backend',
      timestamp: new Date().toISOString(),
      // 'database' | 'offline-files' | 'database-with-offline-fallback' | 'none'
      dataMode: repository ? repository.mode ?? 'database' : 'none',
      // true while a database outage is being answered from the offline files
      degraded: Boolean(repository?.isDegraded?.()),
    });
  });

  router.get('/db', async (req, res) => {
    if (!repository) {
      return res.status(503).json({ error: { code: 'DATABASE_NOT_CONFIGURED', message: 'No database connection is configured.' } });
    }
    if (repository.mode === 'offline-files') {
      return res.status(503).json({ error: { code: 'OFFLINE_MODE', message: 'The API is serving committed offline files; the database is not used, so it is not reported as reachable.' } });
    }
    try {
      await (repository.pingDatabase ?? repository.ping)();
      return res.status(200).json({ status: 'ok', database: 'reachable' });
    } catch (err) {
      console.error('Database health check failed:', err.message);
      return res.status(503).json({ error: { code: 'DATABASE_UNREACHABLE', message: 'The database could not be reached.' } });
    }
  });

  router.get('/data', async (req, res) => {
    if (!repository) {
      return res.status(503).json({ error: { code: 'DATABASE_NOT_CONFIGURED', message: 'No database connection is configured.' } });
    }
    const [districts, failures] = await Promise.all([repository.listDistricts(), repository.recentFailedRuns()]);
    const tally = { nasa: 0, synthetic: 0, none: 0 };
    for (const d of districts) tally[d.climateData] += 1;
    res.status(200).json({
      dataMode: repository.mode ?? 'database',
      degraded: Boolean(repository.isDegraded?.()),
      upstream: { service: 'NASA POWER', checked: false, status: 'not_checked' },
      districts: districts.map((d) => ({
        slug: d.slug,
        climateData: d.climateData,
        dataStatus: d.dataStatus,
        latestObservationDate: d.latestObservationDate,
        lastRetrievedAt: d.lastRetrievedAt,
        rowCount: d.rowCount,
        missingCount: d.missingCount,
        daysSinceLatest: d.latestObservationDate ? freshnessFor({ endDate: d.latestObservationDate }).daysSinceLatest : null,
      })),
      tally,
      recentFailedRuns: failures,
    });
  });

  return router;
}
