import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Vineyards from './pages/Vineyards';
import Layout from './components/Layout';
import Fermentation from './pages/Fermentation';
import Harvests from './pages/Harvests';
import VineyardDetail from './pages/VineyardDetail';
import FermentationDetail from './pages/FermentationDetail';
import HarvestDetail from './pages/HarvestDetail';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="vineyards" element={<Vineyards />} />
            <Route path="vineyards/:id" element={<VineyardDetail />} />
            <Route path="harvests" element={<Harvests />} />
            <Route path="harvests/:id" element={<HarvestDetail />} />
            <Route path="fermentation" element={<Fermentation />} />
            <Route path="fermentation/:id" element={<FermentationDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;