export const API_BASE = isMissingApiBase(import.meta.env.VITE_API_BASE_URL)
  ? 'https://staging-api.aaveapy.com/api'
  : import.meta.env.VITE_API_BASE_URL;

export type EnvLike = { MODE?: string; VITE_API_BASE_URL?: string };

export function isMissingApiBase(v: string | null | undefined): boolean {
  return v == null || v.trim() === '';
}

export function validateApiBaseEnv(env: EnvLike): void {
  if (env.MODE === 'production' && isMissingApiBase(env.VITE_API_BASE_URL)) {
    console.warn(
      '[ENV] VITE_API_BASE_URL is not set in production environment. ' +
        'The app will fall back to the staging API. ' +
        'Configure this variable to avoid using staging API in production.',
    );
  }
}

validateApiBaseEnv(import.meta.env);
