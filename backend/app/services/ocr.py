"""Extract text from an uploaded contract — image (Tesseract) or PDF (pdfplumber).

Both tools are free and open-source. Pasted text bypasses this entirely.
"""
import io


def extract_text(filename: str, data: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return _from_pdf(data)
    if name.endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff")):
        return _from_image(data)
    # plain text / unknown -> best-effort decode
    return data.decode("utf-8", errors="ignore")


def _from_pdf(data: bytes) -> str:
    import pdfplumber

    text_parts = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            text_parts.append(page.extract_text() or "")
    return "\n".join(text_parts).strip()


def _from_image(data: bytes) -> str:
    import pytesseract
    from PIL import Image

    image = Image.open(io.BytesIO(data))
    return pytesseract.image_to_string(image).strip()
