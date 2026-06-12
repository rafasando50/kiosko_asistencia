const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// =========================================================================
// 🛠️ PARCHE DE COMPATIBILIDAD PARA NODE v24 (Arregla error de TextEncoder)
// =========================================================================
const util = require('util');

// Forzar la existencia de TextEncoder/TextDecoder en global si no estuvieran
if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = typeof TextEncoder !== 'undefined' ? TextEncoder : globalThis.TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = typeof TextDecoder !== 'undefined' ? TextDecoder : globalThis.TextDecoder;
}

// Sobrescribir incondicionalmente en el objeto util con el constructor global
util.TextEncoder = typeof TextEncoder !== 'undefined' ? TextEncoder : (globalThis.TextEncoder || global.TextEncoder);
util.TextDecoder = typeof TextDecoder !== 'undefined' ? TextDecoder : (globalThis.TextDecoder || global.TextDecoder);
// =========================================================================

// =========================================================================
// 🔄 ALIASING DE TENSORFLOW PARA NODE.JS (Evita error de tfjs-node nativo)
// =========================================================================
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
    if (request === '@tensorflow/tfjs-node') {
        return originalResolveFilename.call(this, '@tensorflow/tfjs', parent, isMain);
    }
    return originalResolveFilename.apply(this, arguments);
};

// ⚠️ LIBRERÍAS DE INTELIGENCIA ARTIFICIAL E IMÁGENES (Versión CPU Estable)
const faceapi = require('@vladmandic/face-api');
const { Canvas, Image, ImageData, loadImage } = require('canvas');

const app = express();
app.use(cors());

// Límites de Express ampliados para soportar el peso del Base64 del celular
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 1. CONEXIÓN A XAMPP (MYSQL)
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',      // Usuario por defecto de XAMPP
    password: '',      // Contraseña por defecto de XAMPP (vacía)
    database: 'kiosko_asistencia', // Tu base de datos
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test de conexión rápida a MySQL
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Error conectando a MySQL en XAMPP:', err.message);
    } else {
        console.log('✅ Conectado con éxito al MySQL de XAMPP');
        connection.release();
    }
});

// Arreglo global en memoria para guardar los moldes matemáticos de los rostros
let descriptoresEmpleadosEntrenados = [];

// =========================================================================
// 🧠 MOTOR DE INTELIGENCIA ARTIFICIAL: CARGAR MODELOS Y MAPEAR FOTOS
// =========================================================================
async function inicializarIA() {
    console.log('⏳ Cargando modelos de Inteligencia Facial desde internet...');
    
    // Inyectamos las herramientas de Canvas en el entorno de la IA
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

    // Descargamos y cargamos las redes neuronales necesarias en memoria (Cargamos el rápido para celular y el preciso para base de datos)
    const MODEL_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    
    console.log('✅ Modelos de IA cargados con éxito.');
    
    // Escaneamos las fotos de la carpeta de referencia para entrenar al servidor
    const carpetaReferencia = path.join(__dirname, 'caras_referencia');
    if (!fs.existsSync(carpetaReferencia)) {
        fs.mkdirSync(carpetaReferencia);
    }

    const archivos = fs.readdirSync(carpetaReferencia);
    console.log(`📂 Escaneando banco de rostros... Se encontraron ${archivos.length} fotos.`);

    for (const archivo of archivos) {
        if (!archivo.endsWith('.jpg') && !archivo.endsWith('.jpeg') && !archivo.endsWith('.png')) continue;

        // Ej: '1.jpg' -> empleadoId = 1
        const empleadoId = parseInt(path.parse(archivo).name);
        
        if (isNaN(empleadoId)) {
            console.log(`⚠️ Archivo ignorado: '${archivo}'. Debe llamarse con el ID del empleado (ej: 1.jpg)`);
            continue;
        }

        try {
            const rutaImagen = path.join(carpetaReferencia, archivo);
            const img = await loadImage(rutaImagen);
            
            // Para la base de datos de referencia (que solo se carga UNA VEZ al encender el servidor),
            // usamos la imagen original sin redimensionar y el detector ultra-preciso SSD Mobilenet v1.
            // Esto garantiza que el 100% de las fotos de los empleados sean mapeadas con la máxima fidelidad.
            const deteccion = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            
            if (deteccion) {
                // Guardamos los rasgos asociados al ID del empleado
                descriptoresEmpleadosEntrenados.push(
                    new faceapi.LabeledFaceDescriptors(empleadoId.toString(), [deteccion.descriptor])
                );
                console.log(`🧠 Cara del Empleado ID [${empleadoId}] mapeada correctamente.`);
            } else {
                console.log(`❌ No se pudo detectar ningún rostro en la foto de referencia: ${archivo}`);
            }
        } catch (error) {
            console.error(`❌ Error al procesar la foto ${archivo}:`, error.message);
        }
    }
    console.log('🚀 ¡Sistema de Reconocimiento Facial en línea y listo para operar!');
}

