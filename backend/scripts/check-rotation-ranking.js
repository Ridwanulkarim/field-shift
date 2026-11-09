// Prints the top rotation picks for a district from the data the API would use (database, or the offline files), so you can
// see whether the ranking is sensible on REAL data before the demo. Read-only.
//
//   npm run check:rotation -- --district=rajshahi --existing=boro,aman
//   npm run check:rotation -- --district=rajshahi --existing=boro,aman --all      also with the filters switched off
//   OFFLINE=1 npm run check:rotation                                              from the committed files, no database
import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createDataSource } from '../src/data/dataSource.js';
import { createEvaluationService } from '../src/services/evaluationService.js';
import { PRIORITIES, PRIORITY_DEFAULT, CONSTRAINT_DEFAULTS } from '../src/science/rules.js';

const { values } = parseArgs({ options: { district: { type: 'string', default: 'rajshahi' }, existing: { type: 'string', default: 'boro,aman' }, all: { type: 'boolean', default: false } } });

async function createDatabaseRepository(url) {
  const { createPrismaClient } = await import('../src/data/prisma.js');
  const { createRepository } = await import('../src/data/repository.js');
  const prisma = createPrismaClient(url);
  return { repository: createRepository(prisma), close: () => prisma.$disconnect() };
}

const source = await createDataSource(config, { createDatabaseRepository });
try {
  if (!source.repository) { console.error('No database and no offline files. See docs/OFFLINE.md.'); process.exit(1); }
  const service = createEvaluationService(source.repository);
  const priorities = Object.fromEntries(PRIORITIES.map((p) => [p.key, PRIORITY_DEFAULT]));
  const runs = [{ name: 'default filters', constraints: CONSTRAINT_DEFAULTS }];
  if (values.all) runs.push({ name: 'filters OFF', constraints: { requireStapleCereal: false, onlyDocumentedPatterns: false } });
  for (const run of runs) {
    const r = await service.evaluate({ district: values.district, existingRotation: values.existing.split(','), soil: { salinity: null, drainage: null }, irrigation: 'limited', priorities, constraints: run.constraints }, 'check-script');
    console.log(`\n== ${values.district} | ${run.name} | data: ${r.climate.dataLabel?.kind ?? 'none'} (${r.climate.provenance?.servedFrom ?? '-'})`);
    console.log(`existing ${r.strategies[0].label}: ${r.strategies[0].score}  (${r.strategies[0].hasStapleCereal ? 'staple cereal' : 'NO staple cereal'}, ${r.strategies[0].pattern.documented ? 'documented pattern' : 'not a documented pattern'})`);
    console.log(r.strategies[0].summary);
    for (const s of r.strategies.slice(1)) console.log(`  #${s.rank} ${s.label}  score ${s.score}  months ${s.monthsInField}  ${s.pattern.documented ? 'documented' : 'NOT documented'}`);
    console.log(`filters removed ${JSON.stringify(r.constraints.excluded)} of ${r.constraints.candidatesBeforeFilters}`);
    console.log(`stability: ${r.stability.verdict} (${r.stability.topPickStaysFirst}/${r.stability.scenariosTried} weight changes keep the top pick first)`);
    for (const c of r.stability.changes ?? []) console.log(`   - ${c.component} ${c.change} -> top becomes ${c.newTop}`);
  }
} finally {
  await source.close();
}
