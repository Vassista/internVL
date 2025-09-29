# AutoEval API Documentation

Automatic Evaluation of Handwritten Answer Sheets.

## Base URL
```
http://localhost:8000
```

## Authentication
No authentication required for local development.

---

## Endpoints

### Health Check

Check server status and model availability.

```http
GET /health
```

**Example Request:**
```bash
curl -X GET "http://localhost:8000/health"
```

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "gpu_available": true,
  "timestamp": "2025-01-10T10:30:00Z"
}
```

---

### Upload Evaluation

Submit evaluation job with model answer and student sheets.

```http
POST /upload/evaluation
```

**Parameters:**
- `model_answer` (file, required): Model answer sheet image
- `job_name` (string, required): Descriptive name for the evaluation
- `student_sheets` (file, optional): ZIP file containing student answer sheets
- `student_images` (files, optional): Individual student answer sheet images

**Method 1 - ZIP Upload:**
```bash
curl -X POST "http://localhost:8000/upload/evaluation" \
  -F "model_answer=@model_answer.jpg" \
  -F "student_sheets=@students.zip" \
  -F "job_name=Mathematics Final Exam 2024"
```

**Method 2 - Individual Files:**
```bash
curl -X POST "http://localhost:8000/upload/evaluation" \
  -F "model_answer=@model_answer.jpg" \
  -F "student_images=@student_001.jpg" \
  -F "student_images=@student_002.jpg" \
  -F "student_images=@student_003.jpg" \
  -F "job_name=Mathematics Final Exam 2024"
```

**Success Response (201):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Files uploaded successfully. Processing started.",
  "status": "pending",
  "model_answer_received": true,
  "student_sheets_count": 25
}
```

---

### Get Job Status

Retrieve current processing status of an evaluation job.

```http
GET /evaluation/{job_id}/status
```

**Path Parameters:**
- `job_id` (string, required): Unique identifier for the evaluation job

**Example Request:**
```bash
curl -X GET "http://localhost:8000/evaluation/550e8400-e29b-41d4-a716-446655440000/status"
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_name": "Mathematics Final Exam 2024",
  "status": "processing",
  "total_students": 25,
  "processed_students": 15,
  "created_at": "2025-01-10T10:30:00Z",
  "completed_at": null,
  "error_message": null
}
```

**Status Values:**
- `pending`: Job queued for processing
- `processing`: Currently processing student sheets
- `completed`: All processing finished successfully
- `partially_completed`: Some students processed with errors
- `failed`: Processing failed

---

### Get Evaluation Results

Retrieve detailed results for a completed evaluation job.

```http
GET /results/{job_id}
```

**Path Parameters:**
- `job_id` (string, required): Unique identifier for the evaluation job

**Example Request:**
```bash
curl -X GET "http://localhost:8000/results/550e8400-e29b-41d4-a716-446655440000"
```

**Success Response (200):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_name": "Mathematics Final Exam 2024",
  "status": "completed",
  "model_answers": [
    {"sn": 1, "answer": "true"},
    {"sn": 2, "answer": "false"},
    {"sn": 3, "answer": "true"}
  ],
  "student_results": [
    {
      "roll_number": "student_001",
      "answers": [
        {"sn": 1, "answer": "true"},
        {"sn": 2, "answer": "false"},
        {"sn": 3, "answer": "true"}
      ],
      "score": 3,
      "total_questions": 3,
      "percentage": 100.0,
      "status": "completed"
    }
  ],
  "summary": {
    "total_students": 25,
    "average_score": 85.2,
    "highest_score": 100.0,
    "lowest_score": 65.0,
    "pass_rate": 92.0
  },
  "created_at": "2025-01-10T10:30:00Z",
  "completed_at": "2025-01-10T10:35:00Z"
}
```

---

### List Evaluation Jobs

Retrieve paginated list of all evaluation jobs.

```http
GET /jobs
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `per_page` (integer, optional): Items per page (default: 10, max: 100)

**Example Request:**
```bash
curl -X GET "http://localhost:8000/jobs?page=1&per_page=10"
```

**Response:**
```json
{
  "jobs": [
    {
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "job_name": "Mathematics Final Exam 2024",
      "status": "completed",
      "total_students": 25,
      "processed_students": 25,
      "created_at": "2025-01-10T10:30:00Z",
      "completed_at": "2025-01-10T10:35:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "per_page": 10,
  "pages": 5
}
```

---

### Search Evaluation Jobs

Search for evaluation jobs by name or identifier.

```http
GET /jobs/search
```

**Query Parameters:**
- `query` (string, required): Search term
- `page` (integer, optional): Page number (default: 1)
- `per_page` (integer, optional): Items per page (default: 10)

**Example Request:**
```bash
curl -X GET "http://localhost:8000/jobs/search?query=mathematics&page=1&per_page=10"
```

