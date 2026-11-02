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
