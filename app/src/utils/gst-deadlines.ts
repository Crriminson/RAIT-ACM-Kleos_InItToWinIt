/**
 * CGST Section 16(4) ITC claim deadline.
 *
 * A registered person cannot take input tax credit on an invoice after the
 * 30th of November following the end of the financial year (Apr 1 – Mar 31)
 * to which the invoice pertains (or the date of filing the annual return,
 * whichever is earlier — we surface the statutory 30-Nov date).
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Section16Deadline {
  deadline: Date;
  label: string; // e.g. "30 Nov 2027"
  daysLeft: number; // negative once the deadline has passed
  expired: boolean;
}

/** Returns the Section 16(4) deadline for an ISO invoice date, or null if unparseable. */
export function section16Deadline(invoiceDate: string, now: Date = new Date()): Section16Deadline | null {
  const d = new Date(invoiceDate);
  if (Number.isNaN(d.getTime())) return null;

  const month = d.getMonth() + 1; // 1–12
  const year = d.getFullYear();
  // Indian FY runs Apr–Mar. The FY ends in this calendar year (for Jan–Mar
  // invoices) or the next one (Apr–Dec). The deadline is 30 Nov of that year.
  const fyEndYear = month >= 4 ? year + 1 : year;
  const deadline = new Date(fyEndYear, 10, 30); // Nov = index 10

  const MS_PER_DAY = 86_400_000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((deadline.getTime() - startOfToday.getTime()) / MS_PER_DAY);

  return {
    deadline,
    label: `${deadline.getDate()} ${MONTHS_SHORT[deadline.getMonth()]} ${deadline.getFullYear()}`,
    daysLeft,
    expired: daysLeft < 0,
  };
}
