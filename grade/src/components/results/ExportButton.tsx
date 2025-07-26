import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExportButtonProps {
  data: any[][];
  fileName: string;
  sheetName: string;
  buttonText: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({ data, fileName, sheetName, buttonText }) => {
  const handleExport = () => {
    // 1. Create a new workbook
    const wb = XLSX.utils.book_new();

    // 2. Create a worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);

    // 3. Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // 4. Trigger the download
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  return (
    <Button onClick={handleExport} variant="outline" size="sm">
      <Download className="h-4 w-4 mr-2" />
      {buttonText}
    </Button>
  );
};

export default ExportButton;
