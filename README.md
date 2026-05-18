# Portail Scientifique — Simulation Quantique Interactive

> Application web full-stack pour simuler la mécanique quantique (propagation en temps imaginaire, oscillateur harmonique) depuis le navigateur.
> Romain Rocchi — CPES L3 — 2026

## Stack

| Couche | Technologie |
|---|---|
| Frontend | Astro 4 + React 18 + Tailwind CSS + TypeScript |
| Backend | FastAPI + Python 3.11 + NumPy/SciPy/Matplotlib |
| Email | Resend API |
| Deploy Frontend | Vercel |
| Deploy Backend | Railway |

---

## Démarrage local

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # remplir RESEND_API_KEY
uvicorn main:app --reload
# → http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_BACKEND_URL=http://localhost:8000
npm run dev
# → http://localhost:4321
```

---

## Ajouter les scripts Python

Placez ces fichiers dans `backend/core/` :

| Fichier | Contenu attendu |
|---|---|
| `base.py` | `SineBasis`, `LegendreBasis`, `HermiteBasis` |
| `Hami.py` | `HamiltonianBuilder` |
| `Hamiltonien1.py` | `HamiltonianBuilderSecondDerivative` |
| `Reso.py` | `ImaginaryTimePropagator` |
| `excited_state_propagator.py` | `ExcitedStatePropagator` |
| `parity_propagator.py` | `ParityPropagator`, `ParitySelector` |
| `Analyse.py` | `AnalysisTools` (optionnel) |

**Ne pas modifier ces fichiers.** Les routeurs `backend/routers/parity.py` et `backend/routers/bases.py` les importent directement.

---

## Déploiement

### Frontend → Vercel

1. Pousser le monorepo sur GitHub.
2. Importer sur [vercel.com](https://vercel.com) — root directory : `frontend`.
3. Ajouter la variable d'environnement : `VITE_BACKEND_URL=https://your-backend.railway.app`.
4. Vercel lit `vercel.json` à la racine — build automatique.

### Backend → Railway

1. New project → Deploy from GitHub → sélectionner le dossier `backend/`.
2. Railway détecte le `Dockerfile` automatiquement.
3. Ajouter les variables d'environnement :
   - `RESEND_API_KEY` — depuis votre dashboard Resend
   - `FRONTEND_URL` — URL Vercel de production
4. Mettre à jour `allow_origins` dans `backend/main.py` avec l'URL Vercel.
5. L'endpoint de santé est `GET /health`.

---

## Architecture

```
Browser → Astro/React Frontend (Vercel)
                ↓ POST /api/parity/run
                ↓ POST /api/bases/run
                ↓ POST /api/send-graphs
        FastAPI Backend (Railway)
                ↓
        Python core scripts (NumPy/SciPy)
                ↓
        Matplotlib → base64 PNG → JSON response
```

---

## Structure du projet

```
portail-scientifique/
├── .github/
│   └── workflows/
│       └── ci.yml                   ← CI GitHub Actions (build + import check)
├── frontend/
│   ├── src/
│   │   ├── layouts/
│   │   │   ├── BaseLayout.astro     ← HTML shell, Google Fonts, global CSS
│   │   │   └── ProjectLayout.astro  ← NavBar + grid background + page-enter
│   │   ├── components/
│   │   │   ├── NavBar.astro         ← Navbar fixe, mobile menu, lien actif
│   │   │   ├── SimulatorErrorBoundary.tsx  ← Error boundary React
│   │   │   ├── ParitySimulator.tsx  ← Module 1 : parité
│   │   │   ├── BasesSimulator.tsx   ← Module 2 : bases & hamiltoniens
│   │   │   ├── ParamSlider.tsx      ← Slider avec fill gradient
│   │   │   ├── PlotViewer.tsx       ← Affichage figures + téléchargement
│   │   │   ├── ResultTable.tsx      ← Tableau niveaux d'énergie (parité)
│   │   │   ├── BasesResultTable.tsx ← Tableau multi-colonnes (bases)
│   │   │   ├── EmailForm.tsx        ← Modal envoi email
│   │   │   └── LoadingSpinner.tsx   ← Spinner SVG animé
│   │   ├── pages/
│   │   │   ├── index.astro          ← Accueil : hero + cartes modules
│   │   │   ├── parity/index.astro   ← Page simulateur parité
│   │   │   ├── bases/index.astro    ← Page simulateur bases
│   │   │   └── about.astro          ← À propos : contexte + stack + auteur
│   │   └── styles/
│   │       └── global.css           ← Scrollbar, focus-visible, fadeIn, badges
│   ├── astro.config.mjs
│   ├── tailwind.config.mjs          ← Design system scientifique dark
│   └── package.json
└── backend/
    ├── core/                        ← Déposer les scripts de simulation ici
    ├── routers/
    │   ├── parity.py                ← POST /api/parity/run
    │   ├── bases.py                 ← POST /api/bases/run
    │   └── email.py                 ← POST /api/send-graphs (rate-limited)
    ├── schemas/                     ← Modèles Pydantic v2
    ├── utils/
    │   ├── figure_export.py         ← matplotlib → base64 PNG
    │   └── rate_limit.py            ← Rate limiter IP en mémoire
    ├── main.py
    ├── requirements.txt
    ├── railway.toml                 ← Config déploiement Railway
    └── Dockerfile                   ← python:3.11-slim, PORT dynamique
```
