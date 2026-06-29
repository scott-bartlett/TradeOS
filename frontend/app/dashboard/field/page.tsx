'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi, usersApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Save, AlertTriangle, Package, User, ChevronRight } from 'lucide-react';
import { formatTime } from '@/lib/date-utils';

export default function FieldPage() {
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [noteText, setNoteText] = useState('');
  const recognitionRef = useRef<any>(null);

  const { data: techsData } = useQuery({
    queryKey: ['techs'],
    queryFn: () => usersApi.getByRole('tech'),
  });

  const { data: jobsData } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list(),
  });

  const { data: job } = useQuery({
    queryKey: ['job', selectedJobId],
    queryFn: () => jobsApi.get(selectedJobId!),
    enabled: !!selectedJobId,
  });

  const { data: fieldNotesData } = useQuery({
    queryKey: ['field-notes', selectedJobId],
    queryFn: () => jobsApi.getFieldNotes(selectedJobId!),
    enabled: !!selectedJobId,
  });

  const saveNoteMutation = useMutation({
    mutationFn: (text: string) => jobsApi.addFieldNote(selectedJobId!, {
      note_text: text,
      tech_id: selectedTechId,
      note_type: 'dictation',
      client_uuid: crypto.randomUUID(),
      captured_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-notes', selectedJobId] });
      setNoteText('');
    },
  });

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition ||
                              (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Use Chrome for voice recording');
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
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
        else interim += event.results[i][0].transcript;
      }
      setNoteText(finalTranscript + interim);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => { if (isRecording) recognition.start(); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const saveNote = () => {
    if (!noteText.trim()) return;
    saveNoteMutation.mutate(noteText.trim());
  };

  const techs = techsData?.users || [];
  const jobs = jobsData?.jobs?.filter((j: any) =>
    !['cancelled', 'paid'].includes(j.status)
  ) || [];
  const fieldNotes = fieldNotesData?.notes || [];
  const analysis = job?.ai_analysis;

  // Step 1 — Pick tech
  if (!selectedTechId) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <User size={14} className="text-[#1A6E45]" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Field App</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Who are you?</h1>
        </div>
        <div className="space-y-2">
          {techs.map((tech: any) => (
            <button
              key={tech.user_id}
              onClick={() => setSelectedTechId(tech.user_id)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-[#1A6E45] hover:bg-[#E8F5EE] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1A6E45] flex items-center justify-center text-white text-sm font-bold">
                  {tech.first_name[0]}
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {tech.first_name} {tech.last_name}
                </span>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2 — Pick job
  if (!selectedJobId) {
    const tech = techs.find((t: any) => t.user_id === selectedTechId);
    return (
      <div className="p-4 max-w-md mx-auto">
        <div className="mb-6">
          <button
            onClick={() => setSelectedTechId(null)}
            className="text-xs text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            Hey {tech?.first_name} — which job?
          </h1>
        </div>
        {jobs.length === 0 ? (
          <p className="text-sm text-gray-400">No active jobs found.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((j: any) => (
              <button
                key={j.job_id}
                onClick={() => setSelectedJobId(j.job_id)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-[#1A6E45] hover:bg-[#E8F5EE] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{j.title}</p>
                  {j.customer_name && (
                    <p className="text-xs text-gray-600 mt-0.5">{j.customer_name}</p>
                  )}
                  {j.service_address && (
                    <p className="text-xs text-gray-400 mt-0.5">📍 {j.service_address}</p>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0 ml-2" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 3 — Field view
  const tech = techs.find((t: any) => t.user_id === selectedTechId);
  const currentJob = jobs.find((j: any) => j.job_id === selectedJobId);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <button
          onClick={() => setSelectedJobId(null)}
          className="text-xs text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1"
        >
          ← Switch job
        </button>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full bg-[#1A6E45] flex items-center justify-center text-white text-xs font-bold">
            {tech?.first_name[0]}
          </div>
          <span className="text-xs font-semibold text-gray-500">{tech?.first_name}</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{job?.title || 'Loading...'}</h1>
        {currentJob?.customer_name && (
          <p className="text-sm text-gray-600">{currentJob.customer_name}</p>
        )}
        {currentJob?.service_address && (
          <p className="text-xs text-gray-400">📍 {currentJob.service_address}</p>
        )}
      </div>

      {/* MIC */}
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
            {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
            <span className="text-sm font-bold">
              {isRecording ? 'Recording — tap to stop' : 'Tap to Record'}
            </span>
            {isRecording && <span className="text-xs opacity-75">Listening...</span>}
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

      {/* Field Notes */}
      {fieldNotes.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Notes Today ({fieldNotes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fieldNotes.map((note: any) => (
                <div key={note.note_id} className="border-l-2 border-[#A8D5BC] pl-3">
                  <p className="text-xs text-gray-400 mb-1">
                    {note.captured_at
                      ? formatTime(note.captured_at)
                      : formatTime(note.created_at)}
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

      {/* Equipment */}
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
                ['Model',        analysis.model_number],
                ['Refrigerant',  analysis.refrigerant],
                ['Age',          analysis.age_years ? `${analysis.age_years} years` : null],
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
