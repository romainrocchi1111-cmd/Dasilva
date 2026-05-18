import { useState } from 'react';
import ParamSlider from './ParamSlider';
import PlotViewer, { type PlotData } from './PlotViewer';
import ResultTable, { type EnergyRow } from './ResultTable';
import EmailForm from './EmailForm';
import LoadingSpinner from './LoadingSpinner';

// ─── API types ────────────────────────────────────────────────────────────────
interface ParityResponse {
  energies: { even: number[]; odd: number[]; analytical: number[] };
  figures: Record<string, string>;
  duration_ms: number;
}

type IntegrationMethod = 'rk4' | 'euler';

interface ParityParams {
  N: number;
  L: number;
  dt: number;
  tau_max: number;
  omega: number;
  n_even: number;
  n_odd: number;
  method: IntegrationMethod;
  graphs: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const GRAPH_OPTIONS = [
  { key: 'convergence', label: 'Convergence E(τ)' },
  { key: 'energies', label: 'Niveaux d\'énergie' },
  { key: 'errors', label: 'Erreurs absolues' },
] as const;

const GRAPH_TITLES: Record<string, string> = {
  convergence: "Convergence E(τ)",
  energies: "Niveaux d'énergie",
  errors: "Erreurs absolues",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildEnergyRows({ energies }: ParityResponse): EnergyRow[] {
  const { even, odd } = energies;
  const rows: EnergyRow[] = [];
  for (let n = 0; n < even.length + odd.length; n++) {
    const isEven = n % 2 === 0;
    const idx = Math.floor(n / 2);
    const numerical = isEven ? even[idx] : odd[idx];
    if (numerical == null) continue;
    const analytical = n + 0.5;
    rows.push({ n, parity: isEven ? 'pair' : 'impair', numerical, analytical, error: Math.abs(numerical - analytical) });
  }
  return rows;
}

function buildPlots(result: ParityResponse, graphs: string[]): PlotData[] {
  return graphs
    .filter((k) => result.figures[k])
    .map((k) => ({ key: k, title: GRAPH_TITLES[k] ?? k, src: result.figures[k] }));
}

// ─── Placeholder ─────────────────────────────────────────────────────────────
function ResultPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center min-h-72 gap-6 py-16 rounded-xl border border-border-subtle bg-bg-surface2">
      <svg viewBox="0 0 240 80" className="w-52 h-[4.5rem] opacity-100" aria-hidden="true">
        <path d="M0 40 Q30 5 60 40 Q90 75 120 40 Q150 5 180 40 Q210 75 240 40"
          stroke="#2563eb" strokeWidth="2" fill="none" opacity="0.35" />
        <path d="M0 40 Q30 18 60 40 Q90 62 120 40 Q150 18 180 40 Q210 62 240 40"
          stroke="#6366f1" strokeWidth="1.5" fill="none" opacity="0.25" />
        <line x1="0" y1="14" x2="240" y2="14" stroke="#0891b2" strokeWidth="1" strokeDasharray="5,4" opacity="0.3" />
        <line x1="0" y1="24" x2="240" y2="24" stroke="#0891b2" strokeWidth="1" strokeDasharray="5,4" opacity="0.2" />
        <line x1="0" y1="34" x2="240" y2="34" stroke="#0891b2" strokeWidth="1" strokeDasharray="5,4" opacity="0.15" />
      </svg>
      <div className="text-center">
        <p className="font-display text-text-secondary text-sm font-medium">
          Configurez les paramètres et lancez la simulation
        </p>
        <p className="font-body text-text-muted text-xs mt-1.5">
          Les graphiques et niveaux d'énergie apparaîtront ici
        </p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ParitySimulator() {
  const [params, setParams] = useState<ParityParams>({
    N: 40, L: 15.0, dt: 0.01, tau_max: 1.5,
    omega: 1.0, n_even: 8, n_odd: 8, method: 'rk4',
    graphs: ['convergence', 'energies', 'errors'],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ParityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleParamChange = (name: string, value: number) =>
    setParams((p) => ({ ...p, [name]: value }));

  const toggleGraph = (key: string) =>
    setParams((p) => ({
      ...p,
      graphs: p.graphs.includes(key) ? p.graphs.filter((g) => g !== key) : [...p.graphs, key],
    }));

  const handleRun = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    const base = 'https://dasilva-production.up.railway.app';
    try {
      const res = await fetch(`${base}/api/parity/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? `Erreur serveur HTTP ${res.status}`);
      }
      setResult(await res.json() as ParityResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const plots = result ? buildPlots(result, params.graphs) : [];
  const energyRows = result ? buildEnergyRows(result) : [];
  const emailFigures = plots.map(({ key, title, src }) => ({ key, title, src }));
  const canLaunch = !isLoading && params.graphs.length > 0;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 pb-16">

        {/* ── LEFT: Control Panel ────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 lg:self-start flex flex-col gap-0">
          <div className="rounded-2xl border border-border-subtle bg-white overflow-hidden">

            {/* Header */}
            <div className="px-5 py-4 border-b border-border-subtle flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display font-semibold text-text-primary text-sm">
                  Paramètres de simulation
                </h2>
                <p className="font-body text-xs text-text-muted">
                  Propagation par parité — Base sinus
                </p>
              </div>
            </div>

            <div className="px-5 py-5 flex flex-col gap-5">

              {/* Sliders */}
              <div className="flex flex-col gap-4">
                <ParamSlider label="N — Fonctions de base" name="N"
                  value={params.N} min={4} max={60} step={2}
                  description="Nombre de fonctions sinus dans la base"
                  onChange={handleParamChange} />
                <ParamSlider label="L — Longueur de boîte" name="L"
                  value={params.L} min={4} max={30} step={0.5} unit="a₀"
                  description="Demi-longueur de la boîte infinie [−L, L]"
                  onChange={handleParamChange} />
                <ParamSlider label="Δτ — Pas de temps" name="dt"
                  value={params.dt} min={0.001} max={0.1} step={0.001}
                  onChange={handleParamChange} />
                <ParamSlider label="τ_max — Temps imaginaire" name="tau_max"
                  value={params.tau_max} min={0.5} max={20} step={0.5} unit="ℏ⁻¹"
                  description="Durée totale de propagation en temps imaginaire"
                  onChange={handleParamChange} />
                <ParamSlider label="ω — Fréquence propre" name="omega"
                  value={params.omega} min={0.1} max={5} step={0.1} unit="rad·s⁻¹"
                  onChange={handleParamChange} />
                <ParamSlider label="n_pair — Niveaux pairs" name="n_even"
                  value={params.n_even} min={1} max={12} step={1}
                  onChange={handleParamChange} />
                <ParamSlider label="n_impair — Niveaux impairs" name="n_odd"
                  value={params.n_odd} min={1} max={12} step={1}
                  onChange={handleParamChange} />
              </div>

              <div className="h-px bg-border-subtle" />

              {/* Integration method toggle */}
              <div className="flex flex-col gap-2.5">
                <span className="font-display text-xs text-text-muted uppercase tracking-widest">
                  Méthode d'intégration
                </span>
                <div className="flex rounded-xl overflow-hidden border border-border-subtle bg-bg-surface2">
                  {(['euler', 'rk4'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setParams((p) => ({ ...p, method: m }))}
                      className={`flex-1 py-2.5 font-mono text-sm font-semibold transition-colors duration-150 ${
                        params.method === m
                          ? 'bg-primary text-white'
                          : 'text-text-muted hover:text-text-secondary hover:bg-white'
                      }`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Graph selection */}
              <div className="flex flex-col gap-2.5">
                <span className="font-display text-xs text-text-muted uppercase tracking-widest">
                  Graphiques à générer
                </span>
                <div className="flex flex-wrap gap-2">
                  {GRAPH_OPTIONS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleGraph(key)}
                      className={`px-3 py-1.5 rounded-full font-body text-xs font-medium transition-all duration-150 ${
                        params.graphs.includes(key)
                          ? 'bg-blue-100 border border-blue-300 text-blue-700'
                          : 'bg-bg-base border border-border-subtle text-text-muted hover:text-text-secondary hover:bg-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch button */}
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={handleRun}
                disabled={!canLaunch}
                aria-busy={isLoading}
                className={`w-full py-3.5 rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-2.5 transition-colors duration-200 ${
                  canLaunch
                    ? 'bg-primary hover:bg-primary-hover text-white'
                    : 'bg-bg-surface2 text-text-muted border border-border-subtle cursor-not-allowed opacity-60'
                }`}
              >
                {isLoading
                  ? (<><LoadingSpinner size="sm" /><span>Calcul en cours…</span></>)
                  : (<><span aria-hidden="true">▶</span><span>Lancer la simulation</span></>)}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Results ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 min-w-0">
          {!isLoading && !result && !error ? (
            <ResultPlaceholder />
          ) : (
            <>
              <PlotViewer
                plots={plots}
                isLoading={isLoading}
                error={error ?? undefined}
              />

              {result && (
                <>
                  <ResultTable
                    rows={energyRows}
                    title="Niveaux d'énergie — numérique vs analytique"
                  />

                  {/* Action bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-border-subtle font-body text-sm text-text-secondary hover:text-text-primary hover:border-primary/40 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-150"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Recevoir par email
                    </button>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 font-mono text-xs text-blue-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" aria-hidden="true" />
                      Calculé en {(result.duration_ms / 1000).toFixed(2)}s
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showEmailForm && (
        <EmailForm
          figures={emailFigures}
          module="parity"
          onClose={() => setShowEmailForm(false)}
        />
      )}
    </>
  );
}
