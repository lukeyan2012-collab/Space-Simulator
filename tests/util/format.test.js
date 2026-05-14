import { describe, it, expect } from 'vitest';
import { fmtNum, fmtNumPlain } from '@/util/format.js';

describe('fmtNum / fmtNumPlain', () => {
  it('returns "0" for exactly zero', () => {
    expect(fmtNum(0)).toBe('0');
    expect(fmtNumPlain(0)).toBe('0');
  });
  it('uses fixed-decimal in the "normal" range', () => {
    expect(fmtNum(12.345)).toBe('12.345');
    expect(fmtNumPlain(123.4)).toBe('123.400');
  });
  it('uses 10^N HTML for large numbers', () => {
    expect(fmtNum(1.989e30)).toBe('1.99 × 10<sup>30</sup>');
    expect(fmtNumPlain(1.989e30)).toBe('1.99 × 10^30');
  });
  it('uses 10^N for very small numbers (negative exponents)', () => {
    expect(fmtNum(1.5e-3)).toBe('1.50 × 10<sup>-3</sup>');
    expect(fmtNumPlain(-1.5e-3)).toBe('-1.50 × 10^-3');
  });
});
