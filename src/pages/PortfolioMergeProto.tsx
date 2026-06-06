/**
 * PROTOTYPE — Portfolio Merge UX scenario page
 * Route: /prototype/portfolio-merge?scenario=1..7
 * DELETE after decision is captured.
 */
import { useSearchParams } from 'react-router-dom';
import { PortfolioMergeProto, SCENARIOS } from '@/components/prototype/PortfolioMergeProto';

const SCENARIO_IDS = Object.keys(SCENARIOS);

export default function PortfolioMergeProtoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scenario = searchParams.get('scenario') ?? '1';
  const validScenario = SCENARIO_IDS.includes(scenario) ? scenario : '1';

  const handleSwitch = (s: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('scenario', s);
      return next;
    }, { replace: true });
  };

  return (
    <div className="min-h-screen min-w-0 w-full bg-background">
      <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl mx-auto px-[var(--ds-space-3)] md:px-[var(--ds-space-5)] py-[var(--ds-space-3)] md:py-[var(--ds-space-5)]">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="ds-text-16 font-semibold text-foreground">Portfolio Merge Prototype</h1>
          <span className="ds-text-11 text-muted-foreground">throwaway code</span>
        </div>

        <PortfolioMergeProto scenario={validScenario} />

        {/* Scenario navigation */}
        <div className="mt-6 space-y-3">
          <p className="ds-text-12 font-medium text-foreground">All Scenarios</p>
          <div className="flex flex-wrap gap-1.5">
            {SCENARIO_IDS.map(id => (
              <button
                key={id}
                onClick={() => handleSwitch(id)}
                className={`
                  inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border ds-text-12 font-medium transition-colors
                  ${id === validScenario
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/40 bg-card/30 text-muted-foreground hover:text-foreground hover:border-border/60'
                  }
                `}
              >
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted/40 ds-text-10">{id}</span>
                <span className="max-w-[14rem] truncate">{SCENARIOS[id].label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
