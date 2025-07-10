"""
Main API server for automated answer sheet evaluation using InternVL
"""

import os
import uuid
import tempfile
import asyncio
import pandas as pd
import json
import traceback
import re
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
import uvicorn
from utils.autoeval_ocr import load_model_and_tokenizer, run_internvl_ocr, post_process_response
from models.api_models import (
    HealthResponse, UploadResponse, JobStatus,
    EvaluationResults, StudentResult, StudentAnswer
)
from utils.api_utils import (
    extract_zip_file, extract_roll_number_from_filename,
    validate_image_file, parse_ocr_response, compare_answers,
    calculate_score, create_summary_stats, cleanup_temp_files
)
from database.database import (
    init_database, save_evaluation_job, update_job_progress,
    complete_evaluation_job, save_student_evaluation,
    get_evaluation_job, get_student_evaluations, get_all_evaluation_jobs,
    get_dashboard_statistics, get_recent_evaluations, delete_evaluation_job
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

UPLOAD_DIR = "temp_uploads"
MAX_FILE_SIZE = 100 * 1024 * 1024
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'}
def fix_json_response(response_text: str) -> str:
    """Fix common JSON formatting issues in InternVL responses."""
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
                answer_match = re.search(r'[,s]*\d+[,s]*"?([^",}\s]+)"?', remainder)
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
    json_entries = [f'  {{"sn": {i}, "answer": "{answer}"}}' for i, answer in enumerate(valid_entries, 1)]
    result = '[\n' + ',\n'.join(json_entries) + '\n]'
    return result
    return result

def run_ocr_with_global_model(image_path: str):
    """Run OCR using the globally loaded InternVL model (avoids reloading)."""
    global model, tokenizer
    if model is None or tokenizer is None:
        print("❌ Model not loaded in global context")
        return None
    try:
        from utils.internvl import load_image, load_prompt
        from utils.autoeval_ocr import post_process_response
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
        traceback.print_exc()
        return None

@app.on_event("startup")
async def startup_event():
    """Initialize the InternVL model and database on startup"""
    global model, tokenizer

    try:
        # Initialize database
        await init_database()
        print("✅ Database initialized successfully!")

        print("Loading InternVL model...")
        model, tokenizer = load_model_and_tokenizer()
        print("✅ Model loaded successfully!")

        # Create upload directory
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    except Exception as e:
        print(f"❌ Error during startup: {e}")
        # gotta exit here in production

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
    """
    Upload model answer and individual student images for evaluation
    """
    # Validate model is loaded
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Validate file types
    if not validate_image_file(model_answer.filename):
        raise HTTPException(status_code=400, detail="Model answer must be an image file")

    # Validate all student images
    for img in student_images:
        if not validate_image_file(img.filename):
            raise HTTPException(status_code=400, detail=f"All student files must be images: {img.filename}")

    if len(student_images) == 0:
        raise HTTPException(status_code=400, detail="At least one student image is required")

    if len(student_images) > 50:  # Reasonable limit
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
    """
    Common upload processing for both ZIP and individual image uploads
    """
    # Generate unique job ID
    job_id = str(uuid.uuid4())

    # Create temporary directory for this job
    job_temp_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(job_temp_dir, exist_ok=True)

    try:
        # Save model answer file
        model_answer_path = os.path.join(job_temp_dir, f"model_answer_{model_answer.filename}")
        with open(model_answer_path, "wb") as f:
            content = await model_answer.read()
            f.write(content)

        student_files = []

        if upload_type == "zip" and student_zip:
            # Handle ZIP file upload
            zip_file = student_zip[0]  # student_zip is a list with one ZIP file
            zip_path = os.path.join(job_temp_dir, f"student_sheets_{zip_file.filename}")

            # Write ZIP file
            with open(zip_path, "wb") as f:
                content = await zip_file.read()
                f.write(content)

            # Extract ZIP and get student files
            extract_dir = os.path.join(job_temp_dir, "extracted")
            student_files = extract_zip_file(zip_path, extract_dir)

        elif upload_type == "individual" and student_images:
            # Handle individual images upload
            individual_dir = os.path.join(job_temp_dir, "individual")
            os.makedirs(individual_dir, exist_ok=True)

            for i, student_img in enumerate(student_images):
                # Save each individual image
                img_path = os.path.join(individual_dir, student_img.filename)
                with open(img_path, "wb") as f:
                    content = await student_img.read()
                    f.write(content)
                student_files.append(img_path)

        else:
            raise HTTPException(status_code=400, detail="Invalid upload configuration")

        # Save job to database
        await save_evaluation_job(job_id, job_name, len(student_files))

        # Start background processing
        background_tasks.add_task(
            process_evaluation_job,
            job_id,
            job_name,
            model_answer_path,
            student_files,
            job_temp_dir,
            upload_type
        )

        return UploadResponse(
            job_id=job_id,
            message=f"Files uploaded successfully ({upload_type}). Processing started.",
            status="pending",
            model_answer_received=True,
            student_sheets_count=len(student_files)
        )

    except Exception as e:
        # Cleanup on error
        cleanup_temp_files(job_temp_dir)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/evaluation/{job_id}/status", response_model=JobStatus)
async def get_evaluation_status(job_id: str):
    """Get the status of an evaluation job"""

    job = await get_evaluation_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatus(
        job_id=job_id,
        job_name=job.get("name"),
        status=job["status"],
        total_students=job["total_files"],
        processed_students=job["processed_files"],
        created_at=datetime.fromisoformat(job["created_at"]),
        completed_at=datetime.fromisoformat(job["completed_at"]) if job["completed_at"] else None,
        error_message=job.get("error_message")
    )

@app.get("/results/{job_id}", response_model=EvaluationResults)
async def get_evaluation_results(job_id: str):
    """Get the results of a completed evaluation job"""

    job = await get_evaluation_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed yet. Current status: {job['status']}"
        )

    # Get student evaluations
    students = await get_student_evaluations(job_id)

    # Parse results and summary stats from job with error handling
    results = []
    summary_stats = {}

    # Handle results field
    if job["results"]:
        if isinstance(job["results"], str) and job["results"].strip():
            try:
                results = json.loads(job["results"])
            except json.JSONDecodeError as e:
                print(f"Warning: Could not parse job results JSON: {e}")
                results = []
        elif isinstance(job["results"], list):
            results = job["results"]

    # Handle summary_stats field
    if job["summary_stats"]:
        if isinstance(job["summary_stats"], str) and job["summary_stats"].strip():
            try:
                summary_stats = json.loads(job["summary_stats"])
            except json.JSONDecodeError as e:
                print(f"Warning: Could not parse job summary_stats JSON: {e}")
                summary_stats = {}
        elif isinstance(job["summary_stats"], dict):
            summary_stats = job["summary_stats"]

    return EvaluationResults(
        job_id=job_id,
        job_name=job.get("name") or f"Evaluation_{job_id[:8]}",
        status=job["status"],
        model_answers=[],
        student_results=results,
        summary=summary_stats,
        created_at=datetime.fromisoformat(job["created_at"]),
        completed_at=datetime.fromisoformat(job["completed_at"]) if job["completed_at"] else None
    )

