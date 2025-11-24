import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ImageData } from '../types';

// Declare faceapi globally as it's loaded via script tag
declare const faceapi: any;

interface CameraCaptureProps {
  onCapture: (data: ImageData) => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [error, setError] = useState<string>('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  // Load Face API Models
  useEffect(() => {
    const loadModels = async () => {
      try {
        if (typeof faceapi === 'undefined') {
          console.warn("face-api.js not loaded yet");
          return;
        }
        // Load from a reliable CDN source for models
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        // Optional: Load landmark models if we wanted precise points, but detector is enough for a box
        setModelsLoaded(true);
        console.log("Face API models loaded");
      } catch (err) {
        console.error("Failed to load face models:", err);
        // Don't block the app, just disable detection features
      }
    };
    loadModels();
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setIsStreamActive(true);
      setError('');
    } catch (err) {
      setError('Unable to access camera. Please ensure permissions are granted.');
      console.error(err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreamActive(false);
    setFaceDetected(false);
  }, []);

  // Attach stream
  useEffect(() => {
    if (isStreamActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isStreamActive]);

  // Face Detection Loop
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const detectFace = async () => {
      if (!isStreamActive || !videoRef.current || !overlayRef.current || !modelsLoaded) return;

      const video = videoRef.current;
      const canvas = overlayRef.current;
      
      // Only detect if video is playing and has dimensions
      if (video.paused || video.ended || video.videoWidth === 0) return;

      // Match overlay to video dimensions
      const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
      faceapi.matchDimensions(canvas, displaySize);

      // Detect
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      // Draw
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Flip context for mirror effect to match video
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);

        if (resizedDetections.length > 0) {
          setFaceDetected(true);
          resizedDetections.forEach((det: any) => {
            const { x, y, width, height } = det.box;
            
            // Draw "Protection" Mask visualization
            ctx.strokeStyle = '#4ade80'; // Green-400
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            
            ctx.fillStyle = 'rgba(74, 222, 128, 0.2)';
            ctx.fillRect(x, y, width, height);
            
            // Label
            ctx.fillStyle = '#4ade80';
            ctx.font = '14px Inter';
            ctx.fillText('Face Protected', x, y - 5);
          });
        } else {
          setFaceDetected(false);
        }
        ctx.restore();
      }
    };

    if (isStreamActive && modelsLoaded) {
      intervalId = setInterval(detectFace, 100); // Run every 100ms
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isStreamActive, modelsLoaded]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Optional: Draw the "Protection" box onto the final image if desired?
        // For now, we keep the image clean for the AI, but we pass the confidence via UI.
        
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        
        onCapture({
          base64,
          mimeType: 'image/png',
          previewUrl: dataUrl
        });
        stopCamera();
      }
    }
  }, [onCapture, stopCamera]);

  return (
    <div className="flex flex-col items-center gap-4">
      {error && <div className="text-red-400 text-sm bg-red-500/10 p-2 rounded w-full text-center">{error}</div>}
      
      <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-700 group">
        {!isStreamActive ? (
          <div className="text-center space-y-3">
             <button 
              onClick={startCamera}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-2 transition-colors border border-slate-600 mx-auto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              Access Camera
            </button>
            {!modelsLoaded && <p className="text-xs text-slate-500 animate-pulse">Loading Face Detection...</p>}
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover transform -scale-x-100" 
            />
            {/* Overlay Canvas for Face Box */}
            <canvas 
              ref={overlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
            
            {faceDetected && (
               <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-500/90 text-black text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-in fade-in">
                 Face Identity Protected
               </div>
            )}
          </>
        )}
      </div>
      
      {/* Hidden canvas for capturing the final image */}
      <canvas ref={canvasRef} className="hidden" />

      {isStreamActive && (
        <button 
          onClick={takePhoto}
          className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          aria-label="Take photo"
        >
          <div className="w-12 h-12 bg-red-500 rounded-full"></div>
        </button>
      )}
    </div>
  );
};
