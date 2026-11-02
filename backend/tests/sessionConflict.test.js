import { describe, it, expect } from 'vitest';
import { isSessionUniqueViolation } from '../src/data/repository.js';

describe('isSessionUniqueViolation', () => {
  it('recognises the Prisma-wrapped one-field-per-session violation', () => {
    const err = Object.assign(new Error('Raw query failed. Code: `23505`. Message: `duplicate key value violates unique constraint "Field_sessionId_key"`'), { code: 'P2010' });
    expect(isSessionUniqueViolation(err)).toBe(true);
  });
  it('recognises the raw PostgreSQL error', () => {
    const err = Object.assign(new Error('duplicate key value violates unique constraint "Field_sessionId_key"'), { code: '23505' });
    expect(isSessionUniqueViolation(err)).toBe(true);
  });
  it('does not treat other unique violations or errors as a session conflict', () => {
    const other = Object.assign(new Error('duplicate key value violates unique constraint "Field_pkey"'), { code: '23505' });
    expect(isSessionUniqueViolation(other)).toBe(false);
    expect(isSessionUniqueViolation(new Error('boom'))).toBe(false);
    expect(isSessionUniqueViolation(null)).toBe(false);
  });
});
