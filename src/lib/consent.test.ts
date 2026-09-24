// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_DENY_ALL, bootstrapAnalytics, getConsent, hasResponded, setConsent } from '@/lib/consent';

const STORAGE_KEY = 'aaveapy:consent-v2';

describe('consent', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts with no decision', () => {
    expect(getConsent()).toBeNull();
    expect(hasResponded()).toBe(false);
  });

  it('persists grant and updates Consent Mode signals', () => {
    const gtag = vi.fn();
    (window as unknown as { gtag: typeof gtag }).gtag = gtag;

    setConsent('granted');

    expect(getConsent()?.analytics).toBe('granted');
    expect(hasResponded()).toBe(true);
    expect(gtag).toHaveBeenCalledWith('consent', 'update', {
      ...CONSENT_DENY_ALL,
      analytics_storage: 'granted',
    });
  });

  it('persists denial without loading gtag.js', () => {
    const gtag = vi.fn();
    (window as unknown as { gtag: typeof gtag }).gtag = gtag;
    const appendSpy = vi.spyOn(document.head, 'appendChild');

    const injectedScripts = (src: HTMLScriptElement[][]) =>
      src.filter((c) => String((c[0] as unknown as HTMLScriptElement)?.src ?? '').includes('googletagmanager'));

    setConsent('denied');

    expect(getConsent()?.analytics).toBe('denied');
    expect(gtag).toHaveBeenCalledWith('consent', 'update', expect.objectContaining({ analytics_storage: 'denied' }));
    // Privacy-max: no Google script is injected on denial.
    expect(injectedScripts(appendSpy.mock.calls as unknown as HTMLScriptElement[][])).toHaveLength(0);
  });

  it('bootstrapAnalytics loads gtag.js only for granted visitors', () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild');

    bootstrapAnalytics();
    const injectedFirst = appendSpy.mock.calls.filter((c) =>
      String((c[0] as unknown as HTMLScriptElement)?.src ?? '').includes('googletagmanager'),
    ).length;
    expect(injectedFirst).toBe(0);

    setConsent('granted');
    // setConsent already loaded the script once; bootstrap must not double-load.
    const before = appendSpy.mock.calls.filter((c) =>
      String((c[0] as unknown as HTMLScriptElement)?.src ?? '').includes('googletagmanager'),
    ).length;
    bootstrapAnalytics();
    const after = appendSpy.mock.calls.filter((c) =>
      String((c[0] as unknown as HTMLScriptElement)?.src ?? '').includes('googletagmanager'),
    ).length;
    expect(after).toBe(before);
  });

  it('treats malformed stored state as not responded', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken json');
    expect(getConsent()).toBeNull();
    expect(hasResponded()).toBe(false);
  });
});
