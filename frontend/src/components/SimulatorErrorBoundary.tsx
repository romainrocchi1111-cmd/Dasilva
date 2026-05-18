import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class SimulatorErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-72 gap-5 py-16 rounded-xl border border-error/30 bg-error/5">
        <div className="w-12 h-12 rounded-full bg-error/15 border border-error/30 flex items-center justify-center">
          <svg className="w-6 h-6 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="text-center px-6">
          <p className="font-display font-semibold text-text-primary mb-1">
            Une erreur est survenue dans le simulateur
          </p>
          {this.state.error && (
            <p className="font-mono text-xs text-error/80 mt-2 max-w-md break-all">
              {this.state.error.message}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl border border-border-subtle bg-bg-surface text-text-secondary font-body text-sm hover:text-text-primary hover:border-primary/40 transition-all duration-150"
        >
          Recharger la page
        </button>
      </div>
    );
  }
}
