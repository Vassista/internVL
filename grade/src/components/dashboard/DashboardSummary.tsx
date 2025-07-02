import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, FileCheck, FileQuestion, Users, AlertCircle, Loader2 } from "lucide-react";
import { apiService, DashboardStats } from '@/services/apiService';

const StatsCard = ({ title, value, description, icon: Icon }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

const DashboardSummary = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const dashboardData = await apiService.getDashboardStats();
        setStats(dashboardData);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="col-span-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const statsCards = [
    {
      title: "Total Evaluations",
      value: stats.total_evaluations.toString(),
      description: "All evaluation jobs created",
      icon: FileCheck
    },
    {
      title: "Pending Evaluations",
      value: stats.pending_evaluations.toString(),
      description: "Jobs currently processing",
      icon: Loader2
    },
    {
      title: "Completed Evaluations",
      value: stats.completed_evaluations.toString(),
      description: "Successfully completed jobs",
      icon: BarChart3
    },
    {
      title: "Total Students",
      value: stats.total_students_processed.toString(),
      description: `Avg score: ${stats.average_score.toFixed(1)}%`,
      icon: Users
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statsCards.map((stat) => (
        <StatsCard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          description={stat.description}
          icon={stat.icon}
        />
      ))}
    </div>
  );
};

export default DashboardSummary;
