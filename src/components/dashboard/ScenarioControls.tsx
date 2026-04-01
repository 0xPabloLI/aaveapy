import { useState, useEffect, memo, forwardRef, useImperativeHandle, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatNumberInput } from '@/lib/numberFormat';
import { DS_NATIVE_CHECKBOX_CLASS } from '@/lib/dsNativeCheckbox';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { cnDsInputSurface } from '@/lib/dsInputSurface';

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
            'flex min-w-0 cursor-pointer items-center gap-[var(--ds-space-1-5)] rounded-md px-0.5 py-0.5 transition-colors hover:bg-muted/50',
            labelClassName,
          )}
        >
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange(event.target.checked)}
            className={cn(DS_NATIVE_CHECKBOX_CLASS, 'mt-0 accent-muted-foreground')}
            aria-label="Net lending and borrowing for incentives (Merit/Merkl); Brevis unchanged"
          />
          <span className={labelTextClassName}>Net</span>
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

function MobileNetCollapsible({
  id,
  checked,
  onCheckedChange,
  fontSize,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  fontSize: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-1 border-t border-border/40 pt-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-1.5 rounded-md px-0.5 py-1.5 transition-colors hover:bg-muted/50"
      >
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
        <span className={`${fontSize} text-muted-foreground`}>Net lending &amp; borrowing</span>
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-1 pb-2 pt-1 space-y-2">
            <label
              htmlFor={id}
              className="flex min-w-0 cursor-pointer items-center gap-[var(--ds-space-1-5)] rounded-md px-0.5 py-1"
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(event) => onCheckedChange(event.target.checked)}
                className={cn(DS_NATIVE_CHECKBOX_CLASS, 'mt-0 accent-muted-foreground')}
                aria-label="Net lending and borrowing for incentives"
              />
              <span className={`${fontSize} text-foreground`}>
                {checked ? 'On' : 'Off'}
              </span>
            </label>

            <div className="space-y-1.5 px-0.5">
              <p className="text-muted-foreground ds-text-11 leading-relaxed">
                Net on: overlapping supply and borrow offset each other first.
              </p>
              <p className="text-muted-foreground ds-text-11 leading-relaxed">
                Net off: both sides are counted in full, which may overestimate incentives.
              </p>
              <p className="text-muted-foreground ds-text-11 leading-relaxed">
                Brevis campaigns use separate rules and are not affected by this switch.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
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
            'Turning this off uses gross supply and borrow per side and may not match how programs size rewards. Open the tooltip on Net for a short note.',
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
  const inputBase = `w-full min-w-0 ${inputMinW} ${controlH} ${inputPx} ${fontSize} tabular-nums placeholder:italic`;
  const clearBtnBase = isMobile
    ? `ds-btn-secondary ${controlH} ${fontSize} inline-flex items-center justify-center px-1.5 min-w-0`
    : `ds-btn-secondary ${controlH} ${fontSize} inline-flex items-center gap-1.5 px-[var(--ds-space-2-5)] min-w-0`;
  const clearBtnState = hasInput
    ? 'border-border bg-muted/80 text-foreground hover:bg-accent hover:border-border shadow-sm'
    : '';

  /**
   * Segmented control: same metrics as `AprApyToggle` (px-3 py-1, ds-text-12, content-width segments)
   * so USD/Token matches APR/APY in FilterBar. Pill thumb: DESIGN.md § 4.2.
   */
  const segmentedTrack = 'rounded-lg border border-border/40 bg-muted/60 p-0.5 gap-0.5';
  const segmentedSegment =
    'flex items-center justify-center rounded-md ds-text-12 font-semibold transition-all duration-200 px-3 py-1';
  const segmentedSelectedBase =
    'bg-card text-foreground border border-border/60 shadow-sm';
  const segmentedUnselectedBase =
    'text-muted-foreground hover:bg-card/50 hover:text-foreground';

  const showMeritMerklMode = typeof onMeritMerklNetPositionChange === 'function';
  const meritMerklCheckboxId = 'scenario-merit-merkl-net-lending-borrowing';

  const fieldLabelMobileSupply =
    'text-[9px] font-semibold uppercase tracking-wider ds-text-emerald-600 shrink-0';
  const fieldLabelMobileBorrow =
    'text-[9px] font-semibold uppercase tracking-wider ds-text-brand-cyan shrink-0';
  const fieldLabelSupplyDesktop = `${fontSize} font-semibold shrink-0 ds-text-emerald-600`;
  const fieldLabelBorrowDesktop = `${fontSize} font-semibold shrink-0 ds-text-brand-cyan`;

  const [mobileExpanded, setMobileExpanded] = useState(true);

  if (isMobile) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
        {/* Collapsible body */}
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out',
            mobileExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="px-1.5 pt-1 pb-0.5">
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
                    USD
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
                    Token
                  </button>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className={`${fieldLabelMobileSupply} w-10 shrink-0`}>Supply</span>
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
                    <span className={`${fieldLabelMobileBorrow} w-10 shrink-0`}>Borrow</span>
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
                <MobileNetCollapsible
                  id={meritMerklCheckboxId}
                  checked={meritMerklNetPosition}
                  onCheckedChange={handleMeritMerklNetPositionChange}
                  fontSize={fontSize}
                />
              ) : null}
            </div>
          </div>
        </div>

        {/* Grip handle to toggle collapse */}
        <button
          type="button"
          onClick={() => setMobileExpanded((prev) => !prev)}
          className="flex w-full items-center justify-center py-1 active:scale-[0.97] transition-transform"
          aria-label={mobileExpanded ? 'Collapse scenario controls' : 'Expand scenario controls'}
          aria-expanded={mobileExpanded}
        >
          <span className="block h-[3px] w-8 rounded-full bg-muted-foreground/40" />
        </button>
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
          USD
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
          Token
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
