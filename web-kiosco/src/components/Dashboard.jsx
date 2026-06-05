import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import './Dashboard.css';

export default function Dashboard({ currentPath, onNavigate }) {
  const [stats, setStats] = useState({
    today_count: 0,
    week_delays: 0,
    recent: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/daily.php?mode=dashboard");
        if (res.ok) {
          const data = await res.json();
          setStats({
            today_count: data.today_count || 0,
            week_delays: data.week_delays || 0,
            recent: data.recent || []
          });
        }
      } catch (err) {
        console.error("Error loading dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const modules = [
    {
      title: "Escáner",
      description: "Registrar entradas y salidas en tiempo real",
      icon: "camera",
      link: "/",
      color: "#4A90E2",
    },
    {
      title: "Hoy",
      description: "Ver quién está trabajando en este momento",
      icon: "calendar",
      link: "/admin/hoy",
      color: "#273469",
    },
    {
      title: "Reportes",
      description: "Historial completo y exportación a Excel",
      icon: "file-text",
      link: "/admin/reportes",
      color: "#64748b",
    },
    {
      title: "Personal",
      description: "Administrar empleados, altas y bajas",
      icon: "users",
      link: "/admin/empleados",
      color: "#1e293b",
    },
  ];

  return (
    <div className="dashboard-page-wrapper">
      <Navbar currentPath={currentPath} onNavigate={onNavigate} />
      <div className="dashboard-bg-decor">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <main className="dashboard-container">
        <div className="welcome-header">
          <h1 className="gradient-text">Panel de Control</h1>
        </div>

        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat-card card-premium">
            <div className="stat-icon" style={{ background: '#4A90E2', color: 'white' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.today_count}</span>
              <span className="stat-label">Entradas Hoy</span>
            </div>
          </div>
          
          <button 
            onClick={() => onNavigate('/admin/reportes?filtro=retardos')} 
            className="stat-card card-premium clickable-stat-card"
          >
            <div className="stat-icon" style={{ background: '#F59E0B', color: 'white' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.week_delays}</span>
              <span className="stat-label">Retardos (Semana)</span>
            </div>
          </button>
        </div>

        <div className="modules-grid">
          {modules.map((module, i) => (
            <button
              key={i}
              onClick={() => onNavigate(module.link)}
              className="module-card card-premium"
            >
              <div
                className="icon-box"
                style={{ background: `${module.color}15`, color: module.color }}
              >
                {module.icon === "camera" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
                {module.icon === "calendar" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                )}
                {module.icon === "file-text" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                )}
                {module.icon === "users" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                )}
              </div>
              <div className="module-info">
                <h2>{module.title}</h2>
                <p>{module.description}</p>
              </div>
              <div className="arrow-indicator">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Recent Activity */}
        <aside className="recent-activity-aside card-premium">
          <div className="section-header">
            <h3>Actividad Reciente</h3>
            <button 
              onClick={() => onNavigate('/admin/hoy')} 
              className="view-all-btn"
            >
              Ver todos
            </button>
          </div>
          <div className="recent-list">
            {loading ? (
              <div className="loading-state">Cargando actividad...</div>
            ) : stats.recent.length === 0 ? (
              <div className="empty-state">No hay actividad hoy</div>
            ) : (
              stats.recent.map((r, idx) => {
                const statusClass = (r.puntualidad || 'a-tiempo').toLowerCase().replace(/\s+/g, '-');
                return (
                  <div key={idx} className="recent-item-new">
                    <div className={`status-circle ${statusClass}`}></div>
                    <div className="recent-info-new">
                      <span className="recent-name-new">{r.full_name}</span>
                      <span className="recent-time-new">
                        {r.entrada ? new Date(r.entrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
