export const MONEY_PRECISION = 2;
export const PERCENT_PRECISION = 2;

function roundToPrecision(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function roundMoney(value: number) {
  return roundToPrecision(value, MONEY_PRECISION);
}

export function roundPercent(value: number) {
  return roundToPrecision(value, PERCENT_PRECISION);
}

export function calculateProfit(input: { revenue: number; cost: number }) {
  return roundMoney(input.revenue - input.cost);
}

export function calculateMarginPercent(input: { revenue: number; profit: number }) {
  if (input.revenue <= 0) {
    return 0;
  }

  return roundPercent((input.profit / input.revenue) * 100);
}
