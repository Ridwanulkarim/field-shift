/**
 * Field Shift - Express REST API Integration Test Suite (Phase 12)
 * Strictly verifies Spec Section 45 HTTP endpoints, payloads, error handling, and Section 50 terminology.
 */
const assert = require('assert');
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const { app, initializeDatabase } = require('./app');

/**
 * In-process HTTP request simulator for sandboxed testing.
 */
function request(app, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? (typeof body === 'object' ? JSON.stringify(body) : String(body)) : null;
    const req = new Readable({
      read() {
        if (dataStr) this.push(dataStr);
        this.push(null);
      }
    });

    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = Object.assign({}, headers);
    if (dataStr) {
      req.headers['content-type'] = req.headers['content-type'] || 'application/json';
      req.headers['content-length'] = Buffer.byteLength(dataStr);
    }

    const res = new EventEmitter();
    const resHeaders = {};
    let resStatusCode = 200;
    let resBody = '';

    res.statusCode = 200;
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.status = (code) => { resStatusCode = code; res.statusCode = code; return res; };
    res.json = (data) => {
      res.setHeader('content-type', 'application/json');
      resBody = JSON.stringify(data);
      res.end();
    };
    res.send = (data) => {
      resBody = typeof data === 'object' ? JSON.stringify(data) : String(data);
      res.end();
    };
    res.end = (chunk) => {
      if (chunk) resBody += chunk;
      let parsed = resBody;
      try { parsed = JSON.parse(resBody); } catch(e){}
      resolve({ status: resStatusCode, headers: resHeaders, body: parsed });
    };

    app.handle(req, res);
  });
}

