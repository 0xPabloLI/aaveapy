import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { PoolWithSpread, MeritIncentive, MerklOpportunityGroup, BrevisIncentive } from '@/types/aave';
import { formatPercent, convertAprToApy } from '@/lib/formatters';
import { useIsMobile } from '@/hooks/use-mobile';

interface IncentiveTooltipProps {
  pool: PoolWithSpread;
  type: 'supply' | 'borrow';
  position: { x: number; y: number };
  triggerCenterX: number;
  onClose: () => void;
  isApy?: boolean;
  usePortal?: boolean;
}

interface IncentiveSource {
  name: string;
  value: number;
  color: string;
  bgColor: string;
  sourceType?: 'Protocol' | 'ACI' | 'Merkl' | 'Brevis';
  link?: string;
  dateRange?: string;
  message?: string | Record<string, unknown> | unknown[];
  requiredTokens?: string[] | string;
}

const sourceIconMap: Record<NonNullable<IncentiveSource['sourceType']>, string> = {
  Protocol: '/icons/tokens/aave.svg',
  Brevis: '/icons/partners/brevis.svg',
  Merkl: '/icons/partners/merkl-black.svg',
  ACI: '/icons/partners/aci-black.svg',
};

const getSourceIcon = (sourceType?: IncentiveSource['sourceType']) =>
  sourceType && sourceType !== 'Protocol' ? sourceIconMap[sourceType] : null;

