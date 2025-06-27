import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { FileUp, X, Check, Archive, Play, Image, Images } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const UploadFormDual = () => {
  const { toast } = useToast();
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

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('model_answer', modelFile);
      formData.append('job_name', jobName);

      if (uploadMode === 'zip' && studentZipFile) {
        formData.append('student_sheets', studentZipFile);
      } else if (uploadMode === 'individual') {
        studentFiles.forEach((file) => {
          formData.append('student_images', file);
        });
      }

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

      const response = await fetch('http://localhost:8000/upload/evaluation', {
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
        description: `${result.student_sheets_count} student sheets uploaded. Job ID: ${result.job_id}`,
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

  const pollProcessingStatus = async () => {
    if (!jobId) return;

    try {
      const response = await fetch(`http://localhost:8000/evaluation/${jobId}/status`);

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
    setStudentFiles([]);
    setJobName('');
    setProgress(0);
    setJobId(null);
    setProcessingStatus(null);
    setUploading(false);
    setProcessing(false);
  };

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

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading files...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* Processing Status */}
        {processingStatus && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900">Processing Status</h4>
            <p className="text-sm text-blue-700 mt-1">
              Status: {processingStatus.status} |
              Processed: {processingStatus.processed_students}/{processingStatus.total_students}
            </p>
            {processing && (
              <div className="mt-2">
                <Progress
                  value={(processingStatus.processed_students / processingStatus.total_students) * 100}
                  className="w-full"
                />
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
          Reset Form
        </Button>

        <Button
          onClick={uploadFiles}
          disabled={uploading || processing || !modelFile || (!studentZipFile && studentFiles.length === 0) || !jobName.trim()}
        >
          {uploading ? (
            <>
              <FileUp className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
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
