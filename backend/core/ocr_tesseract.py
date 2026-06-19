import io
import base64
from PIL import Image
# pyrefly: ignore [missing-import]
import pytesseract
from models.extraction import OCRToken, RawOCRResult
import time

# Explicitly set the tesseract executable path since we just installed it via winget
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def extract_text_tesseract(image_source: str | bytes) -> RawOCRResult:
    t0 = time.perf_counter()
    if isinstance(image_source, str):
        if ',' in image_source:
            image_source = image_source.split(',', 1)[1]
        img_bytes = base64.b64decode(image_source)
    else:
        img_bytes = image_source
    
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    
    # Get detailed OCR data with bounding boxes
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    
    tokens = []
    for i, text in enumerate(data['text']):
        text = str(text).strip()
        # Skip empty text or very low confidence
        if not text or int(data['conf'][i]) < 30:
            continue
            
        x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
        tokens.append(OCRToken(
            text=text,
            confidence=int(data['conf'][i]) / 100.0,
            x1=float(x), y1=float(y),
            x2=float(x + w), y2=float(y + h),
        ))
        
    elapsed = (time.perf_counter() - t0) * 1000
    w_px, h_px = img.size
    
    return RawOCRResult(
        tokens=tokens, 
        image_width=w_px, 
        image_height=h_px, 
        processing_time_ms=elapsed
    )
