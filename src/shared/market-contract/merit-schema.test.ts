import { describe, it, expect } from 'vitest';
import { MeritCampaignGroupSchema, MeritCampaignBreakdownSchema } from './schemas';

// AAV-1303: Merit 的 schema 已从后端 OpenAPI 移除，本仓契约改为手写 base。
// 后端下线期间 `/markets` 仍可能带回 merit 字段，所以这些 schema 必须继续按原先的
// 宽松度接受它们 —— 下面的矩阵就是那份「原先的宽松度」的可执行定义。
// 任何一条从 accept 变 reject 都意味着 merit 数据会在 safeParse 时被静默丢掉。
const breakdown = {
  campaignApr: 12.5,
  campaignStartedAt: '2026-01-01T00:00:00Z',
  campaignEndedAt: '2026-02-01T00:00:00Z',
  campaignId: 'c1',
};

describe('MeritCampaignBreakdownSchema', () => {
  it('accepts a minimal breakdown (only the four required fields)', () => {
    expect(MeritCampaignBreakdownSchema.safeParse(breakdown).success).toBe(true);
  });

  it('accepts campaignType as any string, not an enum', () => {
    expect(MeritCampaignBreakdownSchema.safeParse({ ...breakdown, campaignType: 'SOMETHING_NEW' }).success).toBe(true);
  });

  it('accepts aprCap null (nullable override) but rejects aprCap as a string', () => {
    expect(MeritCampaignBreakdownSchema.safeParse({ ...breakdown, aprCap: null }).success).toBe(true);
    expect(MeritCampaignBreakdownSchema.safeParse({ ...breakdown, aprCap: '1.5' }).success).toBe(false);
  });

  it('keeps positionCapUsd optional but NOT nullable', () => {
    expect(MeritCampaignBreakdownSchema.safeParse({ ...breakdown, positionCapUsd: undefined }).success).toBe(true);
    expect(MeritCampaignBreakdownSchema.safeParse({ ...breakdown, positionCapUsd: null }).success).toBe(false);
  });

  it('rejects a breakdown missing campaignApr', () => {
    const { campaignApr: _drop, ...rest } = breakdown;
    expect(MeritCampaignBreakdownSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a non-coercible object', () => {
    expect(MeritCampaignBreakdownSchema.safeParse({ toString: 1 }).success).toBe(false);
  });
});

describe('MeritCampaignGroupSchema', () => {
  it('accepts a group with link omitted (override loosens it)', () => {
    expect(MeritCampaignGroupSchema.safeParse({ breakdowns: [breakdown] }).success).toBe(true);
  });

  it('accepts a recursive message shape, not just a string', () => {
    const r = MeritCampaignGroupSchema.safeParse({
      breakdowns: [breakdown],
      message: { a: ['two', { b: 1, c: null }] },
    });
    expect(r.success).toBe(true);
    expect((r as { data: { message: unknown } }).data.message).toEqual({ a: ['two', { b: 1, c: null }] });
  });

  it('documents the message asymmetry: scalars are allowed as record leaves, not as array items', () => {
    // IncentiveMessage 的 union 里只有 record 的 value 位带了 scalar；数组元素位是
    // IncentiveMessage 本身，所以裸 number/null 进数组会被拒。这是既有契约，非本次改动引入。
    expect(MeritCampaignGroupSchema.safeParse({ breakdowns: [breakdown], message: { a: 1 } }).success).toBe(true);
    expect(MeritCampaignGroupSchema.safeParse({ breakdowns: [breakdown], message: [1, null] }).success).toBe(false);
  });

  it('validates nested breakdowns through the wrapper (aprCap nullable there too)', () => {
    expect(MeritCampaignGroupSchema.safeParse({ breakdowns: [{ ...breakdown, aprCap: null }] }).success).toBe(true);
    expect(MeritCampaignGroupSchema.safeParse({ breakdowns: [{ ...breakdown, aprCap: 'x' }] }).success).toBe(false);
  });

  it('accepts netPositionConstraint and crossAssetPairing, rejecting bad enum members', () => {
    expect(
      MeritCampaignGroupSchema.safeParse({
        breakdowns: [breakdown],
        netPositionConstraint: { sourceSide: 'supply', offsetReserveIds: ['1:0xa:0xb:0xc'] },
        crossAssetPairing: { sourceSide: 'supply', pairedReserveId: 'a', pairedSide: 'borrow', discountFactor: 0.5 },
      }).success,
    ).toBe(true);
    expect(
      MeritCampaignGroupSchema.safeParse({
        breakdowns: [breakdown],
        netPositionConstraint: { sourceSide: 'swap', offsetReserveIds: [] },
      }).success,
    ).toBe(false);
    expect(
      MeritCampaignGroupSchema.safeParse({
        breakdowns: [breakdown],
        crossAssetPairing: { sourceSide: 'supply', pairedReserveId: 'a', pairedSide: 'borrow', discountFactor: '0.5' },
      }).success,
    ).toBe(false);
  });

  it('strips unknown keys without rejecting', () => {
    const r = MeritCampaignGroupSchema.safeParse({ breakdowns: [breakdown], futureField: 'x' });
    expect(r.success).toBe(true);
    expect('futureField' in (r as { data: object }).data).toBe(false);
  });

  it('accepts an empty breakdowns array', () => {
    expect(MeritCampaignGroupSchema.safeParse({ breakdowns: [] }).success).toBe(true);
  });
});
