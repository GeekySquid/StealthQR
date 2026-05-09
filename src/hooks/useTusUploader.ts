import { useState, useRef, useCallback } from "react";
import * as tus from "tus-js-client";

interface UseTusUploaderOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  bucketName: string;
  onCompleted?: () => void;
  onError?: (err: Error) => void;
}

export function useTusUploader({ supabaseUrl, supabaseAnonKey, bucketName, onCompleted, onError }: UseTusUploaderOptions) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [uploadSpeed, setUploadSpeed] = useState("");
  const [remainingTime, setRemainingTime] = useState("");
  const uploadRef = useRef<tus.Upload | null>(null);

  const startUpload = useCallback((file: File, objectName: string, additionalMetadata: Record<string, string> = {}) => {
    setIsUploading(true);
    setIsCompleted(false);
    setUploadProgress(0);

    const uploadEndpoint = `${supabaseUrl}/storage/v1/upload/resumable`;
    let lastBytesUploaded = 0;
    let lastTime = Date.now();

    const upload = new tus.Upload(file, {
      endpoint: uploadEndpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName,
        objectName,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        ...additionalMetadata,
      },
      chunkSize: 6 * 1024 * 1024, // 6MB chunks for large files
      onError: (error) => {
        console.error("Upload failed: " + error);
        setIsUploading(false);
        if (onError) onError(error);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = (bytesUploaded / bytesTotal) * 100;
        setUploadProgress(Math.round(percentage));

        const currentTime = Date.now();
        const timeElapsed = (currentTime - lastTime) / 1000;
        
        if (timeElapsed > 1) {
          const bytesDiff = bytesUploaded - lastBytesUploaded;
          const speedBps = bytesDiff / timeElapsed;
          
          if (speedBps > 1024 * 1024) {
             setUploadSpeed((speedBps / (1024 * 1024)).toFixed(2) + " MB/s");
          } else if (speedBps > 1024) {
             setUploadSpeed((speedBps / 1024).toFixed(2) + " KB/s");
          } else {
             setUploadSpeed(Math.round(speedBps) + " B/s");
          }

          const bytesRemaining = bytesTotal - bytesUploaded;
          const secondsRemaining = Math.max(0, bytesRemaining / speedBps);
          
          if (secondsRemaining > 60) {
            setRemainingTime(Math.round(secondsRemaining / 60) + " min left");
          } else {
            setRemainingTime(Math.round(secondsRemaining) + " sec left");
          }

          lastBytesUploaded = bytesUploaded;
          lastTime = currentTime;
        }
      },
      onSuccess: () => {
        setIsUploading(false);
        setIsCompleted(true);
        setUploadSpeed("");
        setRemainingTime("");
        if (onCompleted) onCompleted();
      },
    });

    uploadRef.current = upload;
    
    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    });
  }, [supabaseUrl, supabaseAnonKey, bucketName, onCompleted, onError]);

  const cancelUpload = useCallback(() => {
    if (uploadRef.current && isUploading) {
       uploadRef.current.abort();
       setIsUploading(false);
    }
  }, [isUploading]);

  const resetUploader = useCallback(() => {
    cancelUpload();
    setUploadProgress(0);
    setIsCompleted(false);
    setIsUploading(false);
    setUploadSpeed("");
    setRemainingTime("");
  }, [cancelUpload]);

  return {
    uploadProgress,
    isUploading,
    isCompleted,
    uploadSpeed,
    remainingTime,
    startUpload,
    cancelUpload,
    resetUploader
  };
}
