/**
 * Unit tests for the Section 16(4) ITC-claim deadline helper.
 *
 * Rule: ITC on an invoice cannot be claimed after 30 November following the end
 * of the financial year (Apr 1 – Mar 31) the invoice belongs to. `now` is
 * injected so these tests are deterministic regardless of the wall clock.
 */
import { describe, it, expect } from '@jest/globals';
import { section16Deadline } from '../utils/gst-deadlines';

describe('section16Deadline', () => {
  it('maps a mid-FY (May) invoice to 30 Nov of the next calendar year', () => {
    // FY 2026-27 (Apr 2026 – Mar 2027) → deadline 30 Nov 2027.
    const d = section16Deadline('2026-05-08', new Date('2026-06-20'))!;
    expect(d).not.toBeNull();
    expect(d.label).toBe('30 Nov 2027');
    expect(d.deadline.getFullYear()).toBe(2027);
    expect(d.deadline.getMonth()).toBe(10); // November
    expect(d.deadline.getDate()).toBe(30);
    expect(d.expired).toBe(false);
  });

  it('maps a Jan–Mar invoice to 30 Nov of the same calendar year', () => {
    // A Feb 2027 invoice still belongs to FY 2026-27 → deadline 30 Nov 2027.
    const d = section16Deadline('2027-02-15', new Date('2027-03-01'))!;
    expect(d.label).toBe('30 Nov 2027');
    expect(d.deadline.getFullYear()).toBe(2027);
  });

  it('reports the deadline as expired once 30 Nov has passed', () => {
    const d = section16Deadline('2026-05-08', new Date('2027-12-01'))!;
    expect(d.expired).toBe(true);
    expect(d.daysLeft).toBeLessThan(0);
  });

  it('counts daysLeft inclusively from the start of today', () => {
    const d = section16Deadline('2026-05-08', new Date('2027-11-29T23:00:00'))!;
    expect(d.daysLeft).toBe(1);
    expect(d.expired).toBe(false);
  });

  it('returns 0 days left (not expired) on the deadline day itself', () => {
    const d = section16Deadline('2026-05-08', new Date('2027-11-30T09:00:00'))!;
    expect(d.daysLeft).toBe(0);
    expect(d.expired).toBe(false);
  });

  it('returns null for an unparseable date', () => {
    expect(section16Deadline('not-a-date')).toBeNull();
    expect(section16Deadline('')).toBeNull();
  });
});
