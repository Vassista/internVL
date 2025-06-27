import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { FileUp, X, Check, Archive, Play } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const UploadForm = () => {
  const { toast } = useToast();
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [studentZipFile, setStudentZipFile] = useState<File | null>(null);
  const [jobName, setJobName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<any>(null);

  const handleModelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setModelFile(e.target.files[0]);
    }
  };

  const handleStudentZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setStudentZipFile(e.target.files[0]);
    }
  };

  const uploadFiles = async () => {
    if (!modelFile || !studentZipFile || !jobName.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please provide job name, model answer sheet, and student answer sheets ZIP file",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('model_answer', modelFile);
      formData.append('student_sheets', studentZipFile);
      formData.append('job_name', jobName);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('http://localhost:8000/api/upload/evaluation', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result = await response.json();
      setJobId(result.job_id);

      toast({
        title: "Upload successful",
        description: `${result.total_students} student sheets uploaded. Job ID: ${result.job_id}`,
      });

      setUploading(false);

    } catch (error) {
      console.error('Upload error:', error);
      setUploading(false);
      setProgress(0);

      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive"
      });
    }
  };

  const startProcessing = async () => {
    if (!jobId) return;

    setProcessing(true);

    try {
      const response = await fetch(`http://localhost:8000/api/process/start/${jobId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start processing');
      }

      toast({
        title: "Processing started",
        description: "Your evaluation job is now being processed",
      });

      // Start polling for status updates
      pollProcessingStatus();

    } catch (error) {
      console.error('Processing error:', error);
      setProcessing(false);

      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Failed to start processing",
        variant: "destructive"
      });
    }
  };

  const pollProcessingStatus = async () => {
    if (!jobId) return;

    try {
      const response = await fetch(`http://localhost:8000/api/process/status/${jobId}`);

      if (response.ok) {
        const status = await response.json();
        setProcessingStatus(status);

        if (status.status === 'completed' || status.status === 'failed') {
          setProcessing(false);

          if (status.status === 'completed') {
            toast({
              title: "Processing completed",
              description: "Your evaluation is complete! Check the Results page.",
            });
          } else {
            toast({
              title: "Processing failed",
              description: status.error_message || "An error occurred during processing",
              variant: "destructive"
            });
          }
        } else {
          // Continue polling
          setTimeout(pollProcessingStatus, 3000);
        }
      }
    } catch (error) {
      console.error('Status polling error:', error);
      setTimeout(pollProcessingStatus, 5000); // Retry after 5 seconds
    }
  };

  const resetForm = () => {
    setModelFile(null);
    setStudentZipFile(null);
    setJobName('');
    setProgress(0);
    setJobId(null);
    setProcessingStatus(null);
    setUploading(false);
    setProcessing(false);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Answer Sheets</CardTitle>
        <CardDescription>
          Upload model answer sheet and ZIP file containing student answer sheets for evaluation
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Job Name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Evaluation Job Name</label>
          <Input
            type="text"
            placeholder="e.g., Midterm Exam - Section A"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            disabled={uploading || processing}
          />
        </div>

        {/* Model Answer Sheet Upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium mb-1">Model Answer Sheet</label>
          {modelFile ? (
            <div className="flex items-center justify-between p-3 border rounded-md bg-secondary/50">
              <div className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm">{modelFile.name}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModelFile(null)}
                disabled={uploading || processing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="border-dashed border-2 rounded-md p-6 text-center cursor-pointer hover:bg-secondary/50 transition-colors"
              onClick={() => document.getElementById('model-file')?.click()}>
              <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to upload model answer sheet</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG (max 10MB)</p>
            </div>
          )}
          <Input
            id="model-file"
            type="file"
            className="hidden"
            onChange={handleModelFileChange}
            accept=".pdf,.png,.jpg,.jpeg"
            disabled={uploading || processing}
          />
        </div>

        {/* Student Answer Sheets ZIP Upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium mb-1">Student Answer Sheets</label>
          <p className="text-xs text-muted-foreground mb-2">
            Upload a ZIP file containing student answer sheets. Filenames should include roll numbers (e.g., 1000001.jpg, student_1000002.png)
          </p>

          {studentZipFile ? (
            <div className="flex items-center justify-between p-3 border rounded-md bg-secondary/50">
              <div className="flex items-center space-x-2">
                <Archive className="h-4 w-4 text-blue-600" />
                <span className="text-sm">{studentZipFile.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(studentZipFile.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStudentZipFile(null)}
                disabled={uploading || processing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="border-dashed border-2 rounded-md p-6 text-center cursor-pointer hover:bg-secondary/50 transition-colors"
              onClick={() => document.getElementById('student-zip')?.click()}>
              <Archive className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to upload student answer sheets ZIP</p>
              <p className="text-xs text-muted-foreground mt-1">ZIP file (max 50MB)</p>
            </div>
          )}
          <Input
            id="student-zip"
            type="file"
            className="hidden"
            onChange={handleStudentZipChange}
            accept=".zip"
            disabled={uploading || processing}
          />
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Upload Progress</label>
            <Progress value={progress} />
            <p className="text-xs text-right text-muted-foreground">{progress}% complete</p>
          </div>
        )}

        {/* Processing Status */}
        {processingStatus && processing && (
          <div className="space-y-2 p-4 border rounded-md bg-blue-50">
            <h4 className="font-medium">Processing Status</h4>
            <p className="text-sm text-muted-foreground">
              Status: {processingStatus.status}
            </p>
            {processingStatus.progress && (
              <div className="space-y-1">
                <p className="text-sm">
                  Progress: {processingStatus.progress.completed + processingStatus.progress.failed} / {processingStatus.progress.total_students} students
                </p>
                {processingStatus.progress.current_student && (
                  <p className="text-sm">
                    Currently processing: {processingStatus.progress.current_student}
                  </p>
                )}
                {processingStatus.estimated_time_remaining && (
                  <p className="text-sm">
                    Estimated time remaining: {processingStatus.estimated_time_remaining}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Success Message */}
        {jobId && !uploading && !processing && (
          <div className="space-y-2 p-4 border rounded-md bg-green-50">
            <h4 className="font-medium text-green-800">Upload Complete</h4>
            <p className="text-sm text-green-700">
              Job ID: {jobId}
            </p>
            <p className="text-sm text-green-600">
              Files uploaded successfully. Ready to start processing.
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="space-x-2">
        {!jobId ? (
          <Button
            onClick={uploadFiles}
            disabled={uploading || processing || !modelFile || !studentZipFile || !jobName.trim()}
            className="ml-auto"
          >
            {uploading ? "Uploading..." : "Upload Files"}
          </Button>
        ) : !processing && processingStatus?.status !== 'completed' ? (
          <>
            <Button variant="outline" onClick={resetForm}>
              Upload New Files
            </Button>
            <Button onClick={startProcessing}>
              <Play className="h-4 w-4 mr-2" />
              Start Processing
            </Button>
          </>
        ) : processingStatus?.status === 'completed' ? (
          <Button variant="outline" onClick={resetForm} className="ml-auto">
            Process New Evaluation
          </Button>
        ) : (
          <Button disabled className="ml-auto">
            Processing...
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default UploadForm;
