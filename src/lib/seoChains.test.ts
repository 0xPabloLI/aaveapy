import { describe, it, expect } from 'vitest';

import { SEO_CHAINS, getSeoChainBySlug } from './seoChains';

describe('SEO_CHAINS', () => {
  it('contains all 17 supported chains', () => {
    expect(SEO_CHAINS).toHaveLength(17);
  });

  it('has no duplicate slugs', () => {
    const slugs = SEO_CHAINS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  describe('title constraints', () => {
    it.each(SEO_CHAINS.map((c) => [c.slug, c.title]))(
      '%s title is 60 chars or fewer',
      (_slug, title) => {
        expect(title.length).toBeLessThanOrEqual(60);
      },
    );

    it.each(SEO_CHAINS.map((c) => [c.slug, c.title]))(
      '%s title contains "Aave APY"',
      (_slug, title) => {
        expect(title).toContain('Aave APY');
      },
    );
  });

  describe('description constraints', () => {
    it.each(SEO_CHAINS.map((c) => [c.slug, c.description]))(
      '%s description is 160 chars or fewer',
      (_slug, description) => {
        expect(description.length).toBeLessThanOrEqual(160);
      },
    );

    it.each(SEO_CHAINS.map((c) => [c.slug, c.description]))(
      '%s description contains "lending" or "borrowing"',
      (_slug, description) => {
        const hasKeyword = description.includes('lending') || description.includes('borrowing');
        expect(hasKeyword).toBe(true);
      },
    );
  });

  it('every chain has exactly three highlights', () => {
    for (const chain of SEO_CHAINS) {
      expect(chain.highlights).toHaveLength(3);
    }
  });

  it('no empty required fields', () => {
    for (const chain of SEO_CHAINS) {
      expect(chain.slug.length).toBeGreaterThan(0);
      expect(chain.displayName.length).toBeGreaterThan(0);
      expect(chain.title.length).toBeGreaterThan(0);
      expect(chain.description.length).toBeGreaterThan(0);
      expect(chain.intro.length).toBeGreaterThan(0);
      expect(chain.chainNameMatchers.length).toBeGreaterThan(0);
    }
  });

  describe('getSeoChainBySlug', () => {
    it('returns the correct chain for a valid slug', () => {
      expect(getSeoChainBySlug('ethereum')?.displayName).toBe('Ethereum');
      expect(getSeoChainBySlug('arbitrum')?.displayName).toBe('Arbitrum');
    });

    it('returns undefined for an unknown slug', () => {
      expect(getSeoChainBySlug('nonexistent')).toBeUndefined();
    });

    it('handles undefined gracefully', () => {
      expect(getSeoChainBySlug(undefined)).toBeUndefined();
    });

    it('matches case-insensitively', () => {
      expect(getSeoChainBySlug('ETHEREUM')?.displayName).toBe('Ethereum');
      expect(getSeoChainBySlug('Arbitrum')?.displayName).toBe('Arbitrum');
    });
  });
});