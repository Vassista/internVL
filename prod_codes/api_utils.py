"""API Utility Functions for InternVL"""
import os
import re
import json
import zipfile
import tempfile
import shutil
from typing import List, Dict, Tuple, Optional
from pathlib import Path
import pandas as pd
from api_models import StudentAnswer, StudentResult

def extract_roll_number_from_filename(filename: str) -> str:
    """Extract roll number from filename"""
    name = Path(filename).stem
    numbers = re.findall(r'\d+', name)

    if numbers:
        return numbers[-1]
    else:
        return name

def validate_image_file(filename: str) -> bool:
    """Check if file is a valid image format"""
    valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'}
    return Path(filename).suffix.lower() in valid_extensions

def extract_zip_file(zip_path: str, extract_to: str) -> List[str]:
    """Extract ZIP file and return list of image files"""
    image_files = []

    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_to)
        for root, dirs, files in os.walk(extract_to):
            for file in files:
                if validate_image_file(file) and not file.startswith('.'):
                    full_path = os.path.join(root, file)
                    image_files.append(full_path)

    return sorted(image_files)

def normalize_answer(answer: str) -> str:
    """Normalize answer to standard format"""
    if not answer or not isinstance(answer, str):
        return "NA"

    answer = answer.strip().lower()

    if answer in ['true', 't', 'yes', '1', 'correct']:
        return "true"

    if answer in ['false', 'f', 'no', '0', 'incorrect']:
        return "false"

    return "NA"

def compare_answers(student_answers: List[StudentAnswer], model_answers: List[StudentAnswer]) -> Tuple[int, int]:
    """Compare student answers with model answers"""
    correct_count = 0
    total_count = 0

    model_dict = {ans.sn: normalize_answer(ans.answer) for ans in model_answers}

    for student_ans in student_answers:
        sn = student_ans.sn
        if sn in model_dict:
            total_count += 1
            student_normalized = normalize_answer(student_ans.answer)
            model_normalized = model_dict[sn]

            if student_normalized != "NA" and model_normalized != "NA":
                if student_normalized == model_normalized:
                    correct_count += 1

    return correct_count, total_count

def calculate_score(student_answers: List[StudentAnswer], model_answers: List[StudentAnswer]) -> Dict:
    """Calculate detailed score for a student"""
    correct_count, total_count = compare_answers(student_answers, model_answers)
    percentage = (correct_count / total_count * 100) if total_count > 0 else 0

    return {
        "correct": correct_count,
        "total": total_count,
        "percentage": round(percentage, 2),
        "grade": get_letter_grade(percentage)
    }

def get_letter_grade(percentage: float) -> str:
    """Convert percentage to letter grade"""
    if percentage >= 90:
        return "A+"
    elif percentage >= 80:
        return "A"
    elif percentage >= 70:
        return "B"
    elif percentage >= 60:
        return "C"
    elif percentage >= 50:
        return "D"
    else:
        return "F"

def parse_ocr_response(response: str) -> List[StudentAnswer]:
    """Parse InternVL OCR response to StudentAnswer objects"""
    try:
        cleaned = response.lower()
        cleaned = cleaned.replace('json', "")
        cleaned = cleaned.replace('```', "")
        cleaned = cleaned.strip()

        data = json.loads(cleaned)

        answers = []
        for item in data:
            if isinstance(item, dict) and 'sn' in item and 'answer' in item:
                answers.append(StudentAnswer(
                    sn=int(item['sn']),
                    answer=str(item['answer'])
                ))

        return answers

    except (json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"Error parsing OCR response: {e}")
        return []

def create_summary_stats(results: List[StudentResult]) -> Dict:
    """Create summary statistics for the evaluation"""
    if not results:
        return {"total_students": 0}

    scores = [r.percentage for r in results]

    return {
        "total_students": len(results),
        "average_score": round(sum(scores) / len(scores), 2),
        "highest_score": max(scores),
        "lowest_score": min(scores),
        "pass_rate": len([s for s in scores if s >= 50]) / len(scores) * 100,
        "grade_distribution": {
            "A+": len([s for s in scores if s >= 90]),
            "A": len([s for s in scores if 80 <= s < 90]),
            "B": len([s for s in scores if 70 <= s < 80]),
            "C": len([s for s in scores if 60 <= s < 70]),
            "D": len([s for s in scores if 50 <= s < 60]),
            "F": len([s for s in scores if s < 50])
        }
    }

def cleanup_temp_files(temp_dir: str):
    """Clean up temporary files and directories"""
    try:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
    except Exception as e:
        print(f"Warning: Could not clean up temp directory {temp_dir}: {e}")

def process_student_files(zip_file_path: Optional[str] = None,
                         individual_files: Optional[List[str]] = None,
                         extract_to: str = None) -> List[str]:
    """Process student files from either ZIP or individual uploads"""
    image_files = []

    if zip_file_path:
        image_files = extract_zip_file(zip_file_path, extract_to)
    elif individual_files:
        for file_path in individual_files:
            if validate_image_file(file_path):
                image_files.append(file_path)
        image_files = sorted(image_files)

    return image_files
