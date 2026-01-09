import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  error: Error;
}

const ErrorState = ({ error }: ErrorStateProps) => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold mb-2">Failed to load markets</h2>
        <p className="text-muted-foreground">
          {error.message || 'An unexpected error occurred. Please try again later.'}
        </p>
      </div>
    </div>
  );
};

export default ErrorState;
