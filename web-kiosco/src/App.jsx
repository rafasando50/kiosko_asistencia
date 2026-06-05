import React, { useState, useEffect } from 'react';
import Scanner from './components/Scanner';
import Dashboard from './components/Dashboard';
import Empleados from './components/Empleados';
import Hoy from './components/Hoy';
import Reportes from './components/Reportes';
import './App.css';

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.pathname + window.location.search;
  });

  // Escuchar cambios en el historial (atrás/adelante)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const path = currentPath.split('?')[0];

  // Ruteo basado en estado (SPA) sin inicio de sesión forzado
  switch (path) {
    case '/admin/dashboard':
      return <Dashboard currentPath={currentPath} onNavigate={handleNavigate} />;
    case '/admin/empleados':
      return <Empleados currentPath={currentPath} onNavigate={handleNavigate} />;
    case '/admin/hoy':
      return <Hoy currentPath={currentPath} onNavigate={handleNavigate} />;
    case '/admin/reportes':
      return <Reportes currentPath={currentPath} onNavigate={handleNavigate} />;
    case '/':
    case '/admin/scanner':
      return <Scanner onNavigate={handleNavigate} />;
    default:
      return <Scanner onNavigate={handleNavigate} />;
  }
}
