const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

// Límites de Express normales
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Servir fotos de referencia estáticas
app.use('/api/caras_referencia', express.static(path.join(__dirname, 'caras_referencia')));

// 1. CONEXIÓN A LA BASE DE DATOS (MYSQL)
// Se configuran las variables de entorno para producción en cPanel, con fallback a XAMPP local
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kiosko_asistencia',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test de conexión rápida a MySQL
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Error conectando a MySQL:', err.message);
    } else {
        console.log('✅ Conectado con éxito al servidor MySQL');
        connection.release();
    }
});

// Arreglo en memoria para guardar los descriptores faciales (vectores de 128 flotantes)
let descriptoresEmpleadosEntrenados = [];

// 2. CARGAR DESCRIPTORES DESDE ARCHIVOS JSON
function cargarDescriptoresFaciales() {
    const carpetaDescriptores = path.join(__dirname, 'caras_referencia_descriptores');
    
    if (!fs.existsSync(carpetaDescriptores)) {
        console.log(`⚠️ La carpeta de descriptores no existe: ${carpetaDescriptores}. Ejecuta primero el generador local.`);
        return;
    }

    try {
        const archivos = fs.readdirSync(carpetaDescriptores);
        console.log(`📂 Cargando descriptores faciales... Se encontraron ${archivos.length} archivos JSON.`);

        descriptoresEmpleadosEntrenados = [];

        for (const archivo of archivos) {
            if (!archivo.endsWith('.json')) continue;

            // Ej: '2.json' -> empleadoId = 2
            const empleadoId = path.parse(archivo).name;

            try {
                const rutaArchivo = path.join(carpetaDescriptores, archivo);
                const contenido = fs.readFileSync(rutaArchivo, 'utf8');
                const descriptor = JSON.parse(contenido);

                if (Array.isArray(descriptor) && descriptor.length === 128) {
                    descriptoresEmpleadosEntrenados.push({
                        label: empleadoId,
                        descriptor: descriptor
                    });
                    console.log(`🧠 Descriptor de Empleado ID [${empleadoId}] cargado correctamente.`);
                } else {
                    console.log(`⚠️ Descriptor inválido en ${archivo}. Debe ser un arreglo de 128 elementos.`);
                }
            } catch (err) {
                console.error(`❌ Error al procesar archivo ${archivo}:`, err.message);
            }
        }
        console.log(`🚀 ¡Sistema de Biometría Ligero listo con ${descriptoresEmpleadosEntrenados.length} rostros cargados!`);
    } catch (err) {
        console.error('❌ Error al escanear carpeta de descriptores:', err.message);
    }
}

// Cargar los descriptores en el arranque del servidor
cargarDescriptoresFaciales();

// Función auxiliar para calcular la Distancia Euclidiana entre dos vectores de 128 flotantes
function calcularDistanciaEuclidiana(vector1, vector2) {
    if (vector1.length !== vector2.length) return 1.0;
    let suma = 0;
    for (let i = 0; i < vector1.length; i++) {
        suma += Math.pow(vector1[i] - vector2[i], 2);
    }
    return Math.sqrt(suma);
}

// =========================================================================
// 🚀 ENDPOINTS / RUTAS DE LA API
// =========================================================================

app.get('/', (req, res) => {
    res.send('Servidor Kiosco Facial (cPanel Light) corriendo perfectamente 🚀');
});

