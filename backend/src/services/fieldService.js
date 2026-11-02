import { conflict, notFound, validationError } from '../utils/errors.js';
import { FieldDistrictError, FieldGeometryError, FieldSessionConflictError } from '../utils/fieldErrors.js';

export function createFieldService(repo) {
  return {
    async createField(input, sessionId) {
      try {
        const field = await repo.createField(input, sessionId);
        if (!field) throw notFound('DISTRICT_NOT_FOUND', `No district with id "${input.districtId}".`);
        return field;
      } catch (err) {
        if (err instanceof FieldDistrictError) {
          throw notFound('DISTRICT_NOT_FOUND', err.message);
        }
        if (err instanceof FieldGeometryError) {
          throw validationError([{ field: 'boundary', message: err.message }]);
        }
        if (err instanceof FieldSessionConflictError) {
          throw conflict('FIELD_ALREADY_EXISTS', err.message);
        }
        throw err;
      }
    },

    listFields: (sessionId) => repo.listFields(sessionId),

    async getField(id, sessionId) {
      const field = await repo.getField(id, sessionId);
      if (!field) throw notFound('FIELD_NOT_FOUND', `No field with id "${id}".`);
      return field;
    },

    async updateField(id, input, sessionId) {
      try {
        const field = await repo.updateField(id, input, sessionId);
        if (!field) throw notFound('FIELD_NOT_FOUND', `No field with id "${id}".`);
        return field;
      } catch (err) {
        if (err instanceof FieldDistrictError) {
          throw notFound('DISTRICT_NOT_FOUND', err.message);
        }
        if (err instanceof FieldGeometryError) {
          throw validationError([{ field: 'boundary', message: err.message }]);
        }
        throw err;
      }
    },

    async deleteField(id, sessionId) {
      const deleted = await repo.deleteField(id, sessionId);
      if (!deleted) throw notFound('FIELD_NOT_FOUND', `No field with id "${id}".`);
      return { id };
    },
  };
}
