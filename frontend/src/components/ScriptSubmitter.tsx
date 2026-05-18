import { useState, useRef, useCallback } from 'react';

const BACKEND = 'https://dasilva-production.up.railway.app';

const PROGRESS_STEPS = [
  'Vérification de la syntaxe...',
  'Analyse de sécurité...',
  'Exécution du script...',
  'Envoi de la notification...',
];

type Status = 'idle' | 'loading' | 'success' | 'error';
type FieldErrors = Partial<Record<'name' | 'author' | 'description' | 'password' | 'file', string>>;

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600 font-body">{msg}</p>;
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block font-display font-medium text-sm text-text-primary mb-1.5">
      {children}
    </label>
  );
}

const inputBase =
  'w-full px-4 py-2.5 rounded-lg border font-body text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 transition-colors duration-150';
const inputNormal = `${inputBase} border-border-subtle bg-white focus:ring-primary/30 focus:border-primary/60`;
const inputError = `${inputBase} border-red-300 bg-white focus:ring-red-200`;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:text/plain;base64,<b64>" — extract only the b64 part
      const b64 = result.split(',')[1] ?? btoa(result);
      resolve(b64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ScriptSubmitter() {
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const acceptFile = useCallback((f: File) => {
    if (!f.name.endsWith('.py')) {
      setFieldErrors((prev) => ({ ...prev, file: 'Seuls les fichiers .py sont acceptés.' }));
      return;
    }
    if (f.size > 100_000) {
      setFieldErrors((prev) => ({ ...prev, file: 'Fichier trop volumineux (max 100 KB).' }));
      return;
    }
    setFile(f);
    setFieldErrors((prev) => ({ ...prev, file: undefined }));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) acceptFile(dropped);
    },
    [acceptFile],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = 'Champ requis.';
    if (!author.trim()) errors.author = 'Champ requis.';
    if (description.trim().length < 20) errors.description = 'Minimum 20 caractères.';
    if (!password) errors.password = 'Champ requis.';
    if (!file) errors.file = 'Fichier Python requis.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setStatus('loading');
    setErrorMsg('');
    setProgressStep(0);

    let step = 0;
    intervalRef.current = setInterval(() => {
      step = Math.min(step + 1, PROGRESS_STEPS.length - 1);
      setProgressStep(step);
    }, 12_000);

    try {
      const fileB64 = await readFileAsBase64(file!);

      const res = await fetch(`${BACKEND}/api/submit-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          author,
          description,
          password,
          filename: file!.name,
          file_content: fileB64,
        }),
      });

      console.log('Response status:', res.status);
      console.log('Response ok:', res.ok);

      const data: { detail?: unknown; message?: unknown } = await res
        .json()
        .catch(() => ({ detail: 'Réponse invalide du serveur' }));

      console.log('Response data:', JSON.stringify(data));

      if (!res.ok) {
        const message =
          typeof data.detail === 'string'
            ? data.detail
            : Array.isArray(data.detail)
              ? (data.detail as Array<{ msg?: string }>).map((e) => e.msg ?? JSON.stringify(e)).join(', ')
              : JSON.stringify(data.detail) ?? 'Erreur serveur';
        if (res.status === 403) throw new Error('Mot de passe incorrect');
        throw new Error(message);
      }
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      const raw = err instanceof Error ? err.message : 'Erreur inconnue';
      if (raw.includes('Imports non autorisés')) {
        const imports = raw.split(':')[1]?.trim() ?? '';
        setErrorMsg(`Script refusé : imports non autorisés détectés (${imports})`);
      } else if (raw.includes('délai')) {
        setErrorMsg('Le script a dépassé le délai de 60 secondes');
      } else if (raw.includes('ni graphique')) {
        setErrorMsg('Le script ne produit ni graphique ni valeur numérique détectable');
      } else {
        setErrorMsg(raw);
      }
    } finally {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  const reset = () => {
    setStatus('idle');
    setErrorMsg('');
    setFile(null);
    setName('');
    setAuthor('');
    setDescription('');
    setPassword('');
    setProgressStep(0);
    setFieldErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── Success ── */
  if (status === 'success') {
    return (
      <div className="max-w-2xl pb-16">
        <div className="rounded-2xl p-10 bg-emerald-50 border border-emerald-200 text-center">
          <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center">
            <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display font-bold text-xl text-emerald-800 mb-3">Script soumis avec succès !</h2>
          <p className="font-body text-sm text-emerald-700 leading-relaxed mb-7 max-w-sm mx-auto">
            Nous avons bien reçu votre script. Romain va l&apos;examiner et vous contactera si le module est intégré.
          </p>
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-display font-medium text-sm transition-colors duration-150"
          >
            Soumettre un autre script
          </button>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  const isLoading = status === 'loading';

  return (
    <div className="max-w-2xl pb-16">
      <form onSubmit={handleSubmit} noValidate className="space-y-6">

        {/* Name */}
        <div>
          <Label htmlFor="sc-name">
            Nom du module <span className="text-red-500">*</span>
          </Label>
          <input
            id="sc-name"
            type="text"
            maxLength={60}
            placeholder="ex: Oscillateur anharmonique"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            className={fieldErrors.name ? inputError : inputNormal}
          />
          <FieldError msg={fieldErrors.name} />
        </div>

        {/* Author */}
        <div>
          <Label htmlFor="sc-author">
            Auteur <span className="text-red-500">*</span>
          </Label>
          <input
            id="sc-author"
            type="text"
            maxLength={60}
            placeholder="Votre nom"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            disabled={isLoading}
            className={fieldErrors.author ? inputError : inputNormal}
          />
          <FieldError msg={fieldErrors.author} />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="sc-desc">
            Description <span className="text-red-500">*</span>
          </Label>
          <textarea
            id="sc-desc"
            rows={4}
            maxLength={500}
            placeholder="Décrivez ce que fait votre script, ses paramètres, ses résultats attendus..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            className={`${fieldErrors.description ? inputError : inputNormal} resize-none`}
          />
          <div className="flex items-start justify-between mt-1">
            <FieldError msg={fieldErrors.description} />
            <span className="text-xs text-text-muted font-mono ml-auto">{description.length}/500</span>
          </div>
        </div>

        {/* Password */}
        <div>
          <Label htmlFor="sc-password">
            Mot de passe <span className="text-red-500">*</span>
          </Label>
          <input
            id="sc-password"
            type="password"
            placeholder="Mot de passe d'accès"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className={fieldErrors.password ? inputError : inputNormal}
          />
          <FieldError msg={fieldErrors.password} />
        </div>

        {/* File drop zone */}
        <div>
          <Label htmlFor="sc-file">
            Fichier Python (.py) <span className="text-red-500">*</span>
          </Label>
          <div
            role="button"
            tabIndex={0}
            aria-label="Zone de dépôt de fichier"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !isLoading && fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            className={[
              'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors duration-150 select-none',
              dragOver
                ? 'border-primary bg-primary/5'
                : fieldErrors.file
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-border-subtle bg-bg-base hover:border-primary/40',
              isLoading ? 'pointer-events-none opacity-60' : '',
            ].join(' ')}
          >
            <input
              ref={fileInputRef}
              id="sc-file"
              type="file"
              accept=".py"
              onChange={handleFileChange}
              className="sr-only"
            />

            {file ? (
              <>
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-mono text-sm text-text-primary font-medium">{file.name}</p>
                  <p className="font-body text-xs text-text-muted mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-text-muted hover:text-red-500 font-body underline transition-colors"
                >
                  Changer de fichier
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-lg bg-bg-surface2 border border-border-subtle flex items-center justify-center">
                  <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-body text-sm text-text-secondary">
                    Glissez votre fichier ici ou{' '}
                    <span className="text-primary font-medium">cliquez pour parcourir</span>
                  </p>
                  <p className="font-body text-xs text-text-muted mt-1">Fichiers .py uniquement — max 100 KB</p>
                </div>
              </>
            )}
          </div>
          <FieldError msg={fieldErrors.file} />
        </div>

        {/* Progress steps */}
        {isLoading && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <p className="font-display font-medium text-sm text-blue-800 mb-4">
              Validation en cours... (max 60s)
            </p>
            <div className="space-y-2.5">
              {PROGRESS_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-3">
                  <div className={[
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-500',
                    i < progressStep
                      ? 'bg-blue-500'
                      : i === progressStep
                        ? 'bg-blue-400 animate-pulse'
                        : 'bg-blue-100 border border-blue-200',
                  ].join(' ')}>
                    {i < progressStep && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={[
                    'font-body text-sm transition-colors duration-500',
                    i <= progressStep ? 'text-blue-800 font-medium' : 'text-blue-400',
                  ].join(' ')}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error banner */}
        {status === 'error' && errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-body text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2.5 px-8 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-display font-semibold text-sm transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Validation...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Soumettre le script
              </>
            )}
          </button>
          {status === 'error' && (
            <button
              type="button"
              onClick={() => { setStatus('idle'); setErrorMsg(''); }}
              className="font-body text-sm text-text-secondary hover:text-text-primary underline transition-colors"
            >
              Réessayer
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
