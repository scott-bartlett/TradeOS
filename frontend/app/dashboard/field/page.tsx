'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi, usersApi, changeOrdersApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Save, AlertTriangle, Package, User, ChevronRight, Plus, PenLine, CheckCircle } from 'lucide-react';
import { formatTime } from '@/lib/date-utils';

// ── SIGNATURE PAD ─────────────────────────────────────────────────────────────

function SignaturePad({ onSave, onCancel }: {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const getPos = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = (e: any) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
  };

  const draw = (e: any) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1A6E45';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasStrokes(true);
  };

  const endDraw = () => setDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const save = () => {
    onSave(canvasRef.current!.toDataURL('image/png'));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-600">Customer Signature</p>
      <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <p className="text-xs text-gray-400 text-center">Sign above with finger or mouse</p>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 bg-[#1A6E45] hover:bg-[#145a38] text-xs h-8"
          disabled={!hasStrokes} onClick={save}>
          Save Signature
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-8" onClick={clear}>
          Clear
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-8" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── FIELD CHANGE ORDER FORM ───────────────────────────────────────────────────

function FieldCOForm({ jobId, techId, onSuccess, onCancel }: {
  jobId: string;
  techId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    description: '',
    rough_hours: '',
    rough_parts: '',
    customer_approved: false,
  });
  const [showSigPad, setShowSigPad] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition ||
                              (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Use Chrome for voice'); return; }
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let final = form.description ? form.description + ' ' : '';

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
        else interim += event.results[i][0].transcript;
      }
      set('description', final + interim);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => { if (isRecording) recognition.start(); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const mutation = useMutation({
    mutationFn: () => changeOrdersApi.create(jobId, {
      description: form.description,
      rough_hours: form.rough_hours ? parseFloat(form.rough_hours) : null,
      rough_parts: form.rough_parts || null,
      customer_signed: !!signature,
      signature_data: signature || null,
      captured_by_tech: techId,
      field_approved: true,
    }),
    onSuccess,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Field Change Request</p>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>

      {/* Description + mic */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">What extra work did the customer request?</label>
          <button
            onClick={toggleMic}
            className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg ${
              isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isRecording ? <MicOff size={12} /> : <Mic size={12} />}
            {isRecording ? 'Stop' : 'Dictate'}
          </button>
        </div>
        <textarea
          rows={3}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Customer asked for additional wiring, 3 extra hours of work..."
          className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45] resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">Rough Extra Hours</label>
          <input
            type="number"
            step="0.5"
            value={form.rough_hours}
            onChange={e => set('rough_hours', e.target.value)}
            placeholder="e.g. 3"
            className="mt-1 w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Parts Needed</label>
          <input
            type="text"
            value={form.rough_parts}
            onChange={e => set('rough_parts', e.target.value)}
            placeholder="capacitor, wire..."
            className="mt-1 w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45]"
          />
        </div>
      </div>

      {/* Customer approval toggle */}
      <div
        onClick={() => set('customer_approved', !form.customer_approved)}
        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
          form.customer_approved
            ? 'border-[#1A6E45] bg-[#E8F5EE]'
            : 'border-gray-200 bg-white'
        }`}
      >
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          form.customer_approved ? 'border-[#1A6E45] bg-[#1A6E45]' : 'border-gray-300'
        }`}>
          {form.customer_approved && <span className="text-white text-xs">✓</span>}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">Customer verbally approved</p>
          <p className="text-xs text-gray-500">They agreed to this additional work on site</p>
        </div>
      </div>

      {/* Signature */}
      {form.customer_approved && !signature && !showSigPad && (
        <button
          onClick={() => setShowSigPad(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#A8D5BC] rounded-lg text-sm text-[#1A6E45] hover:bg-[#E8F5EE] transition-colors"
        >
          <PenLine size={16} />
          Get Customer Signature (recommended)
        </button>
      )}

      {showSigPad && (
        <SignaturePad
          onSave={(data) => { setSignature(data); setShowSigPad(false); }}
          onCancel={() => setShowSigPad(false)}
        />
      )}

      {signature && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-green-700">✓ Signature captured</p>
            <button
              onClick={() => { setSignature(null); setShowSigPad(true); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Redo
            </button>
          </div>
          <img src={signature} alt="Customer signature" className="w-full border border-gray-200 rounded-lg bg-white max-h-24 object-contain" />
        </div>
      )}

      <Button
        className="w-full bg-[#1A6E45] hover:bg-[#145a38]"
        disabled={!form.description.trim() || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Submitting...' : 'Submit Change Request'}
      </Button>
      <p className="text-xs text-gray-400 text-center">
        Jamie will review and price this in the office
      </p>
    </div>
  );
}

// ── CLOSE OUT FORM ────────────────────────────────────────────────────────────

function CloseOutForm({ jobId, techId, onSuccess, onCancel }: {
  jobId: string;
  techId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition ||
                              (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Use Chrome for voice'); return; }
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let final = note ? note + ' ' : '';

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
        else interim += event.results[i][0].transcript;
      }
      setNote(final + interim);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => { if (isRecording) recognition.start(); };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (note.trim()) {
        await jobsApi.addFieldNote(jobId, {
          note_text: note.trim(),
          tech_id: techId,
          note_type: 'close_out',
          client_uuid: crypto.randomUUID(),
          captured_at: new Date().toISOString(),
        });
      }
      await jobsApi.updateStatus(jobId, 'complete');
    },
    onSuccess,
  });

  if (!confirmed) {
    return (
      <button
        onClick={() => setConfirmed(true)}
        className="w-full flex items-center justify-center gap-2 py-4 bg-[#1A6E45] rounded-xl text-white font-semibold text-sm hover:bg-[#145a38] transition-colors"
      >
        <CheckCircle size={18} />
        Close Out Job
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-900 mb-1">Close Out Job?</p>
        <p className="text-xs text-gray-500">
          This notifies the office the job is finished. Jamie can then build the invoice.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">Final note for the office (optional)</label>
          <button
            onClick={toggleMic}
            className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg ${
              isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isRecording ? <MicOff size={12} /> : <Mic size={12} />}
            {isRecording ? 'Stop' : 'Dictate'}
          </button>
        </div>
        <textarea
          rows={3}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="System running at proper pressures, customer happy, left old part in garage..."
          className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1A6E45] resize-none"
        />
      </div>

      <Button
        className="w-full bg-[#1A6E45] hover:bg-[#145a38] h-12 text-base font-semibold"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <CheckCircle size={18} className="mr-2" />
        {mutation.isPending ? 'Closing out...' : 'Confirm — Job Complete'}
      </Button>
      <button
        onClick={onCancel}
        className="w-full text-xs text-gray-400 hover:text-gray-600 text-center py-1"
      >
        Cancel
      </button>
    </div>
  );
}

export default function FieldPage() {
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showCOForm, setShowCOForm] = useState(false);
  const [showCloseOut, setShowCloseOut] = useState(false);
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

      {/* Change Order Request */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          {showCOForm ? (
            <FieldCOForm
              jobId={selectedJobId!}
              techId={selectedTechId!}
              onSuccess={() => {
                setShowCOForm(false);
                queryClient.invalidateQueries({ queryKey: ['change-orders', selectedJobId] });
              }}
              onCancel={() => setShowCOForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowCOForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-amber-200 rounded-lg text-sm text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <Plus size={16} />
              Request Change Order
            </button>
          )}
        </CardContent>
      </Card>

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

      {/* Close Out Job */}
      {job?.status !== 'complete' && job?.status !== 'ready_to_invoice' &&
       job?.status !== 'invoiced' && job?.status !== 'paid' && (
        <Card className="mt-4 border-[#1A6E45]">
          <CardContent className="pt-4">
            <CloseOutForm
              jobId={selectedJobId!}
              techId={selectedTechId!}
              onSuccess={() => {
                setShowCloseOut(false);
                setSelectedJobId(null);
              }}
              onCancel={() => setShowCloseOut(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Already closed out */}
      {(job?.status === 'complete' || job?.status === 'ready_to_invoice' ||
        job?.status === 'invoiced' || job?.status === 'paid') && (
        <div className="mt-4 flex items-center justify-center gap-2 py-3 bg-green-50 rounded-xl border border-green-200">
          <CheckCircle size={16} className="text-green-600" />
          <span className="text-sm font-medium text-green-700">Job closed out</span>
        </div>
      )}
    </div>
  );
}
