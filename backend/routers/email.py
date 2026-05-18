import re
import os
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
import resend
from utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/api", tags=["email"])

resend.api_key = os.getenv("RESEND_API_KEY", "")
SENDER = os.getenv("EMAIL_SENDER", "noreply@your-domain.fr")
MAX_FIGURES = 5

EMAIL_REGEX = re.compile(
    r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
)


class FigureAttachment(BaseModel):
    filename: str
    data_b64: str  # base64-encoded PNG
    caption: str = ""


class SendGraphsRequest(BaseModel):
    email: str
    figures: list[FigureAttachment] = Field(..., max_length=MAX_FIGURES)
    module: str = Field(..., pattern="^(parity|bases)$")


@router.post("/send-graphs")
async def send_graphs(request: Request, body: SendGraphsRequest):
    if not EMAIL_REGEX.match(body.email):
        raise HTTPException(status_code=422, detail="Adresse email invalide.")

    client_ip = request.client.host if request.client else "unknown"
    allowed, wait_minutes = check_rate_limit(client_ip)
    if not allowed:
        return {
            "success": False,
            "message": f"Trop de requêtes. Réessayez dans {wait_minutes} min.",
        }

    if not resend.api_key:
        raise HTTPException(
            status_code=503,
            detail="Service email non configuré. Définissez RESEND_API_KEY.",
        )

    module_label = "Parité" if body.module == "parity" else "Bases & Hamiltoniens"

    figures_html = "".join(
        f'<div style="margin-bottom:12px">'
        f'<strong>{fig.filename}</strong>'
        f'{f": {fig.caption}" if fig.caption else ""}'
        f'</div>'
        for fig in body.figures
    )

    html_body = f"""
<div style="font-family:Arial,sans-serif;background:#0d1421;color:#f1f5f9;padding:32px;border-radius:8px;max-width:600px;">
  <h1 style="color:#3b82f6;margin-top:0;">Portail Scientifique Quantique</h1>
  <h2 style="color:#94a3b8;font-weight:400;">Module : {module_label}</h2>
  <p>Vos graphiques de simulation sont disponibles en pièces jointes.</p>
  <div style="margin:24px 0;padding:16px;background:#080c14;border-radius:6px;border:1px solid #1a2540;">
    {figures_html}
  </div>
  <hr style="border:none;border-top:1px solid #1a2540;" />
  <p style="color:#475569;font-size:12px;margin-bottom:0;">
    Portail Scientifique — Romain Rocchi, CPES L3 — 2026
  </p>
</div>
"""

    attachments = [
        {
            "filename": fig.filename,
            "content": fig.data_b64,
            "content_type": "image/png",
        }
        for fig in body.figures
    ]

    try:
        resend.Emails.send(
            {
                "from": SENDER,
                "to": body.email,
                "subject": f"Vos graphiques — Portail Scientifique ({module_label})",
                "html": html_body,
                "attachments": attachments,
            }
        )
        return {"success": True, "message": f"Email envoyé à {body.email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email send failed: {str(e)}")
