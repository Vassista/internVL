import React, { useState } from 'react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StudentResult } from '@/services/apiService';
import ExportButton from './ExportButton';

interface ResultsTableProps {
  results: StudentResult[];
  modelAnswers: { [key: string]: string };
}

const ResultsTable: React.FC<ResultsTableProps> = ({ results, modelAnswers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  // Sanitize roll number to create safe filenames
  const sanitizeFileName = (name: string) => {
    return name.replace(/\s+/g, '-').replace(/[\\/:*?"<>|]+/g, '');
  };

  // Filter results based on search term
  const filteredResults = results.filter(result =>
    result.roll_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGradeBadge = (percentage: number) => {
    if (percentage >= 90) return <Badge className="bg-green-500">A+</Badge>;
    if (percentage >= 80) return <Badge className="bg-green-400">A</Badge>;
    if (percentage >= 70) return <Badge className="bg-blue-500">B</Badge>;
    if (percentage >= 60) return <Badge className="bg-yellow-500">C</Badge>;
    if (percentage >= 50) return <Badge className="bg-orange-500">D</Badge>;
    return <Badge variant="destructive">F</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by roll number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Results Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll Number</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Percentage</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResults.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No results found for your search.' : 'No results available.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredResults.map((result, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{result.roll_number}</TableCell>
                  <TableCell>
                    {result.score}/{result.total_questions}
                  </TableCell>
                  <TableCell>{result.percentage.toFixed(1)}%</TableCell>
                  <TableCell>{getGradeBadge(result.percentage)}</TableCell>
                  <TableCell>{getStatusBadge(result.status)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedStudent(result)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {filteredResults.length > 0 && (
            <TableCaption>
              Showing {filteredResults.length} of {results.length} students
            </TableCaption>
          )}
        </Table>
      </div>

      {/* Student Detail Modal */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Student Details - {selectedStudent?.roll_number}</DialogTitle>
            <DialogDescription>
              Detailed answer breakdown for this student
            </DialogDescription>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-4">
              <div className="flex justify-end">
                  <ExportButton
                    data={[
                      ["Question", "Student Answer", "Model Answer"],
                      ...selectedStudent.answers.map(answer => [
                        answer.sn,
                        answer.answer,
                        modelAnswers[String(answer.sn)] || "N/A"
                      ])
                    ]}
                    fileName={sanitizeFileName(selectedStudent.roll_number)}
                    sheetName="Student Answers"
                    buttonText="Export Answers"
                  />
              </div>
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm text-gray-500">Score</div>
                  <div className="font-bold text-lg">
                    {selectedStudent.score}/{selectedStudent.total_questions}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Percentage</div>
                  <div className="font-bold text-lg">{selectedStudent.percentage.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Grade</div>
                  <div className="font-bold text-lg">{getGradeBadge(selectedStudent.percentage)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="font-bold text-lg">{getStatusBadge(selectedStudent.status)}</div>
                </div>
              </div>

              {/* Answer Details */}
              <div>
                <h4 className="font-semibold mb-3">Answer Breakdown</h4>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                  {selectedStudent.answers.map((answer) => (
                    <div key={answer.sn} className="flex items-center justify-between p-2 border rounded">
                      <span className="font-medium">Question {answer.sn}</span>
                      <Badge variant={answer.answer.toLowerCase() === 'na' ? 'destructive' : 'outline'}>
                        {answer.answer.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResultsTable;
