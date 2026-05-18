# backend/core — Simulation Scripts

Place your Python quantum simulation scripts here.

Expected files:

| File | Purpose |
|------|---------|
| `base.py` | Basis function definitions (sinus, Hermite, Legendre…) |
| `Hami.py` | Harmonic oscillator Hamiltonian |
| `Hamiltonien1.py` | Alternative Hamiltonian variant |
| `Reso.py` | Resolution utilities (matrix build, diagonalization) |
| `excited_state_propagator.py` | Excited state imaginary-time propagation |
| `parity_propagator.py` | Parity-separated ITP (even/odd subspaces) |
| `Analyse.py` | Analysis helpers and plotting wrappers |

These scripts are imported by the routers in `../routers/`.
