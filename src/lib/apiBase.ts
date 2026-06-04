export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://staging-api.aaveapy.com/api';

type EnvLike = { MODE?: string; VITE_API_BASE_URL?: string };

export function validateApiBaseEnv(env: EnvLike): void {
  if (env.MODE === 'production' && env.VITE_API_BASE_URL == null) {
    console.warn(
      '[ENV] VITE_API_BASE_URL is not set in production environment. ' +
        'The app will fall back to the staging API. ' +
        'Configure this variable to avoid using staging API in production.',
    );
  }
}

validateApiBaseEnv(import.meta.env);
