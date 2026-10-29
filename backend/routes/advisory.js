/**
 * Field Shift - Advisory Route (Playbook Spec Image 4)
 * GET /api/advisory?district=&crop=&threshold_mm=
 * 
 * Returns recommended window shift in days, two distributions (2001-2012 vs 2013-2025),
 * Mann-Whitney U test statistic, sensitivity check, assumptions, and provenance stack.
 */
import express from 'express';
const router = express.Router();
import * as agroEngine from '../services/agro/agroEngine.js';

router.get('/', (req, res) => {
  try {
    const district = req.query.district || req.query.district_name || 'Rajshahi';
    const crop = req.query.crop || req.query.crop_name || 'Aman Rice';
    const threshold_mm = parseFloat(req.query.threshold_mm) || 20.0;

    const advisory = agroEngine.getPlantingAdvisory(district, crop, threshold_mm);
    res.json(advisory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
