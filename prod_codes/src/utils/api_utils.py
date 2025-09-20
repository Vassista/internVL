"""
API Utility Functions for AutoEval
"""
import os
import re
import json
import zipfile
import tempfile
import shutil
import csv
from typing import List, Dict, Tuple, Optional
from pathlib import Path
import pandas as pd
from models.api_models import StudentAnswer, StudentResult

def extract_roll_number_from_filename(filename: str) -> str:
    """Extract roll number from filename - uses the entire filename without extension"""
    return Path(filename).stem

def validate_image_file(filename: str) -> bool:
    """Check if file is a valid image format"""
    valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'}
    return Path(filename).suffix.lower() in valid_extensions

def validate_csv_file(filename: str) -> bool:
    """Check if file is a valid CSV format"""
    return Path(filename).suffix.lower() == '.csv'

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
        "percentage": round(percentage, 2)
    }

def create_summary_stats(results: List[StudentResult]) -> Dict:
    """Create summary statistics for the evaluation"""
    if not results:
        return {
            "total_students": 0,
            "average_score": 0,
            "highest_score": 0,
            "lowest_score": 0,
            "pass_rate": 0,
            "grade_distribution": {}
        }

    scores = [r.percentage for r in results]

    # Create grade distribution
    grade_distribution = {"A+": 0, "A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    for score in scores:
        if score >= 90:
            grade_distribution["A+"] += 1
        elif score >= 80:
            grade_distribution["A"] += 1
        elif score >= 70:
            grade_distribution["B"] += 1
        elif score >= 60:
            grade_distribution["C"] += 1
        elif score >= 50:
            grade_distribution["D"] += 1
        else:
            grade_distribution["F"] += 1

    return {
        "total_students": len(results),
        "average_score": round(sum(scores) / len(scores), 2),
        "highest_score": max(scores),
        "lowest_score": min(scores),
        "pass_rate": round(len([s for s in scores if s >= 50]) / len(scores) * 100, 1),
        "grade_distribution": grade_distribution
    }

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

def parse_csv_model_answers(csv_file_path: str) -> List[StudentAnswer]:
    """
    Parse CSV file containing model answers and convert to StudentAnswer objects

    Expected CSV format:
    sn,answer
    1,true
    2,false
    3,true
    ...

    Args:
        csv_file_path (str): Path to the CSV file

    Returns:
        List[StudentAnswer]: List of model answers

    Raises:
        ValueError: If CSV format is invalid
        FileNotFoundError: If CSV file doesn't exist
    """
    if not os.path.exists(csv_file_path):
        raise FileNotFoundError(f"CSV file not found: {csv_file_path}")

    try:
        model_answers = []

        with open(csv_file_path, 'r', newline='', encoding='utf-8') as csvfile:
            # Read CSV with proper handling
            csv_reader = csv.DictReader(csvfile)

            # Validate headers
            expected_headers = {'sn', 'answer'}
            actual_headers = set(csv_reader.fieldnames or [])

            if not expected_headers.issubset(actual_headers):
                missing_headers = expected_headers - actual_headers
                raise ValueError(f"Invalid CSV format. Missing required headers: {missing_headers}")

            # Track question numbers to validate sequence
            question_numbers = []

            for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 because of header
                try:
                    # Validate and parse sn (serial number)
                    sn_str = row['sn'].strip() if row['sn'] else ''
                    if not sn_str:
                        raise ValueError(f"Row {row_num}: 'sn' field is empty")

                    try:
                        sn = int(sn_str)
                    except ValueError:
                        raise ValueError(f"Row {row_num}: 'sn' must be a number, got '{sn_str}'")

                    if sn < 1 or sn > 50:  # Allow up to 50 questions
                        raise ValueError(f"Row {row_num}: 'sn' must be between 1 and 50, got {sn}")

                    question_numbers.append(sn)

                    # Validate and parse answer
                    answer = row['answer'].strip().lower() if row['answer'] else ''
                    if not answer:
                        raise ValueError(f"Row {row_num}: 'answer' field is empty")

                    # Validate answer format (must match InternVL expected values)
                    valid_answers = {'true', 'false', 't', 'f', 'na'}
                    if answer not in valid_answers:
                        raise ValueError(f"Row {row_num}: Invalid answer '{row['answer']}'. Must be one of: true, false, t, f, NA")

                    # Create StudentAnswer object
                    model_answers.append(StudentAnswer(sn=sn, answer=answer))

                except KeyError as e:
                    raise ValueError(f"Row {row_num}: Missing required field {e}")
                except Exception as e:
                    raise ValueError(f"Row {row_num}: {str(e)}")

            # Validate we have answers
            if not model_answers:
                raise ValueError("CSV file contains no valid answers")

            # Validate question sequence (must be 1, 2, 3, ... n)
            question_numbers.sort()
            expected_sequence = list(range(1, len(question_numbers) + 1))

            if question_numbers != expected_sequence:
                missing_numbers = set(expected_sequence) - set(question_numbers)
                duplicate_numbers = [num for num in question_numbers if question_numbers.count(num) > 1]

                error_msg = "Invalid question sequence."
                if missing_numbers:
                    error_msg += f" Missing question numbers: {sorted(missing_numbers)}"
                if duplicate_numbers:
                    error_msg += f" Duplicate question numbers: {sorted(set(duplicate_numbers))}"

                raise ValueError(error_msg)

            # Validate exactly 10 questions (matching InternVL constraint)
            if len(model_answers) != 10:
                raise ValueError(f"CSV must contain exactly 10 questions, found {len(model_answers)}")

            print(f"✅ Successfully parsed {len(model_answers)} model answers from CSV")
            return model_answers

    except csv.Error as e:
        raise ValueError(f"Invalid CSV file format: {str(e)}")
    except UnicodeDecodeError as e:
        raise ValueError(f"Unable to read CSV file. Please ensure it's saved as UTF-8: {str(e)}")
    except Exception as e:
        raise ValueError(f"Error parsing CSV file: {str(e)}")
