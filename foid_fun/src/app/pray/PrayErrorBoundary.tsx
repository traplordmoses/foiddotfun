'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PrayErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('[PrayErrorBoundary] prayer flow crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <p
            className="text-sm text-white/80"
            style={{
              fontFamily: 'var(--font-terminal, "JetBrains Mono", monospace)',
              letterSpacing: '0.08em',
            }}
          >
            something frayed, love. refresh and try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/80 hover:bg-white/20"
          >
            reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
