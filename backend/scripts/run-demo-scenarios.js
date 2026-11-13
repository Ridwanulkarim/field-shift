// Runs every demo scenario through the real evaluation service using the committed offline NASA POWER files
// (no database, no network) and prints the existing rotation's score and the top alternatives.
// Usage: npm run demo:scenarios
import { loadOfflineStore } from '../src/data/offlineStore.js';
import { createOfflineRepository } from '../src/data/offlineRepository.js';
import { createEvaluationService } from '../src/services/evaluationService.js';
import { parseEvaluateRequest } from '../src/validation/evaluateRequest.js';
import { DEMO_SCENARIOS } from '../src/data/reference/demoScenarios.js';

const repo = createOfflineRepository(loadOfflineStore());
const service = createEvaluationService(repo);
let failed = 0;
for (const s of DEMO_SCENARIOS) {
  try {
    const out = await service.evaluate(parseEvaluateRequest(s.request));
    console.log(`\n${s.id}: ${s.titleEn}`);
    for (const st of out.strategies) {
      console.log(`  ${st.kind.padEnd(11)} ${String(st.score).padStart(5)}  ${st.label}${st.pattern?.documented === false ? '  (not a documented pattern)' : ''}`);
    }
  } catch (err) {
    failed += 1;
    console.error(`\n${s.id}: FAILED - ${err.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
