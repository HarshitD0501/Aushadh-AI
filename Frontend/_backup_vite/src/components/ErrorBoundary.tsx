import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-box" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <AlertOctagon size={28} color="#dc2626" />
            <h2 className="error-title">Something went wrong</h2>
          </div>
          <p style={{ marginBottom: '14px', color: '#4b5563', fontSize: '0.95rem' }}>
            An unexpected error occurred in the application view. Your locally saved prescriptions remain safe in your browser.
          </p>
          {this.state.error && (
            <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#b91c1c', marginBottom: '16px', background: '#fee2e2', padding: '8px', borderRadius: '4px' }}>
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="btn-primary"
            style={{ width: '100%', maxWidth: '240px' }}
          >
            <RotateCcw size={18} />
            <span>Return to Search</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
