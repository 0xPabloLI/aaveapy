import type { ReserveRateInput } from '@/types/aave';

const RAY = 10n ** 27n;
const HALF_RAY = RAY / 2n;
const PERCENTAGE_FACTOR = 10_000n;
const HALF_PERCENTAGE_FACTOR = PERCENTAGE_FACTOR / 2n;
const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;

function toBigInt(value: string | number | bigint | null | undefined): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return 0n;
    return BigInt(Math.floor(value));
  }
  if (!value) return 0n;
  const normalized = String(value).trim();
  if (!normalized) return 0n;
  if (normalized.includes('.')) {
    const [intPart] = normalized.split('.');
    return intPart ? BigInt(intPart) : 0n;
  }
  return BigInt(normalized);
}

function clamp(value: bigint, min: bigint, max: bigint): bigint {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function rayMul(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return (a * b + HALF_RAY) / RAY;
}

function rayDiv(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return (a * RAY + b / 2n) / b;
}

function percentMul(value: bigint, percentageBps: bigint): bigint {
  if (value === 0n || percentageBps === 0n) return 0n;
  return (value * percentageBps + HALF_PERCENTAGE_FACTOR) / PERCENTAGE_FACTOR;
}

function rayPow(x: bigint, n: bigint): bigint {
  if (n === 0n) return RAY;
  let z = n % 2n !== 0n ? x : RAY;
  let base = x;
  let exp = n / 2n;
  while (exp !== 0n) {
    base = rayMul(base, base);
    if (exp % 2n !== 0n) {
      z = rayMul(z, base);
    }
    exp /= 2n;
  }
  return z;
}

function parseUnits(amount: string, decimals: number): bigint {
  const cleaned = amount.replace(/,/g, '').trim();
  if (!cleaned) return 0n;
  if (!/^\d*\.?\d*$/.test(cleaned)) return 0n;
  const [intRaw, fracRaw = ''] = cleaned.split('.');
  const intPart = intRaw || '0';
  const safeDecimals = Math.max(0, Math.floor(decimals));
  const scale = 10n ** BigInt(safeDecimals);
  const fracPadded = (fracRaw + '0'.repeat(safeDecimals)).slice(0, safeDecimals);
  const fracPart = fracPadded ? BigInt(fracPadded) : 0n;
  return BigInt(intPart) * scale + fracPart;
}

function rayToPercent(rateRay: bigint): number {
  return Number(rateRay) / 1e25;
}

function rayToApyPercent(rateRay: bigint): number {
  if (rateRay <= 0n) return 0;
  const ratePerSecond = rateRay / SECONDS_PER_YEAR;
  const compounded = rayPow(RAY + ratePerSecond, SECONDS_PER_YEAR);
  const apyRay = compounded - RAY;
  return Number(apyRay) / 1e25;
}

function calculateVariableBorrowRate(
  utilizationRateRay: bigint,
  optimalUsageRateRay: bigint,
  baseVariableBorrowRateRay: bigint,
  variableRateSlope1Ray: bigint,
  variableRateSlope2Ray: bigint
): bigint {
  const optimal = clamp(optimalUsageRateRay, 1n, RAY);

  if (utilizationRateRay > optimal) {
    const excessRatio = rayDiv(utilizationRateRay - optimal, RAY - optimal);
    return baseVariableBorrowRateRay + variableRateSlope1Ray + rayMul(variableRateSlope2Ray, excessRatio);
  }

  const normalizedUsage = rayDiv(utilizationRateRay, optimal);
  return baseVariableBorrowRateRay + rayMul(variableRateSlope1Ray, normalizedUsage);
}

export interface NativeRateSimulation {
  utilizationRateRay: string;
  utilizationRatePercent: number;
  supplyAprPercent: number;
  borrowAprPercent: number;
  supplyApyPercent: number;
  borrowApyPercent: number;
  addedLiquidityRaw: string;
  addedBorrowRaw: string;
}

function computeRates(
  rateInput: ReserveRateInput,
  availableLiquidity: bigint,
  totalVariableDebt: bigint,
  addedLiquidityRaw: bigint,
  addedBorrowRaw: bigint,
): NativeRateSimulation {
  const totalLiquidityAndDebt = availableLiquidity + totalVariableDebt;
  const utilizationRate =
    totalLiquidityAndDebt > 0n ? rayDiv(totalVariableDebt, totalLiquidityAndDebt) : 0n;

  const variableBorrowRate = calculateVariableBorrowRate(
    utilizationRate,
    toBigInt(rateInput.optimalUsageRate),
    toBigInt(rateInput.baseVariableBorrowRate),
    toBigInt(rateInput.variableRateSlope1),
    toBigInt(rateInput.variableRateSlope2)
  );

  const reserveFactorBps = clamp(toBigInt(rateInput.reserveFactor), 0n, PERCENTAGE_FACTOR);
  const liquidityRate = percentMul(
    rayMul(variableBorrowRate, utilizationRate),
    PERCENTAGE_FACTOR - reserveFactorBps
  );

  return {
    utilizationRateRay: utilizationRate.toString(),
    utilizationRatePercent: rayToPercent(utilizationRate),
    supplyAprPercent: rayToPercent(liquidityRate),
    borrowAprPercent: rayToPercent(variableBorrowRate),
    supplyApyPercent: rayToApyPercent(liquidityRate),
    borrowApyPercent: rayToApyPercent(variableBorrowRate),
    addedLiquidityRaw: addedLiquidityRaw.toString(),
    addedBorrowRaw: addedBorrowRaw.toString(),
  };
}

export interface NativeRateActionInputs {
  supplyAmount?: string;
  borrowAmount?: string;
}

export function simulateNativeRatesAfterActions(
  rateInput: ReserveRateInput,
  { supplyAmount = '0', borrowAmount = '0' }: NativeRateActionInputs
): NativeRateSimulation {
  const decimals = Number.isFinite(rateInput.decimals) ? rateInput.decimals : 18;
  const addedLiquidity = parseUnits(supplyAmount, decimals);
  const addedBorrow = parseUnits(borrowAmount, decimals);

  const baseAvailableLiquidity = toBigInt(rateInput.availableLiquidity);
  const availableLiquidityBeforeClamp = baseAvailableLiquidity + addedLiquidity - addedBorrow;
  const availableLiquidity = availableLiquidityBeforeClamp > 0n ? availableLiquidityBeforeClamp : 0n;
  const totalScaledVariableDebt = toBigInt(rateInput.totalScaledVariableDebt);
  const variableBorrowIndex = toBigInt(rateInput.variableBorrowIndex);
  const totalVariableDebt = rayMul(totalScaledVariableDebt, variableBorrowIndex) + addedBorrow;

  return computeRates(rateInput, availableLiquidity, totalVariableDebt, addedLiquidity, addedBorrow);
}

export function simulateNativeRatesAfterSupply(
  rateInput: ReserveRateInput,
  supplyAmount: string
): NativeRateSimulation {
  return simulateNativeRatesAfterActions(rateInput, { supplyAmount, borrowAmount: '0' });
}

export function simulateNativeRatesAfterBorrow(
  rateInput: ReserveRateInput,
  borrowAmount: string
): NativeRateSimulation {
  return simulateNativeRatesAfterActions(rateInput, { supplyAmount: '0', borrowAmount });
}
