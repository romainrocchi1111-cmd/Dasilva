import numpy as np

from Reso import ImaginaryTimePropagator


class ExcitedStatePropagator(ImaginaryTimePropagator):
    """
    Propagation en temps imaginaire avec orthogonalisation pour calculer
    des états excités.

    Principe :
    - E0 : propagation standard
    - E1 : projection sur l'orthogonal de psi0 à chaque pas
    - E2 : projection sur l'orthogonal de psi0 et psi1 à chaque pas
    """

    @staticmethod
    def project_out(c, forbidden_states):
        """
        Retire à c les composantes sur les états interdits.
        Les états de forbidden_states sont supposés normalisés.
        """
        c = np.asarray(c, dtype=complex).copy()
        for psi in forbidden_states:
            c = c - np.vdot(psi, c) * psi
        return c

    def run_excited_state(self, c_init, tau_max, forbidden_states=None, n_steps=None):
        """
        Propagation en temps imaginaire avec projection/orthogonalisation.

        Paramètres
        ----------
        c_init : ndarray
            État initial dans la base choisie.
        tau_max : float
            Temps imaginaire maximal.
        forbidden_states : list[ndarray]
            Liste des états déjà connus à retirer à chaque pas
            (ex: [psi0] pour trouver E1, [psi0, psi1] pour trouver E2).
        n_steps : int | None
            Nombre de pas. Si None, on prend int(tau_max / dt).

        Retourne
        --------
        c_history, E_history, tau_history
        """
        if forbidden_states is None:
            forbidden_states = []

        if n_steps is None:
            n_steps = int(tau_max / self.dt)

        c = self.normalize(np.asarray(c_init, dtype=complex).copy())
        c = self.project_out(c, forbidden_states)
        c = self.normalize(c)

        c_history = [c.copy()]
        E_history = [self.energy(c)]
        tau_history = [0.0]

        for i in range(n_steps):
            c = self.step(c)
            c = self.project_out(c, forbidden_states)
            c = self.normalize(c)

            c_history.append(c.copy())
            E_history.append(self.energy(c))
            tau_history.append((i + 1) * self.dt)

        return (
            np.array(c_history),
            np.array(E_history),
            np.array(tau_history),
        )
