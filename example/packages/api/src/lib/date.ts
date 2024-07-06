import { isAfter, isBefore } from 'date-fns';

export const dateFromNumbers = (numbers: number[]) => {
  switch (dateFromNumbers.length) {
    case 0: {
      return;
    }

    case 1: {
      const [year] = numbers as [number];
      return new Date(year, 1, 1);
    }

    case 2: {
      const [year, month] = numbers as [number, number];
      return new Date(year, month - 1);
    }

    default: {
      const [year, month, day] = numbers as [number, number, number, ...number[]];
      return new Date(year, month - 1, day);
    }
  }
};

export function schoolYearStart(): Date {
  const now = new Date();
  const thisYearSeptemberFirst = new Date(now.getFullYear(), 8, 1);
  if (now > thisYearSeptemberFirst) return thisYearSeptemberFirst;

  return new Date(now.getFullYear() - 1, 8, 1);
}

export function yearTier(graduationYear: number): number {
  return schoolYearStart().getFullYear() - graduationYear + 4;
}

export function fromYearTier(tier: number): number {
  return schoolYearStart().getFullYear() - tier + 4;
}

export function parseYearTier(yearTierDisplay: string): number {
  return Number.parseInt(yearTierDisplay.replace(/a$/, ''), 10);
}

export function soonest(...dates: Array<Date | null | undefined>): Date | undefined {
  const validDates = dates.filter(Boolean) as Date[];
  if (validDates.length === 0) return undefined;
  return new Date(Math.min(...validDates.map((date) => date.valueOf())));
}

export function latest(...dates: Array<Date | null | undefined>): Date | undefined {
  const validDates = dates.filter(Boolean) as Date[];
  if (validDates.length === 0) return undefined;
  return new Date(Math.max(...validDates.map((date) => date.valueOf())));
}

export function formatDate(
  date: Date | undefined | null,
  style: Intl.DateTimeFormatOptions['dateStyle'] = 'long',
): string {
  try {
    if (!date) return '';
    if (typeof date === 'string') date = new Date(Date.parse(date));

    return new Intl.DateTimeFormat('fr-FR', { dateStyle: style }).format(date);
  } catch (error) {
    console.error(error);
    return '';
  }
}

export function formatDateTime(
  date: Date | undefined | null,
  dateStyle: Intl.DateTimeFormatOptions['dateStyle'] = 'long',
  timeStyle: Intl.DateTimeFormatOptions['timeStyle'] = 'medium',
): string {
  try {
    if (!date) return '';
    if (typeof date === 'string') date = new Date(Date.parse(date));

    return new Intl.DateTimeFormat('fr-FR', { dateStyle, timeStyle }).format(date);
  } catch (error) {
    console.error(error);
    return '';
  }
}

export function isWithinPartialInterval(
  date: Date,
  { start, end }: { start?: Date | null; end?: Date | null },
) {
  if (start && !isAfter(date, start)) return false;
  if (end && !isBefore(date, end)) return false;
  return true;
}
