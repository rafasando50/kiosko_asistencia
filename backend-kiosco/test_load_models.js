const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Force IPv4 first to prevent IPv6 timeouts

const path = require('path');
const util = require('util');

// Force TextEncoder/Decoder for compatibility
if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = typeof TextEncoder !== 'undefined' ? TextEncoder : globalThis.TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = typeof TextDecoder !== 'undefined' ? TextDecoder : globalThis.TextDecoder;
}
util.TextEncoder = typeof TextEncoder !== 'undefined' ? TextEncoder : (globalThis.TextEncoder || global.TextEncoder);
util.TextDecoder = typeof TextDecoder !== 'undefined' ? TextDecoder : (globalThis.TextDecoder || global.TextDecoder);

const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
    if (request === '@tensorflow/tfjs-node') {
        return originalResolveFilename.call(this, '@tensorflow/tfjs', parent, isMain);
    }
    return originalResolveFilename.apply(this, arguments);
};

const faceapi = require('@vladmandic/face-api');
const { Canvas, Image, ImageData } = require('canvas');

async function test() {
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
    const modelsUri = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
    console.log(`Loading from Github: ${modelsUri}`);
    
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelsUri);
        await faceapi.nets.ssdMobilenetv1.loadFromUri(modelsUri);
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelsUri);
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelsUri);
        console.log('✅ Models loaded successfully from Github!');
    } catch (err) {
        console.error('❌ Error loading from Github:', err);
    }
}

test();
