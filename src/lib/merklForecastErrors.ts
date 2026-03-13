export class MerklForecastApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'MerklForecastApiError';
    this.status = status;
  }
}

export const shouldSurfaceForecastError = (error: unknown): boolean => {
  if (error instanceof MerklForecastApiError && error.status === 422) {
    return false;
  }
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    if (status === 422) return false;
  }
  return true;
};
