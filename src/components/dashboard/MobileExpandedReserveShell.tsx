import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const MOBILE_EXPANDED_CONNECTOR_TOP = 'calc(-1 * var(--ds-space-2))';
const MOBILE_EXPANDED_CONNECTOR_HEIGHT = 'calc(var(--ds-space-2) + 1px)';
const MOBILE_EXPANDED_COLUMN_WIDTH = 'calc((100% - var(--ds-space-2)) / 2)';

type MobileExpandedReserveShellProps = {
  side: 'left' | 'right';
  upper: ReactNode;
  sibling?: ReactNode;
  panel: ReactNode;
};

export default function MobileExpandedReserveShell({
  side,
  upper,
  sibling,
  panel,
}: MobileExpandedReserveShellProps) {
  const connectorOnLeft = side === 'left';

  return (
    <div className="col-span-2" data-mobile-expanded-shell="true">
      <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
        {connectorOnLeft ? (
          <>
            <div className="min-w-0">{upper}</div>
            {sibling ? <div className="min-w-0">{sibling}</div> : null}
          </>
        ) : (
          <>
            {sibling ? <div className="min-w-0">{sibling}</div> : <div aria-hidden="true" className="min-w-0" />}
            <div className="min-w-0">{upper}</div>
          </>
        )}
      </div>

      <div className="relative isolate mt-[var(--ds-space-2)]" data-mobile-expanded-connector="true">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 bg-card"
          style={{
            top: MOBILE_EXPANDED_CONNECTOR_TOP,
            height: MOBILE_EXPANDED_CONNECTOR_HEIGHT,
            width: MOBILE_EXPANDED_COLUMN_WIDTH,
            ...(connectorOnLeft ? { left: 0 } : { right: 0 }),
          }}
        />
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute z-10 w-px bg-border/60',
            connectorOnLeft ? 'left-0' : 'right-0',
          )}
          style={{
            top: MOBILE_EXPANDED_CONNECTOR_TOP,
            height: MOBILE_EXPANDED_CONNECTOR_HEIGHT,
          }}
        />
        <div
          className={cn(
            'relative z-0 overflow-hidden rounded-b-xl border border-border/60 bg-card ds-card-pad-sm',
            connectorOnLeft ? 'rounded-tl-none rounded-tr-xl' : 'rounded-tr-none rounded-tl-xl',
          )}
          style={{ paddingTop: 'var(--ds-space-2)' }}
        >
          {panel}
        </div>
      </div>
    </div>
  );
}
