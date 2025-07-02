import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { FileUp, X, Check, Archive, Play, Image, Images, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { apiService } from '@/services/apiService';

const UploadFormDual = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'zip' | 'individual'>('zip');
  const [studentZipFile, setStudentZipFile] = useState<File | null>(null);
  const [studentFiles, setStudentFiles] = useState<File[]>([]);
  const [jobName, setJobName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<any>(null);
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

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

  const handleStudentFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setStudentFiles(Array.from(e.target.files));
    }
  };

  const removeStudentFile = (index: number) => {
    const updatedFiles = studentFiles.filter((_, i) => i !== index);
    setStudentFiles(updatedFiles);
  };

  const uploadFiles = async () => {
    if (!modelFile || !jobName.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please provide job name and model answer sheet",
        variant: "destructive"
      });
      return;
    }

    if (uploadMode === 'zip' && !studentZipFile) {
      toast({
        title: "Missing ZIP file",
        description: "Please provide student answer sheets ZIP file",
        variant: "destructive"
      });
      return;
    }

    if (uploadMode === 'individual' && studentFiles.length === 0) {
      toast({
        title: "Missing student files",
        description: "Please select individual student answer sheet images",
        variant: "destructive"
      });
      return;
    }

    setCurrentPhase('uploading');
    setUploading(true);
    setProgress(0);
    setStatusMessage('Preparing files for upload...');

    try {
      let result;

      // Enhanced upload progress simulation
      const progressSteps = [
        { progress: 10, message: 'Validating files...' },
        { progress: 25, message: 'Uploading model answer...' },
        { progress: 60, message: 'Uploading student sheets...' },
        { progress: 85, message: 'Processing upload...' },
        { progress: 95, message: 'Finalizing...' }
      ];

      let stepIndex = 0;
      const progressInterval = setInterval(() => {
        if (stepIndex < progressSteps.length) {
          const step = progressSteps[stepIndex];
          setProgress(step.progress);
          setStatusMessage(step.message);
          stepIndex++;
        } else {
          clearInterval(progressInterval);
        }
      }, 400);

      if (uploadMode === 'zip' && studentZipFile) {
        result = await apiService.uploadEvaluation(modelFile, studentZipFile, jobName);
      } else if (uploadMode === 'individual' && studentFiles.length > 0) {
        result = await apiService.uploadIndividualImages(modelFile, studentFiles, jobName);
      }

      clearInterval(progressInterval);
      setProgress(100);
      setStatusMessage('Upload completed successfully!');

      if (result) {
        setJobId(result.job_id);
        setCurrentPhase('processing');
        setStatusMessage('Starting evaluation process...');

        toast({
          title: "Upload successful",
          description: `${result.student_sheets_count} student sheets uploaded. Starting evaluation...`,
        });

        setUploading(false);
        setProcessing(true);
        pollProcessingStatus(result.job_id);
      }

    } catch (error) {
      console.error('Upload error:', error);
      setCurrentPhase('failed');
      setUploading(false);
      setProgress(0);
      setStatusMessage('Upload failed');

      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive"
      });
    }
  };

  const pollProcessingStatus = async (currentJobId?: string) => {
    const jobIdToUse = currentJobId || jobId;
    if (!jobIdToUse) return;

    try {
      const status = await apiService.getJobStatus(jobIdToUse);
      setProcessingStatus(status);

      // Update status message based on processing state
      if (status.status === 'pending') {
        setStatusMessage('Evaluation queued, waiting to start...');
      } else if (status.status === 'processing') {
        const progress = status.total_students > 0
          ? Math.round((status.processed_students / status.total_students) * 100)
          : 0;
        setStatusMessage(
          `Evaluating answer sheets... (${status.processed_students}/${status.total_students} completed)`
        );
      }

      if (status.status === 'completed') {
        setCurrentPhase('completed');
        setProcessing(false);
        setStatusMessage('🎉 Evaluation completed successfully!');

        toast({
          title: "Evaluation completed",
          description: "Your evaluation is complete! Redirecting to results...",
        });

        // Navigate to results page with job ID
        setTimeout(() => {
          navigate(`/results?job_id=${jobIdToUse}`);
        }, 2000);

      } else if (status.status === 'failed') {
        setCurrentPhase('failed');
        setProcessing(false);
        setStatusMessage('❌ Evaluation failed');

        toast({
          title: "Evaluation failed",
          description: status.error_message || "An error occurred during processing",
          variant: "destructive"
        });
      } else {
        // Continue polling for pending/processing states
        setTimeout(() => pollProcessingStatus(jobIdToUse), 3000);
      }
    } catch (error) {
      console.error('Status polling error:', error);
      setStatusMessage('Connection issue, retrying...');
      // Retry after 5 seconds on error
      setTimeout(() => pollProcessingStatus(jobIdToUse), 5000);
    }
  };

  const resetForm = () => {
    setModelFile(null);
    setStudentZipFile(null);
    setStudentFiles([]);
    setJobName('');
    setProgress(0);
    setJobId(null);
    setProcessingStatus(null);
    setUploading(false);
    setProcessing(false);
    setCurrentPhase('idle');
    setStatusMessage('');
  };

  // Effect to handle job ID from URL or continue polling if there's an active job
  useEffect(() => {
    if (jobId && processing) {
      pollProcessingStatus(jobId);
    }
  }, [jobId, processing]);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Answer Sheets</CardTitle>
        <CardDescription>
          Upload model answer sheet and student answer sheets for automated evaluation
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

        {/* Model Answer Upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Model Answer Sheet</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input
              type="file"
              id="model-file"
              accept=".jpg,.jpeg,.png,.bmp,.tiff,.tif"
              onChange={handleModelFileChange}
              className="hidden"
              disabled={uploading || processing}
            />
            <label htmlFor="model-file" className="cursor-pointer">
              {modelFile ? (
                <div className="flex items-center justify-center space-x-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span>{modelFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      setModelFile(null);
                    }}
                    disabled={uploading || processing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <FileUp className="h-8 w-8 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-600">Click to upload model answer sheet</p>
                  <p className="text-xs text-gray-400">Supports JPG, PNG, BMP, TIFF</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Upload Mode Selection */}
        <Tabs value={uploadMode} onValueChange={(value) => setUploadMode(value as 'zip' | 'individual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="zip" className="flex items-center space-x-2">
              <Archive className="h-4 w-4" />
              <span>ZIP File</span>
            </TabsTrigger>
            <TabsTrigger value="individual" className="flex items-center space-x-2">
              <Images className="h-4 w-4" />
              <span>Individual Images</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="zip" className="space-y-2">
            <label className="block text-sm font-medium">Student Answer Sheets (ZIP)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                id="student-zip-file"
                accept=".zip"
                onChange={handleStudentZipChange}
                className="hidden"
                disabled={uploading || processing}
              />
              <label htmlFor="student-zip-file" className="cursor-pointer">
                {studentZipFile ? (
                  <div className="flex items-center justify-center space-x-2 text-green-600">
                    <Check className="h-5 w-5" />
                    <span>{studentZipFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        setStudentZipFile(null);
                      }}
                      disabled={uploading || processing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Archive className="h-8 w-8 mx-auto text-gray-400" />
                    <p className="text-sm text-gray-600">Click to upload ZIP file containing student answer sheets</p>
                    <p className="text-xs text-gray-400">ZIP file should contain image files</p>
                  </div>
                )}
              </label>
            </div>
          </TabsContent>

          <TabsContent value="individual" className="space-y-2">
            <label className="block text-sm font-medium">Student Answer Sheets (Individual Images)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                id="student-files"
                multiple
                accept=".jpg,.jpeg,.png,.bmp,.tiff,.tif"
                onChange={handleStudentFilesChange}
                className="hidden"
                disabled={uploading || processing}
              />
              <label htmlFor="student-files" className="cursor-pointer">
                {studentFiles.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center space-x-2 text-green-600">
                      <Check className="h-5 w-5" />
                      <span>{studentFiles.length} files selected</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {studentFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                          <span className="truncate">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStudentFile(index)}
                            disabled={uploading || processing}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Images className="h-8 w-8 mx-auto text-gray-400" />
                    <p className="text-sm text-gray-600">Click to select multiple student answer sheet images</p>
                    <p className="text-xs text-gray-400">Supports JPG, PNG, BMP, TIFF</p>
                  </div>
                )}
              </label>
            </div>
          </TabsContent>
        </Tabs>

        {/* Enhanced Progress and Status Display */}
        {(uploading || processing || currentPhase === 'completed' || currentPhase === 'failed') && (
          <div className="space-y-4">
            {/* Phase indicator */}
            <div className="flex items-center justify-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                {currentPhase === 'uploading' && (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      Uploading
                    </Badge>
                  </>
                )}
                {currentPhase === 'processing' && (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                      Processing
                    </Badge>
                  </>
                )}
                {currentPhase === 'completed' && (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Completed
                    </Badge>
                  </>
                )}
                {currentPhase === 'failed' && (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <Badge variant="destructive">
                      Failed
                    </Badge>
                  </>
                )}
              </div>
            </div>

            {/* Status message */}
            {statusMessage && (
              <div className="text-center">
                <p className="text-sm text-gray-600">{statusMessage}</p>
              </div>
            )}

            {/* Upload progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Upload Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full h-2" />
              </div>
            )}

            {/* Processing progress */}
            {processing && processingStatus && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Evaluation Progress</span>
                  <span>
                    {processingStatus.processed_students}/{processingStatus.total_students} sheets
                  </span>
                </div>
                <Progress
                  value={processingStatus.total_students > 0
                    ? (processingStatus.processed_students / processingStatus.total_students) * 100
                    : 0
                  }
                  className="w-full h-2"
                />

                {/* Detailed processing info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-blue-900">Job ID:</span>
                      <p className="text-blue-700 font-mono text-xs truncate">{jobId}</p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">Status:</span>
                      <p className="text-blue-700 capitalize">{processingStatus.status}</p>
                    </div>
                  </div>

                  {processingStatus.status === 'processing' && (
                    <div className="mt-2 flex items-center space-x-2 text-blue-600">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs">
                        The AI model is analyzing each answer sheet. This may take a few minutes...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Completion actions */}
            {currentPhase === 'completed' && jobId && (
              <div className="flex justify-center space-x-3">
                <Button
                  onClick={() => navigate(`/results?job_id=${jobId}`)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  View Results
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Start New Evaluation
                </Button>
              </div>
            )}

            {/* Error state */}
            {currentPhase === 'failed' && (
              <div className="text-center space-y-2">
                <div className="text-red-600 text-sm">
                  {processingStatus?.error_message || 'An error occurred during processing'}
                </div>
                <Button variant="outline" onClick={resetForm}>
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={resetForm}
          disabled={uploading || processing}
        >
          {currentPhase === 'completed' || currentPhase === 'failed' ? 'Start New Evaluation' : 'Reset Form'}
        </Button>

        <Button
          onClick={uploadFiles}
          disabled={
            uploading ||
            processing ||
            !modelFile ||
            (!studentZipFile && studentFiles.length === 0) ||
            !jobName.trim() ||
            currentPhase === 'completed'
          }
          className={
            currentPhase === 'completed' ? 'bg-green-600 hover:bg-green-700' :
            currentPhase === 'processing' ? 'bg-orange-600 hover:bg-orange-700' : ''
          }
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : processing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Evaluating...
            </>
          ) : currentPhase === 'completed' ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Completed
            </>
          ) : (
            <>
              <FileUp className="mr-2 h-4 w-4" />
              Upload & Start Evaluation
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default UploadFormDual;
