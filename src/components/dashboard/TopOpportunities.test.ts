import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(process.cwd());

describe('Top opportunities tooltip ownership', () => {
  it('keeps the incentive tooltip state out of the page root', () => {
    const indexSource = readFileSync(resolve(repoRoot, 'src/pages/Index.tsx'), 'utf8');

    expect(indexSource).not.toContain('topTooltipState');
    expect(indexSource).not.toContain('<IncentiveTooltip');
    expect(indexSource).not.toContain('handleTopIncentiveClick');
  });

  it('keeps the incentive tooltip state inside TopOpportunities', () => {
    const topOpportunitiesSource = readFileSync(resolve(repoRoot, 'src/components/dashboard/TopOpportunities.tsx'), 'utf8');

    expect(topOpportunitiesSource).toContain('setTooltipState(');
    expect(topOpportunitiesSource).toContain('useState<TopOpportunitiesTooltipState | null>');
  });

  it('second-row container has min-h to keep card heights consistent', () => {
    const source = readFileSync(resolve(repoRoot, 'src/components/dashboard/TopOpportunities.tsx'), 'utf8');
    expect(source).toContain('min-h-[1.125rem]');
  });

  it('MiniReserveApyRow shows Base APY/APR placeholder when no incentive', () => {
    const source = readFileSync(resolve(repoRoot, 'src/components/dashboard/TopOpportunities.tsx'), 'utf8');
    expect(source).toContain('Base {isApy ? \'APY\' : \'APR\'} only');
  });
});
