import { useEffect } from "react";

/**
 * index.html ships sitewide fallback meta tags (description / og:* / twitter:*)
 * marked with data-rh="true" so non-JS social crawlers always see something.
 * On localized routes those duplicate the per-route tags rendered by Helmet,
 * so remove the static copies once the route-level head is mounted.
 */
export function useStripStaticHeadTags() {
  useEffect(() => {
    const stale = document.head.querySelectorAll('meta[data-rh="true"]');
    stale.forEach((el) => el.remove());
  }, []);
}