**Response:**
```json
{
  "jobs": [
    {
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "job_name": "Mathematics Final Exam 2024",
      "status": "completed",
      "total_students": 25,
      "processed_students": 25,
      "created_at": "2025-01-10T10:30:00Z",
      "completed_at": "2025-01-10T10:35:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "per_page": 10,
  "pages": 1
}
```

---

### Get Job Suggestions

Retrieve recent job suggestions for autocomplete functionality.

```http
GET /jobs/suggestions
```

**Query Parameters:**
- `limit` (integer, optional): Maximum number of suggestions (default: 10)

**Example Request:**
```bash
curl -X GET "http://localhost:8000/jobs/suggestions?limit=5"
```

**Response:**
```json
{
  "suggestions": [
    {
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "job_name": "Mathematics Final Exam 2024",
      "status": "completed",
      "total_students": 25,
      "created_at": "2025-01-10T10:30:00Z"
    }
  ]
}
```

---

### Delete Evaluation Job

Remove an evaluation job and associated data.

```http
DELETE /jobs/{job_id}
```

**Path Parameters:**
- `job_id` (string, required): Unique identifier for the evaluation job

**Example Request:**
```bash
curl -X DELETE "http://localhost:8000/jobs/550e8400-e29b-41d4-a716-446655440000"
```

**Success Response (200):**
```json
{
  "message": "Job deleted successfully"
}
```

---

## Error Responses

### 400 Bad Request
Invalid request parameters or file format.

```json
{
  "detail": "Invalid file format. Supported formats: JPG, PNG, BMP, TIFF, WEBP"
}
```

### 404 Not Found
Requested resource not found.

```json
{
  "detail": "Job not found"
}
```

### 422 Unprocessable Entity
Validation error in request data.

```json
{
  "detail": [
    {
      "loc": ["body", "job_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 500 Internal Server Error
Server processing error.

```json
{
  "detail": "Internal server error. Please try again."
}
```

---

## File Requirements

### Model Answer Sheet
- **Formats**: JPG, PNG, BMP, TIFF, WEBP
- **Size Limit**: 10MB
- **Content**: Clear, readable answer sheet with True/False responses

### Student Answer Sheets
- **Individual Files**: Multiple image files (max 10MB each)
- **ZIP Archive**: Single ZIP file containing multiple images (max 100MB)
- **Naming**: Any descriptive filename (e.g., `student_001.jpg`, `john_doe.png`)

### Answer Format Support
- **True Values**: `True`, `T`, `true`, `TRUE`, `1`
- **False Values**: `False`, `F`, `false`, `FALSE`, `0`

---

## Usage Examples

### Complete Evaluation Workflow

1. **Upload Evaluation:**
```bash
curl -X POST "http://localhost:8000/upload/evaluation" \
  -F "model_answer=@model_answer.jpg" \
  -F "student_sheets=@students.zip" \
  -F "job_name=Physics Midterm 2024"
```

2. **Monitor Progress:**
```bash
# Extract job_id from upload response, then:
curl -X GET "http://localhost:8000/evaluation/{job_id}/status"
```

3. **Retrieve Results:**
```bash
curl -X GET "http://localhost:8000/results/{job_id}"
```

### Batch Processing with Shell Script

```bash
#!/bin/bash

# Upload evaluation
RESPONSE=$(curl -s -X POST "http://localhost:8000/upload/evaluation" \
  -F "model_answer=@model_answer.jpg" \
  -F "student_sheets=@students.zip" \
  -F "job_name=Automated Test")

# Extract job ID
JOB_ID=$(echo $RESPONSE | grep -o '"job_id":"[^"]*"' | cut -d'"' -f4)
echo "Job ID: $JOB_ID"

# Monitor until completion
while true; do
  STATUS=$(curl -s "http://localhost:8000/evaluation/$JOB_ID/status" | \
           grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  echo "Status: $STATUS"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi

  sleep 10
done

# Get results
curl -X GET "http://localhost:8000/results/$JOB_ID"
```

---

## Development Notes

### Local Development
```bash
# Start the API server
cd prod_codes
python main.py

# Server will be available at http://localhost:8000
# API documentation at http://localhost:8000/docs
```

### Testing Connectivity
```bash
# Test if API is responding
curl -f -s "http://localhost:8000/health" > /dev/null && echo "API is running" || echo "API is down"
```

### Performance Considerations
- GPU memory: -
- Processing time: ~2-4 seconds per student sheet
- Concurrent jobs: Single job processing (sequential)
- File storage: Temporary files cleaned after processing

---

## Support

For technical issues:
1. Check server logs for detailed error messages
2. Verify GPU availability with `nvidia-smi`
3. Ensure sufficient disk space for temporary files
4. Validate file formats and sizes before upload

**API Documentation Version**: 2.1.0
**Last Updated**: July 2025
