# Anonymous field API

Field management uses an anonymous browser session; it does not create an
account or identify a farmer. On the first API request, the backend issues a
cryptographically random, signed `field_shift_session` cookie. It is
`HttpOnly`, `SameSite=Lax`, and `Secure` in production, and expires after one
year. Expiry is verified by the server, not only by the browser. The cookie
value is never returned in JSON. Production requires the server-only
`ANONYMOUS_SESSION_SECRET` environment variable.

Each field row stores the session identifier and has a unique database index,
so concurrent requests cannot register a second field for the same session.
Field reads, updates, deletes, and evaluation by `fieldId` are scoped to that
session. A field belonging to another session is returned as `FIELD_NOT_FOUND`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/fields` | Register the session's one field |
| GET | `/api/fields` | List the current session's field (zero or one item) |
| GET | `/api/fields/:id` | Retrieve the current session's field |
| PATCH | `/api/fields/:id` | Update metadata or boundary |
| DELETE | `/api/fields/:id` | Delete the current session's field |
| GET | `/api/fields/:id/climate?from=YYYY-MM-DD&to=YYYY-MM-DD` | Climate of the NASA POWER grid cell that contains the field |

`POST` and `PATCH` accept the field name, district ID, GeoJSON `Polygon` or
`MultiPolygon`, and optional soil/irrigation fields. The backend validates the
geometry, stores it as SRID 4326 `MultiPolygon`, and calculates hectares using
PostGIS. `areaHa` is rejected if supplied by a client.

Errors use the normal API shape. A second registration returns HTTP 409 with
`FIELD_ALREADY_EXISTS`; an unknown or cross-session field returns HTTP 404 with
`FIELD_NOT_FOUND`.

Clearing browser data or changing devices creates a new anonymous session. The
previous field cannot be recovered through this API without the original
cookie, and one field per session is not a guarantee of one field per
real-world person.

State-changing requests from a browser origin must match the configured
`CORS_ORIGIN`; `SameSite=Lax` and this origin check provide the CSRF boundary
for cookie-authenticated field operations. CORS credentials are enabled only
for that configured origin.

## Boundary checks

Besides valid, non-empty GeoJSON, a boundary must satisfy two geographic checks:

- Every coordinate lies inside Bangladesh's bounding box (longitude 88.0 to 92.7, latitude 20.5 to 26.7).
  Field Shift covers Bangladesh only. This also catches coordinates sent as `[latitude, longitude]`.
  A box is a coarse guard, not a border: it admits small parts of neighbouring countries.
- The boundary is within 100 km of the selected district's reference point. This is a data-entry guard
  against filing a field under the wrong district, not a district-boundary test.

Both failures return HTTP 422 `VALIDATION_ERROR` on `boundary`. The same checks apply when `PATCH`
changes the boundary or the district.

## Field climate: `GET /api/fields/:id/climate`

Query: `from` and `to` (both required, `YYYY-MM-DD`, range at most 5 years), as for the district climate endpoint.

A field polygon does **not** create finer climate data. NASA POWER has one value per grid cell, so the
response is the data of the cell that contains the field's **representative point** (PostGIS
`ST_PointOnSurface`, which always lies on the polygon, unlike the centroid of a concave shape). Nothing is
interpolated and nothing is borrowed from a neighbouring cell.

Response fields: `field`, `location.representativePoint`, `cell` (provider, `cellKey`, centre, `resolutionDeg`,
`approxAreaKm2`, `gridVerified`), `spatialContext` (`fieldAreaHa`, `fieldToCellAreaRatio`, `spansMultipleCells`),
`daily` (missing days are `null`, never zero), `provenance`, `dataLabel` and `limitations` (plain-language caveats).

Errors: `404 FIELD_NOT_FOUND` (unknown or another session's field); `404 CLIMATE_CELL_NOT_INGESTED` (no real NASA
POWER run is stored for that cell; the message names the cell); `422` for a bad id or date range.

Two fields in the same cell receive the same observations. That is correct, and the shared `cellKey` shows it.
