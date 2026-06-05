import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import './Reportes.css';

export default function Reportes({ currentPath, onNavigate }) {
  // Parse query parameters
  const queryParams = new URLSearchParams(currentPath.split('?')[1] || '');
  const initialFiltro = queryParams.get('filtro') === 'retardos' ? 'Retardo' : '';

  const getFirstDayOfMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const d = new Date(firstDay.getTime() - firstDay.getTimezoneOffset() * 60000);
    return d.toISOString().split("T")[0];
  };

  const getTodayDate = () => {
    const now = new Date();
    const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return d.toISOString().split("T")[0];
  };

  const [companies, setCompanies] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedPunctuality, setSelectedPunctuality] = useState(initialFiltro);

  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [isPunctualityDropdownOpen, setIsPunctualityDropdownOpen] = useState(false);

  // Cargar empresas
  useEffect(() => {
    async function loadCompanies() {
      try {
        const res = await fetch("/api/companies.php");
        if (res.ok) {
          const data = await res.json();
          setCompanies(data);
        }
      } catch (err) {
        console.error("Error loading companies:", err);
      }
    }
    loadCompanies();
  }, []);

  // Cargar asistencias
  async function loadReports() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports.php?start=${startDate}&end=${endDate}&search=${encodeURIComponent(search)}&company=${encodeURIComponent(selectedCompany)}`);
      if (res.ok) {
        let data = await res.json();
        if (selectedPunctuality) {
          data = data.filter(r => r.puntualidad === selectedPunctuality);
        }
        setAttendances(data);
      }
    } catch (err) {
      console.error("Error loading reports:", err);
    } finally {
      setLoading(false);
    }
  }

  // Recargar reportes al cambiar filtros de selección
  useEffect(() => {
    loadReports();
  }, [selectedCompany, selectedPunctuality]);

  const handleBuscar = (e) => {
    if (e) e.preventDefault();
    loadReports();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      loadReports();
    }
  };

  const handleLimpiar = () => {
    setStartDate(getFirstDayOfMonth());
    setEndDate(getTodayDate());
    setSearch('');
    setSelectedCompany('');
    setSelectedPunctuality('');
    // Forzar la navegación limpia (quitando la query del retardo)
    onNavigate('/admin/reportes');
  };

  // Exportar con ExcelJS
  const handleExportar = async () => {
    if (attendances.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

    if (window.ExcelJS) {
      try {
        const workbook = new window.ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte de Asistencia');

        // Configurar columnas
        worksheet.columns = [
          { header: 'Empleado', key: 'empleado', width: 35 },
          { header: 'ID', key: 'id', width: 15 },
          { header: 'Entrada', key: 'entrada', width: 22 },
          { header: 'Salida', key: 'salida', width: 22 },
          { header: 'Ubicación Entrada', key: 'ubi_entrada', width: 25 },
          { header: 'Ubicación Salida', key: 'ubi_salida', width: 25 },
          { header: 'Puntualidad', key: 'puntualidad', width: 20 }
        ];

        // Estilo cabecera
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF273469' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 30;

        // Agregar filas
        attendances.forEach((r) => {
          const isCompletado = !!r.salida;
          const row = worksheet.addRow({
            empleado: r.full_name,
            id: r.employee_id,
            entrada: r.entrada ? new Date(r.entrada).toLocaleString() : "-",
            salida: isCompletado ? new Date(r.salida).toLocaleString() : "En Turno",
            ubi_entrada: r.entrada_estacion || "Remoto",
            ubi_salida: isCompletado ? (r.salida_estacion || "Remoto") : "-",
            puntualidad: r.puntualidad
          });

          row.alignment = { vertical: 'middle', horizontal: 'center' };
          row.getCell('empleado').alignment = { vertical: 'middle', horizontal: 'left' };

          const celdaPuntualidad = row.getCell('puntualidad');
          celdaPuntualidad.font = { bold: true };
          if (r.puntualidad === 'A Tiempo') celdaPuntualidad.font.color = { argb: 'FF059669' };
          else if (r.puntualidad === 'Retardo') celdaPuntualidad.font.color = { argb: 'FFD97706' };
          else if (r.puntualidad === 'Falta') celdaPuntualidad.font.color = { argb: 'FFDC2626' };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Asistencia_${startDate}_al_${endDate}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Error al exportar con ExcelJS:", err);
      }
    } else {
      alert("La librería de exportación ExcelJS no está lista.");
    }
  };

  return (
    <div className="reportes-page-wrapper">
      <Navbar currentPath={currentPath} onNavigate={onNavigate} />

      <main className="contenedor-principal">
        <div className="card-premium reports-card">
          <h1 className="titulo-principal">Reportes</h1>

          <div className="filtros-seccion">
            <div className="form-grid">
              <div className="input-group">
                <label>Desde:</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  onKeyDown={handleKeyDown}
                  className="input-premium" 
                />
              </div>
              <div className="input-group">
                <label>Hasta:</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  onKeyDown={handleKeyDown}
                  className="input-premium" 
                />
              </div>
              
              <div className="input-group">
                <label>Empresa:</label>
                <div className="custom-select-wrapper">
                  <div 
                    className={`custom-select-trigger ${isCompanyDropdownOpen ? 'active' : ''}`}
                    onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  >
                    <span>{selectedCompany || 'Todas'}</span>
                    <svg className="arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                  <div className={`custom-options ${isCompanyDropdownOpen ? 'active' : ''}`}>
                    <div 
                      className={`option ${selectedCompany === '' ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedCompany('');
                        setIsCompanyDropdownOpen(false);
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
                        }}
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label>Empleado:</label>
                <input
                  type="text"
                  placeholder="Nombre o ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="input-premium"
                />
              </div>

              <div className="input-group">
                <label>Puntualidad:</label>
                <div className="custom-select-wrapper">
                  <div 
                    className={`custom-select-trigger ${isPunctualityDropdownOpen ? 'active' : ''}`}
                    onClick={() => setIsPunctualityDropdownOpen(!isPunctualityDropdownOpen)}
                  >
                    <span>{selectedPunctuality || 'Todas'}</span>
                    <svg className="arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                  <div className={`custom-options ${isPunctualityDropdownOpen ? 'active' : ''}`}>
                    <div 
                      className={`option ${selectedPunctuality === '' ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedPunctuality('');
                        setIsPunctualityDropdownOpen(false);
                      }}
                    >
                      Todas
                    </div>
                    {['A Tiempo', 'Retardo', 'Falta'].map((p, idx) => (
                      <div 
                        key={idx}
                        className={`option ${selectedPunctuality === p ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedPunctuality(p);
                          setIsPunctualityDropdownOpen(false);
                        }}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="botones-filtros">
              <button
                onClick={handleBuscar}
                className="btn-premium primary btn-action-reportes"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                Buscar
              </button>
              <button
                onClick={handleLimpiar}
                className="btn-premium outline btn-action-reportes"
                style={{ minWidth: '120px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                Limpiar
              </button>
              <button
                onClick={handleExportar}
                className="btn-premium outline btn-action-reportes"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Exportar
              </button>
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
                    <td colSpan="7" className="sin-registros">Cargando reportes...</td>
                  </tr>
                ) : attendances.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="sin-registros">No se encontraron registros.</td>
                  </tr>
                ) : (
                  attendances.map((r, idx) => (
                    <tr key={idx}>
                      <td className="nombre">{r.full_name}</td>
                      <td>{r.entrada ? new Date(r.entrada).toLocaleString() : "-"}</td>
                      <td>{r.salida ? new Date(r.salida).toLocaleString() : "-"}</td>
                      <td className="location-cell">{r.entrada_estacion || "-"}</td>
                      <td className="location-cell">{r.salida ? (r.salida_estacion || "-") : "-"}</td>
                      <td>
                        <span className={`badge-status ${r.salida ? 'completado' : 'pendiente'}`}>
                          {r.salida ? "Completado" : "En Turno"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-puntualidad ${(r.puntualidad || 'a-tiempo').toLowerCase().replace(' ', '-')}`}>
                          {r.puntualidad}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
