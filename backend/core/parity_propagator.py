import numpy as np
from Reso import ImaginaryTimePropagator
from excited_state_propagator import ExcitedStatePropagator


class ParitySelector:
    """
    Utilitaire pour construire des états initiaux de parité définie
    dans la base sinus centrée en L/2.

    Dans la base SineBasis(N, L), l'indice n (0-based) correspond
    au mode physique n+1 :
        phi_n(x) = sqrt(2/L) * sin((n+1)*pi*x/L)

    Parité autour de L/2 :
        n+1 impair (n=0,2,4,...) → fonction PAIRE   autour de L/2
        n+1 pair   (n=1,3,5,...) → fonction IMPAIRE autour de L/2
    """

    @staticmethod
    def even_indices(N):
        """Indices (0-based) des modes pairs : n = 0, 2, 4, ..."""
        return np.array([n for n in range(N) if (n + 1) % 2 == 1])

    @staticmethod
    def odd_indices(N):
        """Indices (0-based) des modes impairs : n = 1, 3, 5, ..."""
        return np.array([n for n in range(N) if (n + 1) % 2 == 0])

    @staticmethod
    def project_even(c):
        """
        Projette c sur le sous-espace PAIR :
        met à zéro toutes les composantes impaires.
        """
        c_out = c.copy()
        N = len(c_out)
        for n in range(N):
            if (n + 1) % 2 == 0:   # mode impair → zéro
                c_out[n] = 0.0
        norm = np.linalg.norm(c_out)
        if norm < 1e-14:
            raise ValueError("Projection paire nulle : état initial incompatible.")
        return c_out / norm

    @staticmethod
    def project_odd(c):
        """
        Projette c sur le sous-espace IMPAIR :
        met à zéro toutes les composantes paires.
        """
        c_out = c.copy()
        N = len(c_out)
        for n in range(N):
            if (n + 1) % 2 == 1:   # mode pair → zéro
                c_out[n] = 0.0
        norm = np.linalg.norm(c_out)
        if norm < 1e-14:
            raise ValueError("Projection impaire nulle : état initial incompatible.")
        return c_out / norm

    @staticmethod
    def random_even(N, seed=None):
        """État initial aléatoire dans le sous-espace PAIR."""
        rng = np.random.default_rng(seed)
        c = rng.standard_normal(N) + 1j * rng.standard_normal(N)
        return ParitySelector.project_even(c)

    @staticmethod
    def random_odd(N, seed=None):
        """État initial aléatoire dans le sous-espace IMPAIR."""
        rng = np.random.default_rng(seed)
        c = rng.standard_normal(N) + 1j * rng.standard_normal(N)
        return ParitySelector.project_odd(c)


