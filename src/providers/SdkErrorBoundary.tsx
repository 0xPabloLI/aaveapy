import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface SdkErrorBoundaryProps {
  children: ReactNode;
}

interface SdkErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SdkErrorBoundary extends Component<SdkErrorBoundaryProps, SdkErrorBoundaryState> {
  constructor(props: SdkErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SdkErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SdkErrorBoundary] SDK rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>SDK 数据加载异常，部分功能可能受限。请刷新页面重试。</span>
        </div>
      );
    }

    return this.props.children;
  }
}
