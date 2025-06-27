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

interface ResultsTableProps {
  results: StudentResult[];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ results }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);

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
      {"sn": 1, "answer": "true"},
      {"sn": 2, "answer": "false"},
      {"sn": 3, "answer": "false"},
      {"sn": 4, "answer": "true"},
      {"sn": 5, "answer": "true"},
      {"sn": 6, "answer": "false"},
      {"sn": 7, "answer": "true"},
      {"sn": 8, "answer": "TRUE"},
      {"sn": 9, "answer": "TRUE"},
      {"sn": 10, "answer": "true"}
    ]
  },
  {
    id: 2,
    roll: 1000002,
    score: "7.0",
    totalQuestions: 10,
    evaluationStatus: 'PENDING',
    uploadedAt: '2025-05-06',
    questionAnswers: []
  },
  {
    id: 3,
    roll: 1000003,
    score: "6.5",
    totalQuestions: 10,
    evaluationStatus: 'FAILED',
    uploadedAt: '2025-05-07',
    questionAnswers: []
  }
];

const ResultsTable = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedResult, setSelectedResult] = useState<(typeof mockResults)[0] | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredResults = mockResults.filter(result =>
    result.roll.toString().includes(searchTerm) ||
    result.score.toString().includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredResults.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleViewResult = (result: (typeof mockResults)[0]) => {
    setSelectedResult(result);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by roll number or score..."
            className="pl-8 max-w-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableCaption>List of evaluated answer sheets</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Roll Number</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No results found
                </TableCell>
              </TableRow>
            ) : (
              currentItems.map((result) => (
                <TableRow key={result.id}>
                  <TableCell>{result.roll}</TableCell>
                  <TableCell>
                    {result.evaluationStatus === 'COMPLETED' ? (
                      <span className="font-medium">{result.score}/{result.totalQuestions}</span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      result.evaluationStatus === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : result.evaluationStatus === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {result.evaluationStatus}
                    </span>
                  </TableCell>
                  <TableCell>{result.uploadedAt}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handleViewResult(result)}
                      disabled={result.evaluationStatus !== 'COMPLETED'}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filteredResults.length > itemsPerPage && (
        <div className="flex justify-center mt-4">
          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i + 1}
                variant={currentPage === i + 1 ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Question-Answer Detail Dialog - Completely redesigned for mobile */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md mx-auto p-0 overflow-hidden backdrop-blur-lg bg-white/95 dark:bg-gray-900/95 rounded-lg">
          <DialogHeader className="p-4 border-b bg-muted/30">
            <DialogTitle className="text-xl">Student Response</DialogTitle>
            <DialogDescription className="mt-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="text-sm font-medium">
                  Roll Number: <span className="text-foreground">{selectedResult?.roll}</span>
                </div>
                {selectedResult?.evaluationStatus === 'COMPLETED' && (
                  <div className="px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full text-sm font-medium inline-flex items-center">
                    Score: {selectedResult && selectedResult.score}/{selectedResult?.totalQuestions}
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto pb-4">
            <div className="divide-y">
              {selectedResult?.questionAnswers && selectedResult.questionAnswers.length > 0 ? (
                <>
                  <div className="flex items-center justify-between py-3 px-4 font-medium bg-muted/30 border-t border-b">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                      <span className="text-sm">S.no</span>
                    </div>
                    <div className="flex-1 px-4">
                      <div className="text-foreground">Q.No</div>
                    </div>
                    <div className="min-w-[80px] text-center">
                      <span>Response</span>
                    </div>
                  </div>
                  {selectedResult.questionAnswers.map((qa) => (
                    <div
                      key={qa.sn}
                      className="flex items-center justify-between py-4 px-4 hover:bg-muted/10"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-muted bg-background">
                        <span className="font-semibold text-sm">{qa.sn}</span>
                      </div>
                      <div className="flex-1 px-4">
                        <div className="font-medium text-foreground">Question {qa.sn}</div>
                      </div>
                      <div>
                        <span className={`inline-flex h-8 min-w-[80px] items-center justify-center px-3 rounded-full text-sm font-medium ${
                          qa.answer.toLowerCase() === 'true'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        }`}>
                          {qa.answer}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No question data available
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResultsTable;
