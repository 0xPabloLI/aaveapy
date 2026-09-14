// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsentBanner from '@/components/ConsentBanner';

describe('ConsentBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders for visitors who have not responded and stores the decision on Allow', async () => {
    const { unmount } = render(<ConsentBanner />);
    expect(screen.getByRole('dialog', { name: /analytics consent/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /allow analytics/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('aaveapy:consent-v2')).toContain('"analytics":"granted"');
    unmount();
  });

  it('stores denial on Decline and stays dismissed', async () => {
    const { unmount } = render(<ConsentBanner />);

    await userEvent.click(screen.getByRole('button', { name: /decline/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('aaveapy:consent-v2')).toContain('"analytics":"denied"');

    const { unmount: unmount2 } = render(<ConsentBanner />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount2();
    unmount();
  });

  it('stays hidden for visitors with a stored decision', () => {
    window.localStorage.setItem(
      'aaveapy:consent-v2',
      JSON.stringify({ analytics: 'granted', respondedAt: new Date().toISOString() }),
    );
    render(<ConsentBanner />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
