import { useState, useEffect, memo, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatNumberInput } from '@/lib/numberFormat';
import { DS_NATIVE_CHECKBOX_CLASS } from '@/lib/dsNativeCheckbox';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const INCENTIVE_NET_UNCHECK_TOAST_STORAGE_KEY = 'aaveapy:scenario-incentive-net-uncheck-tip';

function IncentiveNetCheckboxTooltip({
  id,
  checked,
  onCheckedChange,
  labelClassName,
  labelTextClassName,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  labelClassName: string;
  labelTextClassName: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label
          htmlFor={id}
          className={cn(
            'flex min-w-0 cursor-pointer items-start gap-[var(--ds-space-1-5)] rounded-md px-0.5 py-0.5 transition-colors hover:bg-muted/50',
            labelClassName,
          )}
        >
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange(event.target.checked)}
            className={`${DS_NATIVE_CHECKBOX_CLASS} accent-muted-foreground`}
          />
          <span className={labelTextClassName}>Net lending & borrowing</span>
        </label>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[min(17rem,calc(100vw-2rem))] text-left ds-text-13 leading-snug"
      >
        <p className="text-muted-foreground">
          Incentives (e.g. Merit/Merkl) usually follow net lending and net borrowing—overlap does not double-count.
        </p>
        <p className="mt-1.5 text-muted-foreground">
          {'"Off" uses gross supply and borrow per side; may not match how programs pay.'}
        </p>
        <p className="mt-1.5 text-muted-foreground">Brevis ignores this.</p>
      </TooltipContent>
    </Tooltip>
  );
}

const INPUT_DEBOUNCE_MS = 300;

export type ScenarioInputMode = 'usd' | 'token';

export interface ScenarioControlsHandle {
  setSupplyInput: (value: string) => void;
  setBorrowInput: (value: string) => void;
}

interface ScenarioControlsProps {
  onDebouncedChange: (supply: string, borrow: string, mode: ScenarioInputMode) => void;
  /** When true, non-Brevis incentive simulation uses net lending (supply minus borrow) and net borrowing (borrow minus supply); when false, gross supply and gross borrow per side. Brevis is unchanged. */
  meritMerklNetPosition?: boolean;
  onMeritMerklNetPositionChange?: (value: boolean) => void;
}

