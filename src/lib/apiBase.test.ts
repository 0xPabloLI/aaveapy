import { describe, expect, it, vi, beforeEach } from 'vitest';
import { validateApiBaseEnv } from './apiBase';

describe('validateApiBaseEnv', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('warns when production mode has no VITE_API_BASE_URL', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    validateApiBaseEnv({ MODE: 'production', VITE_API_BASE_URL: undefined });

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('VITE_API_BASE_URL');
  });

  it('does not warn when production mode has VITE_API_BASE_URL', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    validateApiBaseEnv({ MODE: 'production', VITE_API_BASE_URL: 'https://api.aaveapy.com/api' });

    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn when development mode has no VITE_API_BASE_URL', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    validateApiBaseEnv({ MODE: 'development', VITE_API_BASE_URL: undefined });

    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn when VITE_API_BASE_URL is empty string in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    validateApiBaseEnv({ MODE: 'production', VITE_API_BASE_URL: '' });

    expect(warn).not.toHaveBeenCalled();
  });
});