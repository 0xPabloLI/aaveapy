// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SdkErrorBoundary } from './SdkErrorBoundary';

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('SDK render crashed');
  return <div>Content loaded</div>;
}

describe('SdkErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error', () => {
    render(
      <SdkErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </SdkErrorBoundary>,
    );
    expect(screen.getByText('Content loaded')).toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    render(
      <SdkErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </SdkErrorBoundary>,
    );
    expect(screen.getByText(/SDK data loading error/)).toBeInTheDocument();
  });

  it('logs structured error to console', () => {
    render(
      <SdkErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </SdkErrorBoundary>,
    );
    // React emits its own uncaught-error logs alongside ours; assert our
    // structured line is among them (exact shape pinned by logger.test.ts).
    const calls = (console.error as ReturnType<typeof vi.spyOn>).mock.calls.map((c: unknown[]) =>
      String(c[0]),
    ) as string[];
    expect(calls.some((line: string) => line.includes('SDK rendering error'))).toBe(true);
  });
});
