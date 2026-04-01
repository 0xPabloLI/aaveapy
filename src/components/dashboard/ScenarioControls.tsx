import { useState, useEffect, memo, forwardRef, useImperativeHandle, useCallback } from 'react';
import { SlidersHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatNumberInput } from '@/lib/numberFormat';
import { DS_NATIVE_CHECKBOX_CLASS } from '@/lib/dsNativeCheckbox';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { cnDsInputSurface } from '@/lib/dsInputSurface';

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
            'flex min-w-0 cursor-pointer items-center gap-[var(--ds-space-1-5)] rounded-md px-0.5 py-0.5 transition-colors',
            labelClassName,
          )}
        >
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange(event.target.checked)}
            className={cn(
              DS_NATIVE_CHECKBOX_CLASS,
              'mt-0 accent-muted-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
            )}
            aria-label="Net lending and borrowing for incentives (Merit/Merkl); Brevis unchanged"
          />
          <span className={cn(labelTextClassName, 'whitespace-nowrap')}>Net lending &amp; borrowing</span>
        </label>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card px-4 py-3 text-left shadow-lg leading-normal"
      >
        <div className="space-y-2.5">
          <p className="text-muted-foreground ds-text-12 leading-relaxed">
            Net on: overlapping supply and borrow offset each other first.
          </p>
          <p className="text-muted-foreground ds-text-12 leading-relaxed">
            Net off: both sides are counted in full, which may overestimate incentives.
          </p>
          <p className="text-muted-foreground ds-text-12 leading-relaxed">
            Brevis campaigns use separate rules and are not affected by this switch.
          </p>
        </div>
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
  const [mobileNetOpen, setMobileNetOpen] = useState(false);
  const handleMeritMerklNetPositionChange = useCallback(
    (next: boolean) => {
      if (!onMeritMerklNetPositionChange) return;
      if (!next && !isMobile) {
        toast('Incentives usually follow net lending & borrowing', {
          description:
            'Turning this off uses gross supply and borrow per side and may not match how programs size rewards. Open the tooltip on Net for a short note.',
          duration: 4500,
        });
      }
      onMeritMerklNetPositionChange(next);
    },
    [onMeritMerklNetPositionChange, isMobile],
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
  const inputBase = `w-full min-w-0 ${inputMinW} ${controlH} ${inputPx} ${fontSize} tabular-nums placeholder:italic`;
  const clearBtnBase = isMobile
    ? `ds-btn-secondary ${controlH} ${fontSize} inline-flex items-center justify-center px-1.5 min-w-0`
    : `ds-btn-secondary ${controlH} ${fontSize} inline-flex items-center gap-1.5 px-[var(--ds-space-2-5)] min-w-0`;
  const clearBtnState = hasInput
    ? 'border-border bg-muted/80 text-foreground hover:bg-accent hover:border-border shadow-sm'
    : '';
  const clearBtnMobileStyle =
    'inline-flex h-9 w-9 items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground/70 shadow-none ring-0 outline-none transition-colors hover:bg-muted/45 hover:text-foreground disabled:text-muted-foreground/35 disabled:hover:bg-transparent';

  /**
   * Segmented control: same metrics as `AprApyToggle` (px-3 py-1, ds-text-12, content-width segments)
   * so USD/Token matches APR/APY in FilterBar. Pill thumb: DESIGN.md § 4.2.
   */
  const segmentedTrack = 'rounded-lg border border-border/40 bg-muted/60 p-0.5 gap-0.5';
  const segmentedFontSize = isMobile ? 'ds-text-11' : 'ds-text-12';
  const segmentedUsdLabelSize = isMobile ? 'text-[12px]' : 'text-[13px]';
  const segmentedSegment =
    `flex items-center justify-center rounded-md ${segmentedFontSize} font-semibold transition-all duration-200 px-3 py-1`;
  const segmentedSelectedBase =
    'bg-card text-foreground border border-border/60 shadow-sm';
  const segmentedUnselectedBase =
    'text-muted-foreground hover:bg-card/50 hover:text-foreground';

  const showMeritMerklMode = typeof onMeritMerklNetPositionChange === 'function';
  const meritMerklCheckboxId = 'scenario-merit-merkl-net-lending-borrowing';

  const fieldLabelMobileSupply =
    'ds-text-11 font-semibold uppercase tracking-wide ds-text-emerald-600 shrink-0';
  const fieldLabelMobileBorrow =
    'ds-text-11 font-semibold uppercase tracking-wide ds-text-brand-cyan shrink-0';
  const fieldLabelSupplyDesktop = `${fontSize} font-semibold shrink-0 ds-text-emerald-600`;
  const fieldLabelBorrowDesktop = `${fontSize} font-semibold shrink-0 ds-text-brand-cyan`;

  if (isMobile) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-1.5 py-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <div
            className={cn(
              'flex min-h-0 shrink-0 flex-col self-stretch',
              segmentedTrack,
            )}
          >
            <button
              type="button"
              onClick={() => handleModeChange('usd')}
              className={cn(
                'min-h-0 flex-1',
                segmentedSegment,
                inputMode === 'usd' ? segmentedSelectedBase : segmentedUnselectedBase,
              )}
              aria-pressed={inputMode === 'usd'}
              aria-label="USD mode"
            >
              <span className={segmentedUsdLabelSize}>USD</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('token')}
              className={cn(
                'min-h-0 flex-1',
                segmentedSegment,
                inputMode === 'token' ? segmentedSelectedBase : segmentedUnselectedBase,
              )}
              aria-pressed={inputMode === 'token'}
              aria-label="Token mode"
            >
              <span className={segmentedUsdLabelSize}>Token</span>
            </button>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <span className={`${fieldLabelMobileSupply} w-11 shrink-0`}>Supply</span>
              <input
                value={supplyInput}
                onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
                inputMode="decimal"
                placeholder={inputMode === 'usd' ? '100,000' : '50'}
                className={cn(
                  inputBase,
                  cnDsInputSurface(Boolean(supplyInput.trim()), 'supply'),
                  'min-w-0 flex-1',
                )}
                aria-label="Supply amount"
              />
            </div>
            <div className="flex min-w-0 items-center gap-1">
              <span className={`${fieldLabelMobileBorrow} w-11 shrink-0`}>Borrow</span>
              <input
                value={borrowInput}
                onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
                inputMode="decimal"
                placeholder={inputMode === 'usd' ? '20,000' : '10'}
                className={cn(
                  inputBase,
                  cnDsInputSurface(Boolean(borrowInput.trim()), 'borrow'),
                  'min-w-0 flex-1',
                )}
                aria-label="Borrow amount"
              />
            </div>
          </div>
          <div className="relative flex w-8 shrink-0 flex-col items-center self-stretch">
            <div className="absolute left-[44%] top-1/2 -translate-x-1/2 -translate-y-1/2">
              <button
                type="button"
                onClick={() => { setSupplyInput(''); setBorrowInput(''); }}
                disabled={!hasInput}
                className={cn(clearBtnMobileStyle, 'shrink-0')}
                aria-label="Clear supply and borrow scenario inputs"
              >
                <Trash2 className="size-[18px] shrink-0" aria-hidden />
              </button>
            </div>
            {showMeritMerklMode ? (
              <button
                type="button"
                onClick={() => setMobileNetOpen((prev) => !prev)}
                className={cn(
                  'absolute -right-1.5 -bottom-1 inline-flex h-8 w-8 items-center justify-center text-muted-foreground/65 transition-colors',
                  mobileNetOpen
                    ? 'text-foreground'
                    : 'hover:text-foreground/85',
                )}
                aria-label={mobileNetOpen ? 'Close advanced scenario controls' : 'Open advanced scenario controls'}
                aria-expanded={mobileNetOpen}
              >
                <SlidersHorizontal className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        {showMeritMerklMode && mobileNetOpen ? (
          <div className="mt-1.5 px-0.5 pb-0.5">
            <label
              htmlFor={meritMerklCheckboxId}
              className="mx-auto flex w-fit max-w-full min-w-0 cursor-pointer items-center justify-center gap-[var(--ds-space-1-5)] rounded-md px-1.5 py-0.5 transition-colors"
            >
              <input
                id={meritMerklCheckboxId}
                type="checkbox"
                checked={meritMerklNetPosition}
                onChange={(event) => handleMeritMerklNetPositionChange(event.target.checked)}
                className={cn(
                  DS_NATIVE_CHECKBOX_CLASS,
                  'mt-0 accent-muted-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
                )}
                aria-label="Net lending and borrowing for incentives"
              />
              <span className={`${fontSize} whitespace-nowrap text-foreground`}>Net lending &amp; borrowing</span>
            </label>
            <div className="mt-1 border-t border-border/20 pt-1">
              <div className="space-y-0.5 px-0.5 text-left text-muted-foreground/60 ds-text-10 leading-snug">
                <p>
                  <span className="text-muted-foreground/75">Net on:</span> overlapping supply and borrow offset each other first.
                </p>
                <p>
                  <span className="text-muted-foreground/75">Net off:</span> both sides are counted in full, which may overestimate incentives.
                </p>
                <p>Brevis campaigns use separate rules and are not affected by this switch.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* Desktop: tinted inner well (no extra outer border — reserves card frame only). */
  return (
    <div className="w-full min-w-0 rounded-xl bg-card/60 px-3 py-0.5 backdrop-blur-sm">
      <div className="flex w-full min-w-0 items-center gap-3">
      <div className={cn('flex shrink-0 items-center', segmentedTrack)}>
        <button
          type="button"
          onClick={() => handleModeChange('usd')}
          className={cn(
            segmentedSegment,
            inputMode === 'usd' ? segmentedSelectedBase : segmentedUnselectedBase,
          )}
          aria-pressed={inputMode === 'usd'}
        >
          <span className={segmentedUsdLabelSize}>USD</span>
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('token')}
          className={cn(
            segmentedSegment,
            inputMode === 'token' ? segmentedSelectedBase : segmentedUnselectedBase,
          )}
          aria-pressed={inputMode === 'token'}
        >
          <span className={segmentedUsdLabelSize}>Token</span>
        </button>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-[var(--ds-space-1)]">
        <span className={fieldLabelSupplyDesktop}>Supply</span>
        <input
          value={supplyInput}
          onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
          inputMode="decimal"
          placeholder={inputMode === 'usd' ? '100,000' : '50'}
          className={cn(inputBase, cnDsInputSurface(Boolean(supplyInput.trim()), 'supply'))}
          aria-label="Supply amount"
        />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-[var(--ds-space-1)]">
        <span className={fieldLabelBorrowDesktop}>Borrow</span>
        <input
          value={borrowInput}
          onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
          inputMode="decimal"
          placeholder={inputMode === 'usd' ? '20,000' : '10'}
          className={cn(inputBase, cnDsInputSurface(Boolean(borrowInput.trim()), 'borrow'))}
          aria-label="Borrow amount"
        />
      </div>

      {showMeritMerklMode ? (
        <IncentiveNetCheckboxTooltip
          id={meritMerklCheckboxId}
          checked={meritMerklNetPosition}
          onCheckedChange={handleMeritMerklNetPositionChange}
          labelClassName="shrink-0 min-w-0 py-0.5"
          labelTextClassName={`${fontSize} min-w-0 leading-tight text-muted-foreground`}
        />
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