const ScenarioControls = memo(forwardRef<ScenarioControlsHandle, ScenarioControlsProps>(({
  onDebouncedChange,
  meritMerklNetPosition = true,
  onMeritMerklNetPositionChange,
}, ref) => {
  const isMobile = useIsMobile();
  const [supplyInput, setSupplyInput] = useState('');
  const [borrowInput, setBorrowInput] = useState('');
  const [inputMode, setInputMode] = useState<ScenarioInputMode>('usd');
  const handleMeritMerklNetPositionChange = useCallback(
    (next: boolean) => {
      if (!onMeritMerklNetPositionChange) return;
      if (
        !next &&
        typeof window !== 'undefined' &&
        window.localStorage.getItem(INCENTIVE_NET_UNCHECK_TOAST_STORAGE_KEY) !== '1'
      ) {
        window.localStorage.setItem(INCENTIVE_NET_UNCHECK_TOAST_STORAGE_KEY, '1');
        toast('Incentives usually follow net lending & borrowing', {
          description:
            'Turning this off uses gross supply and borrow per side and may not match how programs size rewards. Hover the label for a short note.',
          duration: 6500,
        });
      }
      onMeritMerklNetPositionChange(next);
    },
    [onMeritMerklNetPositionChange],
  );

  useImperativeHandle(ref, () => ({
    setSupplyInput: (value: string) => setSupplyInput(formatNumberInput(value)),
    setBorrowInput: (value: string) => setBorrowInput(formatNumberInput(value)),
  }), []);

  const handleModeChange = (newMode: ScenarioInputMode) => {
    if (newMode !== inputMode) {
      setSupplyInput('');
      setBorrowInput('');
      setInputMode(newMode);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDebouncedChange(supplyInput, borrowInput, inputMode);
    }, INPUT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [supplyInput, borrowInput, inputMode, onDebouncedChange]);

  const hasInput = supplyInput || borrowInput;

  /* shared token classes — mobile: h-9 (36px) for max compactness; desktop h-8 */
  const controlH = isMobile ? 'h-9' : 'h-8';
  const fontSize = isMobile ? 'ds-text-11' : 'ds-text-12';
  const inputPx = isMobile ? 'px-2' : 'px-[var(--ds-space-3)]';
  /* min-w on inputs so digits don't get clipped; mobile needs more room for long numbers */
  const inputMinW = isMobile ? 'min-w-[5rem]' : 'min-w-[6rem]';
  const inputBase = `ds-input-surface w-full min-w-0 ${inputMinW} ${controlH} ${inputPx} ${fontSize} tabular-nums placeholder:italic`;
  const clearBtnBase = isMobile
    ? `ds-btn-secondary ${controlH} ${fontSize} inline-flex items-center justify-center px-1.5 min-w-0`
    : `ds-btn-secondary ${controlH} ${fontSize} inline-flex items-center gap-1.5 px-[var(--ds-space-2-5)] min-w-0`;
  const clearBtnState = hasInput
    ? 'border-border bg-muted/80 text-foreground hover:bg-accent hover:border-border shadow-sm'
    : '';

  /* Scenario bar: neutral chrome only — supply/borrow semantic colors stay on the reserves table, not this toolbar. */
  const scenarioAmountInput = (hasValue: boolean) =>
    `${inputBase} border-border/60 bg-background/80 text-muted-foreground/80 placeholder:text-muted-foreground/35 ` +
    `focus:border-border focus:bg-card focus:text-foreground ` +
    `focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 focus-visible:ring-offset-background ` +
    (hasValue ? 'border-border text-foreground' : '');

  const segmentedSelected = `px-2 py-1 rounded-md ${fontSize} font-semibold bg-card text-foreground shadow-sm border border-border/60 transition-all duration-200`;
  const segmentedUnselected = `px-2 py-1 rounded-md ${fontSize} font-semibold text-muted-foreground hover:text-foreground hover:bg-card/50 transition-all duration-200`;

  const showMeritMerklMode = typeof onMeritMerklNetPositionChange === 'function';
  const meritMerklCheckboxId = 'scenario-merit-merkl-net-lending-borrowing';

  const fieldLabelMobile = 'text-[9px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0';
  const fieldLabelDesktop = `${fontSize} font-medium shrink-0 text-muted-foreground`;

  if (isMobile) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-1.5 py-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex flex-col self-stretch gap-0 rounded-lg bg-muted/60 p-0.5 border border-border/40 shrink-0">
            <button
              type="button"
              onClick={() => handleModeChange('usd')}
              className={`min-h-0 flex-1 ${inputMode === 'usd' ? segmentedSelected : segmentedUnselected}`}
              aria-pressed={inputMode === 'usd'}
              aria-label="USD mode"
            >
              USD
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('token')}
              className={`min-h-0 flex-1 ${inputMode === 'token' ? segmentedSelected : segmentedUnselected}`}
              aria-pressed={inputMode === 'token'}
              aria-label="Token mode"
            >
              Token
            </button>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <span className={`${fieldLabelMobile} w-10 shrink-0`}>Supply</span>
              <input
                value={supplyInput}
                onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
                inputMode="decimal"
                placeholder={inputMode === 'usd' ? '100,000' : '50'}
                className={`${scenarioAmountInput(Boolean(supplyInput.trim()))} flex-1 min-w-0`}
                aria-label="Supply amount"
              />
            </div>
            <div className="flex min-w-0 items-center gap-1">
              <span className={`${fieldLabelMobile} w-10 shrink-0`}>Borrow</span>
              <input
                value={borrowInput}
                onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
                inputMode="decimal"
                placeholder={inputMode === 'usd' ? '20,000' : '10'}
                className={`${scenarioAmountInput(Boolean(borrowInput.trim()))} flex-1 min-w-0`}
                aria-label="Borrow amount"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setSupplyInput(''); setBorrowInput(''); }}
            disabled={!hasInput}
            className={`${clearBtnBase} ${clearBtnState} shrink-0`}
            aria-label="Clear scenario inputs"
          >
            <Trash2 className="size-4 shrink-0" aria-hidden />
          </button>
        </div>
        {showMeritMerklMode ? (
          <div className="mt-1 border-t border-border/40 pt-1">
            <IncentiveNetCheckboxTooltip
              id={meritMerklCheckboxId}
              checked={meritMerklNetPosition}
              onCheckedChange={handleMeritMerklNetPositionChange}
              labelClassName="min-w-0 flex-1 py-1.5 pl-0.5"
              labelTextClassName={`${fontSize} min-w-0 leading-snug text-muted-foreground`}
            />
          </div>
        ) : null}
      </div>
    );
  }

  /* Desktop: single row */
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-[var(--ds-space-2-5)] py-0.5">
      <div className="flex items-center gap-[var(--ds-space-1-5)]">
        <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
          <button
            type="button"
            onClick={() => handleModeChange('usd')}
            className={inputMode === 'usd' ? segmentedSelected : segmentedUnselected}
            aria-pressed={inputMode === 'usd'}
          >
            USD
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('token')}
            className={inputMode === 'token' ? segmentedSelected : segmentedUnselected}
            aria-pressed={inputMode === 'token'}
          >
            Token
          </button>
        </div>

        <div className="flex items-center gap-[var(--ds-space-1)] flex-1 min-w-0">
          <span className={fieldLabelDesktop}>Supply</span>
          <input
            value={supplyInput}
            onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder={inputMode === 'usd' ? '100,000' : '50'}
            className={scenarioAmountInput(Boolean(supplyInput.trim()))}
            aria-label="Supply amount"
          />
        </div>

        <div className="flex items-center gap-[var(--ds-space-1)] flex-1 min-w-0">
          <span className={fieldLabelDesktop}>Borrow</span>
          <input
            value={borrowInput}
            onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder={inputMode === 'usd' ? '20,000' : '10'}
            className={scenarioAmountInput(Boolean(borrowInput.trim()))}
            aria-label="Borrow amount"
          />
        </div>

        {showMeritMerklMode ? (
          <div className="flex shrink-0 items-center rounded-lg border border-border/40 bg-muted/60 py-0.5 px-[var(--ds-space-2)]">
            <IncentiveNetCheckboxTooltip
              id={meritMerklCheckboxId}
              checked={meritMerklNetPosition}
              onCheckedChange={handleMeritMerklNetPositionChange}
              labelClassName="max-w-[13rem] min-w-0 py-0.5"
              labelTextClassName={`${fontSize} min-w-0 leading-tight text-muted-foreground`}
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => { setSupplyInput(''); setBorrowInput(''); }}
          disabled={!hasInput}
          className={`${clearBtnBase} ${clearBtnState}`}
          aria-label="Clear scenario inputs"
        >
          <Trash2 className="size-3.5 shrink-0" aria-hidden />
          <span>Clear</span>
        </button>
      </div>
    </div>
  );
}));

ScenarioControls.displayName = 'ScenarioControls';

export default ScenarioControls;