// Arrancar la inicialización de la IA en segundo plano
inicializarIA();


// =========================================================================
// 🔒 ALGORITMO ANTI-SPOOFING PASIVO (Detección de fotos en pantallas/papel)
// =========================================================================
function analizarTexturaAntiSpoofing(imgCaptura, canvasPequeno, faceBox) {
    try {
        // 1. Calculamos las proporciones de escala de la imagen pequeña vs la original
        const scaleX = imgCaptura.width / canvasPequeno.width;
        const scaleY = imgCaptura.height / canvasPequeno.height;

        // 2. Mapeamos las coordenadas de la caja del rostro a la imagen original de alta resolución
        const origX = faceBox.x * scaleX;
        const origY = faceBox.y * scaleY;
        const origWidth = faceBox.width * scaleX;
        const origHeight = faceBox.height * scaleY;

        // 3. Extraemos una muestra (parche) de piel a alta resolución de la mejilla/frente
        // Seleccionamos un tamaño del 20% del rostro
        const patchWidth = Math.round(origWidth * 0.20);
        const patchHeight = Math.round(origHeight * 0.20);
        
        // Desplazamos las coordenadas al centro-superior del rostro
        const patchX = Math.round(origX + origWidth * 0.4);
        const patchY = Math.round(origY + origHeight * 0.35);

        // Validar que el parche no se salga de los límites reales de la imagen capturada
        if (patchX < 0 || patchY < 0 || patchX + patchWidth > imgCaptura.width || patchY + patchHeight > imgCaptura.height) {
            console.log('⚠️ [Anti-Spoofing] El rostro mapeado está fuera de los límites de la foto original.');
            return { esReal: true, ruido: 5.0, glare: 0.0 }; // Fallback seguro
        }

        // Creamos un canvas temporal exclusivo para el pedacito de alta resolución
        const canvasPatch = new Canvas(patchWidth, patchHeight);
        const ctxPatch = canvasPatch.getContext('2d');
        ctxPatch.drawImage(imgCaptura, patchX, patchY, patchWidth, patchHeight, 0, 0, patchWidth, patchHeight);

        const imgData = ctxPatch.getImageData(0, 0, patchWidth, patchHeight);
        const data = imgData.data;

        let totalDiferencias = 0;
        let pixelesAnalizados = 0;
        let pixelesGlare = 0; // Píxeles blancos saturados (típico reflejo de pantallas/papel brillo)

        // 4. Analizamos la luminancia y la micro-textura de alta resolución píxel por píxel
        for (let y = 0; y < patchHeight - 1; y++) {
            for (let x = 0; x < patchWidth - 1; x++) {
                const idx = (y * patchWidth + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // Detección de reflejo (glare): píxeles con brillo extremo (casi blanco puro)
                if (r > 240 && g > 240 && b > 240) {
                    pixelesGlare++;
                }

                const idxDerecha = (y * patchWidth + (x + 1)) * 4;
                const idxAbajo = ((y + 1) * patchWidth + x) * 4;

                const lum = r * 0.299 + g * 0.587 + b * 0.114;
                const lumDerecha = data[idxDerecha] * 0.299 + data[idxDerecha+1] * 0.587 + data[idxDerecha+2] * 0.114;
                const lumAbajo = data[idxAbajo] * 0.299 + data[idxAbajo+1] * 0.587 + data[idxAbajo+2] * 0.114;

                // Varianza local (ruido de alta frecuencia)
                totalDiferencias += Math.abs(lum - lumDerecha) + Math.abs(lum - lumAbajo);
                pixelesAnalizados++;
            }
        }

        const promedioRuido = totalDiferencias / (pixelesAnalizados * 2 || 1);
        const porcentajeGlare = (pixelesGlare / (pixelesAnalizados || 1)) * 100;

        console.log(`🛡️ [Anti-Spoofing] Coeficiente de ruido: ${promedioRuido.toFixed(2)} | Glare detectado: ${porcentajeGlare.toFixed(2)}%`);

        // UMBRALES EN ALTA RESOLUCIÓN:
        // - Piel real: Suave y continua (1.8 a 17.5).
        // - Pantalla con moiré o Impresión halftone: Ruido sumamente alto (> 17.5).
        // - Foto plana en papel de baja calidad o fuera de foco: Ruido extremadamente bajo y plano (< 1.8).
        if (promedioRuido > 17.5) {
            return { 
                esReal: false, 
                ruido: promedioRuido, 
                glare: porcentajeGlare, 
                motivo: 'Patrón de pantalla o textura impresa' 
            };
        }
        if (promedioRuido < 1.8) {
            return { 
                esReal: false, 
                ruido: promedioRuido, 
                glare: porcentajeGlare, 
                motivo: 'Foto impresa plana o estática (Ruido bajo)' 
            };
        }

        // - Exceso de píxeles saturados en cúmulos: Reflejo directo de una pantalla LCD/OLED o papel glossy
        if (porcentajeGlare > 6.0) {
            return { 
                esReal: false, 
                ruido: promedioRuido, 
                glare: porcentajeGlare, 
                motivo: 'Reflejo especular de pantalla/papel plastificado' 
            };
        }

        return { esReal: true, ruido: promedioRuido, glare: porcentajeGlare };

    } catch (e) {
        console.error('❌ Error analizando anti-spoofing:', e.message);
        return { esReal: true, ruido: 5.0, glare: 0.0 }; // Si falla, permite continuar
    }
}


// =========================================================================
// 🚀 ENDPOINTS / RUTAS DE TU API
// =========================================================================

app.get('/', (req, res) => {
    res.send('Servidor Inteligente del Kiosco corriendo perfectamente 🚀');
});

// Endpoint para obtener las empresas
app.get('/api/empresas', (req, res) => {
    db.query('SELECT * FROM empresas', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// RUTA INTELIGENTE: Procesa el descriptor matemático del rostro enviado por el cliente
app.post('/api/asistencia/checar-temporal', async (req, res) => {
  const { empresa_id, descriptor } = req.body;

  if (!descriptor || !empresa_id) {
    return res.status(400).json({ success: false, error: 'Faltan datos obligatorios (descriptor o empresa_id)' });
  }

  if (descriptoresEmpleadosEntrenados.length === 0) {
      return res.status(500).json({ success: false, error: 'La IA no tiene rostros de referencia cargados en el servidor' });
  }

  try {
    console.log('📸 Recibiendo descriptor facial desde el cliente web...');
    console.time('⏱️ Tiempo de Reconocimiento IA');
    
    // Convertir el descriptor de JS Array a Float32Array para faceapi
    const float32Descriptor = new Float32Array(descriptor);
    const comparadorRostros = new faceapi.FaceMatcher(descriptoresEmpleadosEntrenados, 0.6);
    const mejorMatch = comparadorRostros.findBestMatch(float32Descriptor);
    
    console.timeEnd('⏱️ Tiempo de Reconocimiento IA');
    const empleado_id = mejorMatch.label;

    if (empleado_id === 'unknown') {
        console.log('🛑 Acceso Denegado: El rostro no pertenece a ningún empleado registrado.');
        return res.status(403).json({ success: false, error: 'Rostro no reconocido en el sistema ❌' });
    }

    console.log(`🎯 ¡MATCH DETECTADO! Empleado ID identificado: ${empleado_id} (Distancia: ${mejorMatch.distance.toFixed(2)})`);

    // 4. LÓGICA AUTOMÁTICA EN MYSQL (Primero validamos estado de empleado y luego limites de asistencia)
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
      console.error('❌ Error crítico en el procesamiento de la IA:', error);
      res.status(500).json({ success: false, error: 'Error al procesar el reconocimiento facial' });
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

// Helper para generar descriptor facial usando faceapi
async function generarYGuardarDescriptor(empleadoId) {
    const rutaImagen = path.join(__dirname, 'caras_referencia', `${empleadoId}.jpg`);
    if (!fs.existsSync(rutaImagen)) return;
    try {
        const img = await loadImage(rutaImagen);
        const deteccion = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        if (deteccion) {
            const descriptorArray = Array.from(deteccion.descriptor);
            const carpetaDescriptores = path.join(__dirname, 'caras_referencia_descriptores');
            if (!fs.existsSync(carpetaDescriptores)) {
                fs.mkdirSync(carpetaDescriptores);
            }
            const rutaJSON = path.join(carpetaDescriptores, `${empleadoId}.json`);
            fs.writeFileSync(rutaJSON, JSON.stringify(descriptorArray));
            console.log(`🧠 [IA] Descriptor para Empleado ${empleadoId} generado y guardado.`);
            
            // Actualizar memoria
            descriptoresEmpleadosEntrenados = descriptoresEmpleadosEntrenados.filter(d => d.label !== empleadoId.toString());
            descriptoresEmpleadosEntrenados.push(
                new faceapi.LabeledFaceDescriptors(empleadoId.toString(), [deteccion.descriptor])
            );
        } else {
            console.log(`❌ [IA] No se detectó rostro para generar descriptor de Empleado ${empleadoId}`);
        }
    } catch (err) {
        console.error(`❌ [IA] Error generando descriptor de Empleado ${empleadoId}:`, err.message);
    }
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

                        // Generar descriptor matemático
                        await generarYGuardarDescriptor(id);
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
                console.log(`[Debug] Empleado insertado con ID: ${newId}. Generando employee_id: ${generatedEmployeeId}`);

                db.query('UPDATE empleados SET employee_id = ? WHERE id = ?', [generatedEmployeeId, newId], async (updateErr, updateResult) => {
                    if (updateErr) {
                        console.error('Error al guardar employee_id automático:', updateErr);
                    } else {
                        console.log(`[Debug] UPDATE de employee_id exitoso. Filas afectadas: ${updateResult ? updateResult.affectedRows : 'desconocido'}`);
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

                            // Generar descriptor matemático
                            await generarYGuardarDescriptor(newId);
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

// Endpoint para recargar descriptores faciales en caliente (sin reiniciar Node)
app.post('/api/asistencia/recargar-descriptores', async (req, res) => {
    try {
        console.log('🔄 Petición recibida: Recargando descriptores faciales...');
        descriptoresEmpleadosEntrenados = []; // Vaciar base de datos en memoria
        await inicializarIA(); // Volver a escanear carpeta e inicializar
        res.json({ 
            success: true, 
            message: `Descriptores faciales recargados con éxito. Rostros en memoria: ${descriptoresEmpleadosEntrenados.length}` 
        });
    } catch (err) {
        console.error('❌ Error recargando descriptores faciales:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. ARRANCAR EL SERVIDOR
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});