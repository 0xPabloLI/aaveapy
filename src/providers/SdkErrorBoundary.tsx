import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 text-orange-700 dark:text-orange-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>SDK 数据加载异常，部分功能可能受限。</span>
          <button
            onClick={this.handleReset}
            className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
