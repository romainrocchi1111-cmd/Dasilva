import { useState } from 'react';

export interface EnergyRow {
  n: number;
  parity: 'pair' | 'impair';
  numerical: number;
  analytical: number;
  error: number;
}

export interface ResultTableProps {
  rows: EnergyRow[];
  title?: string;
}

const MAX_VISIBLE = 20;

function fmtEnergy(v: number): string {
  return v.toFixed(6);
}

function fmtError(e: number): string {
  if (e < 1e-12) return '< 1e-12';
  if (e < 0.001) return e.toExponential(2);
  return e.toFixed(5);
}

function errorCls(e: number): string {
  if (e < 0.001) return 'text-success';
  if (e < 0.01) return 'text-warning';
  return 'text-error';
}

export default function ResultTable({ rows, title }: ResultTableProps) {
  const [showAll, setShowAll] = useState(false);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-white p-6">
        {title && (
          <h3 className="font-display font-semibold text-text-primary mb-3">{title}</h3>
        )}
        <p className="font-body text-sm text-text-muted text-center py-6">
          Aucun résultat disponible
        </p>
      </div>
    );
  }

  const displayRows = showAll ? rows : rows.slice(0, MAX_VISIBLE);
  const hasMore = rows.length > MAX_VISIBLE;

  return (
    <div className="rounded-xl border border-border-subtle bg-white overflow-hidden">
      {title && (
        <div className="px-6 py-4 border-b border-border-subtle">
          <h3 className="font-display font-semibold text-text-primary">{title}</h3>
        </div>
      )}

      {/* Scrollable table wrapper */}
      <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="sticky top-0 z-10 bg-bg-surface2">
            <tr className="border-b border-border-subtle">
              {(
                [
                  { label: 'n', align: 'left' },
                  { label: 'Parité', align: 'left' },
                  { label: 'E_num (ℏω)', align: 'right' },
                  { label: 'E_anal (ℏω)', align: 'right' },
                  { label: 'Erreur', align: 'right' },
                ] as const
              ).map(({ label, align }) => (
                <th
                  key={label}
                  className="px-4 py-3 font-display text-xs uppercase tracking-widest text-text-muted font-medium whitespace-nowrap"
                  style={{ textAlign: align }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr
                key={row.n}
                className={`border-l-2 transition-colors duration-100 hover:bg-bg-surface2 ${
                  row.parity === 'pair'
                    ? 'border-l-blue-200'
                    : 'border-l-indigo-200'
                }`}
              >
                {/* n */}
                <td className="px-4 py-2.5 font-mono text-text-primary">
                  {row.n}
                </td>

                {/* Parity badge */}
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-medium ${
                      row.parity === 'pair'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    {row.parity}
                  </span>
                </td>

                {/* E numerical */}
                <td className="px-4 py-2.5 font-mono text-right text-text-primary tabular-nums">
                  {fmtEnergy(row.numerical)}
                </td>

                {/* E analytical */}
                <td className="px-4 py-2.5 font-mono text-right text-text-secondary tabular-nums">
                  {fmtEnergy(row.analytical)}
                </td>

                {/* Error */}
                <td
                  className={`px-4 py-2.5 font-mono text-right tabular-nums ${errorCls(row.error)}`}
                >
                  {fmtError(row.error)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show more / less toggle */}
      {hasMore && (
        <div className="px-6 py-3 border-t border-border-subtle text-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="font-body text-xs text-text-secondary hover:text-primary transition-colors duration-150"
          >
            {showAll
              ? '▲ Réduire'
              : `▼ Voir tout — ${rows.length} niveaux`}
          </button>
        </div>
      )}
    </div>
  );
}
