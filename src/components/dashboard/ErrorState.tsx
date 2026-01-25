import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  error: Error;
}

const ErrorState = ({ error }: ErrorStateProps) => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-[var(--ds-space-4)]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-[var(--ds-space-4)] rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="ds-text-20 font-bold mb-[var(--ds-space-2)]">Failed to load pools</h2>
        <p className="text-muted-foreground">
          {error.message || 'An unexpected error occurred. Please try again later.'}
        </p>
      </div>
    </div>
  );
};

export default ErrorState;
