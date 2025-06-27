import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileImage, FileArchive, Loader2, CheckCircle } from 'lucide-react';
import { apiService } from '@/services/apiService';

const UploadFormAPI: React.FC = () => {
  const navigate = useNavigate();
  const modelAnswerInputRef = useRef<HTMLInputElement>(null);
  const studentSheetsInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    jobName: '',
    modelAnswer: null as File | null,
    studentSheets: null as File | null,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (field: 'modelAnswer' | 'studentSheets', file: File | null) => {
    setFormData(prev => ({ ...prev, [field]: file }));
    setError(null);
  };

  const validateFiles = () => {
    if (!formData.jobName.trim()) {
      throw new Error('Please enter a job name');
    }

    if (!formData.modelAnswer) {
      throw new Error('Please select a model answer image');
    }

    if (!formData.studentSheets) {
      throw new Error('Please select a student sheets ZIP file');
    }

    // Validate model answer file type
    const modelAnswerExt = formData.modelAnswer.name.toLowerCase().split('.').pop();
    const validImageExts = ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif'];
    if (!validImageExts.includes(modelAnswerExt || '')) {
      throw new Error('Model answer must be an image file (JPG, PNG, BMP, TIFF)');
    }

    // Validate student sheets file type
    if (!formData.studentSheets.name.toLowerCase().endsWith('.zip')) {
      throw new Error('Student sheets must be a ZIP file');
    }

    // Check file sizes (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (formData.modelAnswer.size > maxSize) {
      throw new Error('Model answer file is too large (max 100MB)');
    }
    if (formData.studentSheets.size > maxSize) {
      throw new Error('Student sheets ZIP file is too large (max 100MB)');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsUploading(true);

    try {
      validateFiles();

      const result = await apiService.uploadEvaluation(
        formData.modelAnswer!,
        formData.studentSheets!,
        formData.jobName
      );

      setSuccess(true);

      // Navigate to results page with job ID after short delay
      setTimeout(() => {
        navigate(`/results?job_id=${result.job_id}`);
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (success) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Successful!</h3>
            <p className="text-gray-600 mb-4">
              Your files have been uploaded and processing has started.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to results page...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Answer Sheets for Grading
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Job Name */}
          <div className="space-y-2">
            <Label htmlFor="jobName">Job Name *</Label>
            <Input
              id="jobName"
              type="text"
              placeholder="e.g., Midterm Exam - Computer Science"
              value={formData.jobName}
              onChange={(e) => setFormData(prev => ({ ...prev, jobName: e.target.value }))}
              required
            />
          </div>

          {/* Model Answer Upload */}
          <div className="space-y-2">
            <Label htmlFor="modelAnswer">Model Answer Sheet *</Label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
              onClick={() => modelAnswerInputRef.current?.click()}
            >
              <FileImage className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <div className="text-sm text-gray-600 mb-2">
                Upload the correct answer sheet image
              </div>
              <Input
                ref={modelAnswerInputRef}
                id="modelAnswer"
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange('modelAnswer', e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="mb-2"
                onClick={(e) => {
                  e.stopPropagation();
                  modelAnswerInputRef.current?.click();
                }}
              >
                Choose Image File
              </Button>
              {formData.modelAnswer && (
                <div className="text-sm text-gray-700 mt-2">
                  <strong>Selected:</strong> {formData.modelAnswer.name}
                  <span className="text-gray-500"> ({formatFileSize(formData.modelAnswer.size)})</span>
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                Supported: JPG, PNG, BMP, TIFF (max 100MB)
              </div>
            </div>
          </div>

          {/* Student Sheets Upload */}
          <div className="space-y-2">
            <Label htmlFor="studentSheets">Student Answer Sheets *</Label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
              onClick={() => studentSheetsInputRef.current?.click()}
            >
              <FileArchive className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <div className="text-sm text-gray-600 mb-2">
                Upload ZIP file containing all student answer sheets
              </div>
              <Input
                ref={studentSheetsInputRef}
                id="studentSheets"
                type="file"
                accept=".zip"
                onChange={(e) => handleFileChange('studentSheets', e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="mb-2"
                onClick={(e) => {
                  e.stopPropagation();
                  studentSheetsInputRef.current?.click();
                }}
              >
                Choose ZIP File
              </Button>
              {formData.studentSheets && (
                <div className="text-sm text-gray-700 mt-2">
                  <strong>Selected:</strong> {formData.studentSheets.name}
                  <span className="text-gray-500"> ({formatFileSize(formData.studentSheets.size)})</span>
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                ZIP file only (max 100MB)
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading and Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Start Grading
              </>
            )}
          </Button>
        </form>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Instructions:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>1. Enter a descriptive name for this grading job</li>
            <li>2. Upload the model answer sheet (correct answers)</li>
            <li>3. Upload a ZIP file containing all student answer sheets</li>
            <li>4. Student files should be named with identifiers (e.g., student_001.jpg)</li>
            <li>5. All answer sheets should have the same format (True/False questions)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default UploadFormAPI;
