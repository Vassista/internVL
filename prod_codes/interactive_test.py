#!/usr/bin/env python3
"""
Interactive API Test Script for InternVL API Server

This script allows you to test the API server by providing file paths interactively.
It supports both ZIP file uploads and individual image uploads without revealing the structure.
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

# API Configuration
DEFAULT_BASE_URL = "http://localhost:8000"
POLL_INTERVAL = 2  # seconds
MAX_WAIT_TIME = 300  # seconds (5 minutes)

class APITester:
    def __init__(self, base_url: str = DEFAULT_BASE_URL):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()

    def check_health(self) -> bool:
        """Check if the API server is running and healthy"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            response.raise_for_status()
            health_data = response.json()
            print(f"✅ API Server is healthy")
            print(f"   Model loaded: {health_data.get('model_loaded', False)}")
            print(f"   GPU available: {health_data.get('gpu_available', False)}")
            return health_data.get('model_loaded', False)
        except requests.exceptions.RequestException as e:
            print(f"❌ API Server is not accessible: {e}")
            return False

    def upload_evaluation(self, model_answer_path: str, student_files_path: str, job_name: str) -> Optional[str]:
        """
        Upload files for evaluation. Automatically detects if student_files_path is a ZIP or directory.
        Returns job_id if successful, None otherwise.
        """
        model_path = Path(model_answer_path)
        student_path = Path(student_files_path)

        if not model_path.exists():
            print(f"❌ Model answer file not found: {model_answer_path}")
            return None

        if not student_path.exists():
            print(f"❌ Student files path not found: {student_files_path}")
            return None

        try:
            # Check if student_files_path is a ZIP file or directory with images
            if student_path.is_file() and student_path.suffix.lower() == '.zip':
                # ZIP file upload
                print(f"📦 Uploading ZIP file: {student_path.name}")
                with open(model_path, 'rb') as model_file, open(student_path, 'rb') as zip_file:
                    files = [
                        ('model_answer', (model_path.name, model_file, 'image/jpeg')),
                        ('student_sheets', (student_path.name, zip_file, 'application/zip'))
                    ]
                    data = {'job_name': job_name}
                    response = self.session.post(
                        f"{self.base_url}/upload/evaluation",
                        files=files,
                        data=data
                    )
            elif student_path.is_dir():
                # Individual images upload
                print(f"📁 Uploading individual images from directory: {student_path.name}")
                image_files = []
                image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'}

                for img_path in student_path.iterdir():
                    if img_path.is_file() and img_path.suffix.lower() in image_extensions:
                        image_files.append(img_path)

                if not image_files:
                    print(f"❌ No image files found in directory: {student_path}")
                    return None

                print(f"   Found {len(image_files)} image files")

                # Open all files with context managers
                try:
                    file_handles = [open(model_path, 'rb')]
                    file_handles.extend([open(img_path, 'rb') for img_path in image_files])
                except IOError as e:
                    print(f"❌ Failed to open files: {e}")
                    return None

                try:
                    files = [('model_answer', (model_path.name, file_handles[0], 'image/jpeg'))]
                    for i, img_path in enumerate(image_files, 1):
                        files.append(('student_images', (img_path.name, file_handles[i], 'image/jpeg')))

                    data = {'job_name': job_name}
                    response = self.session.post(
                        f"{self.base_url}/upload/individual",
                        files=files,
                        data=data
                    )
                finally:
                    # Close all file handles
                    for fh in file_handles:
                        fh.close()
            else:
                print(f"❌ Student files path must be either a ZIP file or a directory with images")
                return None

            response.raise_for_status()
            result = response.json()

            job_id = result.get('job_id')
            print(f"✅ Upload successful! Job ID: {job_id}")
            print(f"   Job Name: {result.get('job_name')}")
            print(f"   Status: {result.get('status')}")

            return job_id

        except requests.exceptions.RequestException as e:
            print(f"❌ Upload failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_detail = e.response.json()
                    print(f"   Error details: {error_detail}")
                except:
                    print(f"   Response text: {e.response.text}")
            return None

    def check_job_status(self, job_id: str) -> Dict:
        """Check the status of a job"""
        try:
            response = self.session.get(f"{self.base_url}/evaluation/{job_id}/status")
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to check job status: {e}")
            return {}

    def get_results(self, job_id: str) -> Optional[Dict]:
        """Get the results of a completed job"""
        try:
            response = self.session.get(f"{self.base_url}/results/{job_id}")
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to get results: {e}")
            return None

    def wait_for_completion(self, job_id: str) -> bool:
        """Wait for job to complete and monitor progress"""
        print(f"⏳ Waiting for job {job_id} to complete...")
        start_time = time.time()

        while time.time() - start_time < MAX_WAIT_TIME:
            status = self.check_job_status(job_id)
            current_status = status.get('status', 'unknown')

            # Show progress if available
            if 'total_students' in status and 'processed_students' in status:
                total = status['total_students']
                processed = status['processed_students']
                print(f"   Status: {current_status} ({processed}/{total} students processed)")
            else:
                print(f"   Status: {current_status}")

            if current_status == 'completed':
                print(f"✅ Job completed successfully!")
                return True
            elif current_status == 'failed':
                error_msg = status.get('error_message', 'Unknown error')
                print(f"❌ Job failed: {error_msg}")
                return False

            time.sleep(POLL_INTERVAL)

        print(f"⏰ Job did not complete within {MAX_WAIT_TIME} seconds")
        return False

def get_user_input():
    """Get file paths and job name from user"""
    print("\n" + "="*60)
    print("🧪 InternVL API Test Script")
    print("="*60)

    # Show available test files if they exist
    test_dir = Path("test_imgs")
    if test_dir.exists():
        print(f"\n📁 Available test files in {test_dir}:")
        for item in test_dir.iterdir():
            if item.is_file():
                print(f"   {item.name}")

    # Get API server URL
    base_url = input(f"\nEnter API server URL (default: {DEFAULT_BASE_URL}): ").strip()
    if not base_url:
        base_url = DEFAULT_BASE_URL

    # Get model answer path
    while True:
        model_answer = input("\nEnter path to model answer image: ").strip()
        if model_answer and Path(model_answer).exists():
            break
        print("❌ File not found. Please enter a valid path.")

    # Get student files path
    while True:
        student_files = input("\nEnter path to student files (ZIP file or directory with images): ").strip()
        if student_files and Path(student_files).exists():
            break
        print("❌ Path not found. Please enter a valid path.")

    # Get job name
    job_name = input("\nEnter job name (optional): ").strip()
    if not job_name:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        job_name = f"Test_Job_{timestamp}"

    return base_url, model_answer, student_files, job_name

def save_results(results: Dict, job_name: str):
    """Save results to a JSON file"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"test_results_{job_name}_{timestamp}.json"

    # Clean filename
    filename = "".join(c for c in filename if c.isalnum() or c in "._-")

    try:
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"💾 Results saved to: {filename}")
    except Exception as e:
        print(f"❌ Failed to save results: {e}")

def print_summary(results: Dict):
    """Print a summary of the results"""
    if not results:
        return

    print("\n" + "="*60)
    print("📊 EVALUATION SUMMARY")
    print("="*60)

    # Basic job info
    job_id = results.get('job_id', 'Unknown')
    job_name = results.get('job_name', 'Unknown')
    status = results.get('status', 'Unknown')

    print(f"Job ID: {job_id}")
    print(f"Job Name: {job_name}")
    print(f"Status: {status}")

    # Student results summary
    student_results = results.get('student_results', [])
    if student_results:
        print(f"\n📝 Student Results ({len(student_results)} students):")
        for i, student in enumerate(student_results, 1):
            roll_number = student.get('roll_number', f'Student_{i}')
            score = student.get('score', 0)
            total = student.get('total_questions', 0)
            percentage = student.get('percentage', 0)
            print(f"   {roll_number}: {score}/{total} ({percentage:.1f}%)")

    # Summary statistics
    summary = results.get('summary', {})
    if summary:
        print(f"\n📈 Statistics:")
        print(f"   Total Students: {summary.get('total_students', 0)}")
        print(f"   Average Score: {summary.get('average_score', 0):.1f}%")
        print(f"   Highest Score: {summary.get('highest_score', 0):.1f}%")
        print(f"   Lowest Score: {summary.get('lowest_score', 0):.1f}%")
        print(f"   Pass Rate: {summary.get('pass_rate', 0):.1f}%")

def main():
    try:
        # Get user input
        base_url, model_answer, student_files, job_name = get_user_input()

        # Initialize API tester
        tester = APITester(base_url)

        # Check API health
        print(f"\n🔍 Checking API server health...")
        if not tester.check_health():
            print("❌ API server is not ready. Please ensure it's running and the model is loaded.")
            return

        # Upload files for evaluation
        print(f"\n📤 Uploading files...")
        print(f"   Model Answer: {Path(model_answer).name}")
        print(f"   Student Files: {Path(student_files).name}")
        print(f"   Job Name: {job_name}")

        job_id = tester.upload_evaluation(model_answer, student_files, job_name)
        if not job_id:
            return

        # Wait for completion
        if not tester.wait_for_completion(job_id):
            return

        # Get and display results
        print(f"\n📋 Retrieving results...")
        results = tester.get_results(job_id)
        if results:
            print_summary(results)
            save_results(results, job_name)

        print(f"\n✅ Test completed successfully!")

    except KeyboardInterrupt:
        print(f"\n\n⏹️ Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")

if __name__ == "__main__":
    main()