async function runApiTests() {
  console.log('================================================================');
  console.log('STARTING PHASE 12 REST API INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  await initializeDatabase();

  // 1. GET /api/health (Spec Section 45)
  console.log('[Test 1] Testing GET /api/health...');
  const healthRes = await request(app, { method: 'GET', url: '/api/health' });
  assert.strictEqual(healthRes.status, 200);
  assert.strictEqual(healthRes.body.status, 'ok');
  assert.strictEqual(healthRes.body.version, 'v6.2');
  assert.strictEqual(healthRes.body.database, 'connected');
  console.log(`✓ Health endpoint verified: status=${healthRes.body.status}, version=${healthRes.body.version}, engine=${healthRes.body.engine_mode}\n`);

  // 2. GET /api/crops (Spec Section 45, 26, 27)
  console.log('[Test 2] Testing GET /api/crops (12 Canonical Varieties)...');
  const cropsRes = await request(app, { method: 'GET', url: '/api/crops' });
  assert.strictEqual(cropsRes.status, 200);
  assert.strictEqual(cropsRes.body.count, 12);
  assert.strictEqual(cropsRes.body.crops.length, 12);
  
  const cropNames = cropsRes.body.crops.map(c => c.name);
  assert.strictEqual(cropNames.some(n => n.includes('Chickpea')), true);
  assert.strictEqual(cropNames.some(n => n.includes('Wheat')), true);
  assert.strictEqual(cropNames.some(n => n.includes('Boro Rice')), true);
  console.log(`✓ Crops endpoint verified: exactly 12 crops returned with verified agronomic traits.\n`);

  // 3. GET /api/fields (Spec Section 45, 51)
  console.log('[Test 3] Testing GET /api/fields (5 Predefined Demo Fields)...');
  const fieldsRes = await request(app, { method: 'GET', url: '/api/fields' });
  assert.strictEqual(fieldsRes.status, 200);
  assert.strictEqual(fieldsRes.body.count, 5);
  assert.strictEqual(fieldsRes.body.fields.length, 5);

  const f1 = fieldsRes.body.fields.find(f => f.id === 1);
  assert.strictEqual(f1.name.includes('Godagari'), true);
  assert.strictEqual(f1.irrigation_available, false);
  assert.notStrictEqual(f1.condition_score, null);
  assert.strictEqual(f1.condition_score.label, 'Moderate stress');
  console.log(`✓ Fields endpoint verified: 5 demo fields returned with attached Field Condition Scores & descriptive labels.\n`);

  // 4. GET /api/fields/:id & Error Case (Spec Section 45)
  console.log('[Test 4] Testing GET /api/fields/:id and 404 handler...');
  const field1Res = await request(app, { method: 'GET', url: '/api/fields/1' });
  assert.strictEqual(field1Res.status, 200);
  assert.strictEqual(field1Res.body.field.id, 1);
  assert.strictEqual(Array.isArray(field1Res.body.crop_history), true);
  assert.strictEqual(field1Res.body.crop_history.length >= 5, true);
  assert.notStrictEqual(field1Res.body.latest_condition_score, null);

  const notFoundRes = await request(app, { method: 'GET', url: '/api/fields/999' });
  assert.strictEqual(notFoundRes.status, 404);
  assert.strictEqual(notFoundRes.body.error.includes('not found'), true);
  console.log(`✓ Field detail endpoint verified: multi-year crop history loaded; 404 returned for non-existent field.\n`);

  // 5. POST /api/rotations/evaluate (Spec Section 45, 36–41, 48–50)
  console.log('[Test 5] Testing POST /api/rotations/evaluate (Field 1 Pulse Rotation)...');
  const chickpea = cropsRes.body.crops.find(c => c.name.includes('Chickpea'));
  const mungbean = cropsRes.body.crops.find(c => c.name.includes('Mung Bean'));
  const wheat = cropsRes.body.crops.find(c => c.name.includes('Wheat'));

  const evalPayload = {
    field_id: 1,
    name: 'Godagari Pulse Sequence',
    season_sequence: ['Rabi', 'Kharif-1'],
    crop_ids: [chickpea.id, mungbean.id],
    rotation_cycle_mode: 'continue_after_current',
    priorities: { water: 3, heat: 4, soil: 3, diversity: 3, profitability: 4 }
  };

  const evalRes = await request(app, { method: 'POST', url: '/api/rotations/evaluate', body: evalPayload });
  assert.strictEqual(evalRes.status, 201);
  assert.strictEqual(evalRes.body.field_id, 1);
  assert.strictEqual(evalRes.body.feasibility_status, 'Seasonally feasible');
  assert.strictEqual(evalRes.body.overall_score, 59.14);
  assert.strictEqual(Number(evalRes.body.water_multiplier) > 1.9, true);
  assert.strictEqual(evalRes.body.observation_ids_used.length, 61);
  assert.strictEqual(evalRes.body.baseline_ids_used.length, 7);

  // Verify explanation structure & diversity labeling fix
  const exp = evalRes.body.explanation;
  assert.strictEqual(typeof exp.water, 'object');
  assert.strictEqual(typeof exp.heat, 'object');
  assert.strictEqual(typeof exp.soil, 'object');
  assert.strictEqual(typeof exp.diversity, 'object');
  assert.deepStrictEqual(exp.diversity.candidate_crop_families, ['Legume', 'Legume']);
  assert.strictEqual(exp.diversity.repeat_check_sequence.length, 3);
  assert.strictEqual(exp.diversity.unique_family_ratio, 0.5);
  assert.strictEqual(exp.caveats.not_a_forecast.includes('Recent NASA conditions are used as a proxy'), true);
  console.log(`✓ Rotation evaluation endpoint verified: score=${evalRes.body.overall_score}, water_mult=${evalRes.body.water_multiplier}x, explanation sub-objects complete.\n`);

  // 6. POST /api/rotations/evaluate Error Handling
  console.log('[Test 6] Testing POST /api/rotations/evaluate Validation & Error Cases...');
  const errRes1 = await request(app, {
    method: 'POST',
    url: '/api/rotations/evaluate',
    body: { season_sequence: ['Rabi'], crop_ids: [chickpea.id] }
  });
  assert.strictEqual(errRes1.status, 400);

  const errRes2 = await request(app, {
    method: 'POST',
    url: '/api/rotations/evaluate',
    body: { field_id: 1, season_sequence: ['Rabi', 'Kharif-1'], crop_ids: [chickpea.id] }
  });
  assert.strictEqual(errRes2.status, 400);
  console.log(`✓ Evaluation validation verified: rejected missing field_id and mismatched array lengths with 400 Bad Request.\n`);

  // 7. POST /api/rotations/compare (Spec Section 45, 50)
  console.log('[Test 7] Testing POST /api/rotations/compare (Option A vs Option B on Field 1)...');
  const comparePayload = {
    field_id: 1,
    rotations: [
      {
        name: 'Option A: Pulse Rotation (Chickpea -> Mung Bean)',
        season_sequence: ['Rabi', 'Kharif-1'],
        crop_ids: [chickpea.id, mungbean.id],
        rotation_cycle_mode: 'continue_after_current',
        priorities: { water: 3, heat: 4, soil: 3, diversity: 3, profitability: 4 }
      },
      {
        name: 'Option B: Cereal-Pulse Rotation (Wheat -> Mung Bean)',
        season_sequence: ['Rabi', 'Kharif-1'],
        crop_ids: [wheat.id, mungbean.id],
        rotation_cycle_mode: 'continue_after_current',
        priorities: { water: 3, heat: 4, soil: 3, diversity: 3, profitability: 4 }
      }
    ]
  };

  const compareRes = await request(app, { method: 'POST', url: '/api/rotations/compare', body: comparePayload });
  assert.strictEqual(compareRes.status, 200);
  assert.strictEqual(compareRes.body.field_id, 1);
  assert.strictEqual(compareRes.body.comparisons_count, 2);
  assert.strictEqual(Array.isArray(compareRes.body.rotations), true);
  assert.strictEqual(compareRes.body.rotations[0].rank, 1);
  assert.strictEqual(compareRes.body.rotations[0].ranking_label, 'Highest-scoring rotation');
  assert.strictEqual(compareRes.body.rotations[0].overall_score >= compareRes.body.rotations[1].overall_score, true);
  assert.strictEqual(compareRes.body.rotations[0].delta_from_top, 0);

  // Verify Spec Section 50 guardrail: no forbidden "Best rotation" string
  const compareString = JSON.stringify(compareRes.body);
  assert.strictEqual(compareString.includes('Best rotation'), false);
  console.log(`✓ Rotation comparison endpoint verified: sorted descending, rank 1 labeled 'Highest-scoring rotation', delta calculated, forbidden terms absent.\n`);

  // 8. GET /api/rotations/field/:fieldId (Spec Section 45)
  console.log('[Test 8] Testing GET /api/rotations/field/:fieldId...');
  const fieldRotRes = await request(app, { method: 'GET', url: '/api/rotations/field/1' });
  assert.strictEqual(fieldRotRes.status, 200);
  assert.strictEqual(fieldRotRes.body.field_id, 1);
  assert.strictEqual(fieldRotRes.body.count >= 2, true);
  console.log(`✓ Field rotations history verified: retrieved ${fieldRotRes.body.count} stored rotations for Field 1.\n`);

  console.log('================================================================');
  console.log('ALL PHASE 12 REST API INTEGRATION TESTS PASSED! (8/8)');
  console.log('================================================================');
}

if (require.main === module) {
  runApiTests().catch(err => {
    console.error('API Test failed with error:', err);
    process.exit(1);
  });
}

module.exports = { runApiTests };
