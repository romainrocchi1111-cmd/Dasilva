from pydantic import BaseModel, Field
from enum import Enum


class BasisType(str, Enum):
    sinus = "Sinus"
    legendre = "Legendre"
    hermite = "Hermite"


class HamiltonianType(str, Enum):
    hami = "Hami"
    hamiltonien1 = "Hamiltonien1"


class Combination(BaseModel):
    basis: BasisType
    hamiltonian: HamiltonianType


class BasesRequest(BaseModel):
    combinations: list[Combination] = Field(..., min_length=1, max_length=4)
    N: int = Field(12, ge=4, le=40)
    L: float = Field(8.0, ge=4.0, le=30.0, description="Box length (Sinus basis only)")
    dt: float = Field(0.01, ge=0.001, le=0.1)
    tau_max: float = Field(6.0, ge=0.5, le=20.0)
    omega: float = Field(1.0, ge=0.1, le=5.0)
    graphs: list[str] = Field(
        default=["convergence", "spectrum", "wavefunction", "errors"]
    )


class CombinationResult(BaseModel):
    label: str
    energies: list[float]
    E_history: list[float]
    tau_history: list[float]


class BasesResponse(BaseModel):
    results: list[CombinationResult]
    figures: dict[str, str]  # key -> base64 PNG
    duration_ms: int
