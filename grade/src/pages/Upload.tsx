import React from 'react';
import UploadFormDual from '@/components/upload/UploadFormDual';

const Upload: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Answer Sheets</h1>
        <p className="text-gray-600">
          Upload your model answer sheet and student answer sheets for automated grading.
          Choose between ZIP file upload or individual image selection.
        </p>
      </div>
      <UploadFormDual />
    </div>
  );
};

export default Upload;
