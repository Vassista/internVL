import React from 'react';
import LoginForm from '@/components/auth/LoginForm';

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30">
      <div className="text-center mb-8">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-primary">Test</h1>
          <p className="text-muted-foreground mt-2">Automated Answer Sheet Evaluation</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
};

export default Login;
