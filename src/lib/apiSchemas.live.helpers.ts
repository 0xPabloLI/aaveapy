export const DEFAULT_LIVE_API_BASE = 'https://staging-api.aaveapy.com/api';

type LiveEnv = Partial<Record<'LIVE_TEST_API_BASE' | 'VITE_API_BASE_URL', string | undefined>>;

type LiveHttpErrorInput = {
  bodySnippet: string;
  endpoint: string;
  status: number;
  statusText: string;
  url: string;
};

export function resolveLiveApiBase(env: LiveEnv = process.env): string {
  return env.LIVE_TEST_API_BASE || DEFAULT_LIVE_API_BASE;
}

const CLOUDFLARE_CHALLENGE_MARKERS = [
  'just a moment',
  'cf-mitigated',
  'cloudflare',
  '/cdn-cgi/challenge-platform',
];

export function isLikelyCloudflareChallenge(status: number, bodySnippet: string): boolean {
  if (status !== 403) return false;

  const normalized = bodySnippet.toLowerCase();
  return CLOUDFLARE_CHALLENGE_MARKERS.some((marker) => normalized.includes(marker));
}

export function shouldSoftFailLiveSchema(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LIVE_TEST_STRICT !== 'true';
}

export function formatLiveHttpError({
  bodySnippet,
  endpoint,
  status,
  statusText,
  url,
}: LiveHttpErrorInput): string {
  const trimmedBody = bodySnippet.trim();

  return [
    `Live schema request failed for ${endpoint}`,
    `url: ${url}`,
    `status: ${status} ${statusText}`,
    `body: ${trimmedBody || '<empty>'}`,
  ].join('\n');
}
