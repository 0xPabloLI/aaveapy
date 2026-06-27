import { describe, expect, it, vi, beforeEach } from 'vitest';
import { validateApiBaseEnv, isMissingApiBase } from './apiBase';

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

  it('warns when VITE_API_BASE_URL is empty string in production (treated as missing)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    validateApiBaseEnv({ MODE: 'production', VITE_API_BASE_URL: '' });

    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns when VITE_API_BASE_URL is null in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    validateApiBaseEnv({ MODE: 'production', VITE_API_BASE_URL: null as unknown as string });

    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('isMissingApiBase', () => {
  it('returns true for null', () => {
    expect(isMissingApiBase(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isMissingApiBase(undefined)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isMissingApiBase('')).toBe(true);
  });

  it('returns true for whitespace-only string', () => {
    expect(isMissingApiBase('   ')).toBe(true);
  });

  it('returns false for a valid URL', () => {
    expect(isMissingApiBase('https://api.aaveapy.com/api')).toBe(false);
  });

  it('returns false for "0"', () => {
    expect(isMissingApiBase('0')).toBe(false);
  });

  it('returns false for "/"', () => {
    expect(isMissingApiBase('/')).toBe(false);
  });
});
