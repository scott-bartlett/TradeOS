'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Save, AlertTriangle, CheckCircle, Package, User } from 'lucide-react';

// Hardcoded for pilot — will come from auth in Phase 2
const MARCUS_ID = 'c262b631-9d86-4b86-8996-3c3d6ad5657c';
const CALLOWAY_JOB_ID = '4c72af88-c797-4f99-89d0-a2817f791737';

export default function FieldPage() {
  const queryClient = useQueryClient();
  const [isRecording, setIsRecording] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savedNotes, setSavedNotes] = useState<any[]>([]);
  const recognitionRef = useRef<any>(null);

  const { data: job } = useQuery({
    queryKey: ['job', CALLOWAY_JOB_ID],
    queryFn: () => jobsApi.get(CALLOWAY_JOB_ID),
  });

  const { data: fieldNotesData } = useQuery({
    queryKey: ['field-notes', CALLOWAY_JOB_ID],
    queryFn: () => jobsApi.getFieldNotes(CALLOWAY_JOB_ID),
  });

  const saveNoteMutation = useMutation({
    mutationFn: (text: string) => jobsApi.addFieldNote(CALLOWAY_JOB_ID, {
      note_text: text,
      tech_id: MARCUS_ID,
      note_type: 'dictation',
      client_uuid: crypto.randomUUID(),
      captured_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-notes', CALLOWAY_JOB_ID] });
      setNoteText('');
    },
  });

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || 
                              (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser');
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

    let finalTranscript = noteText ? noteText + ' ' : '';

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setNoteText(finalTranscript + interim);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => {
      if (isRecording) recognition.start();
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const saveNote = () => {
    if (!noteText.trim()) return;
    saveNoteMutation.mutate(noteText.trim());
  };

  const fieldNotes = fieldNotesData?.notes || [];
  const analysis = job?.ai_analysis;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-[#1A6E45] flex items-center justify-center">
            <User size={12} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Marcus — Field View</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{job?.title || 'Loading...'}</h1>
        <p className="text-sm text-gray-400">{job?.job_number}</p>
      </div>

      {/* MIC — always first, always prominent */}
      <Card className="mb-4 border-[#A8D5BC]">
        <CardContent className="pt-4">
          <button
            onClick={toggleMic}
            className={`w-full py-5 rounded-xl flex flex-col items-center gap-2 transition-all ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-[#1A6E45] text-white hover:bg-[#145a38]'
            }`}
          >
            {isRecording
              ? <MicOff size={28} />
              : <Mic size={28} />
            }
            <span className="text-sm font-bold">
              {isRecording ? 'Recording — tap to stop' : 'Tap to Record'}
            </span>
            {isRecording && (
              <span className="text-xs opacity-75">Listening...</span>
            )}
          </button>

          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Or type your note here..."
            className="w-full mt-3 p-3 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-[#1A6E45] min-h-[80px]"
          />

          <Button
            onClick={saveNote}
            disabled={!noteText.trim() || saveNoteMutation.isPending}
            className="w-full mt-2 bg-[#1A6E45] hover:bg-[#145a38]"
          >
            <Save size={14} className="mr-2" />
            {saveNoteMutation.isPending ? 'Saving...' : 'Save Note'}
          </Button>
        </CardContent>
      </Card>

      {/* Field Notes Log */}
      {fieldNotes.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Field Notes Today ({fieldNotes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fieldNotes.map((note: any) => (
                <div key={note.note_id} className="border-l-2 border-[#A8D5BC] pl-3">
                  <p className="text-xs text-gray-400 mb-1">
                    {note.captured_at
                      ? new Date(note.captured_at).toLocaleTimeString()
                      : new Date(note.created_at).toLocaleTimeString()}
                  </p>
                  <p className="text-sm text-gray-700">{note.note_text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Brief */}
      <Card className="mb-4 bg-[#1e2d24] border-0">
        <CardContent className="pt-4">
          <p className="text-xs font-semibold text-[#A8D5BC] uppercase tracking-wide mb-3">Job Brief</p>

          {analysis?.flags?.filter((f: any) =>
            f.severity === 'critical' || f.severity === 'warning'
          ).map((flag: any, i: number) => (
            <div key={i} className="flex gap-2 mb-2 p-2 rounded-lg bg-yellow-900/30">
              <AlertTriangle size={12} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-300">{flag.message}</p>
            </div>
          ))}

          {job?.scope_of_work && (
            <p className="text-xs text-white/60 mt-3 leading-relaxed">{job.scope_of_work}</p>
          )}
        </CardContent>
      </Card>

      {/* Details */}
      {analysis && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Package size={14} className="text-[#1A6E45]" />
              Equipment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Manufacturer', analysis.manufacturer],
                ['Model', analysis.model_number],
                ['Refrigerant', analysis.refrigerant],
                ['Age', analysis.age_years ? `${analysis.age_years} years` : null],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-medium text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}