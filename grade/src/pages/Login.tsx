import React from 'react';
import GoogleSignIn from '@/components/auth/GoogleSignIn';

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30">
      <div className="text-center mb-8">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-primary">AutoEval</h1>
          <p className="text-muted-foreground mt-2">Automatic Evaluation of Handwritten True/False Answer Sheets</p>
        </div>
        <GoogleSignIn />
      </div>
    </div>
  );
};

export default Login;
