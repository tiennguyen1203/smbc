import React, { useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Upload, X, Video, FileText, Tag, FolderOpen, 
  Pause, Play, RotateCcw, CheckCircle, AlertCircle,
  Clock, Zap, HardDrive
} from 'lucide-react';
import { ChunkedUploadService, UploadProgress } from '../services/uploadService';
import { CreateVideoData } from '../services/videoService';

interface ChunkedVideoUploadProps {
  onUploadSuccess?: () => void;
  onCancel?: () => void;
}

interface ChunkProgress {
  [chunkIndex: number]: number;
}

const ChunkedVideoUpload: React.FC<ChunkedVideoUploadProps> = ({ 
  onUploadSuccess, 
  onCancel 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [chunkProgress, setChunkProgress] = useState<ChunkProgress>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isThrottled, setIsThrottled] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [useChunkedUpload, setUseChunkedUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateVideoData>();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('video/')) {
        setSelectedFile(file);
        setUploadError(null);
        setUseChunkedUpload(file.size > 100 * 1024 * 1024);
      } else {
        setUploadError('Please select a valid video file');
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        setSelectedFile(file);
        setUploadError(null);
        setUseChunkedUpload(file.size > 100 * 1024 * 1024);
      } else {
        setUploadError('Please select a valid video file');
      }
    }
  }, []);

  const removeFile = useCallback(() => {
    setSelectedFile(null);
    setUploadError(null);
    setUploadProgress(null);
    setChunkProgress({});
    setSessionId(null);
    setUseChunkedUpload(false);
    setIsThrottled(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleUploadProgress = useCallback((progress: UploadProgress) => {
    setUploadProgress(progress);
    setIsThrottled(false);
  }, []);

  const handleChunkProgress = useCallback((chunkIndex: number, progress: number) => {
    setChunkProgress(prev => ({
      ...prev,
      [chunkIndex]: progress
    }));
  }, []);

  const pauseUpload = useCallback(async () => {
    setIsPaused(true);
  }, []);

  const resumeUpload = useCallback(async () => {
    if (sessionId) {
      try {
        await ChunkedUploadService.resumeUpload(sessionId);
        setIsPaused(false);
        setUploadError(null);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Failed to resume upload');
      }
    }
  }, [sessionId]);

  const cancelUpload = useCallback(async () => {
    if (sessionId) {
      try {
        await ChunkedUploadService.cancelUpload(sessionId);
        setIsUploading(false);
        setIsPaused(false);
        setUploadProgress(null);
        setChunkProgress({});
        setSessionId(null);
        setUploadError(null);
        setIsThrottled(false);
      } catch (error) {
        console.error('Failed to cancel upload:', error);
      }
    }
  }, [sessionId]);

  const onSubmit = async (data: CreateVideoData) => {
    if (!selectedFile) {
      setUploadError('Please select a video file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(null);
    setChunkProgress({});
    setUploadError(null);
    setIsPaused(false);

    try {
      if (useChunkedUpload) {
        const uploadSessionId = await ChunkedUploadService.uploadFileInChunks(
          selectedFile,
          {
            title: data.title,
            description: data.description || '',
            tags: data.tags || [],
            category: data.category || 'general',
          },
          handleUploadProgress,
          handleChunkProgress
        );
        
        setSessionId(uploadSessionId);
      } else {
        const { videoService } = await import('../services/videoService');
        
        const formData = new FormData();
        formData.append('video', selectedFile);
        formData.append('title', data.title);
        formData.append('description', data.description || '');
        if (data.tags && data.tags.length > 0) {
          formData.append('tags', data.tags.join(','));
        }
        if (data.category) {
          formData.append('category', data.category);
        }

        await videoService.uploadVideo(formData);
      }

      setTimeout(() => {
        reset();
        setSelectedFile(null);
        setIsUploading(false);
        setUploadProgress(null);
        setChunkProgress({});
        setSessionId(null);
        onUploadSuccess?.();
      }, 1000);
      
          } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        
        // Check if it's a rate limiting error
        if (errorMessage.includes('Rate limit exceeded') || errorMessage.includes('429')) {
          setIsThrottled(true);
          setUploadError('Upload is being throttled due to rate limiting. The system will automatically retry with delays.');
        } else {
          setUploadError(errorMessage);
        }
        
        setIsUploading(false);
        setUploadProgress(null);
        setChunkProgress({});
      }
  };

  const formatFileSize = (bytes: number): string => {
    return ChunkedUploadService.formatFileSize(bytes);
  };

  const formatTime = (seconds: number): string => {
    return ChunkedUploadService.formatTime(seconds);
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return ChunkedUploadService.formatSpeed(bytesPerSecond);
  };

  const getUploadStatusColor = () => {
    if (uploadProgress?.status === 'completed') return 'text-green-600';
    if (uploadProgress?.status === 'failed' || uploadError) return 'text-red-600';
    if (isPaused) return 'text-yellow-600';
    if (isThrottled) return 'text-orange-600';
    return 'text-blue-600';
  };

  const getUploadStatusIcon = () => {
    if (uploadProgress?.status === 'completed') return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (uploadProgress?.status === 'failed' || uploadError) return <AlertCircle className="h-5 w-5 text-red-600" />;
    if (isPaused) return <Pause className="h-5 w-5 text-yellow-600" />;
    if (isThrottled) return <Clock className="h-5 w-5 text-orange-600" />;
    return <Upload className="h-5 w-5 text-blue-600" />;
  };

  const getUploadStatusText = () => {
    if (uploadProgress?.status === 'completed') return 'Completed';
    if (uploadProgress?.status === 'failed') return 'Failed';
    if (uploadError && !isThrottled) return 'Failed';
    if (isPaused) return 'Paused';
    if (isThrottled) return 'Throttled - Slowing down to avoid rate limits';
    return 'Uploading';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Upload Video</h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {!selectedFile ? (
            <div>
              <Video className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop your video here or click to browse
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Supports MP4, AVI, MOV, WMV up to 5GB
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Upload className="h-4 w-4 mr-2" />
                Select Video
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-4">
                <Video className="h-8 w-8 text-primary-500" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Upload Method Selection */}
              {selectedFile.size > 100 * 1024 * 1024 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="chunked-upload"
                      checked={useChunkedUpload}
                      onChange={(e) => setUseChunkedUpload(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="chunked-upload" className="text-sm font-medium text-blue-800">
                      Use chunked upload (recommended for large files)
                    </label>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Chunked upload provides better reliability and resumable uploads for large files
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {isUploading && uploadProgress && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getUploadStatusIcon()}
                <span className={`font-medium ${getUploadStatusColor()}`}>
                  {getUploadStatusText()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {isUploading && uploadProgress.status !== 'completed' && (
                  <>
                    {!isPaused ? (
                      <button
                        type="button"
                        onClick={pauseUpload}
                        className="text-yellow-600 hover:text-yellow-700 transition-colors"
                      >
                        <Pause size={20} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={resumeUpload}
                        className="text-green-600 hover:text-green-700 transition-colors"
                      >
                        <Play size={20} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={cancelUpload}
                      className="text-red-600 hover:text-red-700 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Progress</span>
                <span>{Math.round(uploadProgress.progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.progress}%` }}
                />
              </div>
            </div>

            {/* Upload Stats */}
            {useChunkedUpload && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    {uploadProgress.uploadedChunks}/{uploadProgress.totalChunks} chunks
                  </span>
                </div>
                {uploadProgress.speed && (
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">
                      {formatSpeed(uploadProgress.speed)}
                    </span>
                  </div>
                )}
                {uploadProgress.timeRemaining && (
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">
                      {formatTime(uploadProgress.timeRemaining)} left
                    </span>
                  </div>
                )}
                {uploadProgress.currentChunk !== undefined && (
                  <div className="flex items-center space-x-2">
                    <Upload className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">
                      Chunk {uploadProgress.currentChunk + 1}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {uploadError && (
          <div className={`border rounded-md p-4 ${
            isThrottled 
              ? 'bg-orange-50 border-orange-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              {isThrottled ? (
                <Clock className="h-5 w-5 text-orange-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <p className={`text-sm ${
                isThrottled ? 'text-orange-600' : 'text-red-600'
              }`}>
                {uploadError}
              </p>
            </div>
            {isThrottled && (
              <p className="text-xs text-orange-500 mt-2">
                This is normal for large files. The system automatically adds delays between requests to respect server limits.
              </p>
            )}
            {sessionId && !isThrottled && (
              <button
                type="button"
                onClick={resumeUpload}
                className="mt-2 inline-flex items-center text-sm text-red-600 hover:text-red-700"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Retry Upload
              </button>
            )}
          </div>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="inline h-4 w-4 mr-1" />
              Title *
            </label>
            <input
              type="text"
              {...register('title', { required: 'Title is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter video title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FolderOpen className="inline h-4 w-4 mr-1" />
              Category
            </label>
            <select
              {...register('category')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select category</option>
              <option value="general">General</option>
              <option value="entertainment">Entertainment</option>
              <option value="education">Education</option>
              <option value="sports">Sports</option>
              <option value="news">News</option>
              <option value="music">Music</option>
              <option value="gaming">Gaming</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FileText className="inline h-4 w-4 mr-1" />
            Description
          </label>
          <textarea
            {...register('description')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            placeholder="Enter video description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Tag className="inline h-4 w-4 mr-1" />
            Tags
          </label>
          <input
            type="text"
            {...register('tags')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            placeholder="Enter tags separated by commas"
          />
        </div>

        <div className="flex justify-end space-x-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!selectedFile || isUploading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Upload Video'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChunkedVideoUpload;
