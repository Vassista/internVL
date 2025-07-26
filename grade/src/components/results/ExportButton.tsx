import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentResult } from '@/services/apiService';

interface ExportButtonProps {
  results: StudentResult[];
  jobName: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({ results, jobName }) => {
  const handleExport = () => {
    // 1. Create a new workbook
    const wb = XLSX.utils.book_new();

    // 2. Create a worksheet
    const wsData = [
      ["Roll Number", "Score", "Total Questions", "Percentage", "Status"],
      ...results.map(result => [
        result.roll_number,
        result.score,
        result.total_questions,
        result.percentage,
        result.status
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 3. Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, "Student Results");

    // 4. Generate a file name
    const fileName = `student-results-${jobName.replace(/\s+/g, '-')}.xlsx`;

    // 5. Trigger the download
    XLSX.writeFile(wb, fileName);
  };

  return (
    <Button onClick={handleExport} variant="outline" size="sm">
      <Download className="h-4 w-4 mr-2" />
      Export to Excel
    </Button>
  );
};

export default ExportButton;
