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

    // LÓGICA AUTOMÁTICA EN MYSQL (Limita a 1 Entrada y 1 Salida por día)
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
        console.log(`🛑 Bloqueado: Empleado ${empleado_id} ya registró entrada y salida por hoy.`);
        return res.status(400).json({ 
          success: false, 
          error: 'Ya has registrado tu entrada y salida por el día de hoy. ¡Hasta mañana! 👋' 
        });
      }

      let nuevoTipo = 'ENTRADA';

      if (rows.length === 1) {
        const primerRegistro = rows[0].tipo;
        // Alternamos el registro según el primero
        nuevoTipo = primerRegistro === 'ENTRADA' ? 'SALIDA' : 'ENTRADA';
      }

      const sqlInsertar = `
        INSERT INTO asistencias (empleado_id, empresa_id, tipo, fecha_hora) 
        VALUES (?, ?, ?, NOW())
      `;

      db.query(sqlInsertar, [empleado_id, empresa_id, nuevoTipo], (insertErr, result) => {
        if (insertErr) {
          console.error('Error al insertar asistencia:', insertErr);
          return res.status(500).json({ success: false, error: 'No se pudo guardar el registro' });
        }

        const mensajeExito = nuevoTipo === 'ENTRADA' 
          ? `¡Hola! Entrada registrada con éxito` 
          : `¡Adiós! Salida registrada con éxito`;

        console.log(`[Asistencia] Empleado ${empleado_id} registró ${nuevoTipo} correctamente.`);
        
        res.json({
          success: true,
          message: mensajeExito,
          tipo: nuevoTipo
        });
      });
    });

  } catch (error) {
      console.error('❌ Error crítico en el emparejamiento biométrico:', error);
      res.status(500).json({ success: false, error: 'Error al procesar el reconocimiento facial en el servidor' });
  }
});

// 3. ARRANCAR EL SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
