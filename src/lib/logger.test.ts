import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { redactText, redactValue } from '@/lib/logRedaction';
import { formatLogEntry, logger, setLogLevel } from '@/lib/logger';

describe('redactText', () => {
  it('truncates wallet addresses to prefix…last4', () => {
    const wallet = '0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314';
    expect(redactText(`positions for ${wallet} loaded`)).toBe('positions for 0x4D1c…5314 loaded');
  });

  it('fully redacts 64-hex secrets (private keys)', () => {
    const key = `0x${'ab'.repeat(32)}`;
    expect(redactText(`leak ${key}`)).toBe('leak [REDACTED_HEX_SECRET]');
  });

  it('redacts bearer tokens', () => {
    expect(redactText('auth: Bearer REDACTED_TEST_TOKEN')).toBe('auth: Bearer [REDACTED]');
  });

  it('redacts api key query params but keeps the rest of the URL', () => {
    expect(redactText('https://api.example.com/v1/data?api_key=secret123&page=2')).toBe(
      'https://api.example.com/v1/data?api_key=[REDACTED]&page=2',
    );
  });

  it('redacts emails', () => {
    expect(redactText('contact user@example.com')).toBe('contact [REDACTED_EMAIL]');
  });
});

describe('redactValue', () => {
  it('scrubs nested object strings recursively', () => {
    const value = {
      user: '0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314',
      nested: { note: 'reach me at me@example.com' },
    };
    const out = redactValue(value) as typeof value;
    expect(out.user).toBe('0x4D1c…5314');
    expect(out.nested.note).toBe('reach me at [REDACTED_EMAIL]');
  });

  it('drops values under sensitive keys entirely', () => {
    const out = redactValue({
      privateKey: '0x1234',
      Authorization: 'Bearer x',
      API_KEY: 'k-123',
      walletMnemonic: 'word word word',
      safe: 'keep me',
    }) as Record<string, string>;
    expect(out.privateKey).toBe('[REDACTED]');
    expect(out.Authorization).toBe('[REDACTED]');
    expect(out.API_KEY).toBe('[REDACTED]');
    expect(out.walletMnemonic).toBe('[REDACTED]');
    expect(out.safe).toBe('keep me');
  });

  it('redacts Error objects including stack', () => {
    const error = new Error('transfer failed for 0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314');
    const out = redactValue(error) as { name: string; message: string };
    expect(out.name).toBe('Error');
    expect(out.message).toContain('0x4D1c…5314');
    expect(out.message).not.toContain('0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314');
  });

  it('handles cycles and depth caps', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect(redactValue(a)).toEqual({ name: 'a', self: '[CYCLIC]' });

    let deep: unknown = 'leaf';
    for (let i = 0; i < 8; i++) deep = { child: deep };
    const out = redactValue(deep);
    expect(JSON.stringify(out)).toContain('[MAX_DEPTH]');
  });

  it('handles Map and Set containers', () => {
    const out = redactValue({ m: new Map([['k', '0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314']]), s: new Set([1]) });
    expect(JSON.stringify(out)).toContain('0x4D1c…5314');
    expect(JSON.stringify(out)).toContain('[1]');
  });
});

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setLogLevel('info');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats JSON lines with ts/level/msg and optional ctx', () => {
    const line = formatLogEntry('info', 'markets fetched', { chain: 'arbitrum' }, 'json');
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('markets fetched');
    expect(parsed.ctx).toEqual({ chain: 'arbitrum' });
    expect(typeof parsed.ts).toBe('string');
  });

  it('omits ctx when no context is given (JSON)', () => {
    const parsed = JSON.parse(formatLogEntry('info', 'boot', undefined, 'json'));
    expect(parsed.ctx).toBeUndefined();
  });

  it('formats compact lines for development consoles', () => {
    expect(formatLogEntry('warn', 'cache miss', { chain: 'base' }, 'compact')).toBe(
      '[WARN] cache miss {"chain":"base"}',
    );
    expect(formatLogEntry('info', 'boot', undefined, 'compact')).toBe('[INFO] boot');
  });

  it('scrubs context before emitting', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('wallet action', { wallet: '0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314' });
    const emitted = warnSpy.mock.calls[0][0] as string;
    expect(emitted).not.toContain('0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314');
    expect(emitted).toContain('0x4D1c…5314');
  });

  it('filters below the minimum level and honors overrides', () => {
    logger.debug('noisy trace');
    expect(logSpy).not.toHaveBeenCalled();

    setLogLevel('debug');
    logger.debug('now visible');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
