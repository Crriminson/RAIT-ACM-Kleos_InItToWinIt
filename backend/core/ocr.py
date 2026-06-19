"""
core/ocr.py — PaddleOCR wrapper (updated for PaddleOCR 3.7.0 / PaddleX API)

Public API
----------
    extract_text(image_source) -> RawOCRResult

The caller can pass:
  • a file path (str or pathlib.Path)
  • raw image bytes
  • a base64-encoded string

API changes from PaddleOCR 3.5 → 3.7 (paddlex backend):
  - PaddleOCR(show_log=...) removed → not a valid kwarg
  - PaddleOCR(use_angle_cls=...) deprecated → use use_textline_orientation
  - PaddleOCR(enable_mkldnn=False) required on Windows to avoid
    NotImplementedError in oneDNN with PP-OCRv6
  - ocr.ocr() deprecated → use ocr.predict() which returns a generator
    of OCRResult dict-like objects
  - Result structure changed:
      OLD: [ [ [polygon, (text, conf)], ... ] ]  (nested list)
      NEW: OCRResult with keys:
             rec_texts  : list[str]
             rec_scores : list[float]
             rec_polys  : list[ndarray shape (4,2)]  — polygon corners
             rec_boxes  : list[ndarray shape (4,)]   — [x1,y1,x2,y2]

Design decisions
----------------
* English-only model (lang='en'). All 6 sample invoices are clean
  English/numeric computer-generated PNGs.
* use_textline_orientation=True — handles rotated/skewed camera captures.
* enable_mkldnn=False — disables the oneDNN backend that crashes with
  PaddlePaddle 3.3.x + PP-OCRv6 on Windows (ConvertPirAttribute bug).
* PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True — avoids slow network checks
  on every init after models are already cached.
* Module-level singleton — avoids reloading 5 model files per request.
"""
from __future__ import annotations

import base64
import io
import os
import time
from pathlib import Path

import numpy as np
from PIL import Image

from models.extraction import OCRToken, RawOCRResult

# ---------------------------------------------------------------------------
# Suppress slow per-request network check (models already cached locally)
# ---------------------------------------------------------------------------
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

# ---------------------------------------------------------------------------
# Module-level singleton — lazy-initialised on first call
# ---------------------------------------------------------------------------
_ocr_instance = None

_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif"}


# Max image side length fed to PaddleOCR. Detection cost scales with resolution;
# the sample invoices are 1720px but downscaling to ~1000px roughly halves
# inference time (40s -> 24s on CPU) with no loss of recognised tokens.
# Override with OCR_MAX_SIDE=0 to disable downscaling.
_MAX_SIDE = int(os.getenv("OCR_MAX_SIDE", "1000"))


