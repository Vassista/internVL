"""Main API server using InternVL for automated answer sheet evaluation"""
import os
import uuid
import tempfile
import asyncio
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
import uvicorn

from autoeval_ocr import load_model_and_tokenizer, run_internvl_ocr, post_process_response
from api_models import (
    HealthResponse, UploadResponse, JobStatus,
    EvaluationResults, StudentResult, StudentAnswer
)
from api_utils import (
    extract_zip_file, extract_roll_number_from_filename,
    validate_image_file, parse_ocr_response, compare_answers,
    calculate_score, create_summary_stats, cleanup_temp_files
)

app = FastAPI(
    title="InternVL API",
    description="Automated answer sheet evaluation using InternVL",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
tokenizer = None
jobs_storage: Dict[str, Dict] = {}

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'}

def fix_json_response(response_text: str) -> str:
    import re

    cleaned = response_text.strip()

    lines = cleaned.split('\n')
    valid_entries = []

    for line in lines:
        line = line.strip()
        if not line or line in ['[', ']', ',']:
            continue

        if '"sn":' in line and '"answer":' in line:
            answer_match = re.search(r'"answer":\s*"([^"]*)"', line)
            if answer_match:
                answer = answer_match.group(1)
                valid_entries.append(answer)
        elif '"sn":' in line:
            parts = line.split('"sn":')
            if len(parts) > 1:
                remainder = parts[1].strip()
                answer_match = re.search(r'[,\s]*\d+[,\s]*"?([^",}\s]+)"?', remainder)
                if answer_match:
                    answer = answer_match.group(1).lower().strip()
                    if answer in ['true', 'false', 't', 'f', 'na']:
                        valid_entries.append(answer)
                    else:
                        valid_entries.append('na')
                else:
                    valid_entries.append('na')

    while len(valid_entries) < 10:
        valid_entries.append('na')

    valid_entries = valid_entries[:10]

    json_entries = []
    for i, answer in enumerate(valid_entries, 1):
        json_entries.append(f'  {{"sn": {i}, "answer": "{answer}"}}')

    result = '[\n' + ',\n'.join(json_entries) + '\n]'

    return result

def run_ocr_with_global_model(image_path: str):
    """Run OCR using the globally loaded InternVL model"""
    global model, tokenizer

    if model is None or tokenizer is None:
        print("❌ Model not loaded in global context")
        return None

    try:
        print("Running OCR using InternVL...")

        import pandas as pd
        import json
        import torch
        from internvl import load_image, load_prompt
        from autoeval_ocr import post_process_response

        prompt = load_prompt()
        question = "<image>\n" + prompt
        pixel_values = load_image(image_path, max_num=12).to(torch.bfloat16).cuda()

        generation_config = dict(
            max_new_tokens=1024,
            do_sample=True,
            eos_token_id=151645,
            pad_token_id=151645
        )

        response = model.chat(tokenizer, pixel_values, question, generation_config)
        cleaned_response = post_process_response(response)

        fixed_response = fix_json_response(cleaned_response)

        try:
            parsed_data = json.loads(fixed_response)
            df = pd.DataFrame(parsed_data)
            return df
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}")
            print(f"Raw response: {response}")
            print(f"Cleaned response: {cleaned_response}")
            print(f"Fixed response: {fixed_response}")
            return None

    except Exception as e:
        print(f"❌ Error in OCR processing: {e}")
        import traceback
        traceback.print_exc()
        return None

