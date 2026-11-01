import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { createFieldService } from '../src/services/fieldService.js';
import { FieldGeometryError } from '../src/utils/fieldErrors.js';

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
  areaHa: 999,
};

describe('field management API', () => {
  it('registers a field, converts Polygon output to MultiPolygon, and ignores client area', async () => {
    const res = await request(app()).post('/api/fields').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.field.boundary.type).toBe('MultiPolygon');
    expect(res.body.field.areaHa).toBe(1.2);
    expect(res.body.field.areaHa).not.toBe(999);
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
      areaHa: 0,
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
