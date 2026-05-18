import { useState, useRef, useEffect, useCallback } from 'react';
import ParamSlider from './ParamSlider';

// ─── gif.js global type ───────────────────────────────────────────────────────
declare global {
  interface Window {
    GIF: new (options: {
      workers: number;
      quality: number;
      width: number;
      height: number;
      workerScript: string;
    }) => {
      addFrame: (img: HTMLImageElement, opts: { delay: number }) => void;
      on: (event: 'finished', cb: (blob: Blob) => void) => void;
      render: () => void;
    };
  }
}

// ─── SpatialHash ─────────────────────────────────────────────────────────────
class SpatialHash {
  cellSize: number;
  gridSize: number;
  cells: Map<number, number[]>;

  constructor(cellSize: number) {
    this.cellSize = Math.max(cellSize, 0.01);
    this.gridSize = Math.ceil(1.0 / this.cellSize);
    this.cells = new Map();
  }

  key(cx: number, cy: number): number {
    const gx = ((cx % this.gridSize) + this.gridSize) % this.gridSize;
    const gy = ((cy % this.gridSize) + this.gridSize) % this.gridSize;
    return gx * this.gridSize + gy;
  }

  build(positions: Float32Array, N: number): void {
    this.cells.clear();
    for (let i = 0; i < N; i++) {
      const cx = Math.floor(positions[i * 2] / this.cellSize);
      const cy = Math.floor(positions[i * 2 + 1] / this.cellSize);
      const k = this.key(cx, cy);
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k)!.push(i);
    }
  }

  query(px: number, py: number, r: number): number[] {
    const result: number[] = [];
    const span = Math.ceil(r / this.cellSize);
    const cx0 = Math.floor(px / this.cellSize);
    const cy0 = Math.floor(py / this.cellSize);
    for (let dx = -span; dx <= span; dx++) {
      for (let dy = -span; dy <= span; dy++) {
        const k = this.key(cx0 + dx, cy0 + dy);
        const cell = this.cells.get(k);
        if (cell) result.push(...cell);
      }
    }
    return result;
  }
}

// ─── Simulation update ────────────────────────────────────────────────────────
function updateFish(
  positions: Float32Array,
  orientations: Float32Array,
  params: {
    vi: number; dt: number;
    r_align: number; eta: number;
    d_rep: number; d_att: number; r_ressort: number;
    k_rep: number; k_att: number;
  },
  hash: SpatialHash,
  N: number,
  forces: Float32Array,
): void {
  const { vi, dt, r_align, eta, d_rep, d_att, r_ressort, k_rep, k_att } = params;

  hash.build(positions, N);
  forces.fill(0);

  const newOrientations = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const px = positions[i * 2];
    const py = positions[i * 2 + 1];
    const candidates = hash.query(px, py, r_ressort * 1.2);

    let fx = 0, fy = 0;
    let sinSum = 0, cosSum = 0;
    let alignCount = 0;

    for (const j of candidates) {
      if (j === i) continue;

      let dx = positions[j * 2] - px;
      let dy = positions[j * 2 + 1] - py;

      if (dx >  0.5) dx -= 1.0;
      if (dx < -0.5) dx += 1.0;
      if (dy >  0.5) dy -= 1.0;
      if (dy < -0.5) dy += 1.0;

      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1e-5 || dist === Infinity) continue;

      const nx = dx / dist;
      const ny = dy / dist;

      // Dead zone force model
      let F = 0;
      if (dist < d_rep) {
        F = -k_rep * (dist - d_rep);           // repulsion
      } else if (dist > d_att && dist < r_ressort) {
        F = -k_att * (dist - d_att);           // attraction
      }
      // dead zone [d_rep, d_att]: F stays 0

      fx += F * nx;
      fy += F * ny;

      if (dist < r_align) {
        sinSum += Math.sin(orientations[j]);
        cosSum += Math.cos(orientations[j]);
        alignCount++;
      }
    }

    forces[i * 2]     = fx;
    forces[i * 2 + 1] = fy;

    const noise = (Math.random() - 0.5) * eta;
    newOrientations[i] = alignCount > 0
      ? Math.atan2(sinSum, cosSum) + noise
      : orientations[i] + noise;
  }

  for (let i = 0; i < N; i++) {
    const vx = vi * Math.cos(newOrientations[i]) + forces[i * 2]     * dt;
    const vy = vi * Math.sin(newOrientations[i]) + forces[i * 2 + 1] * dt;
    positions[i * 2]     = ((positions[i * 2]     + vx * dt) % 1 + 1) % 1;
    positions[i * 2 + 1] = ((positions[i * 2 + 1] + vy * dt) % 1 + 1) % 1;
    orientations[i]      = newOrientations[i];
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function drawFish(
  ctx: CanvasRenderingContext2D,
  positions: Float32Array,
  orientations: Float32Array,
  forces: Float32Array,
  N: number,
): void {
  const blue: number[] = [];
  const green: number[] = [];
  const red: number[] = [];

  for (let i = 0; i < N; i++) {
    const fx = forces[i * 2];
    const fy = forces[i * 2 + 1];
    const fmag = Math.sqrt(fx * fx + fy * fy);
    if (fmag < 1)  blue.push(i);
    else if (fmag < 10) green.push(i);
    else red.push(i);
  }

  const drawBucket = (bucket: number[], color: string) => {
    if (bucket.length === 0) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const i of bucket) {
      const cx = positions[i * 2] * 600;
      const cy = positions[i * 2 + 1] * 600;
      const θ = orientations[i];
      ctx.moveTo(cx + Math.cos(θ) * 8, cy + Math.sin(θ) * 8);
      ctx.lineTo(cx + Math.cos(θ + 2.4) * 4, cy + Math.sin(θ + 2.4) * 4);
      ctx.lineTo(cx + Math.cos(θ - 2.4) * 4, cy + Math.sin(θ - 2.4) * 4);
      ctx.closePath();
    }
    ctx.fill();
  };

  drawBucket(blue,  '#3b82f6');
  drawBucket(green, '#10b981');
  drawBucket(red,   '#ef4444');
}

