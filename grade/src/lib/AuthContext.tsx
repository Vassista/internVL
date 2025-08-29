import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';

type User = {
  email: string;
  name: string;
  picture?: string;
  role: string;
};

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Google JWT decoder
const decodeGoogleJWT = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('authToken');

    if (storedUser && storedToken) {
      try {
        const userData = JSON.parse(storedUser);
        // Validate that the user data has the expected structure
        if (userData && typeof userData === 'object' && userData.email) {
          setUser(userData);
          setIsAuthenticated(true);
          apiService.setAuthToken(storedToken);
        } else {
          // Clear invalid user data
          console.warn('Invalid user data found in localStorage, clearing...');
          localStorage.removeItem('user');
          localStorage.removeItem('authToken');
        }
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
      }
    }
    setIsLoading(false);
  }, []);

  const loginWithGoogle = async (credential: string) => {
    try {
      // Call the backend login endpoint
      const response = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const loginResponse = await response.json();
      const userData: User = {
        email: loginResponse.user.email,
        name: loginResponse.user.name,
        picture: loginResponse.user.picture,
        role: loginResponse.user.role
      };

      // Store user data and token
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('authToken', credential);

      // Set authentication token in API service
      apiService.setAuthToken(credential);

      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error during Google login:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    apiService.setAuthToken(null);
    setUser(null);
    setIsAuthenticated(false);
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
