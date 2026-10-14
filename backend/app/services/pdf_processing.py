import base64
import logging
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path

logger = logging.getLogger("medical-records-app")

def _read_pdf_content(file_path: str):
    """Read PDF file and open via stream"""
    with open(file_path, "rb") as f:
        content = f.read()
    logger.info(f"[ANALYSIS] PDF file size: {len(content)} bytes, first bytes hex: {content[:20].hex()}")
    import pymupdf
    return pymupdf.open(stream=BytesIO(content), filetype="pdf")

def _pdf_to_images_poppler(file_path: str) -> list:
    """Convert PDF pages to base64 PNG images using pdftoppm"""
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            result = subprocess.run(
                ["pdftoppm", "-png", "-r", "200", file_path, f"{tmpdir}/page"],
                capture_output=True, timeout=30
            )
            if result.returncode != 0:
                logger.warning(f"[ANALYSIS] pdftoppm failed: {result.stderr.decode()}")
                return []
            page_files = sorted(Path(tmpdir).glob("page-*.png"))
            if not page_files:
                logger.warning("[ANALYSIS] pdftoppm produced no output files")
                return []
            images = []
            for pf in page_files:
                with open(pf, "rb") as f:
                    images.append(base64.b64encode(f.read()).decode("utf-8"))
            logger.info(f"[ANALYSIS] pdftoppm converted {len(images)} pages")
            return images
    except FileNotFoundError:
        logger.warning("[ANALYSIS] pdftoppm not installed")
        return []
    except Exception as e:
        logger.warning(f"[ANALYSIS] pdftoppm failed: {e}")
        return []

def _pdf_to_text_poppler(file_path: str) -> str:
    """Extract text from PDF using pdftotext"""
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", file_path, "-"],
            capture_output=True, timeout=30
        )
        if result.returncode == 0 and result.stdout.strip():
            text = result.stdout.decode("utf-8", errors="replace")
            logger.info(f"[ANALYSIS] pdftotext extracted {len(text)} characters")
            return text
    except FileNotFoundError:
        logger.warning("[ANALYSIS] pdftotext not installed")
    except Exception as e:
        logger.warning(f"[ANALYSIS] pdftotext failed: {e}")
    return ""

def convert_pdf_to_images(file_path: str) -> list:
    logger.info(f"[ANALYSIS] Converting PDF to images: {file_path}")
    # Try pdftoppm first — handles more PDF variants than pymupdf
    poppler_images = _pdf_to_images_poppler(file_path)
    if poppler_images:
        logger.info(f"[ANALYSIS] pdftoppm converted {len(poppler_images)} pages")
        return poppler_images
    # Fall back to pymupdf
    logger.warning("[ANALYSIS] pdftoppm unavailable or failed, trying pymupdf...")
    try:
        import pymupdf
        doc = _read_pdf_content(file_path)
        images = []
        for page_num, page in enumerate(doc):
            pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
            img_data = pix.tobytes("png")
            images.append(base64.b64encode(img_data).decode('utf-8'))
            logger.info(f"[ANALYSIS] Converted page {page_num + 1}/{len(doc)} to image, size: {len(img_data)} bytes")
        logger.info(f"[ANALYSIS] Converted {len(images)} pages to images")
        return images
    except Exception as e:
        logger.warning(f"[ANALYSIS] pymupdf image conversion failed: {e}")
        return []

def extract_text_from_pdf(file_path: str) -> str:
    logger.info(f"[ANALYSIS] Extracting text from PDF: {file_path}")
    # Try pdftotext first
    poppler_text = _pdf_to_text_poppler(file_path)
    if poppler_text:
        return poppler_text
    # Fall back to pymupdf
    logger.warning("[ANALYSIS] pdftotext unavailable or failed, trying pymupdf...")
    try:
        import pymupdf
        doc = _read_pdf_content(file_path)
        text = ""
        for page in doc:
            text += page.get_text()
        logger.info(f"[ANALYSIS] Extracted {len(text)} characters from PDF with {len(doc)} pages")
        return text
    except Exception:
        logger.warning("[ANALYSIS] pymupdf text extraction failed, trying raw text fallback...")
        try:
            with open(file_path, "rb") as f:
                raw = f.read()
            text = raw.decode("utf-8", errors="replace")
            if text.strip():
                logger.info(f"[ANALYSIS] Extracted {len(text)} characters via raw text fallback")
                return text
        except Exception:
            pass
        return ""

def encode_image_to_base64(file_path: str) -> str:
    logger.info(f"[ANALYSIS] Encoding image to base64: {file_path}")
    with open(file_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
    logger.info(f"[ANALYSIS] Image encoded, base64 length: {len(encoded)} characters")
    return encoded
