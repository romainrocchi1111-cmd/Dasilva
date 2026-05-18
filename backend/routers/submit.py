import ast
import sys
import io
import base64
import os
import re
import traceback
import multiprocessing

from fastapi import APIRouter, UploadFile, Form, HTTPException, Request
from fastapi.responses import JSONResponse
import resend

from utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/api", tags=["submit"])

SUBMIT_PASSWORD = os.getenv("SUBMIT_PASSWORD", "quantique2026")
ADMIN_EMAIL = "romainrocchi1111@gmail.com"
MAX_SCRIPT_SIZE = 100_000
TIMEOUT_SECONDS = 60

FORBIDDEN_IMPORTS = {
    "os", "sys", "subprocess", "shutil", "pathlib",
    "socket", "urllib", "http", "requests", "httpx",
    "importlib", "ctypes", "multiprocessing", "threading",
    "eval", "exec", "open", "__import__",
}


def _run_script(script_code: str, result_queue: multiprocessing.Queue) -> None:
    import sys as _sys
    import io as _io
    import base64 as _base64
    import traceback as _tb
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np

    old_stdout = _sys.stdout
    _sys.stdout = _io.StringIO()

    figures_b64: list[str] = []
    original_show = plt.show

    def capture_show() -> None:
        fig = plt.gcf()
        buf = _io.BytesIO()
        fig.savefig(buf, format="png", dpi=100, bbox_inches="tight")
        buf.seek(0)
        figures_b64.append(_base64.b64encode(buf.read()).decode())
        plt.close(fig)

    plt.show = capture_show  # type: ignore[assignment]

    try:
        exec(  # noqa: S102
            script_code,
            {
                "numpy": np,
                "np": np,
                "matplotlib": matplotlib,
                "plt": plt,
                "__name__": "__main__",
            },
        )
        output = _sys.stdout.getvalue()
        result_queue.put({"success": True, "output": output, "figures": figures_b64})
    except Exception:
        result_queue.put({"success": False, "error": _tb.format_exc()})
    finally:
        _sys.stdout = old_stdout
        plt.show = original_show  # type: ignore[assignment]


@router.post("/submit-script")
async def submit_script(
    request: Request,
    name: str = Form(...),
    author: str = Form(...),
    description: str = Form(...),
    password: str = Form(...),
    file: UploadFile = Form(...),
) -> JSONResponse:
    # Step 1 — Password
    if password != SUBMIT_PASSWORD:
        raise HTTPException(status_code=403, detail="Mot de passe incorrect")

    # Step 1b — Rate limit (after password check to avoid probing)
    client_ip = request.client.host if request.client else "unknown"
    allowed, wait_minutes = check_rate_limit(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Trop de soumissions. Réessayez dans {wait_minutes} min.",
        )

    # Step 2 — File size
    content = await file.read()
    if len(content) > MAX_SCRIPT_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 100KB)")

    # Step 3 — Syntax check
    try:
        tree = ast.parse(content.decode("utf-8"))
    except SyntaxError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Erreur de syntaxe Python ligne {e.lineno}: {e.msg}",
        ) from e

    # Step 4 — Security: AST import scan
    forbidden_found: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = node.names if hasattr(node, "names") else []
            for alias in names:
                module = alias.name.split(".")[0]
                if module in FORBIDDEN_IMPORTS:
                    forbidden_found.append(module)

    if forbidden_found:
        raise HTTPException(
            status_code=422,
            detail=f"Imports non autorisés: {', '.join(set(forbidden_found))}",
        )

    # Step 5 — Execute in subprocess with timeout
    result_queue: multiprocessing.Queue = multiprocessing.Queue()
    proc = multiprocessing.Process(
        target=_run_script,
        args=(content.decode("utf-8"), result_queue),
    )
    proc.start()
    proc.join(timeout=TIMEOUT_SECONDS)

    if proc.is_alive():
        proc.terminate()
        proc.join()
        raise HTTPException(
            status_code=408,
            detail="Le script a dépassé le délai de 60 secondes",
        )

    if result_queue.empty():
        raise HTTPException(status_code=500, detail="Exécution échouée sans résultat")

    result = result_queue.get()

    if not result["success"]:
        raise HTTPException(
            status_code=422,
            detail=f"Erreur d'exécution: {result['error'][:500]}",
        )

    # Step 6 — Validate output
    output_text: str = result.get("output", "")
    figures: list[str] = result.get("figures", [])
    has_numbers = bool(re.search(r"\d+\.?\d*", output_text))
    has_figures = len(figures) > 0

    if not has_numbers and not has_figures:
        raise HTTPException(
            status_code=422,
            detail="Le script ne produit ni graphique ni valeur numérique détectable",
        )

    # Step 7 — Email to Romain
    resend.api_key = os.getenv("RESEND_API_KEY", "")
    sender = os.getenv("EMAIL_SENDER", "onboarding@resend.dev")

    script_preview = output_text[:1000] if output_text else "(aucune sortie texte)"
    figures_note = "Graphiques inclus en pièces jointes." if figures else "Aucun graphique généré."

    html_body = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;padding:24px;">
  <h1 style="color:#2563eb;">Nouveau script soumis</h1>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr>
      <td style="padding:8px;font-weight:bold;width:140px;">Module</td>
      <td style="padding:8px;">{name}</td>
    </tr>
    <tr style="background:#f8f9fb;">
      <td style="padding:8px;font-weight:bold;">Auteur</td>
      <td style="padding:8px;">{author}</td>
    </tr>
    <tr>
      <td style="padding:8px;font-weight:bold;">Description</td>
      <td style="padding:8px;">{description}</td>
    </tr>
  </table>

  <h2 style="color:#475569;">Résultat de l'exécution</h2>
  <pre style="background:#f1f4f8;padding:12px;border-radius:8px;font-size:12px;overflow:auto;">{script_preview}</pre>

  <p style="color:#475569;font-size:13px;">
    Le script Python est en pièce jointe.<br>
    {figures_note}
  </p>

  <hr style="border-color:#e2e8f0;"/>
  <p style="color:#94a3b8;font-size:12px;">
    Portail Scientifique — Soumission automatique — 2026
  </p>
</div>
"""

    attachments: list[dict] = [
        {
            "filename": file.filename or "script.py",
            "content": base64.b64encode(content).decode(),
            "content_type": "text/x-python",
        }
    ]
    for i, fig_b64 in enumerate(figures[:3]):
        attachments.append(
            {
                "filename": f"figure_{i + 1}.png",
                "content": fig_b64,
                "content_type": "image/png",
            }
        )

    try:
        resend.Emails.send(
            {
                "from": sender,
                "to": ADMIN_EMAIL,
                "subject": f"[Portail] Nouveau script : {name} — par {author}",
                "html": html_body,
                "attachments": attachments,
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur envoi email: {str(e)}",
        ) from e

    return JSONResponse(
        {
            "success": True,
            "message": "Script soumis avec succès !",
            "has_figures": has_figures,
            "has_output": has_numbers,
        }
    )
