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
                  <TableHead>Job ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((evaluation, index) => (
                  <TableRow key={`${evaluation.id}-${index}`}>
                    <TableCell className="font-medium">
                      <div className="max-w-[200px] truncate" title={evaluation.id}>
                        {evaluation.id.substring(0, 8)}...
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(evaluation.status)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {evaluation.processed_files}/{evaluation.total_files} files
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(evaluation.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {evaluation.completed_at ? (
                        <span className="text-sm text-muted-foreground">
                          {new Date(evaluation.completed_at).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" size="sm" asChild>
                        <Link to={`/results?job_id=${evaluation.id}`}>
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
