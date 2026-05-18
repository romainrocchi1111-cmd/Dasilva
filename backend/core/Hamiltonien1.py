import numpy as np
from scipy.integrate import quad


class HamiltonianBuilderSecondDerivative:
    """
    Construit la matrice hamiltonienne H = T + V dans une base orthogonale.

    Énergie cinétique :
        T_ij = -(ħ²/(2m)) ∫ φ_i(x) φ''_j(x) w(x) dx

    Potentiel harmonique :
        V_ij = (1/2) m ω² ∫ φ_i(x) x² φ_j(x) w(x) dx

    Compatible avec la même interface que Hami.HamiltonianBuilder.
    """

    def __init__(
        self,
        basis,
        m: float,
        omega: float,
        hbar: float = 1.0,
        trunc_inf=(-10.0, 10.0),
    ):
        self.basis = basis
        self.N = int(basis.N)

        self.m = float(m)
        self.omega = float(omega)
        self.hbar = float(hbar)

        self.trunc_inf = trunc_inf

    # =========================================================
    # outils internes
    # =========================================================

    def _phi(self, n, x):
        """
        Accès générique à φ_n(x)
        """
        if hasattr(self.basis, "phi"):
            return self.basis.phi(n, x)

        return self.basis.evaluate(n, x)

    def _weight(self, x):
        """
        poids d'intégration
        """
        if hasattr(self.basis, "weight"):
            return self.basis.weight(x)

        return 1.0

    def _domain_limits(self):
        """
        bornes d'intégration
        """
        dom = getattr(self.basis, "domain", None)

        if isinstance(dom, tuple) and len(dom) == 2:
            return float(dom[0]), float(dom[1])

        if dom in ("inf", "R", "ℝ"):
            return self.trunc_inf

        return self.trunc_inf

    # =========================================================
    # dérivée seconde
    # =========================================================

    def _d2phi_dx2(self, n, x, h=1e-4):
        """
        dérivée seconde par différence finie centrée

        f''(x) ≈ (f(x+h) - 2f(x) + f(x-h)) / h²
        """

        fph = self._phi(n, x + h)
        f0 = self._phi(n, x)
        fmh = self._phi(n, x - h)

        return (fph - 2 * f0 + fmh) / (h * h)

    # =========================================================
    # matrices
    # =========================================================

    def kinetic_matrix(self, h=1e-4, quad_limit=200):
        """
        matrice cinétique

        T_ij = -(ħ²/(2m)) ∫ φ_i φ''_j dx
        """

        a, b = self._domain_limits()

        T = np.zeros((self.N, self.N))

        pref = -(self.hbar ** 2) / (2 * self.m)

        for i in range(self.N):
            for j in range(i, self.N):

                def integrand(x):
                    return (
                        self._phi(i, x)
                        * self._d2phi_dx2(j, x, h)
                        * self._weight(x)
                    )

                val = pref * quad(integrand, a, b, limit=quad_limit)[0]

                T[i, j] = val
                T[j, i] = val

        return T

    def potential_matrix_harmonic(self, quad_limit=200):
        """
        matrice potentiel harmonique
        """

        a, b = self._domain_limits()

        V = np.zeros((self.N, self.N))

        pref = 0.5 * self.m * self.omega ** 2

        for i in range(self.N):
            for j in range(i, self.N):

                def integrand(x):
                    return (
                        self._phi(i, x)
                        * x ** 2
                        * self._phi(j, x)
                        * self._weight(x)
                    )

                val = pref * quad(integrand, a, b, limit=quad_limit)[0]

                V[i, j] = val
                V[j, i] = val

        return V

    # =========================================================
    # construction Hamiltonien
    # =========================================================

    def build_hamiltonian(self, h=1e-4, quad_limit=200):

        T = self.kinetic_matrix(h=h, quad_limit=quad_limit)

        V = self.potential_matrix_harmonic(quad_limit=quad_limit)

        H = T + V

        return H, T, V
