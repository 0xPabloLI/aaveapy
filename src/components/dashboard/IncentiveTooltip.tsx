import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { useTheme } from 'next-themes';
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
  accentBorderClass?: string;
  accentTextClass?: string;
  accentBgClass?: string;
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

const lightSourceIconMap: Record<NonNullable<IncentiveSource['sourceType']>, string> = {
  Protocol: '/icons/tokens/aave.svg',
  Brevis: '/icons/partners/brevis-black.svg',
  Merkl: '/icons/partners/merkl-black.svg',
  ACI: '/icons/partners/aci-black.svg',
};

const darkSourceIconMap: Record<NonNullable<IncentiveSource['sourceType']>, string> = {
  Protocol: '/icons/tokens/aave.svg',
  Brevis: '/icons/partners/brevis-white.svg',
  Merkl: '/icons/partners/merkl-white.svg',
  ACI: '/icons/partners/aci-white.svg',
};

const getSourceIcon = (
  sourceType?: IncentiveSource['sourceType'],
  isDark?: boolean
) => {
  if (!sourceType || sourceType === 'Protocol') return null;
  const map = isDark ? darkSourceIconMap : lightSourceIconMap;
  return map[sourceType];
};

const IncentiveTooltip = ({
  pool,
  type,
  position,
  triggerCenterX,
  onClose,
  isApy = true,
  usePortal = false,
  accentBorderClass,
  accentTextClass,
  accentBgClass,
}: IncentiveTooltipProps) => {
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [arrowLeft, setArrowLeft] = useState(0);
  const [tooltipLeft, setTooltipLeft] = useState<number | null>(null);
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const numberMatch = /^(\d+(?:\.\d+)?%?)$/;
  const currencyMatch = /^[€$£¥]$/;
  const highlightMatch = /^([€$£¥]?\d+(?:\.\d+)?%?|[€$£¥])$/;
  type MessageLine = { text: string; emphasizePrefix?: boolean };
  const renderHighlightedText = (text: string) => (
    <>
      {text.split(/([€$£¥]?\d+(?:\.\d+)?%?|[€$£¥])/g).map((part, index) =>
        highlightMatch.test(part) && (numberMatch.test(part) || currencyMatch.test(part) || /^[€$£¥]\d/.test(part)) ? (
          <span key={`num-${index}`} className="font-semibold text-foreground">
            {part}
          </span>
        ) : (
          <span key={`txt-${index}`}>{part}</span>
        )
      )}
    </>
  );
  const renderMessageLine = (line: MessageLine, accentClass: string) => {
    if (!line.emphasizePrefix) return renderHighlightedText(line.text);
    const colonIndex = line.text.indexOf(':');
    if (colonIndex === -1) return renderHighlightedText(line.text);
    const prefix = line.text.slice(0, colonIndex + 1);
    const rest = line.text.slice(colonIndex + 1).trimStart();
    return (
      <>
        <span className={`font-semibold ${accentClass}`}>{prefix}</span>
        {rest ? <span className="ml-1">{renderHighlightedText(rest)}</span> : null}
      </>
    );
  };
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

  const getMessageLines = (message?: string | Record<string, unknown> | unknown[]): MessageLine[] => {
    if (!message) return [];
    const filterLines = (lines: MessageLine[]) =>
      lines.filter((line) => !line.text.toLowerCase().includes('require_multiple'));
    if (typeof message === 'string') return filterLines([{ text: message }]);
    if (Array.isArray(message)) {
      return filterLines(
        message
          .map((item) => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item) {
              const values = Object.values(item as Record<string, unknown>)
                .map((entry) => formatValue(entry))
                .filter(Boolean);
              return values.length > 0
                ? { text: values.join(': '), emphasizePrefix: values.length > 1 }
                : '';
            }
            return '';
          })
          .filter(Boolean)
          .map((item) => (typeof item === 'string' ? { text: item } : item))
      );
    }
    const values = Object.values(message)
      .map((entry) => formatValue(entry))
      .filter(Boolean);
    if (values.length === 0) return [];
    return filterLines([{ text: values.join(': '), emphasizePrefix: values.length > 1 }]);
  };

  const accentClass =
    accentBorderClass ??
    (type === 'supply'
      ? 'border-l-[3px] border-l-[rgb(var(--ds-emerald-500-rgb)/0.35)]'
      : 'border-l-[3px] border-l-[rgb(var(--ds-brand-cyan-rgb)/0.35)]');
  const valueAccentClass =
    accentTextClass ?? (type === 'supply' ? 'ds-text-emerald-600' : 'ds-text-brand-cyan');
  const valueBgClass =
    accentBgClass ?? (type === 'supply' ? 'ds-bg-emerald-500-10' : 'ds-bg-brand-cyan-10');
  const isDark = resolvedTheme === 'dark';
  const tooltipSurfaceStyle = {
    backgroundColor: 'hsl(var(--card))',
    backgroundImage: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card)))',
  } as const;

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
          color: 'text-foreground',
          bgColor: 'bg-muted/60',
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
            color: 'text-foreground',
            bgColor: 'bg-muted/60',
            sourceType: 'ACI',
            link: merit.link,
            message: merit.message,
            dateRange: formatDateRange(merit.startDate, merit.endDate) || undefined,
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
            color: 'text-foreground',
            bgColor: 'bg-muted/60',
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
        color: 'text-foreground',
        bgColor: 'bg-muted/60',
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
              color: 'text-foreground',
              bgColor: 'bg-muted/60',
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

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (!tooltipRef.current) return;
      const tooltipWidth = tooltipRef.current.offsetWidth;
      const minLeft = 16;
      const maxLeft = Math.max(minLeft, window.innerWidth - tooltipWidth - minLeft);
      const baseLeft = type === 'borrow' ? triggerCenterX - tooltipWidth + 24 : position.x;
      const nextLeft = Math.min(Math.max(baseLeft, minLeft), maxLeft);
      setTooltipLeft(nextLeft);

      const arrowWidth = 16;
      const calculatedLeft = triggerCenterX - nextLeft - arrowWidth / 2;
      const maxArrowLeft = tooltipWidth - arrowWidth - 12;
      setArrowLeft(Math.max(12, Math.min(maxArrowLeft, calculatedLeft)));
    };

    // Use double RAF to ensure layout is complete, but store both IDs for cleanup
    let innerRafId: number | null = null;
    const outerRafId = requestAnimationFrame(() => {
      innerRafId = requestAnimationFrame(updatePosition);
    });

    window.addEventListener('resize', updatePosition);

    return () => {
      cancelAnimationFrame(outerRafId);
      if (innerRafId !== null) {
        cancelAnimationFrame(innerRafId);
      }
      window.removeEventListener('resize', updatePosition);
    };
  }, [triggerCenterX, position, type]);

  // Mobile: bottom sheet style
  if (isMobile) {
    const content = (
      <>
        {/* Background overlay with smooth fade */}
        <div 
          className="fixed inset-0 z-30 bg-background/20 backdrop-blur-[2px] animate-in fade-in-0 duration-300 ease-out" 
          onClick={onClose}
        />
        {/* Bottom sheet with spring-like animation */}
        <div
          ref={tooltipRef}
          className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border border-border/60 bg-card ds-tooltip-shadow-up animate-in slide-in-from-bottom-4 fade-in-0 duration-300 ease-out max-h-[80vh] overflow-y-auto"
          style={tooltipSurfaceStyle}
        >
          {/* Handle bar */}
          <div className="sticky top-0 bg-card border-b border-border px-[var(--ds-space-4)] py-[var(--ds-space-3)] flex items-center justify-between z-10">
            <h3 className="ds-tooltip-title text-foreground">
              {type === 'supply' ? 'Supply' : 'Borrow'} Incentive Details
            </h3>
            <button
              onClick={onClose}
              className="p-[var(--ds-space-1-5)] rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          <div className="ds-tooltip-pad pt-[var(--ds-space-3)] pb-[var(--ds-space-3)]">
            {/* Detailed sources */}
            {hasDetails ? (
              <div className="divide-y divide-border/40 my-[var(--ds-space-2)]">
                {incentiveSources.map((source, index) => {
                  const messageLines = getMessageLines(source.message);
                  const valueClass = `ds-tooltip-title ${valueAccentClass}`;
                  const linkClass = `${valueAccentClass} ${valueBgClass} transition-opacity opacity-80 hover:opacity-100`;
                  const iconSrc = source.sourceType ? getSourceIcon(source.sourceType, isDark) : null;
                  const isBrevis = source.sourceType === 'Brevis';
                  const isWordmark = source.sourceType === 'Brevis' || source.sourceType === 'ACI' || source.sourceType === 'Merkl';
                  const logoWrapperClass = isWordmark ? 'min-w-[44px] px-[6px] py-[5px]' : 'h-[20px] w-[20px]';
                  const logoClass = isWordmark ? 'h-[11px] w-auto max-w-[60px]' : 'h-[11px] w-[11px]';
                  return (
                    <div 
                      key={`${source.name}-${index}`}
                      className={`ds-tooltip-item relative px-[var(--ds-space-2)] py-[var(--ds-space-1)] ${accentClass}`}
                    >
                      <div className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-1)]">
                        <div className="flex items-center gap-[var(--ds-space-1-5)] min-w-0 flex-1 pr-1">
                          {iconSrc && (
                            <span
                              className={`flex items-center justify-center rounded-md ring-1 ring-border/50 shadow-sm flex-shrink-0 bg-muted/60 ${logoWrapperClass}`}
                            >
                              <img
                                src={iconSrc}
                                alt={`${source.sourceType} logo`}
                                title={source.sourceType}
                                className={logoClass}
                                loading="lazy"
                              />
                            </span>
                          )}
                          {isBrevis && !iconSrc && (
                            <span className="ds-text-9 font-semibold uppercase tracking-[0.22em] text-foreground/80 flex-shrink-0">
                              Brevis
                            </span>
                          )}
                          <span className="ds-tooltip-title text-foreground break-words block min-w-0">
                            {source.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-[var(--ds-space-1-5)] flex-shrink-0">
                          {source.link && (
                            <a
                              href={source.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`${linkClass} flex h-7 w-7 items-center justify-center rounded-full transition-opacity opacity-80 hover:opacity-100 focus:outline-none focus-visible:outline-none focus-visible:ring-0`}
                              title="Open link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <span className={`${valueClass} whitespace-nowrap`}>
                            {formatPercent(source.value)}
                          </span>
                        </div>
                      </div>
                    {source.dateRange && (
                      <p className={`ds-tooltip-body mt-[var(--ds-space-1)] break-words ${valueAccentClass}`}>
                        Campaign time: {source.dateRange}
                      </p>
                    )}
                    {messageLines.length > 0 && (
                      <ul className="mt-[var(--ds-space-1)] space-y-[var(--ds-space-1)] ds-tooltip-body text-muted-foreground">
                        {messageLines.map((line, lineIndex) => (
                          <li key={`message-${index}-${lineIndex}`} className="flex items-start gap-[var(--ds-space-1)]">
                            <span className={`mt-[0.4em] h-1 w-1 rounded-full bg-current flex-shrink-0 ${valueAccentClass}`} />
                            <span className="min-w-0 break-words">{renderMessageLine(line, valueAccentClass)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mb-[var(--ds-space-2)]">
                <p className="ds-tooltip-body text-muted-foreground italic">
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
      {/* Background overlay - subtle for click-away */}
      <div 
        className="fixed inset-0 z-30 animate-in fade-in-0 duration-200" 
        onClick={onClose}
      />
      {/* Tooltip content with smooth zoom + fade animation */}
      <div
        ref={tooltipRef}
        className="fixed z-40 rounded-xl border border-border/60 bg-card ds-tooltip-pad ds-tooltip-shadow max-w-[min(520px,calc(100vw-32px))] w-auto min-w-[240px] animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-200 ease-out"
        style={{ 
          left: `${tooltipLeft ?? position.x}px`,
          top: `${position.y + 8}px`,
          ...tooltipSurfaceStyle,
        }}
      >
        {/* Upward-pointing arrow - dynamically positioned, appears as border extension */}
        <div 
          className="absolute -top-2 w-4 h-4 border-l border-t border-border/60 transform rotate-45 bg-card"
          style={{ 
            left: `${arrowLeft}px`,
            ...tooltipSurfaceStyle,
          }}
        />
        {/* Content area */}
        <div className="w-full min-w-0">
          {/* Detailed sources */}
          {hasDetails ? (
            <div className="divide-y divide-border/40 my-[var(--ds-space-2)]">
              {incentiveSources.map((source, index) => {
                const messageLines = getMessageLines(source.message);
                const valueClass = `ds-tooltip-title ${valueAccentClass}`;
                const linkClass = `${valueAccentClass} ${valueBgClass} transition-opacity opacity-80 hover:opacity-100`;
                const iconSrc = source.sourceType ? getSourceIcon(source.sourceType, isDark) : null;
                const isBrevis = source.sourceType === 'Brevis';
                const isWordmark = source.sourceType === 'Brevis' || source.sourceType === 'ACI' || source.sourceType === 'Merkl';
                const logoWrapperClass = isWordmark ? 'min-w-[44px] px-[6px] py-[5px]' : 'h-[20px] w-[20px]';
                const logoClass = isWordmark ? 'h-[11px] w-auto max-w-[60px]' : 'h-[11px] w-[11px]';
                return (
                  <div 
                    key={`${source.name}-${index}`}
                    className={`ds-tooltip-item relative px-[var(--ds-space-2)] py-[var(--ds-space-1)] ${accentClass} animate-in fade-in-0 slide-in-from-top-2`}
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <div className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-1)]">
                      <div className="flex items-center gap-[var(--ds-space-1-5)] min-w-0 flex-1 pr-1">
                        {iconSrc && (
                          <span
                            className={`flex items-center justify-center rounded-md ring-1 ring-border/50 shadow-sm flex-shrink-0 bg-muted/60 ${logoWrapperClass}`}
                          >
                            <img
                              src={iconSrc}
                              alt={`${source.sourceType} logo`}
                              title={source.sourceType}
                              className={logoClass}
                              loading="lazy"
                            />
                          </span>
                        )}
                        {isBrevis && !iconSrc && (
                          <span className="ds-text-9 font-semibold uppercase tracking-[0.22em] text-foreground/80 flex-shrink-0">
                            Brevis
                          </span>
                        )}
                        <span className="ds-tooltip-title text-foreground break-words block min-w-0">
                          {source.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-[var(--ds-space-1-5)] flex-shrink-0">
                        {source.link && (
                          <a
                            href={source.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`${linkClass} flex h-7 w-7 items-center justify-center rounded-full transition-opacity opacity-80 hover:opacity-100 focus:outline-none focus-visible:outline-none focus-visible:ring-0`}
                            title="Open link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <span className={`${valueClass} whitespace-nowrap`}>
                          {formatPercent(source.value)}
                        </span>
                      </div>
                    </div>
                    {source.dateRange && (
                      <p className={`ds-tooltip-body mt-[var(--ds-space-1)] break-words ${valueAccentClass}`}>
                        Campaign time: {source.dateRange}
                      </p>
                    )}
                    {messageLines.length > 0 && (
                      <ul className="mt-[var(--ds-space-1)] space-y-[var(--ds-space-1)] ds-tooltip-body text-muted-foreground">
                        {messageLines.map((line, lineIndex) => (
                          <li key={`message-desktop-${index}-${lineIndex}`} className="flex items-start gap-[var(--ds-space-1)]">
                            <span className={`mt-[0.4em] h-1 w-1 rounded-full bg-current flex-shrink-0 ${valueAccentClass}`} />
                            <span className="min-w-0 break-words">{renderMessageLine(line, valueAccentClass)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mb-[var(--ds-space-2)]">
              <p className="ds-tooltip-body text-muted-foreground italic">
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
