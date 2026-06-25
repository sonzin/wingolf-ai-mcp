export function parseDateRange(startDate: string, endDate: string): { start: string; end: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    throw new Error(`Invalid startDate: "${startDate}". Expected format YYYY-MM-DD.`);
  }
  if (isNaN(end.getTime())) {
    throw new Error(`Invalid endDate: "${endDate}". Expected format YYYY-MM-DD.`);
  }
  if (start > end) {
    throw new Error(`startDate (${startDate}) must be before endDate (${endDate}).`);
  }

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 400) {
    throw new Error(`Date range too wide (${diffDays} days). Maximum is 400 days.`);
  }

  return { start: startDate, end: endDate };
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
