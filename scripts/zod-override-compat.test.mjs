import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ZOD_FLOOR, compareVersions } from './check-zod-version-floor.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_KIT_WALLET_PACKAGE_JSON = path.join(REPO_ROOT, 'node_modules/@reown/appkit-wallet/package.json');

/** Walk up from a resolved module entry to the package.json that owns it. */
function packageJsonFor(entryPath) {
  let dir = path.dirname(entryPath);
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(dir, 'package.json');
    try {
      return JSON.parse(readFileSync(candidate, 'utf8'));
    } catch {
      dir = path.dirname(dir);
    }
  }
  throw new Error(`no package.json above ${entryPath}`);
}

/**
 * Which zod copy does `@reown/appkit-wallet` actually get?
 *
 * This is the exact thing the root override changes: before it, npm keeps a
 * nested 3.22.4 under the wallet package; after it, resolution falls back to
 * the hoisted 4.x. Asserting on the resolved copy (not on package.json ranges)
 * is what makes the canary meaningful for a forced major.
 */
function resolvedZodVersion() {
  const requireFromWallet = createRequire(APP_KIT_WALLET_PACKAGE_JSON);
  const entry = requireFromWallet.resolve('zod');
  return packageJsonFor(entry).version;
}

test('Z9: @reown/appkit-wallet resolves a zod copy at or above the advisory floor', () => {
  const version = resolvedZodVersion();
  assert.ok(compareVersions(version, ZOD_FLOOR) >= 0, `wallet package resolves zod ${version}, floor is ${ZOD_FLOOR}`);
});

test('Z9b: the wallet frame schema still parses under that zod copy', async () => {
  const { W3mFrameSchema, W3mFrameConstants } = await import('@reown/appkit-wallet');

  const event = { type: W3mFrameConstants.FRAME_READY, payload: { version: '1.0.0' } };
  const accepted = W3mFrameSchema.frameEvent.safeParse(event);
  assert.equal(accepted.success, true, `valid FRAME_READY rejected: ${JSON.stringify(accepted.error?.issues ?? [])}`);

  // Negative control: the same schema must still reject a wrong payload shape,
  // otherwise "parses" would only prove the schema went permissive.
  const rejected = W3mFrameSchema.frameEvent.safeParse({
    type: W3mFrameConstants.FRAME_READY,
    payload: 42,
  });
  assert.equal(rejected.success, false, 'invalid payload should be rejected');
});
