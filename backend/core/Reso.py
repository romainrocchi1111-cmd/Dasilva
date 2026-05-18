import numpy as np


class ImaginaryTimePropagator:
    """
    Propagation en temps imaginaire :
        dc/dτ = -(1/ħ) H c
    """

    def __init__(self, H, dt, hbar=1.0, method='rk4'):
        """
        H : matrice hamiltonienne
        dt : pas de temps imaginaire
        hbar : constante de Planck réduite
        method : 'euler' ou 'rk4'
        """
        self.H = H
        self.dt = dt
        self.hbar = hbar
        self.method = method

    # =========================
    # Normalisation
    # =========================
    def normalize(self, c):
        """Normalise le vecteur de coefficients"""
        norm = np.linalg.norm(c)
        if norm == 0:
            raise ValueError("Norme nulle détectée pendant la propagation.")
        return c / norm

    # =========================
    # Énergie
    # =========================
    def energy(self, c):
        """
        Calcule l'énergie :
            E = <psi|H|psi>
        (suppose c normalisé)
        """
        return np.real(np.conj(c) @ self.H @ c)

    # =========================
    # Méthode d'Euler (ordre 1)
    # =========================
    def propagate_euler(self, c):
        """
        c(τ+dt) = c(τ) - dt/ħ * H c(τ)
        """
        c_new = c - (self.dt / self.hbar) * (self.H @ c)
        return self.normalize(c_new)

    # =========================
    # Runge-Kutta ordre 4
    # =========================
    def propagate_rk4(self, c):
        """
        Runge-Kutta ordre 4 pour :
            dc/dτ = -(1/ħ) H c
        """

        A = -(1.0 / self.hbar) * self.H

        k1 = A @ c
        k2 = A @ (c + 0.5 * self.dt * k1)
        k3 = A @ (c + 0.5 * self.dt * k2)
        k4 = A @ (c + self.dt * k3)

        c_new = c + (self.dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)

        return self.normalize(c_new)

    # =========================
    # Choix de la méthode
    # =========================
    def step(self, c):
        """Effectue un pas de propagation"""

        if self.method == 'euler':
            return self.propagate_euler(c)

        elif self.method == 'rk4':
            return self.propagate_rk4(c)

        else:
            raise ValueError(f"Méthode inconnue : {self.method}")

    # =========================
    # Propagation complète
    # =========================
    def run(self, c_init, tau_max, n_steps=None):
        """
        Effectue la propagation complète

        c_init : état initial
        tau_max : temps imaginaire maximal
        n_steps : nombre de pas (si None → tau_max/dt)

        Retourne :
            c_history
            E_history
            tau_history
        """

        if n_steps is None:
            n_steps = int(tau_max / self.dt)

        # Normalisation initiale
        c = self.normalize(c_init.copy())

        c_history = [c.copy()]
        E_history = [self.energy(c)]
        tau_history = [0.0]

        for i in range(n_steps):

            c = self.step(c)

            c_history.append(c.copy())
            E_history.append(self.energy(c))
            tau_history.append((i + 1) * self.dt)

        return (
            np.array(c_history),
            np.array(E_history),
            np.array(tau_history),
        )
