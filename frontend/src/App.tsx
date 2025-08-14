import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { Navigation } from './components/Navigation';
import VideoList from './components/VideoList';
import SmartVideoUpload from './components/SmartVideoUpload';
import VideoDetail from './components/VideoDetail';
import Login from './components/Login';
import Signup from './components/Signup';
import ProtectedRoute from './components/ProtectedRoute';
import { useState } from 'react';
import { useAuthStore } from './stores/authStore';

function App() {
  const [showUpload, setShowUpload] = useState(false);
  const { isAuthenticated, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation onUploadClick={() => setShowUpload(true)} />
        
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<VideoList />} />
            <Route path="/category/:category" element={<VideoList />} />
            <Route path="/search" element={<VideoList />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route 
              path="/upload" 
              element={
                <ProtectedRoute>
                  <SmartVideoUpload onUploadSuccess={() => setShowUpload(false)} />
                </ProtectedRoute>
              } 
            />
            <Route path="/video/:id" element={<VideoDetail />} />
          </Routes>
        </main>

        {showUpload && isAuthenticated && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <SmartVideoUpload
              onUploadSuccess={() => setShowUpload(false)}
              onCancel={() => setShowUpload(false)}
            />
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;
