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
from schemas.parity import ParityRequest, ParityResponse, EnergyResults
from utils.figure_export import fig_to_base64, setup_plot_style

router = APIRouter(prefix="/api/parity", tags=["parity"])


@router.post("/run", response_model=ParityResponse)
async def run_parity(params: ParityRequest):
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, _run_sync, params)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")


def _run_sync(params: ParityRequest) -> dict:
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'core'))

    from base import SineBasis
    from Hami import HamiltonianBuilder
    from parity_propagator import ParityPropagator

    start = time.time()
    setup_plot_style()

    basis = SineBasis(params.N, params.L)
    builder = HamiltonianBuilder(basis, m=1.0, omega=params.omega, hbar=1.0)
    H, T, V = builder.build_hamiltonian()

    prop = ParityPropagator(H, N_basis=params.N, dt=params.dt, hbar=1.0, method=params.method.value)
    results = prop.compute_levels(params.n_even, params.n_odd, params.tau_max)

    even_energies = [float(r["energy"]) for r in results["even"]]
    odd_energies  = [float(r["energy"]) for r in results["odd"]]
    n_total = params.n_even + params.n_odd
    analytical = [float(n + 0.5) for n in range(n_total)]

    figures: dict[str, str] = {}

    if "convergence" in params.graphs:
        fig, (ax_even, ax_odd) = plt.subplots(1, 2, figsize=(12, 5))
        for r in results["even"]:
            k = r["subspace_index"]
            ax_even.plot(r["tau_history"], r["E_history"], label=f"E{2*k}")
        ax_even.set_title("États pairs E(τ)", color="#f1f5f9")
        ax_even.set_xlabel("τ", color="#94a3b8")
        ax_even.set_ylabel("E(τ)", color="#94a3b8")
        ax_even.legend(fontsize=7)
        ax_even.grid(True, alpha=0.3)

        for r in results["odd"]:
            k = r["subspace_index"]
            ax_odd.plot(r["tau_history"], r["E_history"], label=f"E{2*k+1}")
        ax_odd.set_title("États impairs E(τ)", color="#f1f5f9")
        ax_odd.set_xlabel("τ", color="#94a3b8")
        ax_odd.set_ylabel("E(τ)", color="#94a3b8")
        ax_odd.legend(fontsize=7)
        ax_odd.grid(True, alpha=0.3)
        plt.tight_layout()
        figures["convergence"] = fig_to_base64(fig)
        plt.close(fig)

    if "energies" in params.graphs:
        levels = results["levels"]
        n_lev = len(levels)
        x = np.arange(n_lev)
        energies_num = np.array([r["energy"] for r in levels])
        parities = [r["parity"] for r in levels]
        analytical_arr = np.array([i + 0.5 for i in range(n_lev)])
        colors = ["#3b82f6" if p == "even" else "#8b5cf6" for p in parities]

        fig, ax = plt.subplots(figsize=(10, 5))
        ax.bar(x - 0.2, energies_num, 0.35, color=colors, label="Numérique", alpha=0.85)
        ax.bar(x + 0.2, analytical_arr, 0.35, color="#06b6d4", alpha=0.5, label="Analytique")
        ax.set_xticks(x)
        ax.set_xticklabels([f"E{i}" for i in range(n_lev)])
        ax.set_ylabel("Énergie (ℏω)", color="#94a3b8")
        ax.set_title("Niveaux d'énergie : numérique vs analytique", color="#f1f5f9", fontsize=12, fontweight="bold")
        ax.legend()
        ax.grid(True, axis="y", alpha=0.3)
        plt.tight_layout()
        figures["energies"] = fig_to_base64(fig)
        plt.close(fig)

    if "errors" in params.graphs:
        levels = results["levels"]
        n_lev = len(levels)
        analytical_arr = np.array([i + 0.5 for i in range(n_lev)])
        energies_num = np.array([r["energy"] for r in levels])
        errors = np.abs(energies_num - analytical_arr)
        parities = [r["parity"] for r in levels]
        colors = ["#3b82f6" if p == "even" else "#8b5cf6" for p in parities]
        safe_errors = np.maximum(errors, 1e-15)

        fig, ax = plt.subplots(figsize=(8, 4))
        ax.bar(np.arange(n_lev), safe_errors, color=colors, alpha=0.85)
        ax.set_yscale("log")
        ax.set_xticks(np.arange(n_lev))
        ax.set_xticklabels([f"E{i}" for i in range(n_lev)])
        ax.set_ylabel("|E_num − E_anal| (ℏω)", color="#94a3b8")
        ax.set_title("Erreur absolue sur les niveaux d'énergie", color="#f1f5f9", fontsize=12, fontweight="bold")
        ax.grid(True, axis="y", alpha=0.3)
        plt.tight_layout()
        figures["errors"] = fig_to_base64(fig)
        plt.close(fig)

    duration_ms = int((time.time() - start) * 1000)
    return {
        "energies": {
            "even": even_energies,
            "odd": odd_energies,
            "analytical": analytical,
        },
        "figures": figures,
        "duration_ms": duration_ms,
    }


