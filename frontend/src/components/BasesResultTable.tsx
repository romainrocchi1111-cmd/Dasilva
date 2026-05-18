import { useState } from 'react';

export interface CombinationData {
  label: string;
  energies: number[];
}

export interface BasesResultTableProps {
  combinations: CombinationData[];
}

const MAX_VISIBLE = 20;

function fmtEnergy(v: number): string {
  return v.toFixed(6);
}

function errorCls(energy: number, n: number): string {
  const err = Math.abs(energy - (n + 0.5));
  if (err < 0.001) return 'text-success';
  if (err < 0.01) return 'text-warning';
  return 'text-error';
}

export default function BasesResultTable({ combinations }: BasesResultTableProps) {
  const [showAll, setShowAll] = useState(false);

  if (combinations.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-white p-6">
        <p className="font-body text-sm text-text-muted text-center py-6">
          Aucun résultat disponible
        </p>
      </div>
    );
  }

  const maxLevel = Math.max(0, ...combinations.map((c) => c.energies.length));
  const displayCount = showAll ? maxLevel : Math.min(maxLevel, MAX_VISIBLE);
  const hasMore = maxLevel > MAX_VISIBLE;

  const HEADER_COLORS = ['text-primary', 'text-secondary', 'text-accent', 'text-warning'];

  return (
    <div className="rounded-xl border border-border-subtle bg-white overflow-hidden">
      <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
        <table className="w-full text-sm" style={{ minWidth: `${280 + combinations.length * 140}px` }}>
          <thead className="sticky top-0 z-10 bg-bg-surface2">
            <tr className="border-b border-border-subtle">
              {/* n */}
              <th className="px-4 py-3 text-left font-display text-xs uppercase tracking-widest text-text-muted font-medium">
                Niveau n
              </th>
              {/* Analytical */}
              <th className="px-4 py-3 text-right font-display text-xs uppercase tracking-widest text-text-muted font-medium whitespace-nowrap">
                Analytique (ℏω)
              </th>
              {/* One column per combination */}
              {combinations.map((combo, i) => (
                <th
                  key={combo.label}
                  className={`px-4 py-3 text-right font-display text-xs uppercase tracking-widest font-medium whitespace-nowrap ${
                    HEADER_COLORS[i % HEADER_COLORS.length]
                  }`}
                >
                  {combo.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: displayCount }, (_, n) => (
              <tr
                key={n}
                className={`border-l-2 transition-colors duration-100 hover:bg-bg-surface2 ${
                  n % 2 === 0 ? 'border-l-blue-200' : 'border-l-indigo-200'
                }`}
              >
                {/* n */}
                <td className="px-4 py-2.5 font-mono text-text-primary">{n}</td>

                {/* Analytical */}
                <td className="px-4 py-2.5 font-mono text-right text-text-secondary tabular-nums">
                  {(n + 0.5).toFixed(6)}
                </td>

                {/* Energy per combination */}
                {combinations.map((combo) => {
                  const e = combo.energies[n];
                  return (
                    <td
                      key={combo.label}
                      className={`px-4 py-2.5 font-mono text-right tabular-nums ${
                        e != null ? errorCls(e, n) : 'text-text-muted'
                      }`}
                    >
                      {e != null ? fmtEnergy(e) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="px-6 py-3 border-t border-border-subtle text-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="font-body text-xs text-text-secondary hover:text-primary transition-colors duration-150"
          >
            {showAll
              ? '▲ Réduire'
              : `▼ Voir tout — ${maxLevel} niveaux`}
          </button>
        </div>
      )}
    </div>
  );
}
