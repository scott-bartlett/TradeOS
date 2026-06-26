'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { photosApi } from '@/lib/api';
import { Camera, Upload, Loader2, Sparkles, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  jobId: string;
  photos: any[];
}

export function PhotoUpload({ jobId, photos }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [analyzed, setAnalyzed] = useState(false);

  const analyzeMutation = useMutation({
    mutationFn: () => photosApi.analyze(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['photos', jobId] });
      setAnalyzed(true);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => photosApi.delete(photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      setAnalyzed(false);
    },
  });

  const handleFiles = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    setUploadedCount(0);
    setAnalyzed(false);

    try {
      for (let i = 0; i < files.length; i++) {
        await photosApi.upload(jobId, files[i], 'equipment');
        setUploadedCount(i + 1);
      }
      queryClient.invalidateQueries({ queryKey: ['photos', jobId] });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const isAnalyzing = analyzeMutation.isPending;
  const hasPhotos = photos.length > 0;
  const unanalayzed = photos.filter(p => !p.ai_analyzed).length;

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />

      {/* Photo thumbnails with delete */}
      {hasPhotos && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo: any) => (
            <div key={photo.photo_id} className="relative group aspect-square">
              <a
                href={photo.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-full rounded-lg bg-gray-100 overflow-hidden hover:opacity-90 transition-opacity"
              >
                <img
                  src={photo.public_url}
                  alt="Job photo"
                  className="w-full h-full object-cover"
                />
              </a>
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (confirm('Remove this photo?')) {
                    deleteMutation.mutate(photo.photo_id);
                  }
                }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
              >
                <X size={10} />
              </button>
              {/* Analyzed badge */}
              {photo.ai_analyzed && (
                <div className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-[#1A6E45] flex items-center justify-center">
                  <CheckCircle size={10} className="text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => !uploading && !isAnalyzing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
          uploading
            ? 'border-[#A8D5BC] bg-[#E8F5EE] cursor-wait'
            : 'border-gray-200 hover:border-[#1A6E45] hover:bg-[#E8F5EE]'
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="text-[#1A6E45] animate-spin" />
            <p className="text-sm text-[#1A6E45]">Uploading {uploadedCount} photo{uploadedCount !== 1 ? 's' : ''}...</p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Camera size={16} className="text-gray-400" />
            <p className="text-sm text-gray-500">
              {hasPhotos ? 'Add more photos' : 'Tap to upload photos'}
            </p>
          </div>
        )}
      </div>

      {/* Analyze button — only shows when there are unanalyzed photos */}
      {hasPhotos && unanalayzed > 0 && !isAnalyzing && (
        <Button
          className="w-full bg-[#1A6E45] hover:bg-[#145a38]"
          onClick={() => analyzeMutation.mutate()}
        >
          <Sparkles size={14} className="mr-2" />
          Analyze with AI ({unanalayzed} photo{unanalayzed !== 1 ? 's' : ''})
        </Button>
      )}

      {/* Analyzing state */}
      {isAnalyzing && (
        <div className="w-full py-3 rounded-lg bg-[#E8F5EE] flex items-center justify-center gap-2">
          <Sparkles size={14} className="text-[#1A6E45] animate-pulse" />
          <span className="text-sm text-[#1A6E45] font-medium">Claude is reading the equipment...</span>
        </div>
      )}

      {/* Done state */}
      {analyzed && !isAnalyzing && (
        <div className="w-full py-2 rounded-lg bg-green-50 flex items-center justify-center gap-2">
          <CheckCircle size={14} className="text-green-600" />
          <span className="text-sm text-green-700 font-medium">Analysis complete — scroll down to see results</span>
        </div>
      )}
    </div>
  );
}