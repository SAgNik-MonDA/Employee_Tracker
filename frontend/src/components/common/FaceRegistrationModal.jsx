import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { loadFaceModels, getFaceDescriptor } from '../../utils/faceUtils';
import API from '../../api/axios';

const FaceRegistrationModal = ({ isOpen, onClose, onSuccess }) => {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setLoading(true);
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to access camera.');
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    
    setLoading(true);
    try {
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (!descriptor) {
        toast.error('Could not detect a clear face. Please try again.');
        setLoading(false);
        return;
      }

      await API.post('/auth/save-face', { faceDescriptor: descriptor });
      toast.success('Face authentication set up successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save face descriptor.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-surface-900 border border-surface-700/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        <div className="p-4 border-b border-surface-700/50 flex justify-between items-center bg-surface-800/30">
          <h3 className="font-display font-semibold text-surface-100">Set Up Face Authentication</h3>
          <button onClick={onClose} className="p-1 text-surface-400 hover:text-white hover:bg-surface-700 rounded-lg transition-colors">
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          <p className="text-sm text-surface-400 mb-4 text-center">
            Look directly at the camera and ensure your face is well-lit.
          </p>

          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-surface-700/50 shadow-inner">
            {loading && !cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-primary-400">
                <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mb-3"></div>
                <span className="text-sm font-medium animate-pulse">Initializing Camera & AI Models...</span>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${!cameraActive ? 'opacity-0' : 'opacity-100'}`}
              onPlay={() => setLoading(false)}
            />
          </div>

          <div className="w-full mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-sm text-surface-300 hover:bg-surface-700/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCapture}
              disabled={loading || !cameraActive}
              className="btn-primary"
            >
              {loading ? 'Processing...' : 'Capture & Save Face'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceRegistrationModal;