const IncentiveTooltip = ({ pool, type, position, triggerCenterX, onClose, isApy = true, usePortal = false }: IncentiveTooltipProps) => {
  const isMobile = useIsMobile();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [arrowLeft, setArrowLeft] = useState(0);
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const numberMatch = /^(\d+(?:\.\d+)?%?)$/;
  const currencyMatch = /^[€$£¥]$/;
  const highlightMatch = /^([€$£¥]?\d+(?:\.\d+)?%?|[€$£¥])$/;
  const renderHighlightedText = (text: string) => (
    <>
      {text.split(/([€$£¥]?\d+(?:\.\d+)?%?|[€$£¥])/g).map((part, index) =>
        highlightMatch.test(part) && (numberMatch.test(part) || currencyMatch.test(part) || /^[€$£¥]\d/.test(part)) ? (
          <span key={`num-${index}`} className="font-semibold text-gray-900">
            {part}
          </span>
        ) : (
          <span key={`txt-${index}`}>{part}</span>
        )
      )}
    </>
  );
  const tooltipSurfaceStyle = {
    backgroundImage: [
      'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.98))',
      'radial-gradient(900px 220px at 5% -10%, rgba(255, 196, 0, 0.10), transparent 60%)',
      'radial-gradient(700px 220px at 100% 0%, rgba(14, 116, 144, 0.10), transparent 55%)',
      'linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
      'linear-gradient(0deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
    ].join(', '),
    backgroundSize: 'auto, auto, auto, 18px 18px, 18px 18px',
  } as const;

  // Format date for display (e.g., "Jan 7, 2026"), safe for invalid values
  const formatDate = (dateString?: string): string | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDateRange = (start?: string, end?: string): string | null => {
    const startText = formatDate(start);
    const endText = formatDate(end);
    if (!startText || !endText) return null;
    return `${startText} - ${endText}`;
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  };

  const getMessageLines = (message?: string | Record<string, unknown>): string[] => {
    if (!message) return [];
    if (typeof message === 'string') return [message];
    if (Array.isArray(message)) {
      return message
        .map((item) => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item) {
            const values = Object.values(item as Record<string, unknown>)
              .map((entry) => formatValue(entry))
              .filter(Boolean);
            return values.length > 0 ? values.join(': ') : '';
          }
          return '';
        })
        .filter(Boolean);
    }
    const values = Object.values(message)
      .map((entry) => formatValue(entry))
      .filter(Boolean);
    if (values.length === 0) return [];
    return [values.join(': ')];
  };

  const getMerklLink = (opportunity: MerklOpportunityGroup): string | undefined => {
    return opportunity.link || opportunity.opportunityLink;
  };

  // Get detailed incentive sources (unified layout)
  const getIncentiveSources = (): IncentiveSource[] => {
    const sources: IncentiveSource[] = [];

    // Protocol incentives (number array)
    const protocolIncentives = type === 'supply' ? pool.supplyIncentives : pool.borrowIncentives;
    if (protocolIncentives && Array.isArray(protocolIncentives) && protocolIncentives.length > 0) {
      const totalProtocol = protocolIncentives.reduce((sum, apr) => {
        if (!isNaN(apr) && apr > 0) {
          return sum + (isApy ? convertAprToApy(apr) : apr);
        }
        return sum;
      }, 0);
      if (totalProtocol > 0) {
        sources.push({
          name: 'Protocol Incentive',
          value: totalProtocol,
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50',
          sourceType: 'Protocol',
        });
      }
    }

    // Merit incentives (MeritIncentive array)
    const meritIncentives: MeritIncentive[] | undefined = type === 'supply' ? pool.meritSupplys : pool.meritBorrows;
    if (meritIncentives && Array.isArray(meritIncentives)) {
      meritIncentives.forEach((merit, index) => {
        const apr = merit.apr;
        const selfApr = merit.selfApr || 0;
        
        // Convert each APR to APY separately then sum (convertAprToApy is non-linear)
        let totalValue = 0;
        if (isApy) {
          if (!isNaN(apr) && apr > 0) {
            totalValue += convertAprToApy(apr);
          }
          if (!isNaN(selfApr) && selfApr > 0) {
            totalValue += convertAprToApy(selfApr);
          }
        } else {
          // For APR mode, just sum the APR values
          totalValue = (!isNaN(apr) && apr > 0 ? apr : 0) + (!isNaN(selfApr) && selfApr > 0 ? selfApr : 0);
        }
        
        if (totalValue > 0) {
          const name = merit.name
            ? merit.name
            : meritIncentives.length > 1 
              ? `ACI Incentive ${index + 1}`
              : 'ACI Incentive';

          sources.push({
            name,
            value: totalValue,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            sourceType: 'ACI',
            link: merit.link,
            message: merit.message,
            dateRange: formatDateRange(merit.startDate, merit.endDate) || undefined,
            requiredTokens: merit.requiredBorrowTokens || merit.requiredSupplyTokens,
          });
        }
      });
    }

    // Brevis incentives (array, fallback to legacy single APR)
    const brevisIncentives: BrevisIncentive[] | undefined =
      type === 'supply' ? pool.brevisSupplys : pool.brevisBorrows;
    const brevisLegacyApr = type === 'supply' ? pool.brevisSupplyApr : pool.brevisBorrowApr;

    if (brevisIncentives && Array.isArray(brevisIncentives) && brevisIncentives.length > 0) {
      brevisIncentives.forEach((brevis) => {
        const apr = brevis.apr;
        if (!isNaN(apr) && apr > 0) {
          sources.push({
            name: brevis.name || 'Brevis Incentive',
            value: isApy ? convertAprToApy(apr) : apr,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            sourceType: 'Brevis',
            link: brevis.link,
            dateRange: formatDateRange(brevis.startDate, brevis.endDate) || undefined,
          });
        }
      });
    } else if (brevisLegacyApr !== null && brevisLegacyApr !== undefined && !isNaN(brevisLegacyApr) && brevisLegacyApr > 0) {
      const brevisValue = isApy ? convertAprToApy(brevisLegacyApr) : brevisLegacyApr;
      sources.push({
        name: 'Brevis Incentive',
        value: brevisValue,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        sourceType: 'Brevis',
      });
    }

    // Merkl incentives (use breakdowns for date range)
    const opportunities = type === 'supply' ? pool.merklSupplys : pool.merklBorrows;
    if (opportunities && Array.isArray(opportunities)) {
      opportunities.forEach((opportunity) => {
        if (!opportunity.breakdowns || !Array.isArray(opportunity.breakdowns)) return;
        opportunity.breakdowns.forEach((breakdown) => {
          const apr = breakdown.campaignApr;
          if (!isNaN(apr) && apr > 0) {
            sources.push({
              name: opportunity.name || 'Merkl Incentive',
              value: isApy ? convertAprToApy(apr) : apr,
              color: 'text-blue-600',
              bgColor: 'bg-blue-50',
              sourceType: 'Merkl',
              link: getMerklLink(opportunity),
              message: opportunity.message,
              dateRange: formatDateRange(breakdown.campaignStartedAt, breakdown.campaignEndedAt) || undefined,
            });
          }
        });
      });
    }

    return sources;
  };


  const incentiveSources = getIncentiveSources();
  const hasDetails = incentiveSources.length > 0;

  useEffect(() => {
    // Use requestAnimationFrame to ensure tooltip is fully rendered before calculating
    const updateArrowPosition = () => {
      if (tooltipRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const arrowWidth = 16;
        // Calculate arrow position: trigger center X - tooltip left - arrow width / 2
        const calculatedLeft = triggerCenterX - tooltipRect.left - arrowWidth / 2;
        // Clamp arrow position to stay within tooltip bounds (with some padding)
        const minLeft = 12;
        const maxLeft = tooltipRect.width - arrowWidth - 12;
        setArrowLeft(Math.max(minLeft, Math.min(maxLeft, calculatedLeft)));
      }
    };

    // Use requestAnimationFrame to wait for DOM update
    requestAnimationFrame(() => {
      requestAnimationFrame(updateArrowPosition);
    });
  }, [triggerCenterX, position]);

  // Mobile: bottom sheet style
  if (isMobile) {
    const content = (
      <>
        {/* Background overlay */}
        <div 
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200" 
          onClick={onClose}
        />
        {/* Bottom sheet */}
        <div
          ref={tooltipRef}
          className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border border-black/10 shadow-[0_-24px_60px_-40px_rgba(0,0,0,0.35)] animate-in slide-in-from-bottom duration-300 max-h-[80vh] overflow-y-auto"
          style={tooltipSurfaceStyle}
        >
          {/* Handle bar */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-[var(--ds-space-4)] py-[var(--ds-space-3)] flex items-center justify-between z-10">
            <h3 className="ds-tooltip-title text-gray-900">
              {type === 'supply' ? 'Supply' : 'Borrow'} Incentive Details
            </h3>
            <button
              onClick={onClose}
              className="p-[var(--ds-space-1-5)] rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          <div className="ds-tooltip-pad pt-[var(--ds-space-3)] pb-[var(--ds-space-3)]">
            {/* Detailed sources */}
            {hasDetails ? (
              <div className="divide-y divide-gray-200/70 my-[var(--ds-space-2)]">
                {incentiveSources.map((source, index) => (
                  <div 
                    key={`${source.name}-${index}`}
                    className="ds-tooltip-item relative px-[var(--ds-space-2)] py-[var(--ds-space-1)] animate-in fade-in-0"
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    {(() => {
                      const valueClass = 'ds-tooltip-title text-gray-900';
                      const linkClass = 'text-gray-500 hover:text-gray-700 transition-colors';
                      const iconSrc = source.sourceType ? getSourceIcon(source.sourceType) : null;
                      const isBrevis = source.sourceType === 'Brevis';
                      const isWordmark = source.sourceType === 'Brevis' || source.sourceType === 'ACI' || source.sourceType === 'Merkl';
                      return (
                        <div className="flex items-center justify-between gap-[var(--ds-space-2)] mb-[var(--ds-space-1)]">
                          <div className="flex items-center gap-[var(--ds-space-1-5)] min-w-0 flex-1 pr-1">
                            {iconSrc && (
                              <span
                                className={`flex items-center justify-center rounded-md ring-1 ring-black/10 shadow-sm flex-shrink-0 bg-gray-50 ${
                                  isWordmark ? 'h-5 min-w-[44px] px-2' : 'h-5 w-5'
                                }`}
                              >
                                <img
                                  src={iconSrc}
                                  alt={`${source.sourceType} logo`}
                                  title={source.sourceType}
                                  className={isWordmark ? 'h-3.5 w-auto max-w-[56px]' : 'h-3.5 w-3.5'}
                                  loading="lazy"
                                />
                              </span>
                            )}
                            {isBrevis && !iconSrc && (
                              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-700 flex-shrink-0">
                                Brevis
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="ds-tooltip-title text-gray-900 truncate max-w-[220px] block">
                                {source.name}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-[var(--ds-space-1-5)] flex-shrink-0">
                            {source.link && (
                              <a
                                href={source.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={`${linkClass} flex items-center justify-center rounded-full border border-current/25 p-1.5 text-[10px] font-semibold`}
                                title="View details"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <span className={`${valueClass} whitespace-nowrap`}>
                              {formatPercent(source.value)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                    {source.dateRange && (
                      <p className="ds-tooltip-body text-gray-600 mt-[var(--ds-space-1)] break-words">
                        {source.dateRange}
                      </p>
                    )}
                    {getMessageLines(source.message).map((line, lineIndex) => (
                      <p key={`message-${index}-${lineIndex}`} className="ds-tooltip-body text-gray-600 mt-[var(--ds-space-1)] break-words">
                        {renderHighlightedText(line)}
                      </p>
                    ))}
                    {source.requiredTokens && (
                      <p className="ds-tooltip-body text-gray-500 mt-[var(--ds-space-1)] break-words">
                        Requires: {renderHighlightedText(Array.isArray(source.requiredTokens) ? source.requiredTokens.join(', ') : source.requiredTokens)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-[var(--ds-space-2)]">
                <p className="ds-tooltip-body text-gray-500 italic">
                  No detailed breakdown available
                </p>
              </div>
            )}
            
          </div>
        </div>
      </>
    );
    if (usePortal && portalTarget) {
      return createPortal(content, portalTarget);
    }
    return content;
  }

  // Desktop: tooltip style
  const content = (
    <>
      {/* Background overlay */}
      <div 
        className="fixed inset-0 z-30" 
        onClick={onClose}
      />
      {/* Tooltip content with fade-in animation */}
      <div
        ref={tooltipRef}
        className="fixed z-40 rounded-xl border border-black/10 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.35)] ds-tooltip-pad max-w-[360px] w-[360px] animate-in fade-in-0 zoom-in-95 duration-200"
        style={{ 
          left: `${Math.max(16, Math.min(position.x, window.innerWidth - 376))}px`, 
          top: `${position.y + 8}px`,
          ...tooltipSurfaceStyle,
        }}
      >
        {/* Upward-pointing arrow - dynamically positioned, appears as border extension */}
        <div 
          className="absolute -top-2 w-4 h-4 border-l border-t border-black/10 transform rotate-45"
          style={{ 
            left: `${arrowLeft}px`,
            backgroundImage: tooltipSurfaceStyle.backgroundImage,
            backgroundSize: tooltipSurfaceStyle.backgroundSize,
          }}
        />
        {/* Content area */}
        <div className="w-full min-w-0">
          {/* Detailed sources */}
          {hasDetails ? (
            <div className="divide-y divide-gray-200/70 my-[var(--ds-space-2)]">
              {incentiveSources.map((source, index) => (
                  <div 
                    key={`${source.name}-${index}`}
                    className="ds-tooltip-item relative px-[var(--ds-space-2)] py-[var(--ds-space-1)] animate-in fade-in-0"
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    {(() => {
                      const valueClass = 'ds-tooltip-title text-gray-900';
                      const linkClass = 'text-gray-500 hover:text-gray-700 transition-colors';
                      const iconSrc = source.sourceType ? getSourceIcon(source.sourceType) : null;
                      const isBrevis = source.sourceType === 'Brevis';
                      const isWordmark = source.sourceType === 'Brevis' || source.sourceType === 'ACI' || source.sourceType === 'Merkl';
                      return (
                        <div className="flex items-center justify-between gap-[var(--ds-space-2)] mb-[var(--ds-space-1)]">
                          <div className="flex items-center gap-[var(--ds-space-1-5)] min-w-0 flex-1 pr-1">
                            {iconSrc && (
                              <span
                                className={`flex items-center justify-center rounded-md ring-1 ring-black/10 shadow-sm flex-shrink-0 bg-gray-50 ${
                                  isWordmark ? 'h-5 min-w-[44px] px-2' : 'h-5 w-5'
                                }`}
                              >
                                <img
                                  src={iconSrc}
                                  alt={`${source.sourceType} logo`}
                                  title={source.sourceType}
                                  className={isWordmark ? 'h-3.5 w-auto max-w-[56px]' : 'h-3.5 w-3.5'}
                                  loading="lazy"
                                />
                              </span>
                            )}
                            {isBrevis && !iconSrc && (
                              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-700 flex-shrink-0">
                                Brevis
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="ds-tooltip-title text-gray-900 truncate max-w-[220px] block">
                                {source.name}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-[var(--ds-space-1-5)] flex-shrink-0">
                            {source.link && (
                              <a
                                href={source.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={`${linkClass} flex items-center justify-center rounded-full border border-current/25 p-1.5 text-[10px] font-semibold`}
                                title="View details"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <span className={`${valueClass} whitespace-nowrap`}>
                              {formatPercent(source.value)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  {source.dateRange && (
                    <p className="ds-tooltip-body text-gray-600 mt-[var(--ds-space-1)] break-words">
                      {source.dateRange}
                    </p>
                  )}
                  {getMessageLines(source.message).map((line, lineIndex) => (
                    <p key={`message-desktop-${index}-${lineIndex}`} className="ds-tooltip-body text-gray-600 mt-[var(--ds-space-1)] break-words">
                      {renderHighlightedText(line)}
                    </p>
                  ))}
                  {source.requiredTokens && (
                    <p className="ds-tooltip-body text-gray-500 mt-[var(--ds-space-1)] break-words">
                      Requires: {renderHighlightedText(Array.isArray(source.requiredTokens) ? source.requiredTokens.join(', ') : source.requiredTokens)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-[var(--ds-space-2)]">
              <p className="ds-tooltip-body text-gray-500 italic">
                No detailed breakdown available
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
  if (usePortal && portalTarget) {
    return createPortal(content, portalTarget);
  }
  return content;
};

export default IncentiveTooltip;
