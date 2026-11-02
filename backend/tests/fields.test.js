import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { createFieldService } from '../src/services/fieldService.js';
import { FieldGeometryError, FieldSessionConflictError } from '../src/utils/fieldErrors.js';
import crypto from 'node:crypto';

const polygon = {
  type: 'Polygon',
  coordinates: [[[91.7, 24.8], [91.71, 24.8], [91.71, 24.81], [91.7, 24.8]]],
};

function fakeFieldService() {
  const fields = new Map();
  const repo = {
    createField: async (input) => {
      if (input.districtId === 999) return null;
      const field = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        ...input,
        boundary: { type: 'MultiPolygon', coordinates: [[input.boundary.coordinates]] },
        areaHa: 1.2,
        district: { id: input.districtId, slug: 'sylhet', nameEn: 'Sylhet', nameBn: 'সিলেট' },
        createdAt: '2026-10-31T00:00:00.000Z',
        updatedAt: '2026-10-31T00:00:00.000Z',
      };
      fields.set(field.id, field);
      return field;
    },
    listFields: async () => [...fields.values()],
    getField: async (id) => fields.get(id) ?? null,
    updateField: async (id, input) => {
      const field = fields.get(id);
      if (!field) return null;
      const updated = { ...field, ...input, updatedAt: '2026-11-01T00:00:00.000Z' };
      if (input.boundary) {
        updated.boundary = { type: 'MultiPolygon', coordinates: [[input.boundary.coordinates]] };
        updated.areaHa = 2.4;
      }
      fields.set(id, updated);
      return updated;
    },
    deleteField: async (id) => fields.delete(id),
  };
  return createFieldService(repo);
}

const app = () => createApp(loadConfig({}), { fieldService: fakeFieldService() });
const validBody = {
  name: 'North Paddy Field',
  districtId: 1,
  boundary: polygon,
  soilType: 'Clay',
  soilPh: 6.5,
  organicMatterPct: 2.1,
  salinityDsM: 0.5,
  irrigationSource: 'Groundwater',
};

