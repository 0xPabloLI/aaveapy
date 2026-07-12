// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import InkAprCalculator from './InkAprCalculator';

const mockUseIsMobile = vi.fn();

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

const mockCoingecko = { data: null as Record<string, unknown> | null };

vi.mock('@/hooks/useCoingeckoFdv', () => ({
  useCoingeckoFdv: () => ({ data: mockCoingecko.data, isLoading: false, error: null }),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipArrow: () => null,
  TooltipCalloutArrow: () => null,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderCalculator(props: Partial<{
  rateInput: string;
  setRateInput: (v: string) => void;
  onRateChange: (rate: number) => void;
  onDragStateChange: (isDragging: boolean) => void;
}> = {}) {
  const defaultProps = {
    rateInput: '1.0000',
    setRateInput: vi.fn(),
    ...props,
  };
  return render(<InkAprCalculator {...defaultProps} />);
}

describe('InkAprCalculator', () => {
  beforeEach(() => {
    mockUseIsMobile.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockCoingecko.data = null;
  });

  describe('FDV input', () => {
    it('displays the default FDV value when initialized with default rate', () => {
      renderCalculator();

      const fdvInput = screen.getByLabelText('Estimated $INK FDV in billions');
      expect(fdvInput).toHaveValue('1');
    });

    it('updates input value when slider changes (slider → input sync)', () => {
      const { rerender } = render(
        <InkAprCalculator rateInput="1.0000" setRateInput={vi.fn()} />,
      );

      const fdvInput = screen.getByLabelText('Estimated $INK FDV in billions');
      expect(fdvInput).toHaveValue('1');

      // Simulate slider moving to FDV=5.0 (rateInput=5.0000)
      rerender(<InkAprCalculator rateInput="5.0000" setRateInput={vi.fn()} />);

      expect(fdvInput).toHaveValue('5');
    });

    it('updates slider when input value changes (input → slider sync)', async () => {
      vi.useFakeTimers();
      const setRateInput = vi.fn();
      renderCalculator({ setRateInput });

      const fdvInput = screen.getByLabelText('Estimated $INK FDV in billions');

      // Focus to clear and type a new value
      fireEvent.focus(fdvInput);
      fireEvent.change(fdvInput, { target: { value: '5' } });

      // Advance past debounce (300ms) so onCommit fires
      await act(() => vi.advanceTimersByTime(350));

      expect(setRateInput).toHaveBeenCalledWith('5.0000');
      vi.useRealTimers();
    });

    it('prevents slider from overwriting input while focused (focus guard)', async () => {
      const { rerender } = render(
        <InkAprCalculator rateInput="1.0000" setRateInput={vi.fn()} />,
      );

      const fdvInput = screen.getByLabelText('Estimated $INK FDV in billions');

      // Focus and type a partial value
      fireEvent.focus(fdvInput);
      fireEvent.change(fdvInput, { target: { value: '99' } });

      // Simulate slider change while focused — should NOT overwrite
      rerender(<InkAprCalculator rateInput="5.0000" setRateInput={vi.fn()} />);

      expect(fdvInput).toHaveValue('99');
    });

    it('restores current FDV value when input is cleared on blur', async () => {
      renderCalculator();

      const fdvInput = screen.getByLabelText('Estimated $INK FDV in billions');

      // Clear the input and blur
      fireEvent.focus(fdvInput);
      fireEvent.change(fdvInput, { target: { value: '' } });
      fireEvent.blur(fdvInput);

      // After blur + value sync, input should show current FDV (formatted without trailing zeros)
      expect(fdvInput).toHaveValue('1');
    });

    it('clamps out-of-range value to MAX_FDV (dynamic from reference points)', async () => {
      vi.useFakeTimers();
      const setRateInput = vi.fn();
      renderCalculator({ setRateInput });

      const fdvInput = screen.getByLabelText('Estimated $INK FDV in billions');

      fireEvent.focus(fdvInput);
      fireEvent.change(fdvInput, { target: { value: '200' } });

      await act(() => vi.advanceTimersByTime(350));

      // MAX_FDV = max of REFERENCE_POINTS fdv (115.8 binance) when no live data
      // clamped to 115.8, price = (115.8 * 1e9) / 1e9 = 115.8
      expect(setRateInput).toHaveBeenCalledWith('115.8000');
      vi.useRealTimers();
    });

    it('MAX_FDV uses live CoinGecko data when available', async () => {
      vi.useFakeTimers();

      // Set live BNB FDV = 120B
      mockCoingecko.data = {
        items: [{ symbol: 'BNB', fdvUsd: 120_000_000_000 }],
        fetchedAt: '2026-06-12T00:00:00Z',
      };

      const setRateInput = vi.fn();
      render(
        <InkAprCalculator rateInput="1.0000" setRateInput={setRateInput} />,
      );

      const fdvInput = screen.getByLabelText('Estimated $INK FDV in billions');
      fireEvent.focus(fdvInput);
      fireEvent.change(fdvInput, { target: { value: '150' } });

      await act(() => vi.advanceTimersByTime(350));

      // MAX_FDV = 120 (live BNB), 150 > 120 → clamped to 120
      expect(setRateInput).toHaveBeenCalledWith('120.0000');

      vi.useRealTimers();
      mockCoingecko.data = null;
    });

    it('slider handles max boundary correctly (clamp to MAX_FDV)', () => {
      const setRateInput = vi.fn();
      renderCalculator({ setRateInput });

      const slider = screen.getByRole('slider', { name: 'FDV slider' });

      // Click at far right (position 100 → max FDV)
      fireEvent.mouseDown(slider, { clientX: 9999 });

      // Should call setRateInput with the max FDV from reference points
      // MAX_FDV = 115.8 (binance hardcoded, no live data)
      expect(setRateInput).toHaveBeenCalledWith('115.8000');
    });

    it('slider handles min boundary correctly (clamp to MIN_FDV)', () => {
      const setRateInput = vi.fn();
      renderCalculator({ setRateInput });

      const slider = screen.getByRole('slider', { name: 'FDV slider' });

      // Click at far left (position 0 → min FDV)
      fireEvent.mouseDown(slider, { clientX: -9999 });

      // Should call setRateInput with MIN_FDV = 0
      expect(setRateInput).toHaveBeenCalledWith('0.0000');
    });

    it('commits value on Enter key immediately', async () => {
      vi.useFakeTimers();
      const setRateInput = vi.fn();
      renderCalculator({ setRateInput });

      const fdvInput = screen.getByLabelText('Estimated $INK FDV in billions');

      fireEvent.focus(fdvInput);
      fireEvent.change(fdvInput, { target: { value: '7' } });
      fireEvent.keyDown(fdvInput, { key: 'Enter' });

      // Enter bypasses debounce — should commit immediately
      expect(setRateInput).toHaveBeenCalledWith('7.0000');
      vi.useRealTimers();
    });

    it('slider interaction prevents blur commit from overwriting (slider guard)', () => {
      const setRateInput = vi.fn();
      renderCalculator({ setRateInput });

      const fdvInput = screen.getByLabelText('Estimated $INK FDV in billions');
      const slider = screen.getByRole('slider', { name: 'FDV slider' });

      // Focus and type a value that differs from slider position
      fireEvent.focus(fdvInput);
      fireEvent.change(fdvInput, { target: { value: '99' } });

      // Click slider — mousedown triggers updateFromFdv + sets sliderActiveRef
      // Then blur fires on input — but guard should block the overwrite
      fireEvent.mouseDown(slider);
      fireEvent.blur(fdvInput);

      // The last setRateInput call should NOT be from the input's blur commit (99 → 99.0000)
      const lastCall = setRateInput.mock.calls[setRateInput.mock.calls.length - 1]?.[0];
      expect(lastCall).not.toBe('99.0000');
    });
  });
});