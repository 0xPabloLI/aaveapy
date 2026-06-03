import { describe, expect, it } from 'vitest'
import { getUserCampaignStatus, computeCampaignAccessStatuses } from './useCampaignAccess'
import type { CampaignAccessEntry } from '@/types/aave'

const USER = '0xAAA111222333444555666777888999AAABBBCCC'
const OTHER = '0xBBB111222333444555666777888999AAABBBCCC'

describe('getUserCampaignStatus', () => {
  it('returns allowed when no campaigns data', () => {
    expect(getUserCampaignStatus(USER, 'camp-1', undefined)).toBe('allowed')
  })

  it('returns allowed when campaign has no entry', () => {
    const campaigns: Record<string, CampaignAccessEntry> = {}
    expect(getUserCampaignStatus(USER, 'camp-1', campaigns)).toBe('allowed')
  })

  it('returns allowed when on whitelist', () => {
    const campaigns: Record<string, CampaignAccessEntry> = {
      'camp-1': { whitelist: [USER], blacklist: [] },
    }
    expect(getUserCampaignStatus(USER, 'camp-1', campaigns)).toBe('allowed')
  })

  it('returns whitelist-blocked when not on whitelist', () => {
    const campaigns: Record<string, CampaignAccessEntry> = {
      'camp-1': { whitelist: [OTHER], blacklist: [] },
    }
    expect(getUserCampaignStatus(USER, 'camp-1', campaigns)).toBe('whitelist-blocked')
  })

  it('returns blacklisted when on blacklist', () => {
    const campaigns: Record<string, CampaignAccessEntry> = {
      'camp-1': { whitelist: [], blacklist: [USER] },
    }
    expect(getUserCampaignStatus(USER, 'camp-1', campaigns)).toBe('blacklisted')
  })

  it('returns allowed when not on blacklist and no whitelist', () => {
    const campaigns: Record<string, CampaignAccessEntry> = {
      'camp-1': { whitelist: [], blacklist: [OTHER] },
    }
    expect(getUserCampaignStatus(USER, 'camp-1', campaigns)).toBe('allowed')
  })

  it('whitelist takes precedence over blacklist', () => {
    const campaigns: Record<string, CampaignAccessEntry> = {
      'camp-1': { whitelist: [USER], blacklist: [USER] },
    }
    expect(getUserCampaignStatus(USER, 'camp-1', campaigns)).toBe('allowed')
  })

  it('comparison is case-insensitive', () => {
    const upperAddr = USER.toUpperCase()
    const lowerEntry = USER.toLowerCase()
    const campaigns: Record<string, CampaignAccessEntry> = {
      'camp-1': { whitelist: [lowerEntry], blacklist: [] },
    }
    expect(getUserCampaignStatus(upperAddr, 'camp-1', campaigns)).toBe('allowed')
  })
})

describe('computeCampaignAccessStatuses', () => {
  it('returns undefined when no userAddress', () => {
    const campaigns: Record<string, CampaignAccessEntry> = {
      'camp-1': { whitelist: [USER], blacklist: [] },
    }
    expect(computeCampaignAccessStatuses(undefined, campaigns)).toBeUndefined()
  })

  it('returns undefined when no campaigns', () => {
    expect(computeCampaignAccessStatuses(USER, undefined)).toBeUndefined()
  })

  it('returns allowed for user on whitelist', () => {
    const campaigns: Record<string, CampaignAccessEntry> = {
      'camp-1': { whitelist: [USER], blacklist: [] },
    }
    expect(computeCampaignAccessStatuses(USER, campaigns)).toEqual({
      'camp-1': 'allowed',
    })
  })

  it('returns whitelist-blocked for user not on whitelist', () => {
    const campaigns: Record<string, CampaignAccessEntry> = {
      'camp-1': { whitelist: [OTHER], blacklist: [] },
    }
    expect(computeCampaignAccessStatuses(USER, campaigns)).toEqual({
      'camp-1': 'whitelist-blocked',
    })
  })

  it('returns mix of statuses across multiple campaigns', () => {
    const campaigns: Record<string, CampaignAccessEntry> = {
      'camp-1': { whitelist: [USER], blacklist: [] },
      'camp-2': { whitelist: [OTHER], blacklist: [] },
      'camp-3': { whitelist: [], blacklist: [USER] },
      'camp-4': { whitelist: [], blacklist: [] },
    }
    expect(computeCampaignAccessStatuses(USER, campaigns)).toEqual({
      'camp-1': 'allowed',
      'camp-2': 'whitelist-blocked',
      'camp-3': 'blacklisted',
      'camp-4': 'allowed',
    })
  })
})
