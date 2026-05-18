import sys
import os
import asyncio
import time
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'core'))

from fastapi import APIRouter, HTTPException
from schemas.bases import BasesRequest, BasesResponse, BasisType, HamiltonianType
from utils.figure_export import fig_to_base64, setup_plot_style

router = APIRouter(prefix="/api/bases", tags=["bases"])

PALETTE = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b"]


@router.post("/run", response_model=BasesResponse)
async def run_bases(params: BasesRequest):
    try:
        loop = asyncio.get_running_loop()
        tasks = [
            loop.run_in_executor(None, _run_single_combination, combo, params, i)
            for i, combo in enumerate(params.combinations)
        ]
        results = list(await asyncio.gather(*tasks))
        setup_plot_style()
        figures = _generate_overlay_figures(results, params)
        duration_ms = sum(r.get("_duration_ms", 0) for r in results)
        return {
            "results": [
                {
                    "label": r["label"],
                    "energies": r["energies"],
                    "E_history": r["E_history"],
                    "tau_history": r["tau_history"],
                }
                for r in results
            ],
            "figures": figures,
            "duration_ms": duration_ms,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")


def _run_single_combination(combo, params: BasesRequest, index: int) -> dict:
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'core'))

    from base import SineBasis, LegendreBasis, HermiteBasis
    from Hami import HamiltonianBuilder
    from Hamiltonien1 import HamiltonianBuilderSecondDerivative
    from Reso import ImaginaryTimePropagator
    import numpy as np

    start = time.time()

    if combo.basis.value == "Sinus":
        basis = SineBasis(params.N, params.L)
    elif combo.basis.value == "Legendre":
        basis = LegendreBasis(params.N)
    else:  # Hermite
        basis = HermiteBasis(params.N)

    if combo.hamiltonian.value == "Hami":
        builder = HamiltonianBuilder(basis, m=1.0, omega=params.omega, hbar=1.0)
    else:
        builder = HamiltonianBuilderSecondDerivative(basis, m=1.0, omega=params.omega, hbar=1.0)
    H, T, V = builder.build_hamiltonian()

    np.random.seed(42 + index)
    c_init = np.random.randn(params.N) + 1j * np.random.randn(params.N)
    c_init /= np.linalg.norm(c_init)

    propagator = ImaginaryTimePropagator(H, params.dt, hbar=1.0, method="rk4")
    c_history, E_history, tau_history = propagator.run(c_init, params.tau_max)

    eigvals, eigvecs = np.linalg.eigh(H)

    label = f"{combo.basis.value} + {combo.hamiltonian.value}"
    duration_ms = int((time.time() - start) * 1000)

    return {
        "label": label,
        "energies": eigvals[:min(10, params.N)].tolist(),
        "E_history": E_history.tolist(),
        "tau_history": tau_history.tolist(),
        "c_final": c_history[-1],
        "eigvecs": eigvecs,
        "basis_obj": basis,
        "basis_type": combo.basis.value,
        "_duration_ms": duration_ms,
    }


def _generate_overlay_figures(results: list, params: BasesRequest) -> dict[str, str]:
    figures: dict[str, str] = {}
    if "convergence" in params.graphs:
        figures["convergence"] = _plot_overlay_convergence(results)
    if "spectrum" in params.graphs:
        figures["spectrum"] = _plot_overlay_spectrum(results)
    if "wavefunction" in params.graphs:
        figures["wavefunction"] = _plot_overlay_wavefunction(results, params)
    if "errors" in params.graphs:
        figures["errors"] = _plot_overlay_errors(results)
    return figures


def _plot_overlay_convergence(results: list) -> str:
    fig, ax = plt.subplots(figsize=(10, 5))

    for i, r in enumerate(results):
        color = PALETTE[i % len(PALETTE)]
        tau = r["tau_history"]
        e_hist = r["E_history"]
        if not tau or not e_hist:
            continue
        ax.plot(tau, e_hist, color=color, linewidth=2.0, label=r["label"])

    ax.set_title(
        "Convergence E₀(τ) — comparaison des combinaisons",
        color="#f1f5f9",
        fontsize=12,
        fontweight="bold",
    )
    ax.set_xlabel("τ (temps imaginaire)", color="#94a3b8")
    ax.set_ylabel("Énergie fondamentale (ℏω)", color="#94a3b8")
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.35)
    plt.tight_layout()
    return fig_to_base64(fig)


