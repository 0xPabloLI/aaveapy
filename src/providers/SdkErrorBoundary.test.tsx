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

  it('logs error to console', () => {
    render(
      <SdkErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </SdkErrorBoundary>,
    );
    expect(console.error).toHaveBeenCalledWith(
      '[SdkErrorBoundary] SDK rendering error:',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });
});
