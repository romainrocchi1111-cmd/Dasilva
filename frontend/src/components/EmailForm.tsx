import { useState, useEffect, useCallback, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';

export interface FigureInfo {
  key: string;
  title: string;
  src: string;
}

export interface EmailFormProps {
  figures: FigureInfo[];
  module: 'parity' | 'bases';
  onClose: () => void;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export default function EmailForm({ figures, module, onClose }: EmailFormProps) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(figures.map((f) => f.key))
  );
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const emailOk = EMAIL_RE.test(email);
  const showEmailError = touched && email.length > 0 && !emailOk;
  const canSubmit = emailOk && selected.size > 0 && status !== 'loading';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'loading') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [status, onClose]);

  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [status, onClose]);

  const toggleFigure = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus('loading');
    setErrorMsg('');

    const payload = {
      email,
      module,
      figures: figures
        .filter((f) => selected.has(f.key))
        .map((f) => ({ filename: `${f.key}.png`, data_b64: f.src, caption: f.title })),
    };

    const base = 'https://captivating-strength-production-9142.up.railway.app';

    try {
      const res = await fetch(`${base}/api/send-graphs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail ?? `HTTP ${res.status}`);
      }
      if (data.success === false) {
        setStatus('error');
        setErrorMsg(data.message ?? 'Envoi échoué.');
        return;
      }
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue.');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && status !== 'loading') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-border-subtle overflow-hidden"
        style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-form-title"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2
            id="email-form-title"
            className="font-display font-semibold text-text-primary flex items-center gap-2"
          >
            <span aria-hidden="true">📧</span>
            Recevoir les graphiques
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'loading'}
            aria-label="Fermer"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted text-lg
                       hover:text-text-primary hover:bg-bg-surface2 transition-colors duration-150
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {/* ── Success state ── */}
          {status === 'success' ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-success"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p className="font-display font-semibold text-text-primary">
                  Email envoyé avec succès !
                </p>
                <p className="font-body text-sm text-text-secondary mt-1">
                  Fermeture automatique dans 2,5 secondes…
                </p>
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              {/* Email field */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="ef-email"
                  className="font-display text-sm text-text-secondary"
                >
                  Votre adresse email
                </label>
                <input
                  id="ef-email"
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="vous@exemple.fr"
                  autoComplete="email"
                  className={[
                    'w-full px-4 py-2.5 rounded-xl bg-bg-base border font-body text-sm',
                    'text-text-primary placeholder-text-muted outline-none',
                    'transition-all duration-200',
                    showEmailError
                      ? 'border-error focus:border-error focus:ring-1 focus:ring-error/25'
                      : 'border-border-subtle focus:border-primary focus:ring-1 focus:ring-primary/20',
                  ].join(' ')}
                />
                {showEmailError && (
                  <p className="font-body text-xs text-error">
                    Veuillez entrer une adresse email valide.
                  </p>
                )}
              </div>

              {/* Figure selection */}
              <div className="flex flex-col gap-2.5">
                <p className="font-display text-sm text-text-secondary">
                  Sélectionner les graphiques à envoyer
                </p>
                <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                  {figures.map((fig) => (
                    <label
                      key={fig.key}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
                                 bg-bg-base border border-border-subtle select-none
                                 hover:border-primary/40 hover:bg-blue-50 transition-all duration-150"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(fig.key)}
                        onChange={() => toggleFigure(fig.key)}
                        className="w-4 h-4 rounded accent-primary cursor-pointer flex-shrink-0"
                      />
                      <span className="font-body text-sm text-text-secondary">
                        {fig.title}
                      </span>
                    </label>
                  ))}
                </div>
                {selected.size === 0 && (
                  <p className="font-body text-xs text-warning">
                    Sélectionnez au moins un graphique.
                  </p>
                )}
              </div>

              {/* Error banner */}
              {status === 'error' && errorMsg && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
                  <span className="text-error flex-shrink-0 text-sm mt-0.5">⚠</span>
                  <p className="font-body text-xs text-error leading-relaxed">{errorMsg}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className={[
                  'w-full py-3 rounded-xl font-display font-semibold text-sm',
                  'flex items-center justify-center gap-2',
                  'transition-all duration-200',
                  canSubmit
                    ? 'bg-primary hover:bg-primary-hover text-white'
                    : 'bg-bg-surface2 text-text-muted border border-border-subtle cursor-not-allowed opacity-60',
                ].join(' ')}
              >
                {status === 'loading' ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Envoi en cours…</span>
                  </>
                ) : (
                  <>
                    <span>Envoyer</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
