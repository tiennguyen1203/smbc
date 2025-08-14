import React, { useState, useEffect } from 'react';
import VideoUpload from './VideoUpload';
import ChunkedVideoUpload from './ChunkedVideoUpload';

interface SmartVideoUploadProps {
  onUploadSuccess?: () => void;
  onCancel?: () => void;
  forceChunkedUpload?: boolean;
  chunkThreshold?: number; // File size threshold in bytes for chunked upload
}

const SmartVideoUpload: React.FC<SmartVideoUploadProps> = ({
  onUploadSuccess,
  onCancel,
  forceChunkedUpload = false,
  chunkThreshold = 100 * 1024 * 1024, // 100MB default
}) => {
  const [useChunkedUpload, setUseChunkedUpload] = useState(forceChunkedUpload);

  useEffect(() => {
    if (forceChunkedUpload) {
      setUseChunkedUpload(true);
    }
  }, [forceChunkedUpload]);

  return (
    <ChunkedVideoUpload
      onUploadSuccess={onUploadSuccess}
      onCancel={onCancel}
    />
  );
};

export default SmartVideoUpload;
