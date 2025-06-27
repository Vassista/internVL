
import React from 'react';
import DashboardSummary from '@/components/dashboard/DashboardSummary';
import RecentEvaluations from '@/components/dashboard/RecentEvaluations';

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>
      <div className="space-y-6">
        <DashboardSummary />
        <RecentEvaluations />
      </div>
    </div>
  );
};

export default Dashboard;
