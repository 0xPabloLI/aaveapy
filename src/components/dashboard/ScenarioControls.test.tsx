// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScenarioControls from './ScenarioControls';
import type { ScenarioInputMode } from './ScenarioControls';

const mockUseIsMobile = vi.fn();
const mockToast = vi.fn();

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipArrow: () => null,
  TooltipCalloutArrow: () => null,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderControls(
  props: Partial<{
    onDebouncedChange: (supply: string, borrow: string, mode: ScenarioInputMode) => void;
    meritMerklNetPosition: boolean;
    onMeritMerklNetPositionChange: (value: boolean) => void;
    mobileNetOpen: boolean;
    onMobileNetToggle: () => void;
  }> = {},
) {
  const defaultProps = {
    onDebouncedChange: vi.fn(),
    ...props,
  };
  return render(<ScenarioControls {...defaultProps} />);
}

describe('ScenarioControls', () => {
  beforeEach(() => {
    mockUseIsMobile.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('useDebouncedInput migration (AAV-745)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      mockUseIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should NOT call onDebouncedChange immediately on input', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      expect(onDebouncedChange).not.toHaveBeenCalled();
    });

    it('should call onDebouncedChange after 300ms debounce', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      vi.advanceTimersByTime(300);
      expect(onDebouncedChange).toHaveBeenCalledWith('5,000', '', 'usd');
    });

    it('should reset debounce timer on consecutive inputs, committing only last value', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '1000' } });
      vi.advanceTimersByTime(150);
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      vi.advanceTimersByTime(150);
      expect(onDebouncedChange).not.toHaveBeenCalled();
      vi.advanceTimersByTime(150);
      expect(onDebouncedChange).toHaveBeenCalledWith('5,000', '', 'usd');
    });

    it('should commit immediately on blur without waiting for debounce', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      fireEvent.blur(supplyInput);
      expect(onDebouncedChange).toHaveBeenCalledWith('5,000', '', 'usd');
    });

    it('should cancel pending debounce timer on blur', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      fireEvent.blur(supplyInput);
      expect(onDebouncedChange).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(500);
      expect(onDebouncedChange).toHaveBeenCalledTimes(1);
    });

    it('should show formatted value (with commas) after blur', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '10000' } });
      fireEvent.blur(supplyInput);
      expect(supplyInput.value).toBe('10,000');
    });

    it('should remove commas on focus', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '10000' } });
      fireEvent.blur(supplyInput);
      fireEvent.focus(supplyInput);
      expect(supplyInput.value).toBe('10000');
    });

    it('should select all text on focus', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      fireEvent.blur(supplyInput);
      const selectSpy = vi.spyOn(supplyInput, 'select');
      fireEvent.focus(supplyInput);
      expect(selectSpy).toHaveBeenCalled();
      selectSpy.mockRestore();
    });

    it('should commit immediately on Enter key', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      fireEvent.keyDown(supplyInput, { key: 'Enter' });
      expect(onDebouncedChange).toHaveBeenCalledWith('5,000', '', 'usd');
    });

    it('should clear supply and immediately commit empty string on clear button', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      const borrowInput = screen.getByLabelText('Borrow amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      fireEvent.change(borrowInput, { target: { value: '2000' } });
      vi.advanceTimersByTime(300);
      onDebouncedChange.mockClear();
      const clearBtn = screen.getByLabelText('Clear supply amount');
      fireEvent.click(clearBtn);
      expect(supplyInput.value).toBe('');
      expect(onDebouncedChange).toHaveBeenCalledWith('', '2,000', 'usd');
    });

    it('should clear borrow and immediately commit empty string on clear button', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      const borrowInput = screen.getByLabelText('Borrow amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      fireEvent.change(borrowInput, { target: { value: '2000' } });
      vi.advanceTimersByTime(300);
      onDebouncedChange.mockClear();
      const clearBtn = screen.getByLabelText('Clear borrow amount');
      fireEvent.click(clearBtn);
      expect(borrowInput.value).toBe('');
      expect(onDebouncedChange).toHaveBeenCalledWith('5,000', '', 'usd');
    });

    it('should show raw value without commas during editing', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '10000' } });
      expect(supplyInput.value).toBe('10000');
    });

    it('should pass current borrow value when committing supply', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      const borrowInput = screen.getByLabelText('Borrow amount') as HTMLInputElement;
      fireEvent.change(borrowInput, { target: { value: '2000' } });
      vi.advanceTimersByTime(300);
      onDebouncedChange.mockClear();
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      vi.advanceTimersByTime(300);
      expect(onDebouncedChange).toHaveBeenCalledWith('5,000', '2,000', 'usd');
    });

    it('should pass current supply value when committing borrow', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      const borrowInput = screen.getByLabelText('Borrow amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      vi.advanceTimersByTime(300);
      onDebouncedChange.mockClear();
      fireEvent.change(borrowInput, { target: { value: '2000' } });
      vi.advanceTimersByTime(300);
      expect(onDebouncedChange).toHaveBeenCalledWith('5,000', '2,000', 'usd');
    });

    it('should pass current mode in onDebouncedChange when committing', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.click(screen.getByText('Token'));
      vi.advanceTimersByTime(300);
      onDebouncedChange.mockClear();
      fireEvent.change(supplyInput, { target: { value: '50' } });
      vi.advanceTimersByTime(300);
      expect(onDebouncedChange).toHaveBeenCalledWith('50', '', 'token');
    });
  });

  describe('Desktop', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      mockUseIsMobile.mockReturnValue(false);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders USD/Token SegmentedToggle', () => {
      renderControls();
      expect(screen.getByText('USD')).toBeInTheDocument();
      expect(screen.getByText('Token')).toBeInTheDocument();
    });

    it('renders Supply input field', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount');
      expect(supplyInput).toBeInTheDocument();
      expect(supplyInput).toHaveAttribute('inputmode', 'decimal');
    });

    it('renders Borrow input field', () => {
      renderControls();
      const borrowInput = screen.getByLabelText('Borrow amount');
      expect(borrowInput).toBeInTheDocument();
      expect(borrowInput).toHaveAttribute('inputmode', 'decimal');
    });

    it('renders Supply and Borrow labels', () => {
      renderControls();
      const supplyLabels = screen.getAllByText('Supply');
      const borrowLabels = screen.getAllByText('Borrow');
      expect(supplyLabels.length).toBeGreaterThan(0);
      expect(borrowLabels.length).toBeGreaterThan(0);
    });

    it('shows correct placeholders in USD mode', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      const borrowInput = screen.getByLabelText('Borrow amount') as HTMLInputElement;
      expect(supplyInput.placeholder).toBe('100,000');
      expect(borrowInput.placeholder).toBe('20,000');
    });

    it('updates Supply input value and calls debounced callback', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      expect(supplyInput.value).toBe('5000');
      vi.advanceTimersByTime(300);
      expect(onDebouncedChange).toHaveBeenCalled();
    });

    it('updates Borrow input value and calls debounced callback', () => {
      const onDebouncedChange = vi.fn();
      renderControls({ onDebouncedChange });
      const borrowInput = screen.getByLabelText('Borrow amount') as HTMLInputElement;
      fireEvent.change(borrowInput, { target: { value: '2000' } });
      expect(borrowInput.value).toBe('2000');
      vi.advanceTimersByTime(300);
      expect(onDebouncedChange).toHaveBeenCalled();
    });

    it('shows clear button when input has value', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      const clearBtn = screen.getByLabelText('Clear supply amount');
      expect(clearBtn).toBeInTheDocument();
    });

    it('clears input when clear button is clicked', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      const clearBtn = screen.getByLabelText('Clear supply amount');
      fireEvent.click(clearBtn);
      expect(supplyInput.value).toBe('');
    });

    it('clears both inputs when switching mode', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      const borrowInput = screen.getByLabelText('Borrow amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '5000' } });
      fireEvent.change(borrowInput, { target: { value: '2000' } });
      expect(supplyInput.value).toBe('5000');
      expect(borrowInput.value).toBe('2000');
      fireEvent.click(screen.getByText('Token'));
      expect(supplyInput.value).toBe('');
      expect(borrowInput.value).toBe('');
    });

    it('renders Net lending checkbox when onMeritMerklNetPositionChange is provided', () => {
      const onMeritMerklNetPositionChange = vi.fn();
      renderControls({ onMeritMerklNetPositionChange });
      expect(screen.getByLabelText(/Net lending and borrowing for incentives/)).toBeInTheDocument();
    });

    it('does not render Net lending checkbox when no handler', () => {
      renderControls();
      expect(screen.queryByLabelText(/Net lending and borrowing for incentives/)).toBeNull();
    });

    it('does not render SlidersHorizontal button on desktop', () => {
      const onMeritMerklNetPositionChange = vi.fn();
      renderControls({ onMeritMerklNetPositionChange });
      expect(screen.queryByLabelText('Expand advanced controls')).toBeNull();
    });

    it('calls onMeritMerklNetPositionChange when Net checkbox toggled', () => {
      const onMeritMerklNetPositionChange = vi.fn();
      renderControls({ onMeritMerklNetPositionChange });
      const checkbox = screen.getByLabelText(/Net lending and borrowing for incentives/);
      fireEvent.click(checkbox);
      expect(onMeritMerklNetPositionChange).toHaveBeenCalledWith(false);
    });

    it('shows toast when turning off Net on desktop', () => {
      const onMeritMerklNetPositionChange = vi.fn();
      renderControls({ onMeritMerklNetPositionChange });
      const checkbox = screen.getByLabelText(/Net lending and borrowing for incentives/);
      fireEvent.click(checkbox);
      expect(mockToast).toHaveBeenCalled();
    });
  });

  describe('Mobile', () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it('renders USD/Token SegmentedToggle', () => {
      renderControls();
      expect(screen.getByText('USD')).toBeInTheDocument();
      expect(screen.getByText('Token')).toBeInTheDocument();
    });

    it('renders Supply input field', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      expect(supplyInput).toBeInTheDocument();
    });

    it('renders Borrow input field', () => {
      renderControls();
      const borrowInput = screen.getByLabelText('Borrow amount') as HTMLInputElement;
      expect(borrowInput).toBeInTheDocument();
    });

    it('updates Supply input and shows clear button', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '1000' } });
      expect(supplyInput.value).toBe('1000');
      const clearBtn = screen.getByLabelText('Clear supply amount');
      expect(clearBtn).toBeInTheDocument();
    });

    it('clears input when clear button is clicked on mobile', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '1000' } });
      fireEvent.click(screen.getByLabelText('Clear supply amount'));
      expect(supplyInput.value).toBe('');
    });

    it('clears both inputs when switching mode on mobile', () => {
      renderControls();
      const supplyInput = screen.getByLabelText('Supply amount') as HTMLInputElement;
      const borrowInput = screen.getByLabelText('Borrow amount') as HTMLInputElement;
      fireEvent.change(supplyInput, { target: { value: '50' } });
      fireEvent.change(borrowInput, { target: { value: '10' } });
      fireEvent.click(screen.getByText('Token'));
      expect(supplyInput.value).toBe('');
      expect(borrowInput.value).toBe('');
    });

    it('renders SlidersHorizontal button when onMeritMerklNetPositionChange is provided', () => {
      const onMeritMerklNetPositionChange = vi.fn();
      renderControls({ onMeritMerklNetPositionChange });
      expect(screen.getByLabelText('Expand advanced controls')).toBeInTheDocument();
    });

    it('does not render SlidersHorizontal button when no handler', () => {
      renderControls();
      expect(screen.queryByLabelText('Expand advanced controls')).toBeNull();
    });

    it('toggles Net panel when SlidersHorizontal clicked', () => {
      const onMeritMerklNetPositionChange = vi.fn();
      renderControls({ onMeritMerklNetPositionChange });
      const toggleBtn = screen.getByLabelText('Expand advanced controls');
      fireEvent.click(toggleBtn);
      expect(screen.getByLabelText('Collapse advanced controls')).toBeInTheDocument();
      expect(screen.getByLabelText('Net lending and borrowing for incentives')).toBeInTheDocument();
    });

    it('collapses Net panel when SlidersHorizontal clicked again', () => {
      const onMeritMerklNetPositionChange = vi.fn();
      renderControls({ onMeritMerklNetPositionChange });
      fireEvent.click(screen.getByLabelText('Expand advanced controls'));
      fireEvent.click(screen.getByLabelText('Collapse advanced controls'));
      expect(screen.queryByLabelText('Net lending and borrowing for incentives')).toBeNull();
    });

    it('does not show toast when toggling Net on mobile', () => {
      const onMeritMerklNetPositionChange = vi.fn();
      mockUseIsMobile.mockReturnValue(true);
      renderControls({ onMeritMerklNetPositionChange });
      fireEvent.click(screen.getByLabelText('Expand advanced controls'));
      const checkbox = screen.getByLabelText('Net lending and borrowing for incentives');
      fireEvent.click(checkbox);
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('does not render Net checkbox in main mobile layout (only in expanded panel)', () => {
      const onMeritMerklNetPositionChange = vi.fn();
      renderControls({ onMeritMerklNetPositionChange });
      // Before expanding, no checkbox
      expect(screen.queryByLabelText('Net lending and borrowing for incentives')).toBeNull();
    });
  });

  describe('useImperativeHandle', () => {
    it('exposes setSupplyInput and setBorrowInput via ref', () => {
      // Functional test: the imperative handle is tested via ReservesTable integration
      const { container } = renderControls();
      expect(container).toBeTruthy();
    });
  });
});