def _get_ocr():
    """Return the shared PaddleOCR instance, creating it if necessary."""
    global _ocr_instance
    if _ocr_instance is None:
        from paddleocr import PaddleOCR
        _ocr_instance = PaddleOCR(
            lang="en",
            enable_mkldnn=False,                  # disables oneDNN — avoids Windows crash
            # Skip the doc-orientation, dewarping and textline-orientation sub-models.
            # The trader invoices are upright scans/photos, so these add latency for
            # no benefit. (Re-enable use_textline_orientation for heavily rotated input.)
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
    return _ocr_instance


# ---------------------------------------------------------------------------
# Input normalisation
# ---------------------------------------------------------------------------

def _is_base64(s: str) -> bool:
    if s.startswith("data:"):
        return True
    ext = Path(s).suffix.lower()
    if ext in _IMAGE_EXTENSIONS:
        return False
    if len(s) > 260 and "/" not in s and "\\" not in s:
        return True
    return False


def _source_to_temp_path(image_source: str | bytes | Path) -> tuple[str, int, int]:
    """
    Convert any supported input type to a temporary file path that
    PaddleOCR.predict() can accept.

    Returns (file_path, width_px, height_px).
    The file is written to a system temp location only when needed (bytes/base64).
    """
    import tempfile

    path: str | None = None  # set when the source is already a usable file path

    if isinstance(image_source, Path):
        img = Image.open(image_source).convert("RGB")
        path = str(image_source)
    elif isinstance(image_source, str):
        if _is_base64(image_source):
            raw_b64 = image_source.split(",", 1)[1] if image_source.startswith("data:") else image_source
            raw = base64.b64decode(raw_b64)
            img = Image.open(io.BytesIO(raw)).convert("RGB")
        else:
            img = Image.open(image_source).convert("RGB")
            path = image_source
    elif isinstance(image_source, bytes):
        img = Image.open(io.BytesIO(image_source)).convert("RGB")
    else:
        raise TypeError(
            f"extract_text() received unsupported type: {type(image_source).__name__}. "
            "Expected str (path or base64), bytes, or pathlib.Path."
        )

    # Downscale large images — detection cost scales with resolution. When we
    # resize, the original file path is no longer valid, so write a temp file.
    w, h = img.size
    if _MAX_SIDE and max(w, h) > _MAX_SIDE:
        scale = _MAX_SIDE / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        w, h = img.size
        path = None  # force a fresh temp file from the resized image

    if path is None:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        img.save(tmp.name)
        tmp.close()
        path = tmp.name

    return path, w, h


# ---------------------------------------------------------------------------
# Result parsing — new PaddleOCR 3.7 (PaddleX) OCRResult format
# ---------------------------------------------------------------------------

def _ocr_result_to_tokens(
    ocr_result,
    image_width: int,
    image_height: int,
) -> list[OCRToken]:
    """
    Convert one PaddleX OCRResult (dict-like) into a flat list of OCRToken.

    OCRResult keys used:
        rec_texts  : list[str]           — recognised text per detection
        rec_scores : list[float]         — confidence per detection (0.0–1.0)
        rec_boxes  : list[array(4,)]     — axis-aligned bbox [x1,y1,x2,y2]
        rec_polys  : list[array(4,2)]    — polygon (fallback if rec_boxes absent)
    """
    tokens: list[OCRToken] = []

    def _as_list(val):
        """Convert None or numpy array to a plain Python list safely."""
        if val is None:
            return []
        try:
            return list(val)
        except TypeError:
            return []

    texts  = _as_list(ocr_result.get("rec_texts"))
    scores = _as_list(ocr_result.get("rec_scores"))
    boxes  = _as_list(ocr_result.get("rec_boxes"))
    polys  = _as_list(ocr_result.get("rec_polys"))

    use_boxes = len(boxes) == len(texts)
    use_polys = len(polys) == len(texts) and not use_boxes

    for i, (text, conf) in enumerate(zip(texts, scores)):
        text = str(text).strip()
        if not text:
            continue

        try:
            if use_boxes and i < len(boxes):
                b = boxes[i]
                x1, y1, x2, y2 = float(b[0]), float(b[1]), float(b[2]), float(b[3])
            elif use_polys and i < len(polys):
                poly = polys[i]
                xs = [float(pt[0]) for pt in poly]
                ys = [float(pt[1]) for pt in poly]
                x1, x2 = min(xs), max(xs)
                y1, y2 = min(ys), max(ys)
            else:
                # No bbox available — place at origin with zero size
                x1 = y1 = x2 = y2 = 0.0

            tokens.append(OCRToken(
                text=text,
                confidence=float(conf),
                x1=x1, y1=y1, x2=x2, y2=y2,
            ))
        except (TypeError, ValueError, IndexError):
            continue

    return tokens


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def warmup() -> None:
    """
    Eagerly construct the PaddleOCR instance and run one tiny inference so the
    first *real* request doesn't pay the cold-start cost (model load + lazy
    pipeline init can add 10–30s).

    Safe to call from a background thread at server startup: it logs and
    swallows all errors, since PaddleOCR is an optional dependency.
    """
    import logging
    log = logging.getLogger(__name__)
    try:
        t0 = time.perf_counter()
        ocr = _get_ocr()
        blank = np.full((320, 320, 3), 255, dtype=np.uint8)  # white image, no text
        list(ocr.predict(blank))
        log.info("OCR models warmed up in %.1fs", time.perf_counter() - t0)
    except Exception as exc:  # noqa: BLE001 — warmup is best-effort
        log.warning("OCR warmup skipped (offline OCR unavailable): %s", exc)


def extract_text(image_source: str | bytes | Path) -> RawOCRResult:
    """
    Run PaddleOCR on *image_source* and return a structured RawOCRResult.

    Parameters
    ----------
    image_source
        One of:
        - ``str`` — filesystem path OR base64-encoded image OR data URI.
        - ``bytes`` — raw image file bytes.
        - ``pathlib.Path`` — filesystem path.

    Returns
    -------
    RawOCRResult
        Contains per-token text, confidence (0–1), and bounding box.

    Raises
    ------
    TypeError
        If image_source is not a recognised type.
    OSError / PIL.UnidentifiedImageError
        If the image cannot be decoded.
    """
    t0 = time.perf_counter()

    file_path, width, height = _source_to_temp_path(image_source)
    ocr = _get_ocr()

    # predict() returns a generator; consume the single result for one image
    results = list(ocr.predict(file_path))

    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    tokens: list[OCRToken] = []
    for ocr_result in results:
        tokens.extend(_ocr_result_to_tokens(ocr_result, width, height))

    return RawOCRResult(
        tokens=tokens,
        image_width=width,
        image_height=height,
        processing_time_ms=elapsed_ms,
    )
