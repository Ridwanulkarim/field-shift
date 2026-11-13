// FIXTURES, NOT REAL CLIMATESERV OUTPUT. The shapes follow the public ClimateSERV API documentation
// (https://climateserv.readthedocs.io/en/latest/api.html): a job id, a progress number, and { data: [{ date, workid, epochTime, value: { avg } }] }.
// The numbers are invented for tests. Do not copy them anywhere as rainfall.
export const FIXTURE_JOB_ID = '3f2b9c7e-1d44-4c5a-9a0e-5c1f0e8a7b11';

export function fixtureDataResponse(dates, valueFor = () => 1.5, { usFormat = true } = {}) {
  return {
    data: dates.map((iso, i) => ({
      date: usFormat ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : iso,
      workid: 100 + i,
      epochTime: Date.parse(`${iso}T00:00:00Z`) / 1000,
      value: { avg: valueFor(iso, i) },
    })),
  };
}

export const datesBetween = (start, end) => {
  const out = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};