@app.on_event("startup")
async def startup_event():
    """Initialize the InternVL model on startup"""
    global model, tokenizer

    try:
        print("Loading InternVL model...")
        model, tokenizer = load_model_and_tokenizer()
        print("✅ Model loaded successfully!")

    except Exception as e:
        print(f"❌ Error loading model: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global model, tokenizer

    if model is not None:
        del model
        torch.cuda.empty_cache()

    print("🔄 Server shutdown complete")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check API health and model status"""
    return HealthResponse(
        status="healthy" if model is not None else "model_not_loaded",
        model_loaded=model is not None,
        gpu_available=torch.cuda.is_available(),
        timestamp=datetime.now()
    )

@app.post("/upload/evaluation", response_model=UploadResponse)
async def upload_evaluation(
    background_tasks: BackgroundTasks,
    model_answer: UploadFile = File(...),
    student_sheets: UploadFile = File(...),
    job_name: str = Form(...)
):
    """
    Upload model answer and student sheets (ZIP file) for evaluation
    """
    # Validate model is loaded
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Validate file types
    if not validate_image_file(model_answer.filename):
        raise HTTPException(status_code=400, detail="Model answer must be an image file")

    if not student_sheets.filename.lower().endswith('.zip'):
        raise HTTPException(status_code=400, detail="Student sheets must be a ZIP file")

    return await process_upload(background_tasks, model_answer, None, [student_sheets], job_name, "zip")

@app.post("/upload/individual", response_model=UploadResponse)
async def upload_individual_images(
    background_tasks: BackgroundTasks,
    model_answer: UploadFile = File(...),
    student_images: List[UploadFile] = File(...),
    job_name: str = Form(...)
):
    """Upload model answer and individual student images for evaluation"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not validate_image_file(model_answer.filename):
        raise HTTPException(status_code=400, detail="Model answer must be an image file")

    for img in student_images:
        if not validate_image_file(img.filename):
            raise HTTPException(status_code=400, detail=f"All student files must be images: {img.filename}")

    if len(student_images) == 0:
        raise HTTPException(status_code=400, detail="At least one student image is required")

    if len(student_images) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 student images allowed")

    return await process_upload(background_tasks, model_answer, student_images, None, job_name, "individual")

async def process_upload(
    background_tasks: BackgroundTasks,
    model_answer: UploadFile,
    student_images: List[UploadFile] = None,
    student_zip: List[UploadFile] = None,
    job_name: str = "",
    upload_type: str = "zip"
):
    """Common upload processing for both ZIP and individual image uploads"""
    job_id = str(uuid.uuid4())

    job_temp_dir = tempfile.mkdtemp(prefix=f"gradegenius_{job_id}_")

    try:
        model_answer_path = os.path.join(job_temp_dir, f"model_answer_{model_answer.filename}")
        with open(model_answer_path, "wb") as f:
            content = await model_answer.read()
            f.write(content)

        student_files = []

        if upload_type == "zip" and student_zip:
            zip_file = student_zip[0]
            zip_path = os.path.join(job_temp_dir, f"student_sheets_{zip_file.filename}")

            with open(zip_path, "wb") as f:
                content = await zip_file.read()
                f.write(content)

            extract_dir = os.path.join(job_temp_dir, "extracted")
            student_files = extract_zip_file(zip_path, extract_dir)

        elif upload_type == "individual" and student_images:
            individual_dir = os.path.join(job_temp_dir, "individual")
            os.makedirs(individual_dir, exist_ok=True)

            for i, student_img in enumerate(student_images):
                img_path = os.path.join(individual_dir, student_img.filename)
                with open(img_path, "wb") as f:
                    content = await student_img.read()
                    f.write(content)
                student_files.append(img_path)

        else:
            raise HTTPException(status_code=400, detail="Invalid upload configuration")

        jobs_storage[job_id] = {
            "job_id": job_id,
            "job_name": job_name,
            "status": "pending",
            "total_students": len(student_files),
            "processed_students": 0,
            "created_at": datetime.now(),
            "model_answer_path": model_answer_path,
            "student_files": student_files,
            "temp_dir": job_temp_dir,
            "upload_type": upload_type,
            "results": []
        }

        # Start background processing
        background_tasks.add_task(process_evaluation_job, job_id)

        return UploadResponse(
            job_id=job_id,
            message=f"Files uploaded successfully ({upload_type}). Processing started.",
            status="pending",
            model_answer_received=True,
            student_sheets_count=len(student_files)
        )

    except Exception as e:
        cleanup_temp_files(job_temp_dir)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/evaluation/{job_id}/status", response_model=JobStatus)
async def get_evaluation_status(job_id: str):
    """Get the status of an evaluation job"""

    if job_id not in jobs_storage:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs_storage[job_id]

    return JobStatus(
        job_id=job_id,
        status=job["status"],
        total_students=job["total_students"],
        processed_students=job["processed_students"],
        created_at=job["created_at"],
        completed_at=job.get("completed_at"),
        error_message=job.get("error_message")
    )

@app.get("/results/{job_id}", response_model=EvaluationResults)
async def get_evaluation_results(job_id: str):
    """Get the results of a completed evaluation job"""

    if job_id not in jobs_storage:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs_storage[job_id]

    if job["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed yet. Current status: {job['status']}"
        )

    return EvaluationResults(
        job_id=job_id,
        job_name=job["job_name"],
        status=job["status"],
        model_answers=job["model_answers"],
        student_results=job["results"],
        summary=job["summary"],
        created_at=job["created_at"],
        completed_at=job.get("completed_at")
    )

async def process_evaluation_job(job_id: str):
    """Background task to process the evaluation job"""
    global model, tokenizer

    try:
        job = jobs_storage[job_id]
        job["status"] = "processing"

        print(f"Processing model answer for job {job_id}")
        model_df = run_ocr_with_global_model(job["model_answer_path"])

        if model_df is None or model_df.empty:
            raise Exception("Failed to process model answer")

        model_answers = []
        for _, row in model_df.iterrows():
            model_answers.append(StudentAnswer(
                sn=int(row['sn']),
                answer=str(row['answer'])
            ))

        job["model_answers"] = model_answers

        student_results = []

        for i, student_file in enumerate(job["student_files"]):
            try:
                print(f"Processing student {i+1}/{len(job['student_files'])}: {student_file}")

                roll_number = extract_roll_number_from_filename(os.path.basename(student_file))

                student_df = run_ocr_with_global_model(student_file)

                if student_df is not None and not student_df.empty:
                    student_answers = []
                    for _, row in student_df.iterrows():
                        student_answers.append(StudentAnswer(
                            sn=int(row['sn']),
                            answer=str(row['answer'])
                        ))

                    score_info = calculate_score(student_answers, model_answers)

                    # Create student result
                    student_result = StudentResult(
                        roll_number=roll_number,
                        answers=student_answers,
                        score=score_info["correct"],
                        total_questions=score_info["total"],
                        percentage=score_info["percentage"],
                        status="completed"
                    )

                    student_results.append(student_result)

                else:
                    print(f"Failed to process student: {student_file}")

                job["processed_students"] = i + 1

            except Exception as e:
                print(f"Error processing student {student_file}: {e}")
                continue

        summary = create_summary_stats(student_results)

        job["results"] = student_results
        job["summary"] = summary
        job["status"] = "completed"
        job["completed_at"] = datetime.now()

        print(f"✅ Job {job_id} completed successfully! Processed {len(student_results)} students.")

    except Exception as e:
        print(f"❌ Error processing job {job_id}: {e}")
        job["status"] = "failed"
        job["error_message"] = str(e)
        job["completed_at"] = datetime.now()

    finally:
        cleanup_temp_files(job.get("temp_dir", ""))

@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its associated data"""
    if job_id not in jobs_storage:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs_storage[job_id]

    cleanup_temp_files(job.get("temp_dir", ""))

    del jobs_storage[job_id]

    return {"message": f"Job {job_id} deleted successfully"}

if __name__ == "__main__":
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