def _plot_overlay_spectrum(results: list) -> str:
    n_max = min(max((len(r["energies"]) for r in results), default=0), 8)
    if n_max == 0:
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.text(0.5, 0.5, "Aucune donnée", ha="center", va="center",
                transform=ax.transAxes, color="#94a3b8")
        return fig_to_base64(fig)

    fig, ax = plt.subplots(figsize=(11, 5))
    n_combos = len(results)
    x = np.arange(n_max)
    width = 0.75 / (n_combos + 1)

    for i, r in enumerate(results):
        vals = r["energies"][:n_max]
        offset = (i - (n_combos - 1) / 2) * width
        ax.bar(x + offset, vals, width, label=r["label"],
               color=PALETTE[i % len(PALETTE)], alpha=0.82)

    analytical = [n + 0.5 for n in range(n_max)]
    ax.plot(x, analytical, "o--", color="#e2e8f0", linewidth=1.4,
            markersize=4, label="Analytique", zorder=5, alpha=0.75)

    ax.set_title(
        "Spectre énergétique — toutes combinaisons",
        color="#f1f5f9",
        fontsize=12,
        fontweight="bold",
    )
    ax.set_xlabel("Niveau n", color="#94a3b8")
    ax.set_ylabel("Énergie (ℏω)", color="#94a3b8")
    ax.set_xticks(x)
    ax.legend(fontsize=8)
    ax.grid(True, axis="y", alpha=0.35)
    plt.tight_layout()
    return fig_to_base64(fig)


def _plot_overlay_wavefunction(results: list, params: BasesRequest) -> str:
    fig, ax = plt.subplots(figsize=(10, 5))

    for i, r in enumerate(results):
        try:
            import sys, os
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'core'))
            from Analyse import AnalysisTools

            basis_type = r["basis_type"]
            basis = r["basis_obj"]
            eigvecs = r["eigvecs"]
            c0 = eigvecs[:, 0]

            if basis_type == "Sinus":
                x_grid = np.linspace(0, params.L, 500)
            elif basis_type == "Legendre":
                x_grid = np.linspace(-1, 1, 500)
            else:  # Hermite
                x_grid = np.linspace(-5, 5, 500)

            psi_num = np.real(AnalysisTools.reconstruct_wavefunction(basis, c0, x_grid))
            psi_anal = AnalysisTools.analytical_harmonic_wavefunction(
                0, x_grid, m=1.0, omega=params.omega, hbar=1.0
            )

            # sign and norm alignment
            if np.trapz(psi_num * psi_anal, x_grid) < 0:
                psi_num = -psi_num
            norm_n = np.sqrt(np.trapz(psi_num ** 2, x_grid))
            norm_a = np.sqrt(np.trapz(psi_anal ** 2, x_grid))
            if norm_n > 0:
                psi_num /= norm_n
            if norm_a > 0:
                psi_anal /= norm_a

            ax.plot(x_grid, psi_num ** 2, color=PALETTE[i % len(PALETTE)],
                    linewidth=1.8, label=r["label"])
            if i == 0:
                ax.plot(x_grid, psi_anal ** 2, "--", color="#e2e8f0", linewidth=1.4,
                        label="|ψ₀|² analytique", alpha=0.75)
        except Exception:
            pass  # wavefunction skipped on any error

    ax.set_title(
        "Fonction d'onde fondamentale |ψ₀(x)|²",
        color="#f1f5f9",
        fontsize=12,
        fontweight="bold",
    )
    ax.set_xlabel("x", color="#94a3b8")
    ax.set_ylabel("|ψ₀(x)|²", color="#94a3b8")
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.35)
    plt.tight_layout()
    return fig_to_base64(fig)


def _plot_overlay_errors(results: list) -> str:
    fig, ax = plt.subplots(figsize=(9, 5))
    n_levels = 5

    for i, r in enumerate(results):
        color = PALETTE[i % len(PALETTE)]
        energies = r["energies"][:n_levels]
        if not energies:
            continue
        analytical = [n + 0.5 for n in range(len(energies))]
        errors = [max(abs(e - a), 1e-15) for e, a in zip(energies, analytical)]
        ax.semilogy(range(len(errors)), errors, "o-", color=color,
                    linewidth=1.8, markersize=5, label=r["label"])

    ax.set_title(
        "Erreur absolue |E_num − E_anal| — 5 premiers niveaux",
        color="#f1f5f9",
        fontsize=12,
        fontweight="bold",
    )
    ax.set_xlabel("Niveau n", color="#94a3b8")
    ax.set_ylabel("Erreur (ℏω)", color="#94a3b8")
    ax.legend(fontsize=9)
    ax.grid(True, which="both", alpha=0.35)
    plt.tight_layout()
    return fig_to_base64(fig)
