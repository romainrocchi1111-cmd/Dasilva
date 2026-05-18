import { useState } from 'react';
import ParamSlider from './ParamSlider';
import PlotViewer, { type PlotData } from './PlotViewer';
import BasesResultTable from './BasesResultTable';
import EmailForm from './EmailForm';
import LoadingSpinner from './LoadingSpinner';

// ─── Types ────────────────────────────────────────────────────────────────────
type BasisType = 'Sinus' | 'Legendre' | 'Hermite';
type HamiType = 'Hami' | 'Hamiltonien1';

interface Combination {
  basis: BasisType;
  hamiltonian: HamiType;
}

interface CombinationResult {
  label: string;
  energies: number[];
  E_history: number[][];
  tau_history: number[];
}

interface BasesResponse {
  results: CombinationResult[];
  figures: Record<string, string>;
  duration_ms: number;
}

interface SharedParams {
  N: number;
  L: number;
  dt: number;
  tau_max: number;
  omega: number;
  graphs: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BASIS_OPTIONS: BasisType[] = ['Sinus', 'Legendre', 'Hermite'];
const HAMI_OPTIONS: HamiType[] = ['Hami', 'Hamiltonien1'];
const MAX_COMBOS = 4;

const GRAPH_OPTIONS = [
  { key: 'convergence', label: 'Convergence E(τ)' },
  { key: 'spectrum',    label: 'Spectre E_n' },
  { key: 'wavefunction',label: 'Fonction d\'onde ψ₀' },
  { key: 'errors',      label: 'Erreurs' },
] as const;

const GRAPH_TITLES: Record<string, string> = {
  convergence:  "Convergence E₀(τ)",
  spectrum:     "Spectre énergétique",
  wavefunction: "Fonction d'onde ψ₀",
  errors:       "Erreurs absolues",
};

// Palette colors for combination slots (max 4)
const COMBO_BORDER  = ['border-l-blue-400', 'border-l-indigo-400', 'border-l-cyan-400', 'border-l-amber-400'];
const COMBO_BASIS   = [
  'bg-blue-50 text-blue-700 border border-blue-200',
  'bg-indigo-50 text-indigo-700 border border-indigo-200',
  'bg-cyan-50 text-cyan-700 border border-cyan-200',
  'bg-amber-50 text-amber-700 border border-amber-200',
];
const COMBO_HAMI = [
  'bg-blue-50 text-blue-600',
  'bg-indigo-50 text-indigo-600',
  'bg-cyan-50 text-cyan-600',
  'bg-amber-50 text-amber-600',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildPlots(result: BasesResponse, graphs: string[]): PlotData[] {
  return graphs
    .filter((k) => result.figures[k])
    .map((k) => ({ key: k, title: GRAPH_TITLES[k] ?? k, src: result.figures[k] }));
}

// ─── Placeholder ─────────────────────────────────────────────────────────────
function ResultPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center min-h-72 gap-6 py-16 rounded-xl border border-border-subtle bg-bg-surface2">
      <svg viewBox="0 0 240 80" className="w-52 h-[4.5rem]" aria-hidden="true">
        <path d="M0 40 Q30 5 60 40 Q90 75 120 40 Q150 5 180 40 Q210 75 240 40"
          stroke="#2563eb" strokeWidth="2" fill="none" opacity="0.3" />
        <path d="M0 40 Q30 18 60 40 Q90 62 120 40 Q150 18 180 40 Q210 62 240 40"
          stroke="#6366f1" strokeWidth="1.5" fill="none" opacity="0.25" />
        <path d="M0 40 Q30 26 60 40 Q90 54 120 40 Q150 26 180 40 Q210 54 240 40"
          stroke="#0891b2" strokeWidth="1.2" fill="none" opacity="0.2" />
        <path d="M0 40 Q30 32 60 40 Q90 48 120 40 Q150 32 180 40 Q210 48 240 40"
          stroke="#d97706" strokeWidth="1" fill="none" opacity="0.18" />
        <line x1="0" y1="14" x2="240" y2="14" stroke="#0891b2" strokeWidth="1" strokeDasharray="5,4" opacity="0.25" />
        <line x1="0" y1="24" x2="240" y2="24" stroke="#0891b2" strokeWidth="1" strokeDasharray="5,4" opacity="0.18" />
      </svg>
      <div className="text-center">
        <p className="font-display text-text-secondary text-sm font-medium">
          Configurez les combinaisons et lancez la simulation
        </p>
        <p className="font-body text-text-muted text-xs mt-1.5">
          Les courbes superposées apparaîtront ici
        </p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BasesSimulator() {
  const [combinations, setCombinations] = useState<Combination[]>([
    { basis: 'Hermite', hamiltonian: 'Hami' },
  ]);
  const [selBasis, setSelBasis] = useState<BasisType>('Sinus');
  const [selHami, setSelHami]   = useState<HamiType>('Hami');
  const [addError, setAddError] = useState<string | null>(null);

  const [sharedParams, setSharedParams] = useState<SharedParams>({
    N: 12, L: 8.0, dt: 0.01, tau_max: 6.0, omega: 1.0,
    graphs: ['convergence', 'spectrum', 'wavefunction', 'errors'],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult]       = useState<BasesResponse | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const hasSinus = combinations.some((c) => c.basis === 'Sinus');

  const handleSharedChange = (name: string, value: number) =>
    setSharedParams((p) => ({ ...p, [name]: value }));

  const toggleGraph = (key: string) =>
    setSharedParams((p) => ({
      ...p,
      graphs: p.graphs.includes(key) ? p.graphs.filter((g) => g !== key) : [...p.graphs, key],
    }));

  const addCombination = () => {
    setAddError(null);
    if (combinations.length >= MAX_COMBOS) return;
    if (combinations.some((c) => c.basis === selBasis && c.hamiltonian === selHami)) {
      setAddError('Cette combinaison est déjà dans la liste.');
      return;
    }
    setCombinations((prev) => [...prev, { basis: selBasis, hamiltonian: selHami }]);
  };

  const removeCombination = (idx: number) =>
    setCombinations((prev) => prev.filter((_, i) => i !== idx));

  const handleRun = async () => {
    if (isLoading || combinations.length === 0) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    const base = 'https://dasilva-production.up.railway.app';
    try {
      const res = await fetch(`${base}/api/bases/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ combinations, ...sharedParams }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? `Erreur serveur HTTP ${res.status}`);
      }
      setResult(await res.json() as BasesResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const plots        = result ? buildPlots(result, sharedParams.graphs) : [];
  const combosData   = result ? result.results.map((r) => ({ label: r.label, energies: r.energies })) : [];
  const emailFigures = plots.map(({ key, title, src }) => ({ key, title, src }));
  const canLaunch    = !isLoading && combinations.length > 0 && sharedParams.graphs.length > 0;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 pb-16">

        {/* ── LEFT: Control Panel ──────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border-subtle bg-white overflow-hidden">

            {/* Header */}
            <div className="px-5 py-4 border-b border-border-subtle flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M4 6h16M4 10h16M4 14h16M4 18h7" />
                </svg>
              </div>
              <div>
                <h2 className="font-display font-semibold text-text-primary text-sm">
                  Paramètres de simulation
                </h2>
                <p className="font-body text-xs text-text-muted">
                  Comparaison bases &amp; hamiltoniens
                </p>
              </div>
            </div>

            <div className="px-5 py-5 flex flex-col gap-5">

              {/* ── Combinations manager ── */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs text-text-muted uppercase tracking-widest">
                    Combinaisons actives
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-mono text-xs font-medium ${
                    combinations.length >= MAX_COMBOS
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {combinations.length}/{MAX_COMBOS}
                  </span>
                </div>

                {/* Active combination rows */}
                {combinations.length === 0 && (
                  <p className="font-body text-xs text-text-muted italic text-center py-2">
                    Aucune combinaison — ajoutez-en une ci-dessous
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {combinations.map((combo, i) => (
                    <div
                      key={`${combo.basis}-${combo.hamiltonian}-${i}`}
                      className={`flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg bg-bg-base border border-border-subtle border-l-2 ${COMBO_BORDER[i % COMBO_BORDER.length]}`}
                    >
                      <span className={`px-2 py-0.5 rounded font-mono text-xs font-medium ${COMBO_BASIS[i % COMBO_BASIS.length]}`}>
                        {combo.basis}
                      </span>
                      <span className="text-text-muted font-body text-xs select-none">＋</span>
                      <span className={`px-2 py-0.5 rounded font-mono text-xs ${COMBO_HAMI[i % COMBO_HAMI.length]}`}>
                        {combo.hamiltonian}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCombination(i)}
                        aria-label={`Retirer ${combo.basis} + ${combo.hamiltonian}`}
                        className="ml-auto w-5 h-5 rounded flex items-center justify-center text-text-muted text-sm font-bold hover:text-error hover:bg-red-50 transition-colors duration-150"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add combination */}
                {combinations.length < MAX_COMBOS && (
                  <div className="flex flex-col gap-2.5 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="font-body text-xs text-text-muted">Base</label>
                        <select
                          value={selBasis}
                          onChange={(e) => { setSelBasis(e.target.value as BasisType); setAddError(null); }}
                          className="px-2.5 py-1.5 rounded-lg bg-bg-base border border-border-subtle text-text-primary font-body text-xs outline-none focus:border-primary transition-colors duration-150 cursor-pointer"
                        >
                          {BASIS_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-body text-xs text-text-muted">Hamiltonien</label>
                        <select
                          value={selHami}
                          onChange={(e) => { setSelHami(e.target.value as HamiType); setAddError(null); }}
                          className="px-2.5 py-1.5 rounded-lg bg-bg-base border border-border-subtle text-text-primary font-body text-xs outline-none focus:border-primary transition-colors duration-150 cursor-pointer"
                        >
                          {HAMI_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    </div>
                    {addError && (
                      <p className="font-body text-xs text-warning">{addError}</p>
                    )}
                    <button
                      type="button"
                      onClick={addCombination}
                      className="w-full py-2 rounded-lg bg-bg-base border border-dashed border-border-subtle font-body text-xs text-text-muted hover:border-primary/50 hover:text-primary hover:bg-blue-50 transition-all duration-150 flex items-center justify-center gap-1.5"
                    >
                      <span className="text-base leading-none" aria-hidden="true">＋</span>
                      Ajouter cette combinaison
                    </button>
                  </div>
                )}
              </div>

              <div className="h-px bg-border-subtle" />

              {/* Shared sliders */}
              <div className="flex flex-col gap-4">
                <ParamSlider label="N — Fonctions de base" name="N"
                  value={sharedParams.N} min={4} max={40} step={1}
                  onChange={handleSharedChange} />
                {hasSinus && (
                  <ParamSlider label="L — Longueur de boîte" name="L"
                    value={sharedParams.L} min={4} max={30} step={0.5} unit="a₀"
                    description="Requis pour les bases sinus uniquement"
                    onChange={handleSharedChange} />
                )}
                <ParamSlider label="Δτ — Pas de temps" name="dt"
                  value={sharedParams.dt} min={0.001} max={0.1} step={0.001}
                  onChange={handleSharedChange} />
                <ParamSlider label="τ_max — Temps imaginaire" name="tau_max"
                  value={sharedParams.tau_max} min={0.5} max={20} step={0.5} unit="ℏ⁻¹"
                  onChange={handleSharedChange} />
                <ParamSlider label="ω — Fréquence propre" name="omega"
                  value={sharedParams.omega} min={0.1} max={5} step={0.1} unit="rad·s⁻¹"
                  onChange={handleSharedChange} />
              </div>

              <div className="h-px bg-border-subtle" />

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
                        sharedParams.graphs.includes(key)
                          ? 'bg-indigo-100 border border-indigo-300 text-indigo-700'
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

        {/* ── RIGHT: Results ─────────────────────────────────────────────── */}
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
                  <BasesResultTable combinations={combosData} />

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
          module="bases"
          onClose={() => setShowEmailForm(false)}
        />
      )}
    </>
  );
}
