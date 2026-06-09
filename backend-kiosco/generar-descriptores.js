const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const fs = require('fs');
const path = require('path');
const util = require('util');

// Forzar TextEncoder/TextDecoder para compatibilidad con Node v24 (en caso de que falten en el entorno)
if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = typeof TextEncoder !== 'undefined' ? TextEncoder : globalThis.TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = typeof TextDecoder !== 'undefined' ? TextDecoder : globalThis.TextDecoder;
}
util.TextEncoder = typeof TextEncoder !== 'undefined' ? TextEncoder : (globalThis.TextEncoder || global.TextEncoder);
util.TextDecoder = typeof TextDecoder !== 'undefined' ? TextDecoder : (globalThis.TextDecoder || global.TextDecoder);

// Parchear resoluciones de módulos de tensorflow-node a tensorflow normal para CPU
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
    if (request === '@tensorflow/tfjs-node') {
        return originalResolveFilename.call(this, '@tensorflow/tfjs', parent, isMain);
    }
    return originalResolveFilename.apply(this, arguments);
};

const faceapi = require('@vladmandic/face-api');
const { Canvas, Image, ImageData, loadImage } = require('canvas');

async function generar() {
    console.log('⏳ Cargando modelos de Inteligencia Facial desde internet...');
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

    // Descargamos y cargamos los modelos de reconocimiento facial en memoria
    const MODEL_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    
    console.log('✅ Modelos de IA cargados con éxito.');
    
    const carpetaReferencia = path.join(__dirname, 'caras_referencia');
    const carpetaSalida = path.join(__dirname, 'caras_referencia_descriptores');
    
    if (!fs.existsSync(carpetaReferencia)) {
        console.error(`❌ La carpeta de referencia no existe: ${carpetaReferencia}`);
        process.exit(1);
    }
    
    if (!fs.existsSync(carpetaSalida)) {
        fs.mkdirSync(carpetaSalida);
    }
    
    const archivos = fs.readdirSync(carpetaReferencia);
    console.log(`📂 Escaneando banco de rostros... Se encontraron ${archivos.length} fotos.`);
    
    for (const archivo of archivos) {
        if (!archivo.endsWith('.jpg') && !archivo.endsWith('.jpeg') && !archivo.endsWith('.png')) continue;
        
        // Ej: '2.png' -> empleadoId = 2
        const empleadoId = parseInt(path.parse(archivo).name);
        if (isNaN(empleadoId)) {
            console.log(`⚠️ Archivo ignorado: '${archivo}'. Debe llamarse con el ID del empleado (ej: 2.png)`);
            continue;
        }
        
        try {
            const rutaImagen = path.join(carpetaReferencia, archivo);
            const img = await loadImage(rutaImagen);
            
            // Detectar rostro de alta resolución usando SSD Mobilenet v1
            const deteccion = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            
            if (deteccion) {
                // Convertir el Float32Array a un array estándar de JS para poder guardarlo en JSON
                const descriptorArray = Array.from(deteccion.descriptor);
                const rutaJSON = path.join(carpetaSalida, `${empleadoId}.json`);
                fs.writeFileSync(rutaJSON, JSON.stringify(descriptorArray));
                console.log(`🧠 Descriptor de la foto [${archivo}] guardado en: ${rutaJSON}`);
            } else {
                console.log(`❌ No se pudo detectar ningún rostro en la foto de referencia: ${archivo}`);
            }
        } catch (error) {
            console.error(`❌ Error al procesar la foto ${archivo}:`, error.message);
        }
    }
    console.log('🏁 Proceso finalizado. Descriptores generados con éxito.');
}

generar();
