import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';

export interface PlotData {
  key: string;
  title: string;
  src: string; // base64, WITHOUT the data:image/png;base64, prefix
}

export interface PlotViewerProps {
  plots: PlotData[];
  isLoading: boolean;
  error?: string;
  durationMs?: number;
}

const PROGRESS_CSS = `
@keyframes pv-slide {
  0%   { transform: translateX(-150%); }
  100% { transform: translateX(450%); }
}
`;

let pvStyleInjected = false;

export default function PlotViewer({ plots, isLoading, error, durationMs }: PlotViewerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pvStyleInjected) return;
    pvStyleInjected = true;
    const el = document.createElement('style');
    el.textContent = PROGRESS_CSS;
    document.head.appendChild(el);
  }, []);

  useEffect(() => {
    if (plots.length > 0) {
      setVisible(false);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
  }, [plots.length]);

  const handleDownload = useCallback((key: string, src: string) => {
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${src}`;
    a.download = `${key}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  /* ── Loading ─────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-6 py-16">
        <LoadingSpinner size="lg" message="Calcul en cours…" />

        {/* Indeterminate progress bar */}
        <div className="w-64 h-1 bg-border-subtle rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: '35%', animation: 'pv-slide 1.5s ease-in-out infinite' }}
          />
        </div>

        <p className="font-mono text-xs text-text-muted tracking-wide">
          Simulation en cours d'exécution…
        </p>
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────── */
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex items-start gap-4">
        <span className="text-2xl flex-shrink-0 mt-0.5" aria-hidden="true">
          ⚠️
        </span>
        <div>
          <h4 className="font-display font-semibold text-error mb-1.5">
            Erreur de simulation
          </h4>
          <p className="font-body text-sm text-text-secondary leading-relaxed">
            {error}
          </p>
        </div>
      </div>
    );
  }

  /* ── Empty ───────────────────────────────────────────── */
  if (plots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-48 gap-3 py-12 rounded-xl border border-border-subtle bg-bg-surface2">
        <div className="w-10 h-10 rounded-full bg-white border border-border-subtle flex items-center justify-center">
          <svg
            className="w-5 h-5 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"
            />
          </svg>
        </div>
        <p className="font-body text-sm text-text-muted">
          Lancez la simulation pour voir les graphiques
        </p>
      </div>
    );
  }

  /* ── Plots grid ──────────────────────────────────────── */
  const gridClass =
    plots.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2';

  return (
    <div
      className={`relative transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className={`grid ${gridClass} gap-6`}>
        {plots.map((plot) => (
          <div
            key={plot.key}
            className="rounded-xl bg-white border border-border-subtle overflow-hidden flex flex-col"
          >
            {/* Card header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-3">
              <h4 className="font-display font-medium text-sm text-text-primary truncate">
                {plot.title}
              </h4>
              <button
                type="button"
                onClick={() => handleDownload(plot.key, plot.src)}
                title={`Télécharger ${plot.key}.png`}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md
                           font-body text-xs text-text-muted
                           bg-bg-surface2 hover:bg-border-subtle
                           border border-transparent hover:border-border-subtle
                           transition-all duration-150"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Télécharger
              </button>
            </div>

            {/* Plot image */}
            <div className="px-3 pb-3 flex-1">
              <img
                src={`data:image/png;base64,${plot.src}`}
                alt={plot.title}
                className="w-full rounded-lg"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Duration badge */}
      {durationMs != null && (
        <div className="flex justify-end mt-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 font-mono text-xs text-blue-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" aria-hidden="true" />
            Calculé en {(durationMs / 1000).toFixed(2)}s
          </span>
        </div>
      )}
    </div>
  );
}
