import numpy as np
from scipy.special import eval_legendre, hermite
from math import factorial, sqrt
import numpy as np
from scipy.special import hermite

from abc import ABC, abstractmethod


# =========================
# Classe utilitaire
# =========================
class ModuleTest:
    def action1(self):
        return "Module 1 OK"

import numpy as np
from abc import ABC, abstractmethod
from typing import Tuple, Union

Domain = Union[Tuple[float, float], str]  # ex: (0, L), (-1, 1) ou "R"/"inf"

class OrthogonalBasis(ABC):
    """
    Classe mère pour une base orthogonale/orthonormale.

    Objectif:
    - Définir φ_n(x) via evaluate(n, x)
    - Définir le poids w(x) via weight(x)
    - Fournir basis_matrix(x_grid) pour construire Φ[i,n] = φ_n(x_i)

    Le produit scalaire associé est typiquement:
        <f,g> = ∫ f(x) g(x) w(x) dx
    """

    def __init__(self, N: int, domain: Domain):
        self.N = int(N)
        self.domain = domain  # intervalle (a,b) ou "R"/"inf" pour ℝ

        if self.N <= 0:
            raise ValueError("N doit être un entier > 0.")

    @abstractmethod
    def evaluate(self, n: int, x: np.ndarray) -> np.ndarray:
        """
        Retourne φ_n(x). Convention: n commence à 0 (donc φ_0, φ_1, ...).
        x peut être un scalaire ou un tableau numpy.
        """
        raise NotImplementedError

    @abstractmethod
    def weight(self, x: np.ndarray) -> np.ndarray:
        """
        Retourne w(x), la fonction poids associée au produit scalaire.
        """
        raise NotImplementedError

    def basis_matrix(self, x_grid: np.ndarray) -> np.ndarray:
        """
        Construit la matrice Φ de taille (len(x_grid), N) :
            Φ[i, n] = φ_n(x_grid[i])
        """
        x_grid = np.asarray(x_grid)
        Phi = np.zeros((len(x_grid), self.N), dtype=float)

        for n in range(self.N):
            Phi[:, n] = self.evaluate(n, x_grid)

        return Phi

    
    def weighted_inner_discrete(self, f: np.ndarray, g: np.ndarray, x_grid: np.ndarray) -> float:
        """
        Produit scalaire discret (simple) :
            <f,g> ≈ Σ f(x_i) g(x_i) w(x_i) Δx
        Utile pour tests rapides (orthogonalité, etc.).
        """
        x_grid = np.asarray(x_grid)
        f = np.asarray(f)
        g = np.asarray(g)

        if len(x_grid) < 2:
            raise ValueError("x_grid doit contenir au moins 2 points.")
        dx = x_grid[1] - x_grid[0]

        w = self.weight(x_grid)
        return float(np.sum(f * g * w) * dx)
# =========================
# 1️⃣ Base sinus
# =========================
class SineBasis(OrthogonalBasis):

    def __init__(self, N: int, L: float):
        super().__init__(N, (0.0, L))
        self.L = L

    def evaluate(self, n: int, x: np.ndarray) -> np.ndarray:
        # n = 0,1,2,...  → mode physique n+1
        return np.sqrt(2/self.L) * np.sin((n+1)*np.pi*x/self.L)

    def weight(self, x: np.ndarray) -> np.ndarray:
        return 1.0


# =========================
# 2️⃣ Base de Legendre
# =========================
class LegendreBasis(OrthogonalBasis):

    def __init__(self, N: int):
        super().__init__(N, (-1.0, 1.0))

    def evaluate(self, n: int, x: np.ndarray) -> np.ndarray:
        Pn = eval_legendre(n, x)
        return np.sqrt((2*n+1)/2) * Pn

    def weight(self, x: np.ndarray) -> np.ndarray:
        return 1.0

# =========================
# 3️⃣ Base d'Hermite
# =========================



class HermiteBasis(OrthogonalBasis):
    """Base de fonctions d'Hermite normalisées (physique) sur ℝ"""

    def __init__(self, N: int):
        super().__init__(N, 'inf')

    def evaluate(self, n: int, x: np.ndarray) -> np.ndarray:
        """
        psi_n(x) = 1/sqrt(2^n * n! * sqrt(pi)) * H_n(x) * exp(-x^2/2)
        (comme dans le document)
        """
        x = np.asarray(x, dtype=float)
        Hn = hermite(n)(x)  # H_n(x) (physiciens)
        norm = 1.0 / sqrt((2.0 ** n) * factorial(n) * sqrt(np.pi))
        return norm * Hn * np.exp(-0.5 * x**2)

    def weight(self, x: np.ndarray) -> np.ndarray:
        return 1.0

