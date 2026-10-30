import { describe, it, expect } from 'vitest';
import {
  monthsBetween,
  daysInMonth,
  cycleYearOf,
  expectedDaysInCycle,
  overlapMonths,
  dayOfYear,
} from '../src/science/calendar.js';

describe('calendar helpers', () => {
  it('lists months, wrapping past December', () => {
    expect(monthsBetween(7, 11)).toEqual([7, 8, 9, 10, 11]);
    expect(monthsBetween(12, 5)).toEqual([12, 1, 2, 3, 4, 5]);
  });
  it('knows leap years', () => {
    expect(daysInMonth(2020, 2)).toBe(29);
    expect(daysInMonth(2021, 2)).toBe(28);
  });
  it('assigns January to the cycle that started the previous December', () => {
    expect(cycleYearOf(2010, 1, 12, 5)).toBe(2009);
    expect(cycleYearOf(2009, 12, 12, 5)).toBe(2009);
    expect(cycleYearOf(2010, 7, 12, 5)).toBeNull();
    expect(cycleYearOf(2010, 8, 7, 11)).toBe(2010);
  });
  it('counts the days of a whole cycle', () => {
    // Nov 30 + Dec 31 + Jan 31 + Feb 28 + Mar 31 = 151 (cycle starting Nov 2021: Feb 2022 has 28)
    expect(expectedDaysInCycle(2021, 11, 3)).toBe(151);
    // Leap year: Feb 2024 has 29 days, so the cycle starting Nov 2023 has 152
    expect(expectedDaysInCycle(2023, 11, 3)).toBe(152);
  });
  it('finds overlapping months', () => {
    expect(overlapMonths([7, 8, 9, 10, 11], [11, 12, 1, 2])).toEqual([11]);
    expect(overlapMonths([1, 2], [5, 6])).toEqual([]);
  });
  it('computes day of year', () => {
    expect(dayOfYear('2021-01-01')).toBe(1);
    expect(dayOfYear('2021-03-01')).toBe(60);
    expect(dayOfYear('2020-03-01')).toBe(61);
  });
});