describe('field management API', () => {
  it('issues an opaque session cookie and passes it to field operations', async () => {
    const sessions = new Map();
    const service = createFieldService({
      async createField(input, sessionId) {
        if (sessions.has(sessionId)) {
          const error = new Error('This anonymous session already has a registered field.');
          error.status = 409;
          error.code = 'FIELD_ALREADY_EXISTS';
          throw error;
        }
        const field = { id: '550e8400-e29b-41d4-a716-446655440000', ...input };
        sessions.set(sessionId, field);
        return field;
      },
      async listFields(sessionId) {
        return sessions.has(sessionId) ? [sessions.get(sessionId)] : [];
      },
    });
    const application = createApp(loadConfig({}), { fieldService: service });
    const first = request.agent(application);
    const created = await first.post('/api/fields').send(validBody);
    expect(created.status).toBe(201);
    expect(created.headers['set-cookie'][0]).toMatch(/field_shift_session=[A-Za-z0-9_-]{32}\.[a-z0-9]+\.[A-Za-z0-9_-]{16};.*HttpOnly/);
    expect((await first.get('/api/fields')).body.fields).toHaveLength(1);
    expect((await request.agent(application).get('/api/fields')).body.fields).toHaveLength(0);
  });

  it('reuses a valid cookie, rejects malformed or expired cookies, and isolates CRUD operations', async () => {
    const records = new Map();
    const service = createFieldService({
      async createField(input, sessionId) {
        if (records.has(sessionId)) {
          const error = new Error('This anonymous session already has a registered field.');
          error.status = 409;
          error.code = 'FIELD_ALREADY_EXISTS';
          throw error;
        }
        const field = { id: crypto.randomUUID(), ...input, sessionId };
        records.set(sessionId, field);
        return field;
      },
      async listFields(sessionId) {
        return records.has(sessionId) ? [records.get(sessionId)] : [];
      },
      async getField(id, sessionId) {
        const field = records.get(sessionId);
        return field?.id === id ? field : null;
      },
      async updateField(id, input, sessionId) {
        const field = records.get(sessionId);
        if (!field || field.id !== id) return null;
        Object.assign(field, input);
        return field;
      },
      async deleteField(id, sessionId) {
        const field = records.get(sessionId);
        return Boolean(field?.id === id && records.delete(sessionId));
      },
    });
    const application = createApp(loadConfig({}), { fieldService: service });
    const ownerCookie = (await request(application).get('/api/fields')).headers['set-cookie'][0].split(';')[0];
    const otherCookie = (await request(application).get('/api/fields')).headers['set-cookie'][0].split(';')[0];
    expect(otherCookie).not.toBe(ownerCookie);
    const created = await request(application).post('/api/fields').set('Cookie', ownerCookie).send(validBody);
    const id = created.body.field.id;
    expect((await request(application).get('/api/fields').set('Cookie', ownerCookie)).headers['set-cookie']).toBeUndefined();
    expect((await request(application).get(`/api/fields/${id}`).set('Cookie', otherCookie)).status).toBe(404);
    expect((await request(application).patch(`/api/fields/${id}`).set('Cookie', otherCookie).send({ name: 'Stolen' })).status).toBe(404);
    expect((await request(application).delete(`/api/fields/${id}`).set('Cookie', otherCookie)).status).toBe(404);
    expect((await request(application).get(`/api/fields/${id}`).set('Cookie', ownerCookie)).body.field.name).toBe(validBody.name);

    const malformed = await request(application).get('/api/fields').set('Cookie', 'field_shift_session=bad');
    expect(malformed.headers['set-cookie'][0]).not.toContain('field_shift_session=bad');

    const unsigned = `${'a'.repeat(32)}.${(Date.now() - 1).toString(36)}`;
    const signature = crypto.createHmac('sha256', 'development-only-session-secret').update(unsigned).digest('base64url').slice(0, 16);
    const expired = await request(application).get('/api/fields').set('Cookie', `field_shift_session=${unsigned}.${signature}`);
    expect(expired.headers['set-cookie'][0]).not.toContain(`${unsigned}.${signature}`);
    expect(expired.body.fields).toHaveLength(0);
    expect(ownerCookie).toMatch(/^field_shift_session=/);
  });

  it('returns one conflict and one success for concurrent registration in one session', async () => {
    const sessions = new Set();
    const service = createFieldService({
      async createField(input, sessionId) {
        if (sessions.has(sessionId)) {
          throw new FieldSessionConflictError();
        }
        sessions.add(sessionId);
        return { id: crypto.randomUUID(), ...input };
      },
    });
    const application = createApp(loadConfig({}), { fieldService: service });
    const cookie = (await request(application).get('/api/fields')).headers['set-cookie'][0].split(';')[0];
    const responses = await Promise.all([
      request(application).post('/api/fields').set('Cookie', cookie).send(validBody),
      request(application).post('/api/fields').set('Cookie', cookie).send(validBody),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  });

  it('registers a field, converts Polygon output to MultiPolygon, and rejects client area', async () => {
    const res = await request(app()).post('/api/fields').send({ ...validBody, areaHa: 999 });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('areaHa');

    const created = await request(app()).post('/api/fields').send(validBody);
    expect(created.status).toBe(201);
    expect(created.body.field.boundary.type).toBe('MultiPolygon');
    expect(created.body.field.areaHa).toBe(1.2);
  });

  it('does not trust an area value during updates', async () => {
    const res = await request(app()).post('/api/fields').send(validBody);
    expect(res.status).toBe(201);
    const id = res.body.field.id;
    const updated = await request(app()).patch(`/api/fields/${id}`).send({ areaHa: 999 });
    expect(updated.status).toBe(422);
  });

  it('rejects missing name, invalid district ID, and invalid GeoJSON', async () => {
    const res = await request(app()).post('/api/fields').send({
      districtId: 0,
      boundary: { type: 'Point', coordinates: [91, 24] },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'districtId', 'boundary']));
  });

  it('rejects a nonexistent district', async () => {
    const res = await request(app()).post('/api/fields').send({ ...validBody, districtId: 999 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DISTRICT_NOT_FOUND');
  });

  it('rejects an unclosed polygon and invalid UUIDs', async () => {
    const invalid = await request(app()).post('/api/fields').send({
      ...validBody,
      boundary: { type: 'Polygon', coordinates: [[[91, 24], [92, 24], [92, 25], [91, 25]]] },
    });
    expect(invalid.status).toBe(422);
    expect((await request(app()).get('/api/fields/not-a-uuid')).status).toBe(422);
  });

  it('lists and retrieves fields, and returns 404 for an unknown field', async () => {
    const application = app();
    const created = await request(application).post('/api/fields').send(validBody);
    const id = created.body.field.id;
    expect((await request(application).get('/api/fields')).body.fields).toHaveLength(1);
    expect((await request(application).get(`/api/fields/${id}`)).body.field.id).toBe(id);
    expect((await request(application).get('/api/fields/550e8400-e29b-41d4-a716-446655440001')).status).toBe(404);
  });

  it('updates properties and recalculates area when boundary changes', async () => {
    const application = app();
    const created = await request(application).post('/api/fields').send(validBody);
    const id = created.body.field.id;
    const updated = await request(application).patch(`/api/fields/${id}`).send({
      name: 'Updated Field',
      boundary: polygon,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.field.name).toBe('Updated Field');
    expect(updated.body.field.areaHa).toBe(2.4);
  });

  it('deletes a field', async () => {
    const application = app();
    const created = await request(application).post('/api/fields').send(validBody);
    const id = created.body.field.id;
    expect((await request(application).delete(`/api/fields/${id}`)).body.deleted.id).toBe(id);
    expect((await request(application).get(`/api/fields/${id}`)).status).toBe(404);
  });

  it('maps database geometry validation errors to 422 without exposing internals', async () => {
    const service = createFieldService({
      createField: async () => {
        throw new FieldGeometryError('Boundary must be a non-empty, valid polygon with a positive area.');
      },
    });
    const res = await request(createApp(loadConfig({}), { fieldService: service })).post('/api/fields').send(validBody);
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].message).toMatch(/valid polygon/);
    expect(JSON.stringify(res.body)).not.toMatch(/postgis|geometry/i);
  });
});