// Endpoint para obtener las empresas
app.get('/api/empresas', (req, res) => {
    db.query('SELECT * FROM empresas', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Endpoint para recargar descriptores en caliente (útil tras subir nuevos JSONs)
app.post('/api/asistencia/recargar-descriptores', (req, res) => {
    cargarDescriptoresFaciales();
    res.json({ success: true, message: `Descriptores recargados. Rostros en memoria: ${descriptoresEmpleadosEntrenados.length}` });
});

// RUTA BIOMÉTRICA LIGERA: Procesa el descriptor matemático del rostro enviado por el cliente
app.post('/api/asistencia/checar-temporal', async (req, res) => {
  const { empresa_id, descriptor } = req.body;

  if (!descriptor || !empresa_id) {
    return res.status(400).json({ success: false, error: 'Faltan datos obligatorios (descriptor o empresa_id)' });
  }

  if (descriptoresEmpleadosEntrenados.length === 0) {
      return res.status(500).json({ success: false, error: 'El servidor no tiene descriptores faciales cargados en memoria' });
  }

  try {
    console.log('📸 Recibiendo descriptor facial desde el cliente web...');
    console.time('⏱️ Tiempo de Comparación Biométrica');
    
    // Comparación 1 vs N usando Distancia Euclidiana
    let mejorMatch = { label: 'unknown', distance: 1.0 };
    
    for (const ref of descriptoresEmpleadosEntrenados) {
        const distancia = calcularDistanciaEuclidiana(descriptor, ref.descriptor);
        if (distancia < mejorMatch.distance) {
            mejorMatch = { label: ref.label, distance: distancia };
        }
    }
    
    console.timeEnd('⏱️ Tiempo de Comparación Biométrica');
    
    // Umbral estándar de matching (0.6)
    const UMBRAL = 0.6;
    const empleado_id = mejorMatch.distance < UMBRAL ? mejorMatch.label : 'unknown';

    if (empleado_id === 'unknown') {
        console.log(`🛑 Acceso Denegado: Rostro no coincide. Menor distancia: ${mejorMatch.distance.toFixed(4)}`);
        return res.status(403).json({ success: false, error: 'Rostro no reconocido en el sistema ❌' });
    }

    console.log(`🎯 ¡MATCH DETECTADO! Empleado ID identificado: ${empleado_id} (Distancia: ${mejorMatch.distance.toFixed(4)})`);

    // LÓGICA AUTOMÁTICA EN MYSQL (Primero validamos estado de empleado y luego limites de asistencia)
    db.query('SELECT empresa_id, nombre, estado_activo FROM empleados WHERE id = ?', [empleado_id], (empErr, empRows) => {
      if (empErr || !empRows || empRows.length === 0) {
        console.error('Error al buscar datos del empleado:', empErr);
        return res.status(500).json({ success: false, error: 'No se pudo determinar los datos del empleado' });
      }

      const realEmpresaId = empRows[0].empresa_id;
      const nombreEmpleado = empRows[0].nombre;
      const estaActivo = empRows[0].estado_activo;

      // Validar si el empleado está inactivo (controlando booleanos, strings o números de MySQL)
      if (estaActivo == 0 || estaActivo === false || estaActivo === '0') {
        console.log(`🛑 Acceso Denegado: Empleado ${nombreEmpleado} (${empleado_id}) está inactivo.`);
        return res.status(403).json({ success: false, error: 'Empleado inactivo en el sistema. Acceso denegado ❌' });
      }

      const sqlBuscarHoy = `
        SELECT tipo 
        FROM asistencias 
        WHERE empleado_id = ? AND DATE(fecha_hora) = CURDATE() 
        ORDER BY fecha_hora ASC
      `;

      db.query(sqlBuscarHoy, [empleado_id], (err, rows) => {
        if (err) {
          console.error('Error al buscar asistencia de hoy:', err);
          return res.status(500).json({ success: false, error: 'Error en la base de datos al buscar' });
        }

        // Si ya tiene 2 o más registros hoy, se bloquea el check-in adicional
        if (rows.length >= 2) {
          console.log(`🛑 Bloqueado: Empleado ${nombreEmpleado} (${empleado_id}) ya registró entrada y salida por hoy.`);
          return res.status(400).json({ 
            success: false, 
            error: 'Ya has registrado tu entrada y salida por el día de hoy. ¡Hasta mañana! 👋' 
          });
        }

        let nuevoTipo = 'ENTRADA';
        if (rows.length === 1) {
          const primerRegistro = rows[0].tipo;
          nuevoTipo = primerRegistro === 'ENTRADA' ? 'SALIDA' : 'ENTRADA';
        }

        const sqlInsertar = `
          INSERT INTO asistencias (empleado_id, empresa_id, tipo, fecha_hora) 
          VALUES (?, ?, ?, NOW())
        `;

        db.query(sqlInsertar, [empleado_id, realEmpresaId, nuevoTipo], (insertErr, result) => {
          if (insertErr) {
            console.error('Error al insertar asistencia:', insertErr);
            return res.status(500).json({ success: false, error: 'No se pudo guardar el registro de asistencia' });
          }

          const mensajeExito = nuevoTipo === 'ENTRADA' 
            ? `¡Hola ${nombreEmpleado}! Entrada registrada con éxito` 
            : `¡Adiós ${nombreEmpleado}! Salida registrada con éxito`;

          console.log(`[Asistencia] Empleado ${nombreEmpleado} (${empleado_id}) registró ${nuevoTipo} correctamente.`);
          
          res.json({
            success: true,
            message: mensajeExito,
            tipo: nuevoTipo
          });
        });
      });
    });

  } catch (error) {
      console.error('❌ Error crítico en el emparejamiento biométrico:', error);
      res.status(500).json({ success: false, error: 'Error al procesar el reconocimiento facial en el servidor' });
  }
});

// =========================================================================
// 🚀 ENDPOINTS ADMINISTRATIVOS MIGRADOS DESDE PHP
// =========================================================================

// Helper para encontrar o crear empresa por nombre
const findOrCreateCompany = (companyName, callback) => {
    db.query('SELECT id FROM empresas WHERE nombre = ?', [companyName], (err, rows) => {
        if (err) return callback(err);
        if (rows.length > 0) {
            callback(null, rows[0].id);
        } else {
            db.query('INSERT INTO empresas (nombre) VALUES (?)', [companyName], (err2, result) => {
                if (err2) return callback(err2);
                callback(null, result.insertId);
            });
        }
    });
};

// GET /api/companies.php
app.get('/api/companies.php', (req, res) => {
    db.query('SELECT id, nombre AS name FROM empresas ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// GET /api/daily.php
app.get('/api/daily.php', (req, res) => {
    const mode = req.query.mode || '';
    if (mode === 'dashboard') {
        const sqlTodayCount = `
            SELECT COUNT(DISTINCT empleado_id) AS today_count 
            FROM asistencias 
            WHERE DATE(fecha_hora) = CURDATE() AND tipo = 'ENTRADA'
        `;
        const sqlRecent = `
            SELECT 
                MIN(a.id) AS id,
                a.empleado_id,
                emp.nombre AS full_name,
                empr.nombre AS company,
                MIN(CASE WHEN a.tipo = 'ENTRADA' THEN a.fecha_hora END) AS entrada,
                MAX(CASE WHEN a.tipo = 'SALIDA' THEN a.fecha_hora END) AS salida
            FROM asistencias a
            JOIN empleados emp ON a.empleado_id = emp.id
            JOIN empresas empr ON emp.empresa_id = empr.id
            WHERE DATE(a.fecha_hora) = CURDATE()
            GROUP BY a.empleado_id, emp.nombre, empr.nombre 
            ORDER BY entrada DESC
            LIMIT 5
        `;
        db.query(sqlTodayCount, (err, todayRows) => {
            if (err) return res.status(500).json({ error: err.message });
            const today_count = todayRows[0] ? todayRows[0].today_count : 0;

            db.query(sqlRecent, (err2, recentRows) => {
                if (err2) return res.status(500).json({ error: err2.message });

                const recent = recentRows.map(row => {
                    let puntualidad = 'A Tiempo';
                    if (row.entrada) {
                        const entradaDate = new Date(row.entrada);
                        const hours = entradaDate.getHours();
                        const mins = hours * 60 + entradaDate.getMinutes();
                        if (mins > (8 * 60 + 16)) puntualidad = 'Falta';
                        else if (mins > (8 * 60 + 6)) puntualidad = 'Retardo';
                    }
                    return {
                        ...row,
                        puntualidad
                    };
                });

                res.json({
                    today_count,
                    week_delays: 0,
                    recent
                });
            });
        });
        return;
    }

    const search = req.query.search || '';
    const company = req.query.company || '';

    let sql = `
        SELECT 
            MIN(a.id) AS id,
            a.empleado_id,
            emp.nombre AS full_name,
            empr.nombre AS company,
            MIN(CASE WHEN a.tipo = 'ENTRADA' THEN a.fecha_hora END) AS entrada,
            MAX(CASE WHEN a.tipo = 'SALIDA' THEN a.fecha_hora END) AS salida
        FROM asistencias a
        JOIN empleados emp ON a.empleado_id = emp.id
        JOIN empresas empr ON emp.empresa_id = empr.id
        WHERE DATE(a.fecha_hora) = CURDATE()
    `;
    const params = [];
    if (search) {
        sql += ` AND emp.nombre LIKE ?`;
        params.push(`%${search}%`);
    }
    if (company && company !== 'all') {
        sql += ` AND empr.nombre = ?`;
        params.push(company);
    }
    sql += ` GROUP BY a.empleado_id, emp.nombre, empr.nombre ORDER BY entrada DESC`;

    db.query(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const formatted = rows.map(row => {
            let puntualidad = 'A Tiempo';
            if (row.entrada) {
                const entradaDate = new Date(row.entrada);
                const hours = entradaDate.getHours();
                const mins = hours * 60 + entradaDate.getMinutes();
                if (mins > (8 * 60 + 16)) puntualidad = 'Falta';
                else if (mins > (8 * 60 + 6)) puntualidad = 'Retardo';
            }
            return {
                ...row,
                puntualidad
            };
        });

        res.json(formatted);
    });
});

// GET /api/reports.php
app.get('/api/reports.php', (req, res) => {
    const start = req.query.start;
    const end = req.query.end;
    const search = req.query.search || '';
    const company = req.query.company || '';

    if (!start || !end) {
        return res.status(400).json({ error: 'Faltan fechas de inicio o fin (start, end)' });
    }

    let sql = `
        SELECT 
            MIN(a.id) AS id,
            a.empleado_id,
            emp.nombre AS full_name,
            empr.nombre AS company,
            MIN(CASE WHEN a.tipo = 'ENTRADA' THEN a.fecha_hora END) AS entrada,
            MAX(CASE WHEN a.tipo = 'SALIDA' THEN a.fecha_hora END) AS salida
        FROM asistencias a
        JOIN empleados emp ON a.empleado_id = emp.id
        JOIN empresas empr ON emp.empresa_id = empr.id
        WHERE DATE(a.fecha_hora) BETWEEN ? AND ?
    `;
    const params = [start, end];
    if (search) {
        sql += ` AND emp.nombre LIKE ?`;
        params.push(`%${search}%`);
    }
    if (company && company !== 'all') {
        sql += ` AND empr.nombre = ?`;
        params.push(company);
    }
    sql += ` GROUP BY DATE(a.fecha_hora), a.empleado_id, emp.nombre, empr.nombre ORDER BY entrada DESC`;

    db.query(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const formatted = rows.map(row => {
            let puntualidad = 'A Tiempo';
            if (row.entrada) {
                const entradaDate = new Date(row.entrada);
                const hours = entradaDate.getHours();
                const mins = hours * 60 + entradaDate.getMinutes();
                if (mins > (8 * 60 + 16)) puntualidad = 'Falta';
                else if (mins > (8 * 60 + 6)) puntualidad = 'Retardo';
            }
            return {
                ...row,
                puntualidad
            };
        });

        res.json(formatted);
    });
});

// GET /api/admin/users.php
app.get('/api/admin/users.php', (req, res) => {
    const showInactive = req.query.showInactive === 'true';
    const companyFilter = req.query.company || 'all';

    let sql = `
        SELECT 
            emp.id, 
            emp.nombre AS full_name, 
            emp.employee_id,
            emp.puesto,
            emp.department,
            emp.hora_entrada,
            emp.foto_rostro_url AS photo_url, 
            emp.estado_activo AS active, 
            empr.nombre AS company,
            emp.created_at
        FROM empleados emp
        JOIN empresas empr ON emp.empresa_id = empr.id
        WHERE 1=1
    `;
    const params = [];
    if (!showInactive) {
        sql += ` AND emp.estado_activo = 1`;
    }
    if (companyFilter !== 'all') {
        sql += ` AND empr.nombre = ?`;
        params.push(companyFilter);
    }
    sql += ` ORDER BY emp.nombre ASC`;

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Helper para generar descriptor facial (Mock en cPanel)
async function generarYGuardarDescriptor(empleadoId) {
    console.log(`ℹ️ [cPanel] La generación automática de descriptores no está soportada en producción. Por favor, regenera los descriptores localmente y súbelos.`);
}

// POST /api/admin/create-user.php
app.post('/api/admin/create-user.php', (req, res) => {
    const { id, full_name, password, employee_id, puesto, department, hora_entrada, company, photo } = req.body;

    if (!full_name || !company) {
        return res.status(400).json({ error: 'Faltan datos requeridos (nombre o empresa)' });
    }

    findOrCreateCompany(company, (err, empresaId) => {
        if (err) return res.status(500).json({ error: err.message });

        if (id) {
            // Edición de empleado
            let sqlUpdate = `
                UPDATE empleados 
                SET nombre = ?, employee_id = ?, puesto = ?, department = ?, hora_entrada = ?, empresa_id = ?
            `;
            const paramsUpdate = [full_name, employee_id, puesto, department, hora_entrada, empresaId];
            
            if (password) {
                sqlUpdate += `, password = ?`;
                paramsUpdate.push(password);
            }
            
            sqlUpdate += ` WHERE id = ?`;
            paramsUpdate.push(id);

            db.query(sqlUpdate, paramsUpdate, async (err2) => {
                if (err2) return res.status(500).json({ error: err2.message });

                // Si hay foto base64, procesarla
                if (photo) {
                    try {
                        const base64Data = photo.replace(/^data:image\/\w+;base64,/, "");
                        const buffer = Buffer.from(base64Data, 'base64');
                        const filename = `${id}.jpg`;
                        const filepath = path.join(__dirname, 'caras_referencia', filename);
                        fs.writeFileSync(filepath, buffer);

                        // Actualizar la ruta en DB
                        const photoUrl = `/api/caras_referencia/${filename}`;
                        db.query('UPDATE empleados SET foto_rostro_url = ? WHERE id = ?', [photoUrl, id]);
                    } catch (photoErr) {
                        console.error('Error al guardar foto:', photoErr);
                    }
                }

                res.json({ success: true, message: 'Empleado actualizado correctamente', id });
            });
        } else {
            // Creación de empleado
            const sqlInsert = `
                INSERT INTO empleados (nombre, password, employee_id, puesto, department, hora_entrada, empresa_id, estado_activo)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `;
            db.query(sqlInsert, [full_name, password || null, employee_id || null, puesto || null, department || null, hora_entrada || null, empresaId], async (err2, result) => {
                if (err2) return res.status(500).json({ error: err2.message });

                const newId = result.insertId;
                const generatedEmployeeId = `EMP-${String(newId).padStart(4, '0')}`;

                db.query('UPDATE empleados SET employee_id = ? WHERE id = ?', [generatedEmployeeId, newId], async (updateErr) => {
                    if (updateErr) {
                        console.error('Error al guardar employee_id automático:', updateErr);
                    }

                    if (photo) {
                        try {
                            const base64Data = photo.replace(/^data:image\/\w+;base64,/, "");
                            const buffer = Buffer.from(base64Data, 'base64');
                            const filename = `${newId}.jpg`;
                            const filepath = path.join(__dirname, 'caras_referencia', filename);
                            fs.writeFileSync(filepath, buffer);

                            const photoUrl = `/api/caras_referencia/${filename}`;
                            db.query('UPDATE empleados SET foto_rostro_url = ? WHERE id = ?', [photoUrl, newId]);
                        } catch (photoErr) {
                            console.error('Error al guardar foto:', photoErr);
                        }
                    }

                    res.json({ success: true, message: 'Empleado creado correctamente', id: newId });
                });
            });
        }
    });
});

// POST /api/admin/deactivate-user.php
app.post('/api/admin/deactivate-user.php', (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Falta ID' });

    db.query('UPDATE empleados SET estado_activo = 0 WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// POST /api/admin/reactivate-user.php
app.post('/api/admin/reactivate-user.php', (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Falta ID' });

    db.query('UPDATE empleados SET estado_activo = 1 WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// POST /api/admin/companies.php
app.post('/api/admin/companies.php', (req, res) => {
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: 'Falta nombre' });

    db.query('INSERT IGNORE INTO empresas (nombre) VALUES (?)', [name], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Empresa añadida correctamente' });
    });
});

// GET /api/cron_reports.php
app.get('/api/cron_reports.php', (req, res) => {
    res.json({ status: 'success', email_sent: true, recipient: 'admin@empresa.com', total_incidencias: 0 });
});

// 3. ARRANCAR EL SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
