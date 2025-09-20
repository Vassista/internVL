# AutoEval API Documentation

## Overview
Automatic Evaluation of Handwritten True/False Answer Sheets.

## Files Structure
```
prod_codes/
├── api_server.py           # Main FastAPI server
├── api_models.py          # Pydantic data models
├── api_utils.py           # Utility functions
├── autoeval_ocr.py        # InternVL OCR processing (existing)
├── internvl.py            # InternVL core functions (existing)
├── internvl_prompt.txt    # OCR prompt (existing)
├── test_api.py            # API testing script
├── requirements.txt       # Dependencies
└── README.md             # This file
```

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the API Server
```bash
python api_server.py
```

The server will start at: `http://127.0.0.1:8000`

### 3. View API Documentation
Open your browser and go to: `http://127.0.0.1:8000/docs`

### 4. Test the API
```bash
python test_api.py
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server and model status.

### Upload Evaluation (Supports Both Upload Methods)
```
POST /upload/evaluation
```

**Parameters:**
- `model_answer` (file): Model answer sheet image
- `job_name` (string): Name/description for this evaluation job
- **Option 1 - ZIP Upload:**
  - `student_sheets` (file): ZIP file containing student answer sheet images
- **Option 2 - Individual Upload:**
  - `student_images` (files): Multiple individual student answer sheet images

**Upload Methods:**

1. **ZIP File Method** (Original):
   - Upload a single ZIP file containing all student answer sheets
   - Suitable for large batches
   - Maintains original file organization

2. **Individual Images Method** (New):
   - Upload multiple individual image files
   - More flexible for smaller batches
   - Direct file selection without creating ZIP

**Example using curl (ZIP method):**
```bash
curl -X POST "http://localhost:8000/upload/evaluation" \
  -F "model_answer=@model_answer.jpg" \
  -F "student_sheets=@students.zip" \
  -F "job_name=Midterm Exam"
```

**Example using curl (Individual method):**
```bash
curl -X POST "http://localhost:8000/upload/evaluation" \
  -F "model_answer=@model_answer.jpg" \
  -F "student_images=@student_001.jpg" \
  -F "student_images=@student_002.jpg" \
  -F "student_images=@student_003.jpg" \
  -F "job_name=Midterm Exam"
```
```json
{
  "status": "healthy",
  "model_loaded": true,
  "gpu_available": true,
  "timestamp": "2025-06-24T10:30:00"
}
```

### Upload Evaluation
```
POST /upload/evaluation
```
Upload model answer and student answer sheets for evaluation.

**Parameters:**
- `model_answer`: Image file (JPG, PNG, etc.)
- `student_sheets`: ZIP file containing student answer sheets
- `job_name`: Name for this evaluation job

**Response:**
```json
{
  "job_id": "uuid-string",
  "message": "Files uploaded successfully. Processing started.",
  "status": "pending",
  "model_answer_received": true,
  "student_sheets_count": 25
}
```

### Check Job Status
```
GET /evaluation/{job_id}/status
```
Get the processing status of an evaluation job.

**Response:**
```json
{
  "job_id": "uuid-string",
  "status": "processing",
  "total_students": 25,
  "processed_students": 15,
  "created_at": "2025-06-24T10:30:00",
  "completed_at": null,
  "error_message": null
}
```

**Status Values:**
- `pending`: Job queued for processing
- `processing`: Currently processing student sheets
- `completed`: All processing finished successfully
- `failed`: Processing failed with error

### Get Results
```
GET /results/{job_id}
```
Get the evaluation results (only available when status is "completed").

**Response:**
```json
{
  "job_id": "uuid-string",
  "job_name": "Midterm Exam",
  "status": "completed",
  "model_answers": [
    {"sn": 1, "answer": "true"},
    {"sn": 2, "answer": "false"},
    ...
  ],
  "student_results": [
    {
      "roll_number": "001",
      "answers": [
        {"sn": 1, "answer": "true"},
        {"sn": 2, "answer": "false"},
        ...
      ],
      "score": 18,
      "total_questions": 20,
      "percentage": 90.0,
      "status": "completed"
    },
    ...
  ],
  "summary": {
    "total_students": 25,
    "average_score": 82.5,
    "highest_score": 95.0,
    "lowest_score": 65.0,
    "pass_rate": 88.0,
    "grade_distribution": {
      "A+": 5,
      "A": 8,
      "B": 7,
      "C": 3,
      "D": 2,
      "F": 0
    }
  },
  "created_at": "2025-06-24T10:30:00",
  "completed_at": "2025-06-24T10:35:00"
}
```

### Delete Job
```
DELETE /jobs/{job_id}
```
Delete a job and clean up associated files.

## Usage Flow

1. **Upload Files** → POST to `/upload/evaluation` with model answer image and ZIP of student sheets
2. **Monitor Progress** → GET `/evaluation/{job_id}/status` to check processing status
3. **Get Results** → GET `/results/{job_id}` when status is "completed"
4. **Cleanup** → DELETE `/jobs/{job_id}` to remove job data

## File Requirements

### Model Answer Sheet
- Image format: JPG, PNG, BMP, TIFF
- Must be clearly readable answer sheet with True/False answers
- Should have 10 questions numbered 1-10

### Student Answer Sheets ZIP
- ZIP file containing multiple image files
- Each image should be named with student identifier (e.g., `student_001.jpg`, `roll_12345.png`)
- Same format requirements as model answer sheet

## Answer Processing

The system:
1. Uses InternVL to extract text from images
2. Parses True/False answers from structured format
3. Normalizes answers (T/True/1 → "true", F/False/0 → "false")
4. Compares student answers with model answers
5. Calculates scores and generates statistics

## Error Handling

The API provides detailed error messages for:
- Invalid file formats
- Processing failures
- Model loading issues
- File size limits
- Missing jobs

## Deployment Notes

### For Server 35 (IIT Jodhpur)

1. **GPU Requirements**: Ensure CUDA-compatible GPU available
2. **Model Loading**: InternVL model requires significant GPU memory
3. **File Storage**: Temporary files are created during processing
4. **Dependencies**: All packages in requirements.txt must be installed

### Configuration
- Default port: 8000
- Upload directory: `temp_uploads/`
- Max file size: 100MB
- CORS: Currently allows all origins (configure for production)

## Monitoring

- Check `/health` endpoint for system status
- Monitor GPU memory usage during processing
- Check server logs for detailed processing information

## Testing

Use the included `test_api.py` script to verify all functionality works correctly with your data.

## Support

For issues or questions about the API implementation, check:
1. Server logs for detailed error messages
2. GPU memory availability
3. File format compliance
4. Network connectivity
