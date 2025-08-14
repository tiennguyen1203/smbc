import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, RotateCcw } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  onTimeUpdate,
  onEnded,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = useCallback(async () => {
    if (!videoRef.current || isLoading) return;

    try {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Error toggling play:', error);
      setError('Playback error occurred');
    }
  }, [isPlaying, isLoading]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  }, [isMuted]);

  const toggleFullscreen = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (isFullscreen) {
        await document.exitFullscreen();
      } else {
        await videoRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, [isFullscreen]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    
    const newVolume = parseFloat(e.target.value);
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    
    if (newVolume === 0 && !isMuted) {
      setIsMuted(true);
    } else if (newVolume > 0 && isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  }, [isMuted]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    const timeout = setTimeout(() => setShowControls(false), 3000);
    setControlsTimeout(timeout);
  }, [controlsTimeout]);

  const resetVideo = useCallback(() => {
    if (!videoRef.current) return;
    
    videoRef.current.currentTime = 0;
    setCurrentTime(0);
    if (isPlaying) {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded');
      setDuration(video.duration || 0);
      setIsLoading(false);
      setError(null);
    };

    const handleTimeUpdate = () => {
      const time = video.currentTime || 0;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    };

    const handlePlay = () => {
      console.log('Video playing');
      setIsPlaying(true);
    };

    const handlePause = () => {
      console.log('Video paused');
      setIsPlaying(false);
    };

    const handleEnded = () => {
      console.log('Video ended');
      setIsPlaying(false);
      onEnded?.();
    };

    const handleError = (e: Event) => {
      console.error('Video error:', e);
      setError('Failed to load video');
      setIsLoading(false);
    };

    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('volumechange', handleVolumeChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    if (video.readyState >= 1) {
      handleLoadedMetadata();
    } else {
      setIsLoading(true);
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('volumechange', handleVolumeChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [onTimeUpdate, onEnded]);

  useEffect(() => {
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [controlsTimeout]);

  if (error) {
    return (
      <div className={`bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded ${className}`}>
        <p>Error: {error}</p>
        <p className="text-sm">Source: {src}</p>
        <div className="mt-4">
          <p className="text-sm mb-2">Fallback native video player:</p>
          <video
            controls
            className="w-full"
            style={{ minHeight: '300px' }}
            src={src}
            poster={poster}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative bg-black rounded-lg overflow-hidden ${className}`}
      style={{ minHeight: '400px' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}
      
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        style={{ minHeight: '300px' }}
        src={src}
        poster={poster}
        preload="metadata"
        crossOrigin="anonymous"
      />
      
      {showControls && !isLoading && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300">
          <div className="flex items-center space-x-4 mb-2">
            <button
              onClick={togglePlay}
              className="text-white hover:text-gray-300 transition-colors p-1"
              disabled={isLoading}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                disabled={isLoading}
              />
            </div>
            
            <span className="text-white text-sm min-w-[80px] text-right">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="text-white hover:text-gray-300 transition-colors p-1"
                disabled={isLoading}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                disabled={isLoading}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={resetVideo}
                className="text-white hover:text-gray-300 transition-colors p-1"
                disabled={isLoading}
              >
                <RotateCcw size={18} />
              </button>
              
              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-gray-300 transition-colors p-1"
                disabled={isLoading}
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }

        .slider::-webkit-slider-track {
          background: #4b5563;
          border-radius: 4px;
        }

        .slider::-moz-range-track {
          background: #4b5563;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;