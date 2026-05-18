from pydantic import BaseModel, Field
from enum import Enum


class IntegrationMethod(str, Enum):
    euler = "euler"
    rk4 = "rk4"


class ParityRequest(BaseModel):
    N: int = Field(40, ge=4, le=60, description="Number of basis functions")
    L: float = Field(15.0, ge=4.0, le=30.0, description="Box length for sine basis")
    dt: float = Field(0.01, ge=0.001, le=0.1, description="Imaginary time step")
    tau_max: float = Field(1.5, ge=0.5, le=20.0, description="Max imaginary time")
    omega: float = Field(1.0, ge=0.1, le=5.0, description="Oscillator frequency")
    n_even: int = Field(8, ge=1, le=12, description="Number of even levels to compute")
    n_odd: int = Field(8, ge=1, le=12, description="Number of odd levels to compute")
    method: IntegrationMethod = IntegrationMethod.rk4
    graphs: list[str] = Field(
        default=["convergence", "energies", "errors"],
        description="Graphs to generate",
    )


class EnergyResults(BaseModel):
    even: list[float]
    odd: list[float]
    analytical: list[float]


class ParityResponse(BaseModel):
    energies: EnergyResults
    figures: dict[str, str]  # key -> base64 PNG
    duration_ms: int
