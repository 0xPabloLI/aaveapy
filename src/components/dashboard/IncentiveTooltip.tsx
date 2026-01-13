import { useRef, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { PoolWithSpread } from '@/types/aave';
import { formatPercent, convertAprToApy, sumAprSources, sumApyFromAprSources } from '@/lib/formatters';

interface IncentiveTooltipProps {
  pool: PoolWithSpread;
  type: 'supply' | 'borrow';
  position: { x: number; y: number };
  triggerCenterX: number;
  onClose: () => void;
  isApy?: boolean;
}

interface IncentiveSource {
  name: string;
  value: number;
  color: string;
  bgColor: string;
}

interface MerklCampaign {
  campaignApr: number;
  campaignApy: number;
  campaignStartedAt: string;
  campaignEndedAt: string;
  campaignId: string;
  opportunityLink?: string;
}

const IncentiveTooltip = ({ pool, type, position, triggerCenterX, onClose, isApy = true }: IncentiveTooltipProps) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [arrowLeft, setArrowLeft] = useState(0);

  // Get detailed incentive sources
  const getIncentiveSources = (): IncentiveSource[] => {
    const sources: IncentiveSource[] = [];

    const addSource = (name: string, value: number, color: string, bgColor: string) => {
      if (value > 0) {
        sources.push({ name, value, color, bgColor });
      }
    };

    const getAprValue = (aprSources?: Array<string | { apr: string }>) => (
      isApy ? sumApyFromAprSources(aprSources) : sumAprSources(aprSources)
    );

    const protocolAprs = type === 'supply' ? pool.supplyIncentives : pool.borrowIncentives;
    addSource('Protocol', getAprValue(protocolAprs), 'text-indigo-600', 'bg-indigo-50');

    const meritAprs = type === 'supply' ? pool.meritSupplyApr : pool.meritBorrowApr;
    addSource('Merit', getAprValue(meritAprs), 'text-purple-600', 'bg-purple-50');

    const meritSelfAprs = type === 'supply' ? pool.meritSelfSupply : pool.meritSelfBorrow;
    addSource('Merit Self', getAprValue(meritSelfAprs), 'text-purple-700', 'bg-purple-50');

    const requirementAprs = type === 'supply'
      ? pool.meritSupplyWithBorrowRequirement
      : pool.meritBorrowWithSupplyRequirement;
    addSource(
      type === 'supply' ? 'Merit (w/ Borrow Req)' : 'Merit (w/ Supply Req)',
      getAprValue(requirementAprs),
      'text-purple-600',
      'bg-purple-50',
    );

    // Merkl incentives are now handled separately with detailed breakdowns

    // Brevis incentives (percentage APR, e.g., 5 for 5%)
    const brevisApr = type === 'supply' ? pool.brevisSupplyApr : pool.brevisBorrowApr;
    if (brevisApr !== null && brevisApr !== undefined && !isNaN(brevisApr) && brevisApr > 0) {
      // Convert APR to APY if needed (using monthly compounding)
      const brevisValue = isApy ? convertAprToApy(brevisApr) : brevisApr;
      sources.push({
        name: 'Brevis',
        value: brevisValue,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
      });
    }

    return sources;
  };

  // Get Merkl campaigns with detailed breakdowns
  const getMerklCampaigns = (): MerklCampaign[] => {
    const opportunities = type === 'supply' 
      ? pool.merklSupplyOpportunities 
      : pool.merklBorrowOpportunities;
    
    if (!opportunities || !Array.isArray(opportunities)) return [];

    const campaigns: MerklCampaign[] = [];
    opportunities.forEach(opportunity => {
      if (opportunity.breakdowns && Array.isArray(opportunity.breakdowns)) {
        opportunity.breakdowns.forEach(breakdown => {
          if (breakdown.campaignApr && breakdown.campaignApr > 0) {
            campaigns.push({
              campaignApr: breakdown.campaignApr,
              campaignApy: convertAprToApy(breakdown.campaignApr),
              campaignStartedAt: breakdown.campaignStartedAt,
              campaignEndedAt: breakdown.campaignEndedAt,
              campaignId: breakdown.campaignId,
              opportunityLink: opportunity.opportunityLink,
            });
          }
        });
      }
    });

    return campaigns;
  };

  // Format date for display (e.g., "Jan 7, 2026")
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Format date range
  const formatDateRange = (start: string, end: string): string => {
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const incentiveSources = getIncentiveSources();
  const merklCampaigns = getMerklCampaigns();
  const hasDetails = incentiveSources.length > 0 || merklCampaigns.length > 0;

  useEffect(() => {
    // Use requestAnimationFrame to ensure tooltip is fully rendered before calculating
    const updateArrowPosition = () => {
      if (tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const arrowWidth = 16;
        // Calculate arrow position: trigger center X - tooltip left - arrow width / 2
        const calculatedLeft = triggerCenterX - tooltipRect.left - arrowWidth / 2;
        // Clamp arrow position to stay within tooltip bounds (with some padding)
        const minLeft = 8;
        const maxLeft = tooltipRect.width - arrowWidth - 8;
        setArrowLeft(Math.max(minLeft, Math.min(maxLeft, calculatedLeft)));
      }
    };

    // Use requestAnimationFrame to wait for DOM update
    requestAnimationFrame(() => {
      requestAnimationFrame(updateArrowPosition);
    });
  }, [triggerCenterX, position]);

  return (
    <>
      {/* Background overlay */}
      <div 
        className="fixed inset-0 z-30" 
        onClick={onClose}
      />
      {/* Tooltip content with fade-in animation */}
      <div
        ref={tooltipRef}
        className="fixed z-40 bg-white border border-gray-200 rounded-xl shadow-xl p-4 max-w-[360px] animate-in fade-in-0 zoom-in-95 duration-200"
        style={{ 
          left: `${Math.min(position.x, window.innerWidth - 360)}px`, 
          top: `${position.y + 8}px` 
        }}
      >
        {/* Upward-pointing arrow - dynamically positioned, appears as border extension */}
        <div 
          className="absolute -top-2 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"
          style={{ 
            left: `${arrowLeft}px`
          }}
        />
        <div className="flex items-start gap-3">
          {/* Content area */}
          <div className="flex-1 min-w-0">
            {/* Detailed sources */}
            {hasDetails ? (
              <div className="space-y-2 mb-3">
                {incentiveSources.map((source, index) => (
                  <div 
                    key={`${source.name}-${index}`}
                    className={`flex items-center justify-between p-2 rounded-md ${source.bgColor}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${source.color}`}>
                        {source.name}
                      </span>
                    </div>
                    <span className={`text-xs font-bold ${source.color}`}>
                      {formatPercent(source.value)}
                    </span>
                  </div>
                ))}

                {/* Merkl detailed breakdowns */}
                {merklCampaigns.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="mb-2">
                      <span className="text-xs font-semibold text-blue-600">Merkl Campaigns</span>
                    </div>
                    <div className="space-y-2">
                      {merklCampaigns.map((campaign, index) => (
                        <div 
                          key={`merkl-${campaign.campaignId}-${index}`}
                          className="p-2 rounded-md bg-blue-50 border border-blue-100"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-xs font-bold text-blue-600">
                                  {formatPercent(isApy ? campaign.campaignApy : campaign.campaignApr)}
                                </span>
                                {campaign.opportunityLink && (
                                  <a
                                    href={campaign.opportunityLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-600 hover:text-blue-800 transition-colors"
                                    title="View opportunity"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                              <p className="text-xs text-gray-600">
                                {formatDateRange(campaign.campaignStartedAt, campaign.campaignEndedAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-3">
                <p className="text-xs text-gray-500 italic">
                  No detailed breakdown available
                </p>
              </div>
            )}
            
            {/* Bottom disclaimer */}
            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
              Incentive {isApy ? 'APY' : 'APR'} is temporary and subject to change based on protocol emissions.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default IncentiveTooltip;
