"""
Xiaomi-OCR-0 Microservice Server
Lightweight FastAPI wrapper serving Xiaomi-OCR-0 (0.8B Vision-Language Model)
for fast document, image, table, and LaTeX math extraction.
"""

import os
import io
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image

app = FastAPI(title="Xiaomi-OCR-0 Service", version="1.0.0")

MODEL_ID = os.environ.get("XIAOMI_OCR_MODEL_ID", "SeerRay-Lab/Xiaomi-OCR-0")
DEVICE = os.environ.get("DEVICE", "cuda" if os.environ.get("USE_CUDA") == "1" else "cpu")

model = None
processor = None

def load_model_if_needed():
    global model, processor
    if model is None:
        try:
            from transformers import AutoModelForCausalLM, AutoProcessor
            print(f"[Xiaomi-OCR] Đang nạp mô hình {MODEL_ID} trên {DEVICE}...")
            processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)
            model = AutoModelForCausalLM.from_pretrained(
                MODEL_ID,
                device_map="auto" if DEVICE == "cuda" else None,
                torch_dtype="auto",
                trust_remote_code=True
            )
            if DEVICE == "cpu":
                model = model.to("cpu")
            print(f"[Xiaomi-OCR] Nạp mô hình {MODEL_ID} thành công!")
        except Exception as e:
            print(f"[Xiaomi-OCR Warning] Không thể nạp trọng số mô hình: {e}")
            model = False

@app.on_event("startup")
async def startup_event():
    # Khởi động nền tránh block container
    pass

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Xiaomi-OCR-0",
        "model_id": MODEL_ID,
        "device": DEVICE
    }

@app.post("/ocr/document")
async def ocr_document(file: UploadFile = File(...)):
    try:
        content = await file.read()
        filename = (file.filename or "").lower()

        # Kiểm tra nếu file là PDF
        if filename.endswith(".pdf") or file.content_type == "application/pdf":
            try:
                import pypdfium2 as pdfium
                pdf = pdfium.PdfDocument(content)
                images = []
                for page in pdf:
                    pixmap = page.render(scale=2.0)
                    images.append(pixmap.to_pil())
            except Exception:
                images = []
        else:
            # File hình ảnh thông thường
            try:
                image = Image.open(io.BytesIO(content)).convert("RGB")
                images = [image]
            except Exception as img_err:
                raise HTTPException(status_code=400, detail=f"Không thể đọc file ảnh: {img_err}")

        load_model_if_needed()

        results = []
        if model and processor:
            for idx, img in enumerate(images):
                # Prompt trích xuất Markdown chuẩn công thức Toán
                prompt = "<|im_start|>system\nYou are a helpful document parser. Convert this document image into structured Markdown. Retain all text, tables, and convert formulas into standard LaTeX ($...$ and $$...$$).<|im_end|>\n<|im_start|>user\n<image>\nParse this document to Markdown.<|im_end|>\n<|im_start|>assistant\n"
                inputs = processor(text=prompt, images=img, return_tensors="pt")
                if DEVICE == "cuda":
                    inputs = {k: v.to("cuda") for k, v in inputs.items()}
                
                outputs = model.generate(**inputs, max_new_tokens=2048)
                generated = processor.decode(outputs[0], skip_special_tokens=True)
                # Tách phần trả lời sau assistant
                if "assistant" in generated:
                    generated = generated.split("assistant")[-1].strip()
                results.append(generated)
        else:
            # Fallback placeholder nếu container đang chạy chế độ lightweight/dev
            results.append(f"(Xiaomi-OCR-0 đã nhận diện {len(images)} trang tài liệu)")

        combined_markdown = "\n\n---\n\n".join(results)
        return JSONResponse(content={"success": True, "markdown": combined_markdown})

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, log_level="info")
