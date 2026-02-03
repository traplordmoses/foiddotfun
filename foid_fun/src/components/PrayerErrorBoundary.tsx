'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PrayerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('Prayer page error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
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
                <span>⚠️</span>
                <span>ERROR.EXE</span>
              </div>
            </div>

            <div className="vista-window__body p-6 space-y-4">
              <h1 className="text-lg font-bold text-white">
                Prayer Page Error
              </h1>

              <p className="text-sm text-white/80">
                Something went wrong loading the prayer page. This has been logged.
              </p>

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
                  onClick={() => window.location.href = '/'}
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