class ParityPropagator:
    """
    Calcule les niveaux d'énergie en exploitant la parité de la base sinus.

    Nouvelle purification :
    - chaque nouvel état est purifié contre les états interdits déjà trouvés ;
    - la base des états interdits est ré-orthonormalisée tous les `purify_every`
      états trouvés dans un même sous-espace.
    """

    def __init__(self, H, N_basis, dt, hbar=1.0, method="rk4", purify_every=2):
        """
        H            : matrice hamiltonienne (N_basis x N_basis)
        N_basis      : nombre de fonctions de base
        dt           : pas de temps imaginaire
        hbar         : constante de Planck réduite
        method       : schéma d'intégration ('euler' ou 'rk4')
        purify_every : fréquence de ré-orthonormalisation des états interdits
        """
        self.H = H
        self.N = N_basis
        self.dt = dt
        self.hbar = hbar
        self.method = method
        self.purify_every = purify_every
        self.prop = ExcitedStatePropagator(H, dt, hbar=hbar, method=method)

    # ------------------------------------------------------------------
    # Outils de purification
    # ------------------------------------------------------------------
    @staticmethod
    def _normalize(state, tol=1e-14):
        norm = np.linalg.norm(state)
        if norm < tol:
            raise ValueError("Norme quasi nulle : impossible de normaliser l'état.")
        return state / norm

    @classmethod
    def _purify_state(cls, state, forbidden_states, tol=1e-14):
        """
        Retire à `state` toutes les composantes portées par les états interdits,
        puis renormalise.
        """
        purified = np.array(state, dtype=complex, copy=True)

        for phi in forbidden_states:
            overlap = np.vdot(phi, purified)
            purified -= overlap * phi

        norm = np.linalg.norm(purified)
        if norm < tol:
            raise ValueError(
                "La purification a annulé presque tout l'état ; "
                "change la graine ou augmente la base."
            )
        return purified / norm

    @classmethod
    def _orthonormalize_states(cls, states, tol=1e-14):
        """
        Gram-Schmidt complexe pour stabiliser la liste des états interdits.
        """
        ortho = []
        for state in states:
            vec = np.array(state, dtype=complex, copy=True)
            for basis_vec in ortho:
                vec -= np.vdot(basis_vec, vec) * basis_vec

            norm = np.linalg.norm(vec)
            if norm > tol:
                ortho.append(vec / norm)

        return ortho

    # ------------------------------------------------------------------
    # Calcul d'un sous-espace
    # ------------------------------------------------------------------
    def _run_subspace(self, parity, n_levels, tau_max, seeds):
        """
        Calcule n_levels états dans un sous-espace de parité donnée.

        Retourne : list of dict
        """
        if parity == "even":
            init_fn = ParitySelector.random_even
        else:
            init_fn = ParitySelector.random_odd

        results = []
        forbidden = []

        for k in range(n_levels):
            seed = seeds[k] if k < len(seeds) else 100 * k + (0 if parity == "even" else 1)
            c_init = init_fn(self.N, seed=seed)

            # purification préliminaire de l'état initial si nécessaire
            if forbidden:
                c_init = self._purify_state(c_init, forbidden)
                if parity == "even":
                    c_init = ParitySelector.project_even(c_init)
                else:
                    c_init = ParitySelector.project_odd(c_init)

            c_hist, E_hist, tau_hist = self.prop.run_excited_state(
                c_init,
                tau_max,
                forbidden_states=forbidden,
            )

            psi_k = self._normalize(c_hist[-1])
            if forbidden:
                psi_k = self._purify_state(psi_k, forbidden)
                if parity == "even":
                    psi_k = ParitySelector.project_even(psi_k)
                else:
                    psi_k = ParitySelector.project_odd(psi_k)

            E_k = np.real(np.vdot(psi_k, self.H @ psi_k))

            forbidden.append(psi_k)

            # nouvelle purification : stabilisation tous les 2 états trouvés
            if self.purify_every is not None and self.purify_every > 0:
                if len(forbidden) % self.purify_every == 0:
                    forbidden = self._orthonormalize_states(forbidden)

            results.append({
                "energy": E_k,
                "coeffs": psi_k,
                "E_history": E_hist,
                "tau_history": tau_hist,
                "parity": parity,
                "subspace_index": k,
            })

            label = "E" + str(2 * k if parity == "even" else 2 * k + 1)
            print(f"  [{parity:5s}] {label} = {E_k:.10f}")

        return results

    # ------------------------------------------------------------------
    # Interface principale
    # ------------------------------------------------------------------
    def compute_levels(self, n_even, n_odd, tau_max,
                       seeds_even=None, seeds_odd=None):
        """
        Calcule n_even niveaux pairs et n_odd niveaux impairs.
        """
        if seeds_even is None:
            seeds_even = [42 + 10 * k for k in range(n_even)]
        if seeds_odd is None:
            seeds_odd = [43 + 10 * k for k in range(n_odd)]

        print("=" * 55)
        print("Propagation par parité — base sinus")
        print("=" * 55)
        print(f"Purification / ré-orthonormalisation tous les {self.purify_every} états")

        print("\nSous-espace PAIR (E0, E2, E4, ...)")
        even_results = self._run_subspace("even", n_even, tau_max, seeds_even)

        print("\nSous-espace IMPAIR (E1, E3, E5, ...)")
        odd_results = self._run_subspace("odd", n_odd, tau_max, seeds_odd)

        all_results = even_results + odd_results
        all_results.sort(key=lambda r: r["energy"])

        print("\n" + "=" * 55)
        print("Séquence complète (triée par énergie)")
        print("=" * 55)
        for idx, r in enumerate(all_results):
            print(f"  E{idx} = {r['energy']:.10f}  [{r['parity']}]")

        return {
            "even": even_results,
            "odd": odd_results,
            "levels": all_results,
        }

    # ------------------------------------------------------------------
    # Vérification de la parité d'un vecteur de coefficients
    # ------------------------------------------------------------------
    def check_parity(self, coeffs, tol=1e-6):
        """
        Vérifie la parité d'un état en comparant les normes
        des composantes paires et impaires.

        Retourne 'even', 'odd' ou 'mixed'.
        """
        even_idx = ParitySelector.even_indices(self.N)
        odd_idx = ParitySelector.odd_indices(self.N)

        norm_even = np.linalg.norm(coeffs[even_idx])
        norm_odd = np.linalg.norm(coeffs[odd_idx])

        if norm_odd < tol:
            return "even"
        if norm_even < tol:
            return "odd"
        return "mixed"