def _plot_convergence(raw: dict, params: ParityRequest) -> str:
    fig, (ax_even, ax_odd) = plt.subplots(1, 2, figsize=(12, 5))

    tau_vals = raw.get("tau_values", [])
    even_hist = raw.get("even_history", [])  # shape: (n_even, n_tau)
    odd_hist = raw.get("odd_history", [])

    colors_even = plt.cm.Blues(np.linspace(0.4, 0.95, max(len(even_hist), 1)))
    colors_odd = plt.cm.Purples(np.linspace(0.4, 0.95, max(len(odd_hist), 1)))

    for i, (level_hist, col) in enumerate(zip(even_hist, colors_even)):
        ax_even.plot(tau_vals, level_hist, color=col, linewidth=1.6, label=f"n={2*i}")
    ax_even.set_title("États pairs E(τ)", color="#f1f5f9", fontsize=11)
    ax_even.set_xlabel("τ (temps imaginaire)", color="#94a3b8")
    ax_even.set_ylabel("Énergie (ℏω)", color="#94a3b8")
    ax_even.grid(True, alpha=0.35)
    if even_hist:
        ax_even.legend(fontsize=7, ncol=2, loc="upper right")

    for i, (level_hist, col) in enumerate(zip(odd_hist, colors_odd)):
        ax_odd.plot(tau_vals, level_hist, color=col, linewidth=1.6, label=f"n={2*i+1}")
    ax_odd.set_title("États impairs E(τ)", color="#f1f5f9", fontsize=11)
    ax_odd.set_xlabel("τ (temps imaginaire)", color="#94a3b8")
    ax_odd.set_ylabel("Énergie (ℏω)", color="#94a3b8")
    ax_odd.grid(True, alpha=0.35)
    if odd_hist:
        ax_odd.legend(fontsize=7, ncol=2, loc="upper right")

    fig.suptitle(
        "Convergence en temps imaginaire",
        color="#f1f5f9",
        fontsize=13,
        fontweight="bold",
    )
    plt.tight_layout()
    return fig_to_base64(fig)


def _plot_energies(even: list[float], odd: list[float], analytical: list[float]) -> str:
    fig, ax = plt.subplots(figsize=(11, 5))

    # Interleave even (n=0,2,4…) and odd (n=1,3,5…) to sort by quantum number
    pairs: list[tuple[int, float]] = []
    for k, e in enumerate(even):
        pairs.append((2 * k, e))
    for k, o in enumerate(odd):
        pairs.append((2 * k + 1, o))
    pairs.sort()

    if not pairs:
        ax.text(0.5, 0.5, "Aucune donnée", ha="center", va="center",
                transform=ax.transAxes, color="#94a3b8")
        return fig_to_base64(fig)

    levels, num_vals = zip(*pairs)
    x = np.arange(len(levels))
    width = 0.35

    ax.bar(x - width / 2, num_vals, width, label="Numérique", color="#3b82f6", alpha=0.82)
    ax.bar(
        x + width / 2,
        analytical[: len(levels)],
        width,
        label="Analytique",
        color="#06b6d4",
        alpha=0.82,
    )

    ax.set_title(
        "Niveaux d'énergie : numérique vs analytique",
        color="#f1f5f9",
        fontsize=12,
        fontweight="bold",
    )
    ax.set_xlabel("Niveau n", color="#94a3b8")
    ax.set_ylabel("Énergie (ℏω)", color="#94a3b8")
    ax.set_xticks(x)
    ax.set_xticklabels([str(lvl) for lvl in levels])
    ax.legend()
    ax.grid(True, axis="y", alpha=0.35)
    plt.tight_layout()
    return fig_to_base64(fig)


def _plot_errors(even: list[float], odd: list[float]) -> str:
    fig, ax = plt.subplots(figsize=(9, 5))

    even_ref = [2 * k + 0.5 for k in range(len(even))]
    odd_ref = [2 * k + 1.5 for k in range(len(odd))]

    even_errs = [abs(e - a) for e, a in zip(even, even_ref)]
    odd_errs = [abs(o - a) for o, a in zip(odd, odd_ref)]

    if even_errs:
        xs = [2 * k for k in range(len(even_errs))]
        # Replace zeros to avoid log(0)
        safe = [max(e, 1e-15) for e in even_errs]
        ax.semilogy(xs, safe, "o-", color="#3b82f6", linewidth=1.8, markersize=5, label="États pairs")

    if odd_errs:
        xs = [2 * k + 1 for k in range(len(odd_errs))]
        safe = [max(e, 1e-15) for e in odd_errs]
        ax.semilogy(xs, safe, "s-", color="#8b5cf6", linewidth=1.8, markersize=5, label="États impairs")

    ax.set_title(
        "Erreur absolue |E_num − E_anal|",
        color="#f1f5f9",
        fontsize=12,
        fontweight="bold",
    )
    ax.set_xlabel("Niveau n", color="#94a3b8")
    ax.set_ylabel("Erreur (ℏω)", color="#94a3b8")
    ax.legend()
    ax.grid(True, which="both", alpha=0.35)
    plt.tight_layout()
    return fig_to_base64(fig)
