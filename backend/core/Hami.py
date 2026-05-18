import numpy as np
from scipy.integrate import quad

class HamiltonianBuilder:
    """
    Construit la matrice hamiltonienne H = T + V dans une base orthogonale.

    - Cinétique via intégration par parties (plus stable) :
        T_ij = (hbar^2/(2m)) * ∫ phi_i'(x) * phi_j'(x) * w(x) dx

    - Potentiel harmonique :
        V_ij = (1/2) m omega^2 * ∫ phi_i(x) * x^2 * phi_j(x) * w(x) dx
    """

    def __init__(self, basis, m: float, omega: float, hbar: float = 1.0,
                 trunc_inf: tuple[float, float] = (-10.0, 10.0)):
        """
        basis : instance de OrthogonalBasis (ou compatible) avec :
            - N
            - evaluate(n,x)   (et idéalement phi(n,x) alias)
            - weight(x)
            - domain : (a,b) ou 'inf'
        """
        self.basis = basis
        self.N = int(basis.N)
        self.m = float(m)
        self.omega = float(omega)
        self.hbar = float(hbar)
        self.trunc_inf = trunc_inf

    # --------- helpers ----------
    def _phi(self, n: int, x):
        """Récupère φ_n(x) : utilise phi si présent, sinon evaluate."""
        if hasattr(self.basis, "phi"):
            return self.basis.phi(n, x)
        return self.basis.evaluate(n, x)

    def _w(self, x):
        """Poids w(x) (retourne 1.0 si weight renvoie un scalaire)."""
        w = self.basis.weight(x)
        return w

    def _domain_limits(self):
        """Bornes d'intégration selon la base."""
        dom = getattr(self.basis, "domain", None)
        if isinstance(dom, tuple) and len(dom) == 2:
            return float(dom[0]), float(dom[1])
        if dom in ("inf", "R", "ℝ"):
            return float(self.trunc_inf[0]), float(self.trunc_inf[1])
        # fallback
        return float(self.trunc_inf[0]), float(self.trunc_inf[1])

    def _dphi_dx(self, n: int, x: float, h: float = 1e-5) -> float:
        """Dérivée première centrée."""
        return (self._phi(n, x + h) - self._phi(n, x - h)) / (2.0 * h)

    # --------- matrices ----------
    def kinetic_matrix(self, h: float = 1e-5, quad_limit: int = 200) -> np.ndarray:
        """
        T_ij = (hbar^2/(2m)) ∫ φ_i'(x) φ_j'(x) w(x) dx
        """
        a, b = self._domain_limits()
        T = np.zeros((self.N, self.N), dtype=float)
        pref = (self.hbar ** 2) / (2.0 * self.m)

        # Calcul sur triangle sup + symétrisation (plus rapide + force hermiticité)
        for i in range(self.N):
            for j in range(i, self.N):
                def integrand(x):
                    return self._dphi_dx(i, x, h=h) * self._dphi_dx(j, x, h=h) * self._w(x)

                val = pref * quad(integrand, a, b, limit=quad_limit)[0]
                T[i, j] = val
                T[j, i] = val

        return T

    def potential_matrix_harmonic(self, quad_limit: int = 200) -> np.ndarray:
    
        a, b = self._domain_limits()
        V = np.zeros((self.N, self.N), dtype=float)
        pref = 0.5 * self.m * (self.omega ** 2)

        dom = getattr(self.basis, "domain", None)
        if isinstance(dom, tuple) and len(dom) == 2:
            x0 = 0.5 * (a + b)   # centre de la boîte
        else:
            x0 = 0.0             # pour Hermite sur R

        for i in range(self.N):
            for j in range(i, self.N):
                def integrand(x):
                    return self._phi(i, x) * ((x-x0) ** 2) * self._phi(j, x) * self._w(x)

                val = pref * quad(integrand, a, b, limit=quad_limit)[0]
                V[i, j] = val
                V[j, i] = val

        return V

    def build_hamiltonian(self, h: float = 1e-5, quad_limit: int = 200):
        """Retourne H, T, V."""
        T = self.kinetic_matrix(h=h, quad_limit=quad_limit)
        V = self.potential_matrix_harmonic(quad_limit=quad_limit)
        H = T + V
        return H, T, V
