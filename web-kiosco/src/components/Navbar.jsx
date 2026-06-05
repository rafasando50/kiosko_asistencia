import React from 'react';
import './Navbar.css';

export default function Navbar({ currentPath, onNavigate }) {
  return (
    <nav className="kiosco-navbar">
      <div className="navbar-left">
        <img src="/einsur.png" alt="EINSUR GLOBAL Logo" className="navbar-logo" />
      </div>
      <div className="navbar-center">
        Bienvenido al control de asistencia de Einsur Global
      </div>
      <div className="navbar-right">
        <button className="nav-btn btn-dashboard" onClick={() => onNavigate('/admin/dashboard')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span>Dashboard</span>
        </button>
        <button className="nav-btn btn-salir" onClick={() => onNavigate('/')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Salir</span>
        </button>
      </div>
    </nav>
  );
}
