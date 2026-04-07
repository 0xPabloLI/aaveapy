import IncentiveTooltip from './IncentiveTooltip';
import type { ReserveWithSpread } from '@/types/aave';

export interface TooltipState {
  reserve: ReserveWithSpread;
  type: 'supply' | 'borrow';
  position: { x: number; y: number };
  triggerCenterX: number;
  triggerHeight: number;
  triggerRect: { top: number; bottom: number; left: number; right: number; width: number; height: number };
}

interface ReservesTableTooltipOverlayProps {
  tooltipState: TooltipState | null;
  onClose: () => void;
  isApy: boolean;
  tydroPointToUsdRate: number;
  whitelistMerklCampaignIds: ReadonlySet<string>;
  onToggleWhitelistMerklCampaign: (campaignId: string, enabled: boolean) => void;
}

export default function ReservesTableTooltipOverlay({
  tooltipState,
  onClose,
  isApy,
  tydroPointToUsdRate,
  whitelistMerklCampaignIds,
  onToggleWhitelistMerklCampaign,
}: ReservesTableTooltipOverlayProps) {
  if (!tooltipState) return null;
  return (
    <IncentiveTooltip
      reserve={tooltipState.reserve}
      type={tooltipState.type}
      position={tooltipState.position}
      triggerCenterX={tooltipState.triggerCenterX}
      triggerHeight={tooltipState.triggerHeight}
      triggerRect={tooltipState.triggerRect}
      accentTextClass={tooltipState.type === 'supply' ? 'ds-text-emerald-600' : 'ds-text-brand-cyan'}
      accentBgClass={tooltipState.type === 'supply' ? 'ds-bg-emerald-500-10' : 'ds-bg-brand-cyan-10'}
      onClose={onClose}
      isApy={isApy}
      tydroPointToUsdRate={tydroPointToUsdRate}
      whitelistMerklCampaignIds={whitelistMerklCampaignIds}
      onToggleWhitelistMerklCampaign={onToggleWhitelistMerklCampaign}
    />
  );
}
