import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { decryptData } from '@/lib/decryptBrowser';

// Helper functions for DRM
const hexToUint8Array = (hex) => {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return arr;
};

const uint8ArrayToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Extract KID from MPD
const extractKID = async (mpdUrl) => {
  try {
    const response = await fetch(`/api/proxy/kid?mpdUrl=${encodeURIComponent(mpdUrl)}`);
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || data.details || 'Failed to extract KID');
    }
    
    return data.kid;
  } catch (error) {
    console.error('KID extraction failed:', error);
    return null;
  }
};

const VideoPlayer = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL Parameters
  const videoId = searchParams.get('video_id');
  const subjectSlug = searchParams.get('subject_slug');
  const batchId = searchParams.get('batch_id');
  const subjectId = searchParams.get('subject_id');

  // Refs
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const uiRef = useRef(null);
  const queryParamsRef = useRef({ queryParams: '' });
  const qualityLockRef = useRef(false);
  const savedQualityRef = useRef(null);
  const isChangingQualityRef = useRef(false);

  // State
  const [errorMessage, setErrorMessage] = useState(null);
  const [batchNotAvailable, setBatchNotAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Initialize video player
  const initializePlayer = useCallback(async () => {
    if (!videoId || !batchId || !videoRef.current) {
      setErrorMessage('Missing required video parameters.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setBatchNotAvailable(false);
    setLoadingStatus('Fetching video details...');
    setLoadingProgress(10);

    try {
      let videoUrl = null;

      // Try multiple API endpoints using local proxies
      try {
        const response = await fetch(`/api/proxy/get-url?batchId=${batchId}&childId=${videoId}&subjectId=${subjectId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data) && data.data.length > 0 && data.data[0].url) {
            videoUrl = data.data[0].url;
          }
        }
      } catch (error) {
        console.warn('/api/proxy/get-url failed, proceeding to fallbacks.', error);
      }

      setLoadingProgress(30);

      if (!videoUrl) {
        try {
          const response = await fetch(`/api/proxy/video?batchId=${batchId}&subjectId=${subjectSlug}&childId=${videoId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.data) {
              const decrypted = await decryptData(data.data);
              if (decrypted.success && decrypted.data?.url) {
                videoUrl = decrypted.data.signedUrl 
                  ? decrypted.data.url + decrypted.data.signedUrl 
                  : decrypted.data.url;
              }
            }
          }
        } catch (error) {
          console.warn('Fallback video API failed.', error);
        }
      }

      setLoadingProgress(50);

      if (!videoUrl) {
        try {
          const response = await fetch(`/api/proxy/videoplay?batchId=${batchId}&childId=${videoId}&subjectId=${subjectId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.data) && data.data.length > 0 && data.data[0].url) {
              if (data.data[0].type === 'youtube') {
                setErrorMessage('YouTube videos not supported');
                setIsLoading(false);
                return;
              }
              videoUrl = data.data[0].url;
            }
          }
        } catch (error) {
          console.warn('/api/proxy/videoplay failed', error);
        }
      }

      if (!videoUrl) {
        try {
          const response = await fetch(`/api/proxy/get-urls?batchId=${batchId}&childId=${videoId}&subjectId=${subjectId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.data) && data.data.length > 0 && data.data[0].url) {
              if (data.data[0].type === 'youtube') {
                setErrorMessage('YouTube videos not supported');
                setIsLoading(false);
                return;
              }
              videoUrl = data.data[0].url;
            }
          }
        } catch (error) {
          console.warn('/api/proxy/get-urls failed', error);
        }
      }

      setLoadingProgress(50);

      if (!videoUrl) {
        setBatchNotAvailable(true);
        setIsLoading(false);
        return;
      }

      // Extract query params
      const urlParts = videoUrl.split('?');
      if (urlParts.length > 1) {
        queryParamsRef.current.queryParams = '?' + urlParts[1];
      }

      setLoadingStatus('Fetching decryption keys...');
      setLoadingProgress(75);

      // Get KID and OTP key
      const mpdUrl = urlParts[0].replace(/\.m3u8/i, '.mpd') + queryParamsRef.current.queryParams;
      const kid = await extractKID(mpdUrl);

      if (!kid) {
        throw new Error('Could not extract Key ID (KID) from video manifest.');
      }

      const otpResponse = await fetch(`/api/proxy/otp?kid=${kid}`);
      if (!otpResponse.ok) {
        throw new Error(`Failed to fetch decryption key (status: ${otpResponse.status})`);
      }

      const otpData = await otpResponse.json();
      if (!otpData.success || !otpData.key) {
        throw new Error(otpData.error || 'Invalid key data received from API.');
      }

      const decryptionKey = otpData.key;

      setLoadingProgress(85);
      setLoadingStatus('Initializing player...');
      setLoadingProgress(90);

      // Load Shaka Player
      const shaka = await import('shaka-player/dist/shaka-player.ui.js');
      await import('shaka-player/dist/controls.css');

      const videoElement = videoRef.current;
      const containerElement = containerRef.current;

      const player = new shaka.Player(videoElement);
      playerRef.current = player;

      const ui = new shaka.ui.Overlay(player, containerElement, videoElement);
      uiRef.current = ui;
      ui.getControls();

      // Configure player
      player.configure({
        abr: { enabled: false }
      });

      // Adaptation event for quality lock
      player.addEventListener('adaptation', () => {
        if (qualityLockRef.current && savedQualityRef.current && !isChangingQualityRef.current) {
          const tracks = player.getVariantTracks();
          const activeTrack = tracks.filter(t => t.active)[0];
          
          if (activeTrack?.height !== savedQualityRef.current) {
            const targetTrack = tracks.find(t => t.height === savedQualityRef.current);
            if (targetTrack) {
              isChangingQualityRef.current = true;
              player.selectVariantTrack(targetTrack, true);
              setTimeout(() => {
                isChangingQualityRef.current = false;
              }, 100);
            }
          }
        }
      });

      // Error handling
      player.addEventListener('error', (event) => {
        console.error('Shaka Player Error:', event.detail);
      });

      // Request filter
      player.getNetworkingEngine().registerRequestFilter((type, request) => {
        request.headers['Referer'] = 'https://www.pw.live/';
        
        if (type === shaka.net.NetworkingEngine.RequestType.SEGMENT || 
            type === shaka.net.NetworkingEngine.RequestType.MANIFEST) {
          if (!request.uris[0].includes('?')) {
            request.uris[0] += queryParamsRef.current.queryParams;
          }
        }
      });

      // Response filter to inject key
      player.getNetworkingEngine().registerResponseFilter((type, response) => {
        if (type === shaka.net.NetworkingEngine.RequestType.MANIFEST) {
          const manifestText = new TextDecoder().decode(response.data);
          const keyLineMatch = manifestText.match(/(#EXT-X-KEY:.*)/);
          
          if (keyLineMatch && keyLineMatch[0]) {
            const originalKeyLine = keyLineMatch[0];
            const keyDataUri = `data:application/octet-stream;base64,${uint8ArrayToBase64(hexToUint8Array(decryptionKey).buffer)}`;
            const modifiedKeyLine = originalKeyLine
              .replace(/URI="[^"]*"/, `URI="${keyDataUri}"`)
              .replace(/,IV=0x[0-9a-fA-F]+/, '');
            
            const modifiedManifest = manifestText.replace(originalKeyLine, modifiedKeyLine);
            response.data = new TextEncoder().encode(modifiedManifest);
          }
        }
      });

      // Determine the correct URL format to load
      // If original URL is MPD, try M3U8 first (fallback to MPD if needed)
      // If original URL is M3U8, use M3U8
      let playbackUrl = videoUrl;
      const isMpdUrl = videoUrl.toLowerCase().includes('.mpd');
      
      if (isMpdUrl) {
        // Try M3U8 version first for better compatibility
        playbackUrl = videoUrl.replace(/\.mpd/i, '.m3u8');
      }
      
      try {
        await player.load(playbackUrl);
      } catch (error) {
        // If M3U8 fails and we have an MPD URL, try loading MPD directly
        if (isMpdUrl && playbackUrl.includes('.m3u8')) {
          console.warn('M3U8 failed, trying MPD format:', error);
          playbackUrl = videoUrl; // Use original MPD URL
          await player.load(playbackUrl);
        } else {
          throw error;
        }
      }

      // Restore quality preference
      try {
        const savedQuality = localStorage.getItem('videoQualityPreference');
        if (savedQuality) {
          const targetHeight = parseInt(savedQuality, 10);
          savedQualityRef.current = targetHeight;
          qualityLockRef.current = true;
          player.configure({ abr: { enabled: false } });

          const trySetQuality = () => {
            const tracks = player.getVariantTracks();
            const targetTrack = tracks.find(t => t.height === targetHeight);
            if (targetTrack) {
              isChangingQualityRef.current = true;
              player.selectVariantTrack(targetTrack, true);
              setTimeout(() => {
                isChangingQualityRef.current = false;
              }, 100);
              return true;
            }
            return false;
          };

          if (!trySetQuality()) {
            let attempts = 0;
            const interval = setInterval(() => {
              if (trySetQuality() || attempts++ > 5) {
                clearInterval(interval);
              }
            }, 500);
          }
        }
      } catch (error) {
        console.warn('Failed to restore quality from storage', error);
      }

      setIsLoading(false);
      setLoadingProgress(100);
      
      videoElement.play().catch(() => {
        console.log('Autoplay was prevented.');
      });

    } catch (error) {
      console.error('Player initialization failed:', error);
      setErrorMessage(error.message || 'An unknown error occurred during setup.');
      setIsLoading(false);
      setLoadingProgress(0);
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      if (uiRef.current) {
        uiRef.current.destroy();
      }
    };
  }, [videoId, batchId, subjectSlug, subjectId]);

  useEffect(() => {
    const cleanup = initializePlayer();
    return () => {
      cleanup.then(cleanupFn => {
        if (cleanupFn) cleanupFn();
      });
    };
  }, [initializePlayer]);

  return (
    <div ref={containerRef} className="video-container">
      {/* Download button overlay */}
      {!isLoading && !errorMessage && !batchNotAvailable && (
        <button
          onClick={() => {
            // Pass current video params to download page
            const params = new URLSearchParams();
            if (videoId) params.set('video_id', videoId);
            if (batchId) params.set('batch_id', batchId);
            if (subjectId) params.set('subject_id', subjectId);
            if (subjectSlug) params.set('subject_slug', subjectSlug);
            const titleParam = searchParams.get('title');
            if (titleParam) params.set('title', titleParam);
            window.location.href = `/download?${params.toString()}`;
          }}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(90,75,218,0.9)',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            color: '#fff',
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 700,
            backdropFilter: 'blur(4px)',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 13v8m0 0-4-4m4 4 4-4M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284"/>
          </svg>
          Download
        </button>
      )}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 z-10"
          >
            <div className="spinner" />
            <p className="text-white mt-2">{loadingStatus}</p>
            <div className="w-48 bg-gray-600 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-white h-1.5 rounded-full" 
                style={{ 
                  width: `${loadingProgress}%`, 
                  transition: 'width 0.5s ease-in-out' 
                }} 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <video
        ref={videoRef}
        playsInline
        autoPlay
        style={{ width: '100%', height: '100%' }}
      />

      {!isLoading && (errorMessage || batchNotAvailable) && (
        batchNotAvailable ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm z-20 p-4"
          >
            <div className="text-center max-w-md">
              <div className="bg-amber-500/10 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-amber-500" />
              </div>
              <h2 className="font-bold text-xl mb-2 text-white">Batch Not Available</h2>
              <p className="text-sm text-gray-300 mb-2">This batch isn't available on our site yet.</p>
              <p className="text-sm text-gray-400 mb-6">If you have purchased this batch, please contact admin on Telegram to donate it.</p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/donate')}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded font-semibold"
                >
                  <svg className="w-4 h-4 mr-2 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 12 20 22 4 22 4 12"/>
                    <rect x="2" y="7" width="20" height="5"/>
                    <line x1="12" y1="22" x2="12" y2="7"/>
                    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                  </svg>
                  Donate This Batch
                </button>
                <button
                  onClick={() => alert('Please go to Telegram and DM the admin to donate this batch. Donating is safe and helps everyone!')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
                >
                  Contact Admin
                </button>
                <p className="text-xs text-gray-500">Go to Telegram and DM admin. Donating a batch is safe and harmless to your account.</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm z-20"
          >
            <div className="text-center p-8 max-w-md">
              <div className="bg-red-500/10 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-red-500" />
              </div>
              <h2 className="font-bold text-xl mb-2 text-white">Playback Error</h2>
              <p className="text-sm text-gray-400 mb-6">{errorMessage}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
              >
                Try Again
              </button>
            </div>
          </motion.div>
        )
      )}

      <style jsx>{`
        body {
          margin: 0;
          background: #000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
        }
        .video-container {
          width: 100vw;
          height: 100vh;
          position: relative;
          overflow: hidden;
        }
        video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
        }
        .spinner {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: conic-gradient(#0000 10%, #fff);
          mask: radial-gradient(farthest-side, #0000 calc(100% - 9px), #000 0);
          animation: spin 1s infinite linear;
        }
        @keyframes spin {
          to {
            transform: rotate(1turn);
          }
        }
      `}</style>
    </div>
  );
};

export default function PlayerPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="spinner" />
      </div>
    }>
      <VideoPlayer />
    </Suspense>
  );
}
