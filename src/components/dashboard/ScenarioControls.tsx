import { useState, useEffect, memo, forwardRef, useImperativeHandle, useCallback, useRef } from 'react';
import { SlidersHorizontal, Eraser } from 'lucide-react';
import { toast } from 'sonner';
import { formatNumberInput } from '@/lib/numberFormat';
import { DS_NATIVE_CHECKBOX_CLASS } from '@/lib/dsNativeCheckbox';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDebouncedInput } from '@/hooks/useDebouncedInput';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
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
  /** Controlled mobile net-open state — when provided, the SlidersHorizontal toggle is rendered externally and this component uses the supplied value. */
  mobileNetOpen?: boolean;
  onMobileNetToggle?: () => void;
}

interface ScenarioInputFieldProps {
  side: 'supply' | 'borrow';
  displayValue: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
  inputMode: ScenarioInputMode;
  compact: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

function ScenarioInputField({ side, displayValue, onChange, onBlur, onFocus, onKeyDown, onClear, inputMode, compact, inputRef }: ScenarioInputFieldProps) {
  const label = side === 'supply' ? 'Supply' : 'Borrow';
  const accentClass = side === 'supply' ? 'ds-text-emerald-600' : 'ds-text-brand-cyan';
  const labelFontSize = compact ? 'ds-text-11' : 'ds-text-12';
  const labelClass = `${labelFontSize} font-semibold ${accentClass} shrink-0`;

  const controlH = compact ? 'h-[var(--ds-button-sm-h)]' : 'h-[var(--ds-control-h)]';
  const fontSize = compact ? 'ds-text-11' : 'ds-text-12';
  const inputPx = compact ? 'px-2' : 'px-[var(--ds-space-3)]';
  const inputMinW = compact ? 'min-w-[5rem]' : 'min-w-[3.5rem]';
  const inputBase = `w-full min-w-0 ${inputMinW} ${controlH} ${inputPx} ${fontSize} tabular-nums placeholder:italic`;

  const wrapperGap = compact ? 'gap-1' : 'gap-[var(--ds-space-1-5)]';
  const wrapperExtras = compact ? 'min-w-0' : 'flex-1';
  const clearPr = compact ? 'pr-7' : 'pr-8';
  const clearBtnRounded = 'rounded';
  const clearIconSize = 'size-3.5';

  const placeholder = side === 'supply'
    ? (inputMode === 'usd' ? '100,000' : '50')
    : (inputMode === 'usd' ? '20,000' : '10');

  const hasValue = Boolean(displayValue.trim());

  return (
    <div className={`flex items-center ${wrapperGap} ${wrapperExtras}`}>
      <span className={labelClass}>{label}</span>
      <div className="relative flex-1 min-w-0">
        <input
          ref={inputRef}
          value={displayValue}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          inputMode="decimal"
          placeholder={placeholder}
          className={cn(
            inputBase,
            cnDsInputSurface(hasValue, side),
            'min-w-0 w-full',
            hasValue ? clearPr : '',
          )}
          aria-label={`${label} amount`}
        />
        {hasValue && (
          <button
            type="button"
            onClick={onClear}
            className={`absolute right-1 top-1/2 -translate-y-1/2 ${clearBtnRounded} p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors`}
            aria-label={`Clear ${label.toLowerCase()} amount`}
          >
            <Eraser className={clearIconSize} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

const ScenarioControls = memo(forwardRef<ScenarioControlsHandle, ScenarioControlsProps>(({
  onDebouncedChange,
  meritMerklNetPosition = true,
  onMeritMerklNetPositionChange,
  mobileNetOpen: controlledMobileNetOpen,
  onMobileNetToggle,
}, ref) => {
  const isMobile = useIsMobile();
  const [inputMode, setInputMode] = useState<ScenarioInputMode>('usd');
  const [internalMobileNetOpen, setInternalMobileNetOpen] = useState(false);
  const mobileNetOpen = controlledMobileNetOpen ?? internalMobileNetOpen;
  const isMobileNetOpenControlled = controlledMobileNetOpen !== undefined;
  const desktopRowRef = useRef<HTMLDivElement>(null);

  const supplyRef = useRef('');
  const borrowRef = useRef('');
  const modeRef = useRef(inputMode);
  const [externalSupplyValue, setExternalSupplyValue] = useState<string | undefined>(undefined);
  const [externalBorrowValue, setExternalBorrowValue] = useState<string | undefined>(undefined);

  const batchCommit = useCallback((side: 'supply' | 'borrow', formattedValue: string) => {
    if (side === 'supply') {
      supplyRef.current = formattedValue;
    } else {
      borrowRef.current = formattedValue;
    }
    onDebouncedChange(supplyRef.current, borrowRef.current, modeRef.current);
  }, [onDebouncedChange]);

  useEffect(() => {
    modeRef.current = inputMode;
  }, [inputMode]);

  const supplyInput = useDebouncedInput({
    value: externalSupplyValue,
    onCommit: useCallback((v: string) => {
      setExternalSupplyValue(undefined);
      batchCommit('supply', v);
    }, [batchCommit]),
    debounceMs: INPUT_DEBOUNCE_MS,
  });

  const borrowInput = useDebouncedInput({
    value: externalBorrowValue,
    onCommit: useCallback((v: string) => {
      setExternalBorrowValue(undefined);
      batchCommit('borrow', v);
    }, [batchCommit]),
    debounceMs: INPUT_DEBOUNCE_MS,
  });

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
    setSupplyInput: (value: string) => {
      const formatted = formatNumberInput(value);
      supplyRef.current = formatted;
      setExternalSupplyValue(formatted);
    },
    setBorrowInput: (value: string) => {
      const formatted = formatNumberInput(value);
      borrowRef.current = formatted;
      setExternalBorrowValue(formatted);
    },
  }));

  const handleModeChange = (newMode: ScenarioInputMode) => {
    if (newMode !== inputMode) {
      supplyInput.handleClear();
      borrowInput.handleClear();
      supplyRef.current = '';
      borrowRef.current = '';
      setInputMode(newMode);
    }
  };

  const fontSize = isMobile ? 'ds-text-11' : 'ds-text-12';
  const segmentedActiveTextClass = 'text-foreground';

  const showMeritMerklMode = typeof onMeritMerklNetPositionChange === 'function';
  const meritMerklCheckboxId = 'scenario-merit-merkl-net-lending-borrowing';

  if (isMobile) {
    return (
      <div className="relative rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-1.5 py-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="py-2 md:py-0">
          <SegmentedToggle
            options={[
              { value: 'usd', label: 'USD' },
              { value: 'token', label: 'Token' },
            ]}
            value={inputMode}
            onChange={(val) => handleModeChange(val as ScenarioInputMode)}
            orientation="vertical"
            activeTextClassName={segmentedActiveTextClass}
            className="shrink-0 self-stretch"
          />
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0 py-1">
            <ScenarioInputField
              side="supply"
              displayValue={supplyInput.displayValue}
              onChange={supplyInput.handleChange}
              onBlur={supplyInput.handleBlur}
              onFocus={supplyInput.handleFocus}
              onKeyDown={supplyInput.handleKeyDown}
              onClear={supplyInput.handleClear}
              inputMode={inputMode}
              inputRef={supplyInput.inputRef}
              compact
            />
            <ScenarioInputField
              side="borrow"
              displayValue={borrowInput.displayValue}
              onChange={borrowInput.handleChange}
              onBlur={borrowInput.handleBlur}
              onFocus={borrowInput.handleFocus}
              onKeyDown={borrowInput.handleKeyDown}
              onClear={borrowInput.handleClear}
              inputMode={inputMode}
              inputRef={borrowInput.inputRef}
              compact
            />
          </div>
          {showMeritMerklMode && !isMobileNetOpenControlled ? (
            <button
              type="button"
              onClick={() => setInternalMobileNetOpen((prev) => !prev)}
              className={cn(
                'shrink-0 inline-flex h-[var(--ds-control-h)] w-[var(--ds-control-h)] min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground/65 transition-colors',
                mobileNetOpen
                  ? 'text-foreground'
                  : 'hover:text-foreground/85',
              )}
              aria-label={mobileNetOpen ? 'Collapse advanced controls' : 'Expand advanced controls'}
              aria-expanded={mobileNetOpen}
            >
              <SlidersHorizontal
                className={cn('size-3.5 transition-transform duration-300', mobileNetOpen && 'rotate-180')}
                aria-hidden
                />
              </button>
            ) : null}
          </div>
        {showMeritMerklMode && mobileNetOpen ? (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-border/60 bg-card/95 px-1.5 py-1 backdrop-blur-sm">
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

  return (
    <div className="w-full min-w-0 rounded-xl bg-card/60 px-3 py-1.5 backdrop-blur-sm">
      <div ref={desktopRowRef} className="flex flex-row items-center gap-x-4">
        <SegmentedToggle
          options={[
            { value: 'usd', label: 'USD' },
            { value: 'token', label: 'Token' },
          ]}
          value={inputMode}
          onChange={(val) => handleModeChange(val as ScenarioInputMode)}
          activeTextClassName={segmentedActiveTextClass}
          className="shrink-0"
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 min-w-0 flex-1">
          <ScenarioInputField
            side="supply"
            displayValue={supplyInput.displayValue}
            onChange={supplyInput.handleChange}
            onBlur={supplyInput.handleBlur}
            onFocus={supplyInput.handleFocus}
            onKeyDown={supplyInput.handleKeyDown}
            onClear={supplyInput.handleClear}
            inputMode={inputMode}
            inputRef={supplyInput.inputRef}
            compact={false}
          />
          <ScenarioInputField
            side="borrow"
            displayValue={borrowInput.displayValue}
            onChange={borrowInput.handleChange}
            onBlur={borrowInput.handleBlur}
            onFocus={borrowInput.handleFocus}
            onKeyDown={borrowInput.handleKeyDown}
            onClear={borrowInput.handleClear}
            inputMode={inputMode}
            inputRef={borrowInput.inputRef}
            compact={false}
          />

          <div className="flex items-center gap-3 shrink-0">
            {showMeritMerklMode ? (
              <IncentiveNetCheckboxTooltip
                id={meritMerklCheckboxId}
                checked={meritMerklNetPosition}
                onCheckedChange={handleMeritMerklNetPositionChange}
                labelClassName="shrink-0 min-w-0 py-0.5"
                labelTextClassName={`${fontSize} min-w-0 leading-tight text-muted-foreground`}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}));

ScenarioControls.displayName = 'ScenarioControls';

export default ScenarioControls;