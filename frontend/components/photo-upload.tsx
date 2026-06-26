'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { photosApi } from '@/lib/api';
import { Camera, Loader2, Sparkles, CheckCircle, X, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  jobId: string;
  photos: any[];
}

export function PhotoUpload({ jobId, photos }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const [uploading, setUploading] = useState(false);
  const [dictation, setDictation] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [done, setDone] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => photosApi.delete(photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      setDone(false);
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: () => photosApi.analyzeAndGenerate(jobId, dictation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['photos', jobId] });
      queryClient.invalidateQueries({ queryKey: ['supply-items', jobId] });
      setDone(true);
    },
  });

  const handleFiles = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    setDone(false);
    try {
      for (let i = 0; i < files.length; i++) {
        await photosApi.upload(jobId, files[i], 'equipment');
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

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition ||
                              (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Use Chrome for voice input');
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let final = dictation ? dictation + ' ' : '';
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
        else interim += event.results[i][0].transcript;
      }
      setDictation(final + interim);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => { if (isRecording) recognition.start(); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const hasPhotos = photos.length > 0;
  const isAnalyzing = analyzeMutation.isPending;
  const canAnalyze = hasPhotos && !isAnalyzing && !done;

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

      {/* Photo thumbnails */}
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
              <button
                onClick={() => {
                  if (confirm('Remove this photo?')) deleteMutation.mutate(photo.photo_id);
                }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
              >
                <X size={10} />
              </button>
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
            <p className="text-sm text-[#1A6E45]">Uploading...</p>
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

      {/* Dictation box — shows once photos are uploaded */}
      {hasPhotos && !done && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-600">
              Notes for Claude (optional)
            </p>
            <button
              onClick={toggleMic}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                isRecording
                  ? 'bg-red-100 text-red-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isRecording ? <MicOff size={12} /> : <Mic size={12} />}
              {isRecording ? 'Stop' : 'Dictate'}
            </button>
          </div>
          <textarea
            value={dictation}
            onChange={e => setDictation(e.target.value)}
            placeholder="Customer wants full replacement, 2-ton unit, line set looks okay..."
            className="w-full p-3 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-[#1A6E45] min-h-[70px]"
          />
        </div>
      )}

      {/* Single analyze button */}
      {canAnalyze && (
        <Button
          className="w-full bg-[#1A6E45] hover:bg-[#145a38]"
          onClick={() => analyzeMutation.mutate()}
        >
          <Sparkles size={14} className="mr-2" />
          Analyze & Generate Supply List
        </Button>
      )}

      {/* Analyzing state */}
      {isAnalyzing && (
        <div className="w-full py-3 rounded-lg bg-[#E8F5EE] flex items-center justify-center gap-2">
          <Sparkles size={14} className="text-[#1A6E45] animate-pulse" />
          <span className="text-sm text-[#1A6E45] font-medium">
            Claude is reading the equipment and building your supply list...
          </span>
        </div>
      )}

      {/* Done */}
      {done && !isAnalyzing && (
        <div className="w-full py-2 rounded-lg bg-green-50 flex items-center justify-center gap-2">
          <CheckCircle size={14} className="text-green-600" />
          <span className="text-sm text-green-700 font-medium">
            Analysis and supply list ready — scroll down
          </span>
        </div>
      )}
    </div>
  );
}