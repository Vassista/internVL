import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/components/ui/use-toast";

// Google Identity Services types
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GoogleSignIn = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [isConfigured, setIsConfigured] = React.useState(true);

  useEffect(() => {
    const initializeGoogle = () => {
      if (window.google && googleButtonRef.current) {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        if (!clientId || clientId === 'your_google_client_id_here') {
          console.error('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file');
          setIsConfigured(false);
          return;
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: false,
        });

        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          width: 300,
          text: "signin_with",
        });
      }
    };

    // Check if Google Identity Services is already loaded
    if (window.google) {
      initializeGoogle();
    } else {
      // Wait for the script to load
      const checkGoogle = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogle);
          initializeGoogle();
        }
      }, 100);

      // Clean up interval after 10 seconds
      setTimeout(() => clearInterval(checkGoogle), 10000);
    }
  }, []);

  const handleCredentialResponse = async (response: any) => {
    try {
      await loginWithGoogle(response.credential);
      toast({
        title: "Login successful",
  description: "Welcome to AutoEval!",
        duration: 2000,
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      toast({
        title: "Login failed",
        description: "Please try again",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  if (!isConfigured) {
    return (
      <Card className="w-[400px] mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Configuration Required</CardTitle>
          <CardDescription>
            Google Sign-In is not configured. Please set up your Google Client ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              To set up Google Sign-In:
            </p>
            <ol className="list-decimal list-inside text-sm text-yellow-800 mt-2 space-y-1">
              <li>Go to Google Cloud Console</li>
              <li>Create OAuth 2.0 credentials</li>
              <li>Add your domain to authorized origins</li>
              <li>Set VITE_GOOGLE_CLIENT_ID in your .env file</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  }  return (
    <Card className="w-[400px] mx-auto">
      <CardHeader className="text-center">
  <CardTitle className="text-2xl">Welcome to AutoEval</CardTitle>
        <CardDescription>
          Sign in with your Google account to access your evaluation dashboard
        </CardDescription>
      </CardHeader>
            <CardContent className="flex flex-col items-center space-y-6">
        <div ref={googleButtonRef} className="w-full flex justify-center" />

        <div className="text-center text-sm text-gray-500">
          <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleSignIn;