@app.get("/jobs/suggestions")
async def get_job_suggestions(limit: int = 10):
    """Get recent job suggestions for search autocomplete"""

    jobs = await get_all_evaluation_jobs()

    # Limit results
    jobs = jobs[:limit]

    suggestions = []
    for job in jobs:
        suggestion = {
            "job_id": job["id"],
            "job_name": job.get("name") or f"Evaluation_{job['id'][:8]}",
            "status": job["status"],
            "total_students": job["total_files"],
            "created_at": job["created_at"],
        }
        suggestions.append(suggestion)

    return {
        "suggestions": suggestions,
        "total": len(suggestions)
    }

@app.get("/jobs/search")
async def search_jobs(query: Optional[str] = None, limit: int = 20):
    """Search for jobs by name or list all jobs"""

    # Get all jobs from database
    jobs = await get_all_evaluation_jobs()

    # Filter by query if provided
    if query:
        query_lower = query.lower()
        jobs = [job for job in jobs if (
            query_lower in job["id"].lower() or
            (job.get("name") and query_lower in job["name"].lower())
        )]

    # Limit results
    jobs = jobs[:limit]

    # Convert to serializable format
    jobs_list = []
    for job in jobs:
        job_dict = {
            "job_id": job["id"],
            "job_name": job.get("name") or f"Evaluation_{job['id'][:8]}",
            "status": job["status"],
            "total_students": job["total_files"],
            "processed_students": job["processed_files"],
            "created_at": job["created_at"],
            "completed_at": job["completed_at"],
        }
        jobs_list.append(job_dict)

    return {
        "query": query,
        "total_found": len(jobs_list),
        "jobs": jobs_list
    }

