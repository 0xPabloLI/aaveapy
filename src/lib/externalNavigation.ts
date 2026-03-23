/**
 * Opens external URLs in the current tab on mobile (avoids an extra browser tab on iOS/Safari),
 * or in a new tab on desktop.
 */
export function openExternalUrl(url: string | null | undefined, isMobile: boolean): void {
  if (!url) return;
  if (isMobile) {
    window.location.assign(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** Use on `<a href={...}>`: mobile = same tab, desktop = new tab. */
export function externalLinkTabProps(isMobile: boolean): {
  target?: '_blank';
  rel: 'noopener noreferrer';
} {
  return isMobile
    ? { rel: 'noopener noreferrer' }
    : { target: '_blank', rel: 'noopener noreferrer' };
}
