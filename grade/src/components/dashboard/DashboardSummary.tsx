import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, FileCheck, FileQuestion } from "lucide-react";

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
  // Mock data for demonstration
  const stats = [
    {
      title: "Total Evaluations",
      value: "256",
      description: "Total answer sheets evaluated",
      icon: FileCheck
    },
    {
      title: "Pending Evaluations",
      value: "12",
      description: "Answer sheets awaiting evaluation",
      icon: FileQuestion
    },
    {
      title: "Successful Evaluations",
      value: "200",
      description: "Evaluations completed successfully",
      icon: BarChart3
    },
    {
      title: "Failed Evaluations",
      value: "44",
      description: "Evaluations that failed to complete",
      icon: FileQuestion
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
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
