import { describe, it, expect, beforeEach } from 'vitest';
import {
  isRpcUnhealthy,
  clearRpcUnhealthy,
  markRpcUnhealthy,
  selectRpcUrlsByHealth,
  resetRpcHealthCache,
} from './rpcHealth';

const A = 'https://rpc-a.example.com';
const B = 'https://rpc-b.example.com';
const C = 'https://rpc-c.example.com';

describe('rpcHealth (AAV-1387)', () => {
  beforeEach(() => {
    resetRpcHealthCache();
  });

  it('H1 keeps a URL healthy by default', () => {
    expect(isRpcUnhealthy(1, A)).toBe(false);
  });

  it('H2 marks one URL unhealthy without touching its neighbours', () => {
    markRpcUnhealthy(1, A);

    expect(isRpcUnhealthy(1, A)).toBe(true);
    expect(isRpcUnhealthy(1, B)).toBe(false);
  });

  it('H3 clears the mark when the URL serves a read again', () => {
    markRpcUnhealthy(1, A);
    clearRpcUnhealthy(1, A);

    expect(isRpcUnhealthy(1, A)).toBe(false);
  });

  it('H4 drops unhealthy URLs while keeping curated order among the healthy ones', () => {
    markRpcUnhealthy(1, B);

    expect(selectRpcUrlsByHealth(1, [A, B, C])).toEqual([A, C]);
  });

  it('H5 falls back to the full list when every URL is unhealthy (anti-lockout)', () => {
    markRpcUnhealthy(1, A);
    markRpcUnhealthy(1, B);

    expect(selectRpcUrlsByHealth(1, [A, B])).toEqual([A, B]);
  });

  it('H6 keeps marks per chain', () => {
    markRpcUnhealthy(1, A);

    expect(isRpcUnhealthy(10, A)).toBe(false);
  });

  it('H7 resetRpcHealthCache clears every chain', () => {
    markRpcUnhealthy(1, A);
    markRpcUnhealthy(10, B);

    resetRpcHealthCache();

    expect(isRpcUnhealthy(1, A)).toBe(false);
    expect(isRpcUnhealthy(10, B)).toBe(false);
  });

  it('H8 leaves the given list alone when the unhealthy URL is not part of it', () => {
    markRpcUnhealthy(1, A);

    expect(selectRpcUrlsByHealth(1, [B, C])).toEqual([B, C]);
  });
});
