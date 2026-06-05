import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import './Hoy.css';

export default function Hoy({ currentPath, onNavigate }) {
  const [companies, setCompanies] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

  // Reporte Diario
  const [sendingReport, setSendingReport] = useState(false);
  const [modalMsg, setModalMsg] = useState(null); // { title, message, type }

  // 1. Cargar Empresas
  async function loadCompanies() {
    try {
      const res = await fetch("/api/companies.php");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch (err) {
      console.error("Error al cargar empresas:", err);
    }
  }

  // 2. Cargar Asistencias de Hoy
  async function loadHoy() {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily.php?search=${encodeURIComponent(search)}&company=${encodeURIComponent(selectedCompany)}`);
      if (res.ok) {
        const data = await res.json();
        setAttendances(data);
      }
    } catch (err) {
      console.error("Error al cargar asistencias de hoy:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompanies();
    loadHoy();
  }, []);

  // Buscar al presionar buscar
  const handleBuscar = (e) => {
    if (e) e.preventDefault();
    loadHoy();
  };

  // Buscar al presionar Enter en input
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      loadHoy();
    }
  };

  // Limpiar filtros
  const handleLimpiar = () => {
    setSearch('');
    setSelectedCompany('');
    // Forzar recarga con filtros vacíos
    setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/daily.php?search=&company=`);
        if (res.ok) {
          const data = await res.json();
          setAttendances(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  // Disparar reporte diario de retardos/faltas
  const handleEnviarReporte = async () => {
    setSendingReport(true);
    try {
      const res = await fetch("/api/cron_reports.php");
      const data = await res.json();

      if (data.status === "success") {
        if (data.email_sent) {
          setModalMsg({
            title: '¡Reporte Enviado!',
            message: `El reporte consolidado de incidencias (retardos/faltas) se ha enviado con éxito a la dirección: <br/><strong style="color: #273469;">${data.recipient}</strong><br/><br/>Total reportado: <strong>${data.total_incidencias} incidencias hoy.</strong>`,
            type: 'success'
          });
        } else {
          setModalMsg({
            title: 'Reporte Procesado',
            message: `El reporte diario se generó de manera exitosa, pero <strong>no se envió ningún correo</strong> debido a que hoy no se registraron incidencias (retardos o faltas) en el sistema.`,
            type: 'info'
          });
        }
      } else {
        setModalMsg({
          title: 'Error en Servidor',
          message: 'El servidor procesó la solicitud pero retornó un estado no exitoso. Por favor intente más tarde.',
          type: 'error'
        });
      }
    } catch (e) {
      console.error(e);
      setModalMsg({
        title: 'Error de Conexión',
        message: 'No fue posible conectarse con el servidor de reportes. Verifique su conexión de red.',
        type: 'error'
      });
    } finally {
      setSendingReport(false);
    }
  };

  // Formatear Hora
  const formatTime = (timeStr) => {
    if (!timeStr) return "-";
    try {
      return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "-";
    }
  };

  // Obtener etiqueta de empresa seleccionada
  const getSelectedCompanyLabel = () => {
    if (!selectedCompany) return "Todas";
    return selectedCompany;
  };

  return (
    <div className="hoy-page-wrapper">
      <Navbar currentPath={currentPath} onNavigate={onNavigate} />

      <main className="contenedor-principal">
        <div className="card-premium daily-card">
          <h1 className="titulo-principal">Asistencia Diaria</h1>

          <div className="filtros-seccion">
            <div className="filtros-grid">
              <div className="input-group">
                <label>Empresa:</label>
                <div className="custom-select-wrapper">
                  <div 
                    className={`custom-select-trigger ${isCompanyDropdownOpen ? 'active' : ''}`}
                    onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  >
                    <span>{getSelectedCompanyLabel()}</span>
                    <svg className="arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                  <div className={`custom-options ${isCompanyDropdownOpen ? 'active' : ''}`}>
                    <div 
                      className={`option ${selectedCompany === '' ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedCompany('');
                        setIsCompanyDropdownOpen(false);
                        // Cargar inmediatamente
                        setTimeout(() => loadHoy(), 0);
                      }}
                    >
                      Todas
                    </div>
                    {companies.map((c, idx) => (
                      <div 
                        key={idx}
                        className={`option ${selectedCompany === c.name ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedCompany(c.name);
                          setIsCompanyDropdownOpen(false);
                          // Cargar inmediatamente
                          setTimeout(() => loadHoy(), 0);
                        }}
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="input-group search-input-group">
                <label>Empleado:</label>
                <input
                  type="text"
                  placeholder="Nombre o ID"
                  className="input-premium"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>

              <div className="input-group button-group">
                <button onClick={handleBuscar} className="btn-premium primary btn-buscar-hoy">
                  Buscar
                </button>
                <button onClick={handleLimpiar} className="btn-premium outline btn-limpiar-hoy">
                  Limpiar Filtros
                </button>
              </div>
            </div>
          </div>

          <div className="tabla-container">
            <table>
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Ubicación E.</th>
                  <th>Ubicación S.</th>
                  <th>Estado</th>
                  <th>Puntualidad</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="sin-registros">Cargando registros...</td>
                  </tr>
                ) : attendances.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="sin-registros">No hay registros el día de hoy.</td>
                  </tr>
                ) : (
                  attendances.map((row, idx) => (
                    <tr key={idx}>
                      <td className="nombre">{row.full_name}</td>
                      <td>{formatTime(row.entrada)}</td>
                      <td>{formatTime(row.salida)}</td>
                      <td className="location-cell">{row.entrada_estacion || "-"}</td>
                      <td className="location-cell">{row.salida ? (row.salida_estacion || "-") : "-"}</td>
                      <td>
                        <span className={`badge-status ${row.salida ? 'completado' : 'pendiente'}`}>
                          {row.salida ? "Completado" : "En Turno"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-puntualidad ${(row.puntualidad || 'A Tiempo').toLowerCase().replace(' ', '-')}`}>
                          {row.puntualidad || 'A Tiempo'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="acciones-footer">
            <button
              onClick={loadHoy}
              className="btn-premium outline btn-footer-action"
            >
              Actualizar Todo
            </button>
            <button
              onClick={handleEnviarReporte}
              disabled={sendingReport}
              className="btn-premium primary btn-footer-action btn-send-report"
            >
              {sendingReport ? (
                <>
                  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Enviando Reporte...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  Enviar Reporte Diario
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* POPUP DE NOTIFICACION DE REPORTE */}
      {modalMsg && (
        <div className="modal active" onClick={() => setModalMsg(null)}>
          <div className="modal-content-report card-premium" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-icon-report ${modalMsg.type}`}>
              {modalMsg.type === 'success' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              )}
              {modalMsg.type === 'info' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              )}
              {modalMsg.type === 'error' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
              )}
            </div>
            <h3 className="modal-title-report">{modalMsg.title}</h3>
            <p className="modal-text-report" dangerouslySetInnerHTML={{ __html: modalMsg.message }}></p>
            <button 
              onClick={() => setModalMsg(null)} 
              className="btn-premium primary" 
              style={{ width: '100%', height: '48px', minWidth: 0, fontSize: '0.95rem' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
