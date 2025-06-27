import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const RecentEvaluations = () => {
  // Mock data for demonstration
  const recentEvaluations = Array(3).fill(null).map((_, i) => ({
    id: i + 1,
    roll: Math.floor(1000000 + Math.random() * 9000000),
    score: (Math.random() * 10).toFixed(1),
    totalQuestions: 10,
    status: Math.random() > 0.1 ? 'COMPLETED' : 'PENDING',
    date: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }));

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Recent Evaluations</CardTitle>
        <CardDescription>Recently processed answer sheets</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
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
              {recentEvaluations.map((evaluation) => (
                <TableRow key={evaluation.id}>
                  <TableCell>{evaluation.roll}</TableCell>
                  <TableCell>
                    {evaluation.status === 'COMPLETED' ? (
                      <span className="font-medium">{evaluation.score}/{evaluation.totalQuestions}</span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      evaluation.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {evaluation.status}
                    </span>
                  </TableCell>
                  <TableCell>{evaluation.date}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" size="sm">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <Link to="/results">View all evaluations</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentEvaluations;