@app.get("/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""

    stats = await get_dashboard_statistics()
    return stats

@app.get("/dashboard/recent")
async def get_recent_evaluations_endpoint(limit: int = 10):
    """Get recent evaluations for dashboard"""

    recent_jobs = await get_recent_evaluations(limit)
    return {"recent_jobs": recent_jobs}

async def process_evaluation_job(
    job_id: str,
    job_name: str,
    model_answer_path: str,
    student_files: List[str],
    temp_dir: str,
    upload_type: str
):
    """
    Background task to process the evaluation job
    """
    global model, tokenizer

    try:
        # Process model answer first
        print(f"Processing model answer for job {job_id}")
        model_df = run_ocr_with_global_model(model_answer_path)

        if model_df is None or model_df.empty:
            await complete_evaluation_job(job_id, {}, {}, "Failed to process model answer")
            return

        # Convert model answers to StudentAnswer objects
        model_answers = []
        for _, row in model_df.iterrows():
            model_answers.append(StudentAnswer(
                sn=int(row['sn']),
                answer=str(row['answer'])
            ))

        # Process each student sheet
        student_results = []
        processed_count = 0

        for i, student_file in enumerate(student_files):
            try:
                print(f"Processing student {i+1}/{len(student_files)}: {student_file}")

                # Extract roll number from filename
                roll_number = extract_roll_number_from_filename(os.path.basename(student_file))

                # Process student answer sheet
                student_df = run_ocr_with_global_model(student_file)

                if student_df is not None and not student_df.empty:
                    # Convert to StudentAnswer objects
                    student_answers = []
                    student_answers_dict = []
                    for _, row in student_df.iterrows():
                        answer_obj = StudentAnswer(
                            sn=int(row['sn']),
                            answer=str(row['answer'])
                        )
                        student_answers.append(answer_obj)
                        student_answers_dict.append({
                            "sn": int(row['sn']),
                            "answer": str(row['answer'])
                        })

                    # Calculate score
                    score_info = calculate_score(student_answers, model_answers)

                    # Save individual student evaluation to database
                    await save_student_evaluation(
                        job_id=job_id,
                        roll_number=roll_number,
                        filename=os.path.basename(student_file),
                        ocr_text=student_df.to_json(),
                        processed_answers=student_answers_dict,
                        total_score=float(score_info["correct"]),
                        max_possible_score=float(score_info["total"]),
                        percentage=float(score_info["percentage"])
                    )

                    # Create student result for summary
                    student_result = StudentResult(
                        roll_number=roll_number,
                        answers=student_answers,
                        score=score_info["correct"],
                        total_questions=score_info["total"],
                        percentage=score_info["percentage"],
                        status="completed"
                    )

                    student_results.append(student_result)
                    processed_count += 1

                else:
                    print(f"Failed to process student: {student_file}")

                # Update progress in database
                await update_job_progress(job_id, processed_count)

            except Exception as e:
                print(f"Error processing student {student_file}: {e}")
                continue

        # Generate summary statistics
        summary = create_summary_stats(student_results)

        # Convert student_results to JSON-serializable format
        results_dict = []
        for result in student_results:
            results_dict.append({
                "roll_number": result.roll_number,
                "answers": [{"sn": ans.sn, "answer": ans.answer} for ans in result.answers],
                "score": result.score,
                "total_questions": result.total_questions,
                "percentage": result.percentage,
                "status": result.status
            })

        # Determine final job status based on processing results
        total_files = len(student_files)
        processed_files = len(student_results)

        if processed_files == 0:
            # No students processed successfully - mark as failed
            error_message = f"Failed to process any of the {total_files} student files. Please check the file formats and try again."
            await complete_evaluation_job(job_id, results_dict, summary, error_message)
            print(f"❌ Job {job_id} failed! Processed 0/{total_files} students.")
        elif processed_files == total_files:
            # All students processed successfully - mark as completed
            await complete_evaluation_job(job_id, results_dict, summary, None)
            print(f"✅ Job {job_id} completed successfully! Processed {processed_files}/{total_files} students.")
        else:
            # Partial success - mark as completed with warning
            error_message = f"Partially completed: Successfully processed {processed_files} out of {total_files} student files. Some files may have had formatting issues."
            await complete_evaluation_job(job_id, results_dict, summary, error_message)
            print(f"⚠️ Job {job_id} partially completed! Processed {processed_files}/{total_files} students.")

    except Exception as e:
        print(f"❌ Error processing job {job_id}: {e}")
        await complete_evaluation_job(job_id, {}, {}, str(e))

    finally:
        # Cleanup temporary files after processing
        cleanup_temp_files(temp_dir)

@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its associated data"""

    success = await delete_evaluation_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")

    # Also cleanup files
    job_dir = Path(UPLOAD_DIR) / job_id
    if job_dir.exists():
        cleanup_temp_files(job_dir)

    return {"message": f"Job {job_id} deleted successfully"}

if __name__ == "__main__":
    # Create upload directory if it doesn't exist
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Run the server
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
