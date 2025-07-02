import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { AlertCircle, Loader2, CheckCircle, Clock } from "lucide-react";
import { apiService, RecentEvaluation } from '@/services/apiService';

const RecentEvaluations = () => {
  const [evaluations, setEvaluations] = useState<RecentEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentEvaluations = async () => {
      try {
        setLoading(true);
        setError(null);
        const recentData = await apiService.getRecentEvaluations(5);
        setEvaluations(recentData);
      } catch (err) {
        console.error('Error fetching recent evaluations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recent evaluations');
      } finally {
        setLoading(false);
      }
    };

    fetchRecentEvaluations();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Recent Evaluations</CardTitle>
        <CardDescription>Recently processed student answer sheets</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading recent evaluations...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : evaluations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No recent evaluations found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((evaluation, index) => (
                  <TableRow key={`${evaluation.job_id}-${evaluation.roll_number}-${index}`}>
                    <TableCell className="font-medium">{evaluation.roll_number}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={evaluation.job_name}>
                        {evaluation.job_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {evaluation.status === 'completed' ? (
                        <span className="font-medium">
                          {evaluation.score}/{evaluation.total_questions} ({evaluation.percentage.toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(evaluation.status)}
                    </TableCell>
                    <TableCell>
                      {new Date(evaluation.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" size="sm" asChild>
                        <Link to={`/results?job_id=${evaluation.job_id}`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
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
