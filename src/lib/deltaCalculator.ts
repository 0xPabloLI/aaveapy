import { parseNumberInput } from '@/lib/numberFormat';

export interface DeltaInput {
  amount: string;
  walletValue: number | null;
  inputMode: 'usd' | 'token';
  tokenPrice?: number;
}

export interface DeltaResult {
  deltaUsd: number;
  effectiveAmountUsd: number;
  walletValueUsd: number;
  isManualPosition: boolean;
}

function resolveAmountUsd(
  amount: string,
  inputMode: 'usd' | 'token',
  tokenPrice?: number,
): number {
  const raw = parseNumberInput(amount);
  if (raw <= 0) return 0;
  if (inputMode === 'usd') return raw;
  if (!tokenPrice || tokenPrice <= 0) return 0;
  return raw * tokenPrice;
}

export function computeDelta(input: DeltaInput): DeltaResult {
  const { amount, walletValue, inputMode, tokenPrice } = input;
  const isManualPosition = walletValue === null;
  const effectiveAmountUsd = resolveAmountUsd(amount, inputMode, tokenPrice);
  const walletValueUsd = isManualPosition ? 0 : walletValue;

  const deltaUsd = isManualPosition
    ? effectiveAmountUsd
    : effectiveAmountUsd - walletValueUsd;

  return {
    deltaUsd,
    effectiveAmountUsd,
    walletValueUsd,
    isManualPosition,
  };
}

export function computeEffectiveAmount(
  walletValueUsd: number,
  deltaUsd: number,
): number {
  return Math.max(walletValueUsd + deltaUsd, 0);
}

export function clampDelta(
  deltaUsd: number,
  walletValueUsd: number,
  side: 'supply' | 'borrow',
): number {
  const clamped = Math.max(deltaUsd, -walletValueUsd);
  return clamped === 0 ? 0 : clamped;
}
