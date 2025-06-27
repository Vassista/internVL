
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { FileUp, X, Check, Archive } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const UploadForm = () => {
  const { toast } = useToast();
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [studentZipFile, setStudentZipFile] = useState<File | null>(null);
  const [jobName, setJobName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleModelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setModelFile(e.target.files[0]);
    }
  };

  const handleStudentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setStudentFiles(prev => [...prev, ...filesArray]);
      setRollNumbers(prev => [...prev, ...Array(filesArray.length).fill('')]);
    }
  };

  const handleRollNumberChange = (index: number, value: string) => {
    const updatedRollNumbers = [...rollNumbers];
    updatedRollNumbers[index] = value;
    setRollNumbers(updatedRollNumbers);
  };

  const removeStudentFile = (index: number) => {
    const updatedFiles = [...studentFiles];
    updatedFiles.splice(index, 1);
    setStudentFiles(updatedFiles);

    const updatedRollNumbers = [...rollNumbers];
    updatedRollNumbers.splice(index, 1);
    setRollNumbers(updatedRollNumbers);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!modelFile) {
      toast({
        title: "Model answer sheet required",
        description: "Please upload a model answer sheet first",
        variant: "destructive"
      });
      return;
    }

    if (studentFiles.length === 0) {
      toast({
        title: "Student answer sheets required",
        description: "Please upload at least one student answer sheet",
        variant: "destructive"
      });
      return;
    }

    const missingRollNumbers = rollNumbers.some(roll => roll.trim() === '');
    if (missingRollNumbers) {
      toast({
        title: "Roll numbers required",
        description: "Please enter roll numbers for all student answer sheets",
        variant: "destructive"
      });
      return;
    }

    // Mock upload process
    setUploading(true);

    const mockUploadProcess = () => {
      let progressValue = 0;
      const interval = setInterval(() => {
        progressValue += 5;
        setProgress(progressValue);

        if (progressValue >= 100) {
          clearInterval(interval);
          setUploading(false);
          toast({
            title: "Upload successful",
            description: `${studentFiles.length} student sheets submitted for evaluation`,
          });
          // Reset form after successful upload
          setModelFile(null);
          setStudentFiles([]);
          setRollNumbers([]);
          setProgress(0);
        }
      }, 200);
    };

    mockUploadProcess();
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Answer Sheets</CardTitle>
        <CardDescription>Upload model answer sheet and student answer sheets for evaluation</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
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
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-dashed border-2 rounded-md p-6 text-center cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => document.getElementById('model-file')?.click()}>
                <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG (max 10MB)</p>
              </div>
            )}
            <Input
              id="model-file"
              type="file"
              className="hidden"
              onChange={handleModelFileChange}
              accept=".pdf,.png,.jpg,.jpeg"
              disabled={uploading}
            />
          </div>

          {/* Student Answer Sheets Upload */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium">Student Answer Sheets</label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => document.getElementById('student-files')?.click()}
                disabled={uploading}
              >
                <FileUp className="h-4 w-4 mr-2" />
                Add Files
              </Button>
              <Input
                id="student-files"
                type="file"
                className="hidden"
                onChange={handleStudentFileChange}
                accept=".pdf,.png,.jpg,.jpeg"
                multiple
                disabled={uploading}
              />
            </div>

            {studentFiles.length === 0 && (
              <p className="text-sm text-center text-muted-foreground py-4">No student files uploaded yet</p>
            )}

            {studentFiles.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                {studentFiles.map((file, index) => (
                  <div key={index} className="flex items-center space-x-2 p-3 border rounded-md bg-secondary/50">
                    <div className="flex-1 truncate">{file.name}</div>
                    <div className="w-36">
                      <Input
                        placeholder="Roll Number"
                        value={rollNumbers[index]}
                        onChange={(e) => handleRollNumberChange(index, e.target.value)}
                        className="w-full text-sm"
                        disabled={uploading}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStudentFile(index)}
                      disabled={uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Upload Progress</label>
              <Progress value={progress} />
              <p className="text-xs text-right text-muted-foreground">{progress}% complete</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="ml-auto" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload and Evaluate"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default UploadForm;
