import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import {
  MOBILE_SIMULATION_JUNCTION_GEOMETRY,
  getMobileSimulationJunctionFilletPaths,
} from '@/lib/mobileSimulationJunction';

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
  const filletPaths = getMobileSimulationJunctionFilletPaths(connectorOnLeft);

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
        {/* Bridge: bg-card rect covering the gap between card bottom and panel top.
             Extends well into the card to prevent subpixel seams on iOS WebKit.
             border-x continues the card's L/R borders through the gap. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute z-10 border-border/60 bg-card ${connectorOnLeft ? 'left-0 border-l' : 'right-0 border-r'}`}
          style={{
            top: MOBILE_SIMULATION_JUNCTION_GEOMETRY.bridgeTop,
            height: MOBILE_SIMULATION_JUNCTION_GEOMETRY.bridgeHeight,
            width: MOBILE_EXPANDED_COLUMN_WIDTH,
          }}
        />

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute z-10 overflow-visible"
          width={MOBILE_SIMULATION_JUNCTION_GEOMETRY.filletWidth}
          height={MOBILE_SIMULATION_JUNCTION_GEOMETRY.filletHeight}
          viewBox={`0 0 ${MOBILE_SIMULATION_JUNCTION_GEOMETRY.filletWidth} ${MOBILE_SIMULATION_JUNCTION_GEOMETRY.filletHeight}`}
          style={{
            top: MOBILE_SIMULATION_JUNCTION_GEOMETRY.filletTop,
            ...(connectorOnLeft
              ? { left: `calc(${MOBILE_EXPANDED_COLUMN_WIDTH} - 1px)` }
              : { right: `calc(${MOBILE_EXPANDED_COLUMN_WIDTH} - 1px)` }),
          }}
        >
          <path d={filletPaths.fillPath} style={{ fill: 'hsl(var(--card))' }} />
          <path
            d={filletPaths.strokePath}
            fill="none"
            style={{ stroke: 'hsl(var(--border) / 0.6)', strokeWidth: 1 }}
          />
        </svg>

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
