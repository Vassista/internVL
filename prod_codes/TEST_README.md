# API Test Script

This interactive test script allows you to test your InternVL API server without revealing file structure details.

## Features

- ✅ Interactive prompts for file paths
- ✅ Automatic detection of ZIP files vs individual images
- ✅ Real-time job status monitoring
- ✅ Comprehensive results display
- ✅ Results saved to JSON file
- ✅ Health check before testing
- ✅ Error handling and validation

## Usage

1. **Start your API server first:**
   ```bash
   cd prod_codes
   python api_server.py
   ```

2. **Run the test script:**
   ```bash
   python interactive_test.py
   ```

3. **Follow the prompts:**
   - Enter API server URL (or press Enter for default `http://localhost:8000`)
   - Enter path to model answer image file
   - Enter path to student files (can be a ZIP file or directory with images)
   - Enter job name (optional)

## What the script does:

1. **Health Check**: Verifies the API server is running and model is loaded
2. **Smart Upload**: Automatically detects if you're providing:
   - A ZIP file → Uses `/upload/evaluation` endpoint
   - A directory with images → Uses `/upload/individual` endpoint
3. **Progress Monitoring**: Shows real-time job status updates
4. **Results Display**: Shows comprehensive summary including:
   - Individual student scores
   - Statistics (average, highest, lowest scores)
   - Grade distribution
   - Pass rate
5. **Save Results**: Automatically saves results to a timestamped JSON file

## Example Output:

```
🧪 InternVL API Test Script
============================================================

Enter API server URL (default: http://localhost:8000):
Enter path to model answer image: /path/to/model.jpg
Enter path to student files: /path/to/students.zip
Enter job name (optional): My Test

🔍 Checking API server health...
✅ API Server is healthy
   Model loaded: True
   GPU available: True

📤 Uploading files...
   Model Answer: model.jpg
   Student Files: students.zip
   Job Name: My Test

📦 Uploading ZIP file: students.zip
✅ Upload successful! Job ID: abc123-def456

⏳ Waiting for job abc123-def456 to complete...
   Status: processing
   Status: completed
✅ Job completed successfully!

📋 Retrieving results...

📊 EVALUATION SUMMARY
============================================================
Job ID: abc123-def456
Job Name: My Test
Status: completed

📝 Student Results (4 students):
   Student1: 8/10 (80.0%)
   Student2: 6/10 (60.0%)
   Student3: 9/10 (90.0%)
   Student4: 7/10 (70.0%)

📈 Statistics:
   Total Students: 4
   Average Score: 75.0%
   Highest Score: 90.0%
   Lowest Score: 60.0%
   Pass Rate: 100.0%
   Grade Distribution: {'A': 1, 'B': 2, 'C': 1, 'D': 0, 'F': 0}

💾 Results saved to: test_results_My_Test_20250627_223045.json
✅ Test completed successfully!
```

## Requirements

Install the required dependency:
```bash
pip install -r test_requirements.txt
```

## Notes

- The script doesn't modify any InternVL code or other core components
- It only interacts with your API endpoints
- Supports both ZIP file uploads and individual image uploads
- Automatically saves results for later analysis
- Handles errors gracefully with informative messages
