import numpy as np
import matplotlib.pyplot as plt
from math import factorial, sqrt
from scipy.special import hermite

from base import SineBasis, LegendreBasis, HermiteBasis
from Hami import HamiltonianBuilder
from Reso import ImaginaryTimePropagator


class AnalysisTools:
    @staticmethod
    def analytical_harmonic_energies(n_levels, omega, hbar=1.0):
        n = np.arange(n_levels)
        return hbar * omega * (n + 0.5)

    @staticmethod
    def analytical_harmonic_wavefunction(n, x, m, omega, hbar=1.0):
        """
        Fonction d'onde analytique de l'oscillateur harmonique 1D.
        """
        xi = np.sqrt(m * omega / hbar) * x
        Hn = hermite(n)(xi)

        norm = (m * omega / (np.pi * hbar))**0.25
        norm /= np.sqrt((2.0**n) * factorial(n))

        return norm * Hn * np.exp(-xi**2 / 2.0)

    @staticmethod
    def reconstruct_wavefunction(basis, coeffs, x_grid):
        Phi = basis.basis_matrix(x_grid)
        return Phi @ coeffs

    @staticmethod
    def run_simulation_for_basis(basis, c_init, dt, tau_max, m=1.0, omega=1.0, hbar=1.0, method="rk4"):
        builder = HamiltonianBuilder(basis, m=m, omega=omega, hbar=hbar)
        H, T, V = builder.build_hamiltonian()

        propagator = ImaginaryTimePropagator(H, dt, hbar, method=method)
        c_history, E_history, tau_history = propagator.run(c_init, tau_max)

        eigvals, eigvecs = np.linalg.eigh(H)

        return {
            "basis": basis,
            "H": H,
            "T": T,
            "V": V,
            "c_history": c_history,
            "E_history": E_history,
            "tau_history": tau_history,
            "eigvals": eigvals,
            "eigvecs": eigvecs,
            "c_final": c_history[-1],
        }

    @staticmethod
    def plot_energy_convergence(results_dict, omega, hbar=1.0):
        E0 = 0.5 * hbar * omega

        plt.figure(figsize=(10, 6))
        for label, res in results_dict.items():
            plt.plot(res["tau_history"], res["E_history"], label=f"{label}")

        plt.axhline(E0, linestyle="--", label=f"Analytique E0 = {E0:.6f}")
        plt.xlabel("Temps imaginaire τ")
        plt.ylabel("Énergie E(τ)")
        plt.title("Convergence de l'énergie pour chaque base")
        plt.grid(True, alpha=0.3)
        plt.legend()
        plt.tight_layout()
        plt.show()

    @staticmethod
    def plot_final_energy_comparison(results_dict, omega, hbar=1.0):
        labels = list(results_dict.keys())
        numerical = [results_dict[k]["E_history"][-1] for k in labels]
        analytical = [0.5 * hbar * omega for _ in labels]

        x = np.arange(len(labels))
        width = 0.35

        plt.figure(figsize=(8, 5))
        plt.bar(x - width/2, numerical, width, label="Numérique")
        plt.bar(x + width/2, analytical, width, label="Analytique")
        plt.xticks(x, labels)
        plt.ylabel("Énergie")
        plt.title("Comparaison énergie finale numérique / analytique")
        plt.grid(True, axis="y", alpha=0.3)
        plt.legend()
        plt.tight_layout()
        plt.show()

    @staticmethod
    def plot_wavefunction_comparison(results_dict, m, omega, hbar=1.0, L=8.0):

        fig, axes = plt.subplots(len(results_dict), 1, figsize=(10, 4 * len(results_dict)))

        if len(results_dict) == 1:
            axes = [axes]

        for ax, (label, res) in zip(axes, results_dict.items()):
            basis = res["basis"]

        # on prend l'état propre fondamental du Hamiltonien
            c0 = res["eigvecs"][:, 0]

            if label == "Sinus":
                x_grid = np.linspace(0, L, 800)
                psi_num = basis.basis_matrix(x_grid) @ c0
                psi_num = np.real(psi_num)

                psi_anal = AnalysisTools.analytical_harmonic_wavefunction(
                    0, x_grid - L/2, m, omega, hbar
                )

            elif label == "Legendre":
                x_grid = np.linspace(-1, 1, 800)
                psi_num = basis.basis_matrix(x_grid) @ c0
                psi_num = np.real(psi_num)

                psi_anal = AnalysisTools.analytical_harmonic_wavefunction(
                    0, x_grid, m, omega, hbar
                )

            else:  # Hermite
                x_grid = np.linspace(-5, 5, 800)
                psi_num = basis.basis_matrix(x_grid) @ c0
                psi_num = np.real(psi_num)

                psi_anal = AnalysisTools.analytical_harmonic_wavefunction(
                    0, x_grid, m, omega, hbar
                )

            # ajustement du signe
            if np.trapz(psi_num * psi_anal, x_grid) < 0:
                psi_num = -psi_num

            # normalisation sur la grille
            norm_num = np.sqrt(np.trapz(np.abs(psi_num)**2, x_grid))
            norm_anal = np.sqrt(np.trapz(np.abs(psi_anal)**2, x_grid))

            if norm_num > 0:
                psi_num = psi_num / norm_num
            if norm_anal > 0:
                psi_anal = psi_anal / norm_anal

            ax.plot(x_grid, psi_num, label=f"{label} numérique")
            ax.plot(x_grid, psi_anal, "--", label="Analytique n=0")

            if label == "Sinus":
                ax.axvline(L/2, linestyle=":", color="black", label="centre L/2")

            ax.set_title(f"Comparaison de la fonction d'onde - {label}")
            ax.set_xlabel("x")
            ax.set_ylabel("ψ(x)")
            ax.grid(True)
            ax.legend()

        plt.tight_layout()
        plt.show()
