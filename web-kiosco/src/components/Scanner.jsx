import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import '../App.css';
import { API_URL } from '../config';

// Estados de la máquina de detección de vida (Liveness por Giro de Cabeza)
const STATE_CALIBRATING = 0;      // Calibra la posición central de la cara
const STATE_WAITING_TURN = 1;      // Espera un giro a la izquierda o derecha
const STATE_WAITING_CENTER = 2;    // Espera a que regrese al centro
const STATE_VERIFIED = 3;          // Liveness confirmado, ejecuta escaneo láser

export default function Scanner({ onNavigate }) {
  // Configuración de API
  const [apiUrl, setApiUrl] = useState(() => {
    return localStorage.getItem('kiosco_api_url') || API_URL || window.location.origin;
  });

  // Estados de IA, Cámara y Liveness
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Iniciando sistema...');
  const [statusSubtext, setStatusSubtext] = useState('');
  
  // Estados para renderizado visual del indicador de orientación
  const [currentState, setCurrentState] = useState(STATE_CALIBRATING);
  const [headRatio, setHeadRatio] = useState(1.0); // Ratio actual del rostro
  const [centerRatio, setCenterRatio] = useState(1.0); // Ratio central calibrado
  const [alignmentProgress, setAlignmentProgress] = useState(0); // Progreso de barra
  const [turnDirection, setTurnDirection] = useState(''); // 'left', 'right', o ''
  
  // Control de escaneo y flujo
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Feedback Modal
  const [feedback, setFeedback] = useState(null); // { success: true/false, title: '', message: '' }

  const webcamRef = useRef(null);
  const loopRef = useRef(null);
  
  // Refs para cálculo rápido en el requestAnimationFrame sin demoras de estado
  const stateRef = useRef(STATE_CALIBRATING);
  const calibrationFrames = useRef([]);
  const calibratedCenterRatio = useRef(1.0);
  const faceDetectedTime = useRef(null);
  const currentDescriptor = useRef(null);

  // 1. Cargar modelos de face-api.js al montar la app
  useEffect(() => {
    const loadModels = async () => {
      try {
        setStatusMessage('Cargando modelos de IA...');
        setStatusSubtext('Descargando redes neuronales desde internet...');
        const MODEL_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
        
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        
        setModelsLoaded(true);
        setStatusMessage('Colócate frente a la cámara');
        setStatusSubtext('Por favor, ubica tu rostro dentro del marco');
      } catch (err) {
        console.error("Error al cargar modelos de face-api:", err);
        setStatusMessage('Error al cargar la IA ❌');
        setStatusSubtext('Verifica tu conexión a internet o la consola.');
      }
    };
    loadModels();
  }, []);

  // Distancia Euclidiana 2D
  const getDistance = (p1, p2) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  // 3. Loop principal de detección facial y liveness por Giro de Cabeza
  useEffect(() => {
    if (!modelsLoaded || isProcessing || feedback) {
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
        loopRef.current = null;
      }
      return;
    }

    const runDetection = async () => {
      if (!webcamRef.current) {
        loopRef.current = requestAnimationFrame(runDetection);
        return;
      }

      const video = webcamRef.current.video;
      if (!video || video.readyState !== 4) {
        loopRef.current = requestAnimationFrame(runDetection);
        return;
      }

      try {
        const detection = await faceapi.detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })
        ).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
          // Rostro perdido, reseteamos liveness a calibración
          stateRef.current = STATE_CALIBRATING;
          setCurrentState(STATE_CALIBRATING);
          calibrationFrames.current = [];
          
          setStatusMessage('Colócate frente a la cámara');
          setStatusSubtext('Ajusta tu rostro dentro del círculo');
          setAlignmentProgress(0);
          setHeadRatio(1.0);
          setTurnDirection('');
          currentDescriptor.current = null;
        } else {
          // Rostro detectado
          currentDescriptor.current = detection.descriptor;
          const landmarks = detection.landmarks;
          
          // Medir la distancia de la punta de la nariz (index 30) a los bordes laterales del contorno (index 0 y 16)
          const noseTip = landmarks.getNose()[3];
          const jawLeft = landmarks.getJawOutline()[0];
          const jawRight = landmarks.getJawOutline()[16];

          const leftDist = getDistance(noseTip, jawLeft);
          const rightDist = getDistance(noseTip, jawRight);
          
          const ratio = leftDist / rightDist;
          setHeadRatio(ratio);

          // Máquina de estados de giro de cabeza (Anti-Fraude 3D)
          switch (stateRef.current) {
            case STATE_CALIBRATING:
              setStatusMessage('Calibrando posición central...');
              setStatusSubtext('Mira fijamente al centro de la pantalla... ⊙');
              calibrationFrames.current.push(ratio);
              setAlignmentProgress((calibrationFrames.current.length / 5) * 100);

              if (calibrationFrames.current.length >= 5) {
                const sum = calibrationFrames.current.reduce((a, b) => a + b, 0);
                calibratedCenterRatio.current = sum / calibrationFrames.current.length;
                setCenterRatio(calibratedCenterRatio.current);

                stateRef.current = STATE_WAITING_TURN;
                setCurrentState(STATE_WAITING_TURN);
                calibrationFrames.current = [];
                setAlignmentProgress(0);
              }
              break;

            case STATE_WAITING_TURN:
              setStatusMessage('¡Verificación de vida activa!');
              setStatusSubtext('Gira la cabeza levemente a la IZQUIERDA o DERECHA ⟲ ⟳');
              
              if (ratio < calibratedCenterRatio.current - 0.28) {
                setTurnDirection('left');
                stateRef.current = STATE_WAITING_CENTER;
                setCurrentState(STATE_WAITING_CENTER);
              } else if (ratio > calibratedCenterRatio.current + 0.28) {
                setTurnDirection('right');
                stateRef.current = STATE_WAITING_CENTER;
                setCurrentState(STATE_WAITING_CENTER);
              }
              break;

            case STATE_WAITING_CENTER:
              setStatusMessage('¡Movimiento Detectado! ✓');
              setStatusSubtext('Ahora regresa la cabeza al CENTRO para escanear ⊙');
              
              if (Math.abs(ratio - calibratedCenterRatio.current) < 0.12) {
                stateRef.current = STATE_VERIFIED;
                setCurrentState(STATE_VERIFIED);
                faceDetectedTime.current = Date.now(); // Iniciar animación láser
              }
              break;

            case STATE_VERIFIED:
              const elapsed = Date.now() - faceDetectedTime.current;
              const progressPercent = Math.min((elapsed / 1000) * 100, 100); // 1.0 segundo de escaneo
              
              setAlignmentProgress(progressPercent);
              setStatusMessage('¡Liveness Confirmado! Escaneando...');
              setStatusSubtext('Registrando asistencia...');
              setIsScanning(true);

              if (progressPercent >= 100) {
                cancelAnimationFrame(loopRef.current);
                loopRef.current = null;
                handleScanSuccess(detection.descriptor);
                return;
              }
              break;
            
            default:
              stateRef.current = STATE_CALIBRATING;
              setCurrentState(STATE_CALIBRATING);
          }
        }
      } catch (err) {
        console.error("Error en loop de liveness:", err);
      }

      loopRef.current = requestAnimationFrame(runDetection);
    };

    loopRef.current = requestAnimationFrame(runDetection);

    return () => {
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
      }
    };
  }, [modelsLoaded, isProcessing, feedback, apiUrl]);

  // 4. Procesar registro de asistencia (mandar al backend)
  const handleScanSuccess = async (descriptorFloat32) => {
    setIsProcessing(true);
    setIsScanning(true);
    setStatusMessage('¡Rostro Capturado!');
    setStatusSubtext('Enviando datos biométricos al servidor...');

    const descriptorArray = Array.from(descriptorFloat32);

    try {
      const response = await fetch(`${apiUrl}/api/asistencia/checar-temporal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          empresa_id: 1, // default company ID
          descriptor: descriptorArray
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setFeedback({
          success: true,
          title: data.tipo === 'ENTRADA' ? '¡Bienvenido!' : '¡Turno Finalizado!',
          message: data.message
        });
      } else {
        setFeedback({
          success: false,
          title: 'Acceso Denegado',
          message: data.error || 'Rostro no coincide en el sistema.'
        });
      }
    } catch (err) {
      console.error("Error al enviar asistencia:", err);
      setFeedback({
        success: false,
        title: 'Error de Conexión',
        message: 'No se pudo conectar con el servidor de asistencia.'
      });
    } finally {
      setTimeout(() => {
        setFeedback(null);
        setIsProcessing(false);
        setIsScanning(false);
        stateRef.current = STATE_CALIBRATING;
        setCurrentState(STATE_CALIBRATING);
        faceDetectedTime.current = null;
        currentDescriptor.current = null;
        setAlignmentProgress(0);
        setTurnDirection('');
      }, 3500);
    }
  };

  const getOrientationPercent = () => {
    const diff = headRatio - centerRatio;
    const pct = 50 + diff * 80;
    return Math.max(0, Math.min(100, pct));
  };

  return (
    <div className="kiosco-app">
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
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Dashboard</span>
          </button>
          <button className="nav-btn btn-salir" onClick={() => onNavigate('/')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Salir</span>
          </button>
        </div>
      </nav>

      <div className="kiosco-layout">
        {!feedback ? (
          <div className="kiosco-card">
            <div className="webcam-container">
              {modelsLoaded && (
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{
                    facingMode: "user",
                    width: { ideal: 640 },
                    height: { ideal: 800 }
                  }}
                  className="webcam-feed"
                />
              )}
              
              <div className="webcam-overlay">
                <div className={`face-cutout ${isScanning ? 'scanning' : currentState > STATE_CALIBRATING ? 'liveness-ready' : ''}`}>
                  {isScanning && <div className="laser-scan-line" />}
                </div>
              </div>
            </div>

            <div className="status-box">
              {isProcessing && <div className="spinner" />}
              <p className="status-text">{statusMessage}</p>
              <p className="status-subtext">{statusSubtext}</p>

              {modelsLoaded && !isProcessing && (
                <div style={{ width: '240px', marginTop: '12px', position: 'relative' }}>
                  {currentState === STATE_CALIBRATING || currentState === STATE_VERIFIED ? (
                    <div>
                      <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                        {currentState === STATE_CALIBRATING ? 'Calibrando Rostro...' : 'Progreso de Escaneo'}
                      </span>
                      <div className="ear-indicator-container">
                        <div 
                          className="ear-indicator-bar" 
                          style={{ 
                            width: `${alignmentProgress}%`,
                            backgroundColor: currentState === STATE_VERIFIED ? '#10b981' : '#3b82f6'
                          }} 
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
                        <span>Indicador de Giro</span>
                        <span style={{ fontWeight: 'bold', color: currentState === STATE_WAITING_CENTER ? '#10b981' : '#3b82f6' }}>
                          {currentState === STATE_WAITING_CENTER ? '¡Giro Correcto! ✓' : 'Esperando Giro...'}
                        </span>
                      </div>
                      <div className="ear-indicator-container" style={{ position: 'relative', overflow: 'visible', background: '#e2e8f0' }}>
                        <div style={{ position: 'absolute', top: '-2px', bottom: '-2px', left: '22%', width: '2px', backgroundColor: 'rgba(0,0,0,0.15)', borderStyle: 'dashed', borderWidth: '1px' }} />
                        <div style={{ position: 'absolute', top: '-2px', bottom: '-2px', left: '78%', width: '2px', backgroundColor: 'rgba(0,0,0,0.15)', borderStyle: 'dashed', borderWidth: '1px' }} />
                        
                        <div 
                          style={{ 
                            position: 'absolute',
                            top: '0',
                            bottom: '0',
                            left: `${getOrientationPercent() - 5}%`,
                            width: '10%',
                            backgroundColor: currentState === STATE_WAITING_CENTER ? '#10b981' : '#3b82f6',
                            borderRadius: '10px',
                            boxShadow: currentState === STATE_WAITING_CENTER ? '0 0 8px #10b981' : '0 0 8px rgba(59, 130, 246, 0.4)',
                            transition: 'left 0.05s ease-out'
                          }} 
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', marginTop: '4px' }}>
                        <span>IZQ</span>
                        <span>CENTRO</span>
                        <span>DER</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`feedback-card ${feedback.success ? 'success' : 'error'}`}>
            <div className="feedback-icon">
              {feedback.success ? '✓' : '✗'}
            </div>
            <h2 className="feedback-title">{feedback.title}</h2>
            <p className="feedback-message">{feedback.message}</p>
          </div>
        )}

        <div className="kiosco-footer">
          Powered by face-api.js &bull; Client-Side Biometrics &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
