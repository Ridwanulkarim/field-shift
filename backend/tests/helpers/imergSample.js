// REAL NASA response, captured by `npm run probe:imerg` on 2026-11-06 for 2020-07-01 over the NASA POWER cell 49:430
// (Rajshahi): the DAP4 CSV subset of GPM_3IMERGDF V07 "precipitation" (mm/day), pixel block 5 latitudes x 7 longitudes.
// Used only to prove that the parser reads the true response shape. Not a scientific result.
export const REAL_SUBSET_CSV = `Dataset: 3B-DAY.MS.MRG.3IMERG.20200701-S000000-E235959.V07B.nc4
/precipitation[0][0], 0, 0, 0.165, 1.305, 1.97
/precipitation[0][1], 0, 0, 0, 0.855, 1.995
/precipitation[0][2], 0, 0, 0, 0.505, 1.42
/precipitation[0][3], 0, 0, 0, 0, 0.925
/precipitation[0][4], 0, 0, 0, 0, 1.075
/precipitation[0][5], 0, 0, 0, 1.775, 1.94
/precipitation[0][6], 0.025, 0, 0, 2.96, 3.49
`;

// The three links CMR listed for that granule (real).
export const REAL_GRANULE_ENTRY = {
  title: 'GPM_3IMERGDF.07:3B-DAY.MS.MRG.3IMERG.20200701-S000000-E235959.V07B.nc4',
  links: [
    { href: 'https://data.gesdisc.earthdata.nasa.gov/data/GPM_L3/GPM_3IMERGDF.07/2020/07/3B-DAY.MS.MRG.3IMERG.20200701-S000000-E235959.V07B.nc4' },
    { href: 's3://gesdisc-cumulus-prod-protected/GPM_L3/GPM_3IMERGDF.07/2020/07/3B-DAY.MS.MRG.3IMERG.20200701-S000000-E235959.V07B.nc4' },
    { href: 'https://opendap.earthdata.nasa.gov/collections/C2723754864-GES_DISC/granules/GPM_3IMERGDF.07%3A3B-DAY.MS.MRG.3IMERG.20200701-S000000-E235959.V07B.nc4' },
  ],
};

// ASSUMED FORMAT, NOT A NASA RESPONSE: the real `precipitation` lines above plus invented `precipitation_cnt` lines in the
// layout the parser assumes for a second variable. Counts are made up (all 48 except a few). The real two-variable
// response has not been seen yet; `npm run probe:imerg` prints it so this fixture can be replaced by the real thing.
export const ASSUMED_TWO_VARIABLE_CSV = `${REAL_SUBSET_CSV}/precipitation_cnt[0][0], 48, 48, 48, 48, 48
/precipitation_cnt[0][1], 48, 48, 48, 48, 47
/precipitation_cnt[0][2], 48, 48, 48, 46, 48
/precipitation_cnt[0][3], 48, 48, 48, 48, 48
/precipitation_cnt[0][4], 48, 48, 48, 48, 48
/precipitation_cnt[0][5], 48, 48, 48, 48, 48
/precipitation_cnt[0][6], 48, 48, 48, 48, 12
`;
