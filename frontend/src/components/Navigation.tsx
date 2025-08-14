import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Video, Upload, Home, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface NavigationProps {
  onUploadClick: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ onUploadClick }) => {
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuthStore();

  return (
    <nav className="bg-white shadow-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <Video className="h-8 w-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">VideoPlatform</span>
            </Link>
            
            <div className="hidden md:flex items-center space-x-6">
              <Link
                to="/"
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === '/'
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                }`}
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Link>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <button
                  onClick={onUploadClick}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Video
                </button>
                
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <User className="h-4 w-4" />
                    <span>{user?.username}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
