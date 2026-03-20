import { CupsUnit } from '../../modules/attendance/entities/attendance.entity';

/**
 * Calculate picker earnings from cups data
 * Handles unit conversions between PER_100, PER_THOUSAND, and PER_10_THOUSAND
 */
export function calculatePickerEarnings(
  cupsCount: number,
  cupsUnit: string,
  cupsRate: number,
  cupsRateUnit: string
): number {
  if (!cupsCount || !cupsRate) return 0;

  // Convert cups to base (1000 cups)
  const cupsMultiplier =
    cupsUnit === CupsUnit.PER_100 ? 0.1 : cupsUnit === CupsUnit.PER_THOUSAND ? 1 : 10;

  // Convert rate to base (per 1000)
  const rateMultiplier =
    cupsRateUnit === CupsUnit.PER_100 ? 0.1 : cupsRateUnit === CupsUnit.PER_THOUSAND ? 1 : 10;

  const cupsInThousand = cupsCount * cupsMultiplier;
  const ratePerThousand = cupsRate * rateMultiplier;

  return cupsInThousand * ratePerThousand;
}

/**
 * Calculate the number of Mondays in a given month
 */
export function getMondaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let mondays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() === 1) {
      mondays++;
    }
  }
  return mondays;
}

/**
 * Get total days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
