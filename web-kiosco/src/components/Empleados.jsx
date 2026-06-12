import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import './Empleados.css';
import { API_URL } from '../config';

export default function Empleados({ currentPath, onNavigate }) {
  // Estados para datos
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para filtros
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para Modales
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

  // Estado para Errores en Formulario
  const [modalError, setModalError] = useState('');
  const [shakeError, setShakeError] = useState(false);

  // Estado para el selector personalizado en el modal
  const [isSelectDropdownOpen, setIsSelectDropdownOpen] = useState(false);

  // Estado para evitar doble envío al guardar
  const [isSaving, setIsSaving] = useState(false);

  // Estado del Formulario de Empleado (para agregar/editar)
  const [formValues, setFormValues] = useState({
    id: '',
    full_name: '',
    employee_id: '',
    password: '',
    puesto: '',
    department: '',
    hora_entrada: '08:00',
    company: 'Einsur',
    tipo_horario: 'Personalizado',
    photo: ''
  });

  const [photoPreview, setPhotoPreview] = useState('');

  // Empleado seleccionado para de baja
  const [activeEmployee, setActiveEmployee] = useState(null);

  // Nombre de nueva empresa
  const [newCompanyName, setNewCompanyName] = useState('');

  // 1. Cargar Empresas
  async function loadCompanies() {
    try {
      const res = await fetch(`${API_URL}/api/companies.php`);
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
        // Si no hay empresa seleccionada por defecto en el form, asignar la primera
        if (data.length > 0 && !formValues.company) {
          setFormValues(prev => ({ ...prev, company: data[0].name }));
        }
      }
    } catch (err) {
      console.error("Error al cargar empresas:", err);
    }
  }

  // 2. Cargar Usuarios
  async function loadEmployees() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users.php?showInactive=${showInactive}&company=${selectedCompany}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error("Error al cargar empleados:", err);
    } finally {
      setLoading(false);
    }
  }

  // Cargar datos iniciales
  useEffect(() => {
    loadCompanies();
  }, []);

  // Recargar empleados al cambiar filtros
  useEffect(() => {
    loadEmployees();
  }, [selectedCompany, showInactive]);

  // Manejar selección de foto
  const [isPhotoSelected, setIsPhotoSelected] = useState(false);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormValues(prev => ({ ...prev, photo: reader.result }));
      setPhotoPreview(reader.result);
      setIsPhotoSelected(true);
    };
    reader.readAsDataURL(file);
  };

  // Manejar edición de empleado
  const handleEditClick = (employee) => {
    const hora = employee.hora_entrada ? employee.hora_entrada.substring(0, 5) : "08:00";
    setFormValues({
      id: employee.id || '',
      full_name: employee.full_name || '',
      employee_id: employee.employee_id || '',
      password: '', // Se deja vacío a menos que se quiera actualizar
      puesto: employee.puesto || '',
      department: employee.department || '',
      hora_entrada: hora,
      company: employee.company || 'Einsur',
      tipo_horario: 'Personalizado',
      photo: ''
    });
    setPhotoPreview(employee.id ? `${API_URL}/api/caras_referencia/${employee.id}.jpg?t=${Date.now()}` : '');
    setIsPhotoSelected(false);
    setModalError('');
    setIsSaving(false);
    setIsEmployeeModalOpen(true);
  };

  // Abrir modal de nuevo empleado
  const handleNewClick = () => {
    setFormValues({
      id: '',
      full_name: '',
      employee_id: '',
      password: '',
      puesto: '',
      department: '',
      hora_entrada: '08:00',
      company: companies[0]?.name || 'Einsur',
      tipo_horario: 'Personalizado',
      photo: ''
    });
    setPhotoPreview('');
    setIsPhotoSelected(false);
    setModalError('');
    setIsSaving(false);
    setIsEmployeeModalOpen(true);
  };

  // Guardar/Actualizar Empleado
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setModalError('');
    setShakeError(false);

    try {
      const res = await fetch(`${API_URL}/api/admin/create-user.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      });

      if (res.ok) {
        setIsEmployeeModalOpen(false);
        loadEmployees();
      } else {
        const errorData = await res.json();
        setModalError(errorData.error || "No se pudo guardar el empleado");
        setShakeError(true);
        setTimeout(() => setShakeError(false), 300);
      }
    } catch (err) {
      console.error(err);
      setModalError("Error de conexión al guardar.");
      setShakeError(true);
      setTimeout(() => setShakeError(false), 300);
    } finally {
      setIsSaving(false);
    }
  };

  // Abrir confirmación desactivación
  const handleDeactivateClick = (employee) => {
    setActiveEmployee(employee);
    setIsConfirmModalOpen(true);
  };

  // Ejecutar desactivación
  const handleDeactivateConfirm = async () => {
    if (!activeEmployee) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/deactivate-user.php?id=${activeEmployee.id}`, { method: "POST" });
      if (res.ok) {
        setIsConfirmModalOpen(false);
        setActiveEmployee(null);
        loadEmployees();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reactivar usuario
  const handleReactivateClick = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/reactivate-user.php?id=${id}`, { method: "POST" });
      if (res.ok) {
        loadEmployees();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Guardar nueva empresa
  const handleSaveCompany = async () => {
    if (!newCompanyName.trim()) return;
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/companies.php?name=${encodeURIComponent(newCompanyName)}`, { method: "POST" });
      if (res.ok) {
        setNewCompanyName('');
        setIsCompanyModalOpen(false);
        loadCompanies();
        loadEmployees();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };
  // Filtrar empleados por buscador
  const filteredEmployees = employees.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.employee_id && u.employee_id.toLowerCase().includes(q)) ||
      (u.puesto && u.puesto.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="empleados-page-wrapper">
      <Navbar currentPath={currentPath} onNavigate={onNavigate} />

      <main className="content">
        <div className="card-premium management-card">
          <h1 className="main-title gradient-text">Empleados</h1>

          <div className="filters-bar">
            <div className="left-filters">
              <div className="search-box">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input 
                  type="text" 
                  placeholder="Buscar por nombre, ID, puesto..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
              </div>

              <div className="company-tabs">
                <button 
                  className={`tab-btn ${selectedCompany === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedCompany('all')}
                >
                  Todos
                </button>
                {companies.map((c, i) => (
                  <button
                    key={i}
                    className={`tab-btn ${selectedCompany === c.name ? 'active' : ''}`}
                    onClick={() => setSelectedCompany(c.name)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <label className="toggle-inactive">
                <input 
                  type="checkbox" 
                  id="check-inactive" 
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)} 
                />
                <div className="switch"></div>
                <span>Mostrar inactivos</span>
              </label>
            </div>

            <div className="action-buttons">
              <button
                onClick={() => setIsCompanyModalOpen(true)}
                className="btn-premium outline btn-main-action"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                Empresa
              </button>
              <button
                onClick={handleNewClick}
                className="btn-premium primary btn-main-action"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Empleado
              </button>
            </div>
          </div>

          <div className="employee-list-container">
            <div className="employee-header">
              <div className="col-name">Nombre</div>
              <div className="col-id">ID</div>
              <div className="col-dept">Depto</div>
              <div className="col-company">Empresa</div>
              <div className="col-actions">Acciones</div>
            </div>
            
            <div className="employee-rows">
              {loading ? (
                <div className="empty-state">Cargando empleados...</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="empty-state">No se encontraron empleados.</div>
              ) : (
                filteredEmployees.map((u, i) => (
                  <div key={i} className={`employee-row ${u.active ? "" : "row-inactive"}`}>
                    <div className="col-name">
                      <div className="user-info">
                        <div className="user-info-text">
                          <span className="user-name">{u.full_name}</span>
                          <span className="user-puesto">{u.puesto || "Empleado"}</span>
                        </div>
                        {!u.active && <span className="badge-inactive">Inactivo</span>}
                      </div>
                    </div>
                    <div className="col-id">
                      <code className="id-code">{u.employee_id}</code>
                    </div>
                    <div className="col-dept">{u.department || "-"}</div>
                    <div className="col-company">
                      <span className={`tag-company tag-${(u.company || 'default').toLowerCase().replace(/\s+/g, '-')}`}>
                        {u.company || "-"}
                      </span>
                    </div>
                    <div className="col-actions">
                      <div className="actions-cell">
                        <button className="btn-action edit" onClick={() => handleEditClick(u)}>
                          Editar
                        </button>
                        {u.active ? (
                          <button className="btn-action deactivate" onClick={() => handleDeactivateClick(u)}>
                            Desactivar
                          </button>
                        ) : (
                          <button className="btn-action reactivate" onClick={() => handleReactivateClick(u.id)}>
                            Reactivar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL CREAR / EDITAR EMPLEADO */}
      {isEmployeeModalOpen && (
        <div className="modal active" onClick={() => setIsEmployeeModalOpen(false)}>
          <div className="modal-content card-premium" onClick={(e) => e.stopPropagation()} style={{ borderRadius: '24px', padding: '2.5rem' }}>
            <h1 className="modal-title-custom">
              {formValues.id ? "Editar Empleado" : "Nuevo Empleado"}
            </h1>

            {modalError && (
              <div className={`modal-error-container ${shakeError ? 'shake' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleEmployeeSubmit} className="modal-form">
              <input type="hidden" value={formValues.id} />
              <div className="form-grid">
                <div className="input-container full-width">
                  <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <input 
                    type="text" 
                    placeholder="Nombre Completo" 
                    value={formValues.full_name} 
                    onChange={(e) => setFormValues(prev => ({ ...prev, full_name: e.target.value }))}
                    required 
                  />
                </div>
                {formValues.id && (
                  <div className="input-container full-width">
                    <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                    <input 
                      type="text" 
                      placeholder="ID Empleado" 
                      value={formValues.employee_id} 
                      disabled
                      readOnly
                      style={{ opacity: 0.8, cursor: 'not-allowed', background: '#cbd5e120' }}
                    />
                  </div>
                )}
                <div className="input-container full-width">
                  <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>
                  <input 
                    type="text" 
                    placeholder="Puesto / Cargo" 
                    value={formValues.puesto} 
                    onChange={(e) => setFormValues(prev => ({ ...prev, puesto: e.target.value }))}
                  />
                </div>
                <div className="input-container full-width">
                  <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-3-3.87"/><path d="M9 21v-2a4 4 0 0 1 3-3.87"/><circle cx="9" cy="7" r="4"/></svg>
                  <input 
                    type="text" 
                    placeholder="Departamento" 
                    value={formValues.department} 
                    onChange={(e) => setFormValues(prev => ({ ...prev, department: e.target.value }))}
                  />
                </div>
                
                <div className="input-container full-width">
                  <label className="field-meta-label">HORA DE ENTRADA</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '14px', color: '#94a3b8', zIndex: 10 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <input 
                      type="time" 
                      value={formValues.hora_entrada} 
                      onChange={(e) => setFormValues(prev => ({ ...prev, hora_entrada: e.target.value }))}
                      required 
                      className="input-time-custom"
                    />
                  </div>
                </div>

                <div className="input-container full-width">
                  <label className="field-meta-label">EMPRESA</label>
                  <div className="custom-select-wrapper">
                    <div 
                      className={`custom-select-trigger ${isSelectDropdownOpen ? 'active' : ''}`}
                      onClick={() => setIsSelectDropdownOpen(!isSelectDropdownOpen)}
                    >
                      <span>{formValues.company}</span>
                      <svg className="arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                    <div className={`custom-options ${isSelectDropdownOpen ? 'active' : ''}`}>
                      {companies.map((c, idx) => (
                        <div 
                          key={idx} 
                          className={`option ${formValues.company === c.name ? 'selected' : ''}`}
                          onClick={() => {
                            setFormValues(prev => ({ ...prev, company: c.name }));
                            setIsSelectDropdownOpen(false);
                          }}
                        >
                          {c.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="input-container full-width">
                  <label className="field-meta-label">FOTO DE REFERENCIA (FACIAL)</label>
                  <div className="photo-upload-wrapper">
                    <label htmlFor="photo-upload-input" className="photo-upload-label">
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span>{formValues.photo ? "Cambiar Foto" : "Seleccionar Foto"}</span>
                    </label>
                    <input 
                      id="photo-upload-input"
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoChange}
                      style={{ display: 'none' }}
                    />
                    {photoPreview && (
                      <div className="photo-preview-container">
                        <img src={photoPreview} alt="Vista previa" className="photo-preview" onError={(e) => {
                          e.target.style.display = 'none';
                        }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setIsEmployeeModalOpen(false)} className="btn-premium outline" disabled={isSaving}>Cancelar</button>
                <button type="submit" className="btn-premium primary" disabled={isSaving}>
                  {isSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMAR DESACTIVAR EMPLEADO */}
      {isConfirmModalOpen && activeEmployee && (
        <div className="modal active" onClick={() => setIsConfirmModalOpen(false)}>
          <div className="modal-content card-premium" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', borderRadius: '24px', textAlign: 'center', padding: '2.5rem' }}>
            <h2 className="modal-title-bold">¿Desactivar Empleado?</h2>
            <p className="modal-text-confirm"><strong>{activeEmployee.full_name}</strong> dejará de tener acceso.</p>
            <div className="form-actions">
              <button type="button" onClick={() => setIsConfirmModalOpen(false)} className="btn-premium outline">Cancelar</button>
              <button type="button" onClick={handleDeactivateConfirm} className="btn-premium primary danger">Desactivar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA EMPRESA */}
      {isCompanyModalOpen && (
        <div className="modal active" onClick={() => setIsCompanyModalOpen(false)}>
          <div className="modal-content card-premium" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', borderRadius: '24px', textAlign: 'center', padding: '2.5rem' }}>
            <h2 className="modal-title-bold">Añadir Nueva Empresa</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveCompany(); }} className="modal-form">
              <div className="input-container full-width" style={{ marginBottom: '2rem' }}>
                <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                <input 
                  type="text" 
                  placeholder="Nombre de la empresa" 
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  required 
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setIsCompanyModalOpen(false)} className="btn-premium outline" disabled={isSaving}>Cancelar</button>
                <button type="submit" className="btn-premium primary" disabled={isSaving}>
                  {isSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