// ─── Types ────────────────────────────────────────────────────────────────────
type GifStatus = 'idle' | 'recording' | 'encoding' | 'done';
interface GifState { status: GifStatus; url?: string; frameCount: number; }

// ─── Zone Diagram ─────────────────────────────────────────────────────────────
function ZoneDiagram({ d_rep, d_att, r_ressort }: { d_rep: number; d_att: number; r_ressort: number }) {
  const SIZE = 180;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const scale = 80 / Math.max(r_ressort, 0.001);
  const rRes = 80;
  const rAtt = Math.min(d_att * scale, rRes - 1);
  const rRep = Math.min(d_rep * scale, rAtt - 1);

  return (
    <div className="flex flex-col items-center gap-2.5">
      <span className="font-display text-xs text-text-muted uppercase tracking-widest self-start">
        Zones d'interaction
      </span>
      <svg
        width={SIZE} height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="rounded-xl border border-border-subtle bg-bg-surface2 block"
      >
        {/* Attraction ring (d_att → r_ressort) */}
        <circle cx={cx} cy={cy} r={rRes} fill="#dbeafe" />
        {/* Dead zone ring (d_rep → d_att) */}
        <circle cx={cx} cy={cy} r={Math.max(rAtt, 0)} fill="#f1f5f9" />
        {/* Repulsion zone (0 → d_rep) */}
        <circle cx={cx} cy={cy} r={Math.max(rRep, 0)} fill="#fee2e2" />

        {/* Boundary strokes */}
        <circle cx={cx} cy={cy} r={rRes}              fill="none" stroke="#93c5fd" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={Math.max(rAtt, 0)} fill="none" stroke="#94a3b8" strokeWidth="1"   strokeDasharray="4 3" />
        <circle cx={cx} cy={cy} r={Math.max(rRep, 0)} fill="none" stroke="#fca5a5" strokeWidth="1.5" />

        {/* Fish (triangle pointing right) */}
        <polygon
          points={`${cx + 7},${cy} ${cx - 4},${cy - 4.5} ${cx - 4},${cy + 4.5}`}
          fill="#0f172a"
        />
      </svg>
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {([
          ['bg-red-100 border-red-300',   'Répulsion'],
          ['bg-slate-100 border-slate-300', 'Zone neutre'],
          ['bg-blue-100 border-blue-300',  'Attraction'],
        ] as const).map(([cls, label]) => (
          <span key={label} className="flex items-center gap-1 font-body text-xs text-text-secondary">
            <span className={`w-2.5 h-2.5 rounded-full border flex-shrink-0 ${cls}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

const N = 200;

// ─── Component ───────────────────────────────────────────────────────────────
export default function FishSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef({
    vi: 0.25, dt: 0.025,
    r_align: 0.10, eta: 0.90,
    d_rep: 0.045, d_att: 0.145, r_ressort: 0.20,
    k_rep: 5.0, k_att: 0.5,
  });
  const fishRef = useRef<{ positions: Float32Array; orientations: Float32Array } | null>(null);
  const forcesRef = useRef<Float32Array | null>(null);
  const hashRef = useRef<SpatialHash | null>(null);
  const animFrameRef = useRef<number>(0);
  const isRunningRef = useRef(true);
  const lastTimeRef = useRef(0);
  const fpsRef = useRef(0);
  const capturedFramesRef = useRef<string[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gifLoadedRef = useRef(false);

  const [isRunning, setIsRunning] = useState(true);
  const [sliderValues, setSliderValues] = useState({
    vi: 0.25, r_align: 0.10, eta: 0.90,
    d_rep: 0.045, d_att: 0.145, r_ressort: 0.20,
    k_rep: 5.0, k_att: 0.5,
  });
  const [stats, setStats] = useState({ fps: 0, avgSpeed: 0.1, avgForce: 0 });
  const [gifState, setGifState] = useState<GifState>({ status: 'idle', frameCount: 0 });

  // ── Animation loop ────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    if (!canvasRef.current || !fishRef.current || !forcesRef.current || !hashRef.current) return;

    const elapsed = timestamp - lastTimeRef.current;
    if (lastTimeRef.current > 0 && elapsed > 0) {
      fpsRef.current = Math.round(1000 / elapsed);
    }
    lastTimeRef.current = timestamp;

    const ctx = canvasRef.current.getContext('2d')!;
    const { positions, orientations } = fishRef.current;

    if (isRunningRef.current) {
      updateFish(positions, orientations, paramsRef.current, hashRef.current, N, forcesRef.current);
    }

    ctx.fillStyle = '#0d1421';
    ctx.fillRect(0, 0, 600, 600);
    drawFish(ctx, positions, orientations, forcesRef.current, N);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px monospace';
    ctx.fillText(`${fpsRef.current} fps`, 8, 16);

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const positions = new Float32Array(N * 2);
    const orientations = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      positions[i * 2]     = Math.random();
      positions[i * 2 + 1] = Math.random();
      const angle = Math.random() * 2 * Math.PI;
      orientations[i] = angle;
    }
    const forces = new Float32Array(N * 2);
    forcesRef.current = forces;
    fishRef.current = { positions, orientations };

    const p = paramsRef.current;
    const hash = new SpatialHash(Math.max(p.r_align, p.r_ressort) * 1.5);
    hashRef.current = hash;

    for (let step = 0; step < 100; step++) {
      updateFish(positions, orientations, p, hash, N, forces);
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [animate]);

  // ── Stats interval ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const forces = forcesRef.current;
      let avgForce = 0;
      if (forces) {
        for (let i = 0; i < N; i++) {
          const fx = forces[i * 2], fy = forces[i * 2 + 1];
          avgForce += Math.sqrt(fx * fx + fy * fy);
        }
        avgForce /= N;
      }
      setStats({
        fps: fpsRef.current,
        avgSpeed: paramsRef.current.vi,
        avgForce: Math.round(avgForce * 1000) / 1000,
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleParamChange = (name: string, value: number) => {
    setSliderValues(prev => ({ ...prev, [name]: value }));
    const newParams = { ...paramsRef.current, [name]: value };
    paramsRef.current = newParams;
    if (['r_align', 'r_ressort', 'd_rep', 'd_att'].includes(name)) {
      hashRef.current = new SpatialHash(Math.max(newParams.r_align, newParams.r_ressort) * 1.5);
    }
  };

  const togglePause = () => {
    isRunningRef.current = !isRunningRef.current;
    setIsRunning(isRunningRef.current);
  };

  const reset = () => {
    const positions = new Float32Array(N * 2);
    const orientations = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      positions[i * 2]     = Math.random();
      positions[i * 2 + 1] = Math.random();
      const angle = Math.random() * 2 * Math.PI;
      orientations[i] = angle;
    }
    const forces = new Float32Array(N * 2);
    forcesRef.current = forces;
    fishRef.current = { positions, orientations };
    const hash = hashRef.current!;
    for (let step = 0; step < 100; step++) {
      updateFish(positions, orientations, paramsRef.current, hash, N, forces);
    }
  };

  const snapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'poissons-snapshot.png';
    a.click();
  };

  const encodeGif = () => {
    setGifState(prev => ({ ...prev, status: 'encoding' }));

    const doEncode = () => {
      const GIFClass = window.GIF;
      const gif = new GIFClass({
        workers: 2,
        quality: 10,
        width: 600,
        height: 600,
        workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
      });

      const frames = capturedFramesRef.current;
      let loaded = 0;
      const images: HTMLImageElement[] = new Array(frames.length);

      frames.forEach((dataUrl, idx) => {
        const img = new Image();
        img.onload = () => {
          images[idx] = img;
          loaded++;
          if (loaded === frames.length) {
            images.forEach(im => gif.addFrame(im, { delay: 83 }));
            gif.on('finished', (blob: Blob) => {
              setGifState({ status: 'done', url: URL.createObjectURL(blob), frameCount: 60 });
            });
            gif.render();
          }
        };
        img.src = dataUrl;
      });
    };

    if (gifLoadedRef.current) {
      doEncode();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js';
      script.onload = () => { gifLoadedRef.current = true; doEncode(); };
      document.head.appendChild(script);
    }
  };

  const startRecording = () => {
    capturedFramesRef.current = [];
    setGifState({ status: 'recording', frameCount: 0 });

    recordingIntervalRef.current = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      capturedFramesRef.current.push(canvas.toDataURL('image/png'));
      const count = capturedFramesRef.current.length;
      setGifState(prev => ({ ...prev, frameCount: count }));
      if (count >= 60) {
        clearInterval(recordingIntervalRef.current!);
        recordingIntervalRef.current = null;
        encodeGif();
      }
    }, 83);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 pb-16">

      {/* ── LEFT: Controls ─────────────────────────────────────────────── */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-border-subtle bg-white overflow-hidden">

          {/* Header */}
          <div className="px-5 py-4 border-b border-border-subtle flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0 text-base">
              🐟
            </div>
            <div>
              <h2 className="font-display font-semibold text-text-primary text-sm">
                Paramètres de simulation
              </h2>
              <p className="font-body text-xs text-text-muted">N = {N} poissons · Temps réel</p>
            </div>
          </div>

          <div className="px-5 py-5 flex flex-col gap-5">

            {/* Sliders */}
            <div className="flex flex-col gap-4">
              <ParamSlider label="Vitesse" name="vi"
                value={sliderValues.vi} min={0.1} max={2.0} step={0.05}
                onChange={handleParamChange} />
              <ParamSlider label="Rayon d'alignement" name="r_align"
                value={sliderValues.r_align} min={0.01} max={0.3} step={0.01}
                onChange={handleParamChange} />
              <ParamSlider label="Bruit (η)" name="eta"
                value={sliderValues.eta} min={0.0} max={2.0} step={0.05}
                onChange={handleParamChange} />
              <ParamSlider label="Zone répulsion" name="d_rep"
                value={sliderValues.d_rep} min={0.01} max={0.2} step={0.005}
                onChange={handleParamChange} />
              <ParamSlider label="Zone attraction" name="d_att"
                value={sliderValues.d_att} min={0.05} max={0.3} step={0.005}
                onChange={handleParamChange} />
              <ParamSlider label="Rayon ressort" name="r_ressort"
                value={sliderValues.r_ressort} min={0.05} max={0.4} step={0.01}
                onChange={handleParamChange} />
              <ParamSlider label="Force répulsion" name="k_rep"
                value={sliderValues.k_rep} min={1} max={60} step={1}
                onChange={handleParamChange} />
              <ParamSlider label="Force attraction" name="k_att"
                value={sliderValues.k_att} min={0.5} max={20} step={0.5}
                onChange={handleParamChange} />
            </div>

            <ZoneDiagram
              d_rep={sliderValues.d_rep}
              d_att={sliderValues.d_att}
              r_ressort={sliderValues.r_ressort}
            />

            <div className="h-px bg-border-subtle" />

            {/* Control buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={togglePause}
                className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-display font-semibold text-xs transition-colors duration-150"
              >
                {isRunning ? '⏸ Pause' : '▶ Reprendre'}
              </button>
              <button
                type="button"
                onClick={reset}
                className="flex-1 py-2 rounded-lg bg-white border border-border-subtle text-text-secondary font-display font-semibold text-xs hover:border-primary/40 hover:text-text-primary transition-all duration-150"
              >
                🔄 Réinitialiser
              </button>
            </div>
            <button
              type="button"
              onClick={snapshot}
              className="w-full py-2 rounded-lg bg-white border border-border-subtle text-text-secondary font-display font-semibold text-xs hover:border-primary/40 hover:text-text-primary transition-all duration-150"
            >
              📸 Snapshot PNG
            </button>

            <div className="h-px bg-border-subtle" />

            {/* Stats */}
            <div className="rounded-xl bg-bg-surface2 border border-border-subtle p-4 flex flex-col gap-2">
              <span className="font-display text-xs text-text-muted uppercase tracking-widest mb-1">
                Statistiques
              </span>
              {[
                { label: 'FPS', value: String(stats.fps) },
                { label: 'Poissons', value: String(N) },
                { label: 'Vitesse moy.', value: stats.avgSpeed.toFixed(2) },
                { label: 'Force moy.', value: stats.avgForce.toFixed(3) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="font-body text-xs text-text-secondary">{label}</span>
                  <span className="font-mono text-xs font-medium text-text-primary tabular-nums">{value}</span>
                </div>
              ))}
            </div>

            <div className="h-px bg-border-subtle" />

            {/* Color legend */}
            <div className="flex flex-col gap-2">
              <span className="font-display text-xs text-text-muted uppercase tracking-widest">
                Légende
              </span>
              {[
                { color: '#ef4444', label: 'Rouge — répulsion (trop proches)' },
                { color: '#3b82f6', label: 'Bleu — zone morte (équilibre)' },
                { color: '#10b981', label: 'Vert — attraction (trop éloignés)' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
                  <span className="font-body text-xs text-text-secondary">{label}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* ── RIGHT: Canvas + GIF export ─────────────────────────────────── */}
      <div className="flex flex-col gap-6 min-w-0">

        {/* Canvas */}
        <div className="relative w-full" style={{ maxWidth: '600px' }}>
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            className="w-full h-auto rounded-xl border border-border-subtle block"
            style={{ background: '#0d1421' }}
          />
          {/* Status badge */}
          <div className="absolute top-3 right-3 pointer-events-none">
            {isRunning ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 font-mono text-xs text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                EN DIRECT
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 font-mono text-xs text-amber-300">
                ⏸ PAUSE
              </span>
            )}
          </div>
        </div>

        {/* GIF Export */}
        <div className="rounded-xl border border-border-subtle bg-white p-5">
          <h3 className="font-display font-semibold text-text-primary text-sm mb-4">
            Export GIF
          </h3>

          {gifState.status === 'idle' && (
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-display font-semibold text-sm transition-colors duration-150"
            >
              ⏺ Enregistrer GIF (5s)
            </button>
          )}

          {gifState.status === 'recording' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-body text-sm text-text-secondary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Enregistrement…
                </span>
                <span className="font-mono text-xs text-text-muted">
                  {gifState.frameCount}/60 frames
                </span>
              </div>
              <div className="w-full h-2 bg-bg-surface2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-100"
                  style={{ width: `${(gifState.frameCount / 60) * 100}%` }}
                />
              </div>
            </div>
          )}

          {gifState.status === 'encoding' && (
            <div className="flex items-center gap-3 text-sm text-text-secondary">
              <svg className="w-4 h-4 animate-spin text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Encodage en cours…
            </div>
          )}

          {gifState.status === 'done' && gifState.url && (
            <div className="flex flex-col gap-4">
              <img
                src={gifState.url}
                alt="Aperçu GIF"
                className="rounded-lg border border-border-subtle w-32 h-32 object-cover"
              />
              <div className="flex flex-wrap gap-3">
                <a
                  href={gifState.url}
                  download="poissons.gif"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-display font-semibold text-sm transition-colors duration-150"
                >
                  ⬇ Télécharger GIF
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setGifState({ status: 'idle', frameCount: 0 });
                    capturedFramesRef.current = [];
                  }}
                  className="px-4 py-2 rounded-xl bg-white border border-border-subtle text-text-secondary font-display font-semibold text-sm hover:border-primary/40 hover:text-text-primary transition-all duration-150"
                >
                  ⏺ Nouveau GIF
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
