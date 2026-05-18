from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import parity, bases, email as email_router, submit
import os

app = FastAPI(title="Portail Scientifique API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://dasilva-cmhl.vercel.app",
        "http://localhost:4321",
    ],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(parity.router)
app.include_router(bases.router)
app.include_router(email_router.router)
app.include_router(submit.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "portail-scientifique-api"}
