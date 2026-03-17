'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Title shown in the error window (default: "Page Error") */
  title?: string;
  /** Description shown below the title */
  description?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic error boundary for any page. Catches render errors and displays
 * a recovery UI within the FOID vista-window chrome.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const title = this.props.title ?? 'Page Error';
      const description =
        this.props.description ??
        'Something went wrong. This has been logged.';

      return (
        <main className="min-h-screen flex items-center justify-center bg-foid-bg text-white p-4">
          <div className="vista-window max-w-md w-full">
            <div className="vista-window__titlebar">
              <div className="vista-window__controls">
                <span className="vista-window__control vista-window__control--close" />
                <span className="vista-window__control vista-window__control--minimize" />
                <span className="vista-window__control vista-window__control--restore" />
              </div>
              <div className="vista-window__title">
                <span>ERROR.EXE</span>
              </div>
            </div>

            <div className="vista-window__body p-6 space-y-4">
              <h1 className="text-lg font-bold text-white">{title}</h1>

              <p className="text-sm text-white/80">{description}</p>

              {this.state.error && (
                <div className="bg-black/20 rounded p-3 text-xs font-mono text-white/60 overflow-auto max-h-32">
                  {this.state.error.message}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-4 py-2 bg-gradient-to-br from-yellow-400 to-yellow-600 text-black font-semibold rounded-lg hover:scale-105 transition-transform"
                >
                  Reload Page
                </button>

                <button
                  onClick={() => (window.location.href = '/')}
                  className="flex-1 px-4 py-2 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
