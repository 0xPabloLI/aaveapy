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
