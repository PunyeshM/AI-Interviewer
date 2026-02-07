import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useReactMediaRecorder } from "react-media-recorder";

import { useAuth } from "../context/AuthContext";
import { apiPost, apiPatch, apiGet } from "../lib/api";

// Helper for Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface TranscriptItem {
  sender: 'AI' | 'User';
  text: string;
  timestamp: string;
}

interface QuestionDto {
  question_id: number;
  text: string;
}

interface InterviewStartResponse {
  interview_id: number;
  questions: QuestionDto[];
  conversation_url: string | null;
  tavus_error?: string | null;
  recording_url?: string | null;
}

function TavusFrame({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      title="AI Interviewer"
      className="w-full h-full rounded-lg border-0"
      allow="camera; microphone; autoplay; encrypted-media; fullscreen;"
    />
  );
}

export function InterviewPage() {
  const { state } = useAuth();
  const navigate = useNavigate();

  const [interviewId, setInterviewId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [question, setQuestion] = useState<QuestionDto | null>(null);
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tavusError, setTavusError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Transcript State
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { status, startRecording, stopRecording, mediaBlobUrl, previewStream } =
    useReactMediaRecorder({ video: true, audio: true });

  const hasStartedRef = useRef(false);
  const hasEndedRef = useRef(false);

  useEffect(() => {
    if (!state.user) {
      navigate("/login");
    }
  }, [state.user, navigate]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcriptText = event.results[event.results.length - 1][0].transcript;
        if (transcriptText.trim()) {
          handleUserTranscript(transcriptText);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.error("Speech recognition error", event.error);
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // ignore
          }
        }
      };

      recognitionRef.current = recognition;
    }
  }, [interviewId, question]);

  // Polling for live transcript (User + Avatar)
  useEffect(() => {
    if (!interviewId || !hasStartedRef.current || hasEndedRef.current) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiGet<{ transcript: any[] }>(`/api/interview/${interviewId}/transcript`);
        if (res.transcript && res.transcript.length > 0) {
          // Map backend format to frontend format
          const newItems: TranscriptItem[] = res.transcript.map((t: any) => ({
            sender: t.sender,
            text: t.text,
            timestamp: new Date(t.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })
          }));

          // Update state if different length (simple check) or use a more robust diff if needed
          // For simplicity, we'll just replace it as it is authoritative
          setTranscript(newItems);
        }
      } catch (e) {
        console.error("Polling transcript failed", e);
      }
    }, 4000); // Poll every 4 seconds to avoid rate limits

    return () => clearInterval(interval);
  }, [interviewId]);

  const handleUserTranscript = async (text: string) => {
    // 1. Update UI (Optimistic update)
    // We add it locally so the user sees it immediately. 
    // The next poll will likely overwrite this with the confirmed version from backend, which is fine.
    const newItem: TranscriptItem = {
      sender: 'User',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })
    };
    setTranscript(prev => [...prev, newItem]);

    // 2. Send to Backend (Scores & Feedback)
    if (interviewId && question) {
      try {
        // We use the current question ID. In a real flow, we'd detect new questions.
        // For now, accumulating answers under the initial question is a safe fallback
        // to ensure we capture the data for Gemini analysis.
        await apiPost(`/api/interview/${interviewId}/questions/${question.question_id}/answer`, {
          answer_text: text
        });
      } catch (e) {
        console.error("Failed to sync transcript", e);
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      isListeningRef.current = false;
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
      isListeningRef.current = true;
    }
  };

  // Auto-start listening when recording starts
  useEffect(() => {
    if (status === "recording" && recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
      isListeningRef.current = true;
    } else if (status === "stopped" && isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [status]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Handle tab close / navigation
  useEffect(() => {
    const handleUnload = () => {
      if (interviewId && !hasEndedRef.current) {
        hasEndedRef.current = true;
        fetch(`/api/interview/${interviewId}/end`, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' }
        }).catch(err => console.error("Failed to end interview on unload", err));
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [interviewId]);

  useEffect(() => {
    if (status === "stopped" && mediaBlobUrl && interviewId && isFinishing && !hasEndedRef.current) {
      finishInterviewFlow(mediaBlobUrl, interviewId);
    }
  }, [status, mediaBlobUrl, interviewId, isFinishing]);

  async function finishInterviewFlow(blobUrl: string, id: number) {
    if (hasEndedRef.current && !isUploading) return;
    if (isUploading) return;

    setIsUploading(true);
    hasEndedRef.current = true;

    console.log("Starting finish flow...");

    try {
      const videoBlob = await fetch(blobUrl).then(r => r.blob());
      if (videoBlob.size === 0) {
        console.warn("Recording blob is empty. Skipping upload.");
      } else {
        const sigData = await apiGet<any>("/api/interview/signature");

        const formData = new FormData();
        formData.append("file", videoBlob);
        formData.append("api_key", sigData.api_key);
        formData.append("timestamp", sigData.timestamp);
        formData.append("signature", sigData.signature);
        formData.append("folder", sigData.folder);
        formData.append("resource_type", "video");

        const cloudinaryRes = await fetch(
          `https://api.cloudinary.com/v1_1/${sigData.cloud_name}/video/upload`,
          { method: "POST", body: formData }
        );

        const cloudData = await cloudinaryRes.json();
        if (!cloudinaryRes.ok) {
          console.error("Cloudinary error:", JSON.stringify(cloudData));
        } else {
          const secureUrl = cloudData.secure_url;
          await apiPatch(`/api/interview/${id}/recording`, { recording_url: secureUrl });
          console.log("Recording saved:", secureUrl);
        }
      }

      await apiPost(`/api/interview/${id}/end`, {});
      console.log("Interview marked as completed");

      navigate(`/results/${id}`);
    } catch (err) {
      console.error("Failed during finish flow:", err);
    } finally {
      setIsUploading(false);
      // Ensure we navigate even if there's an error
      if (document.location.pathname.includes(`/results/${id}`)) return;
      navigate(`/results/${id}`);
    }
  }

  async function handleStartInterview() {
    if (!state.user || !state.user.email || !state.user.name) {
      setError("You must be logged in and have a valid profile.");
      return;
    }

    setLoading(true);
    setError(null);
    setTavusError(null);

    try {
      const body = {
        candidate: {
          name: state.user.name,
          email: state.user.email,
          role: targetRole || state.user.role || "candidate",
          resume_summary: state.resumeSummary,
        },
        interviewer_id: 1,
        interview_type: targetRole || state.user.role || "candidate",
        skills: state.skills,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      };

      const data = await apiPost<InterviewStartResponse>(
        "/api/interview/start",
        body
      );

      setInterviewId(data.interview_id);
      setQuestions(data.questions);
      setQuestion(data.questions[0] || null);
      setConversationUrl(data.conversation_url ?? null);
      setTavusError(data.tavus_error ?? null);

      startRecording();
      hasStartedRef.current = true;

    } catch (err: any) {
      setError(err.message ?? "Failed to start interview");
    } finally {
      setLoading(false);
    }
  }

  async function handleFinish() {
    if (hasStartedRef.current) {
      setIsFinishing(true);
      stopRecording();
    } else {
      if (interviewId) {
        try {
          await apiPost(`/api/interview/${interviewId}/end`, {});
        } catch (e) {
          console.error("Failed to end interview:", e);
        }
        navigate(`/results/${interviewId}`);
      }
    }
  }

  const tavusKey = import.meta.env.VITE_TAVUS_PUBLIC_KEY as
    | string
    | undefined;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header / controls */}
      <header className="w-full border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Interview Room</h1>
          <p className="text-xs text-zinc-400">
            Logged in as {state.user?.email}
            {status === "recording" && <span className="text-red-500 ml-2 animate-pulse">● Recording</span>}
            {isListening && <span className="text-green-500 ml-2">● Transcribing</span>}
            {isUploading && <span className="text-blue-400 ml-2">Uploading recording...</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <label className="text-xs text-zinc-400">Target role</label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder={state.user?.role ?? "SDE Intern"}
              className="w-40 rounded-md bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {
            !interviewId ? (
              <button
                onClick={handleStartInterview}
                disabled={loading}
                className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-medium disabled:opacity-60"
              >
                {loading ? "Starting..." : "Start Interview"}
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={isFinishing || isUploading}
                className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isFinishing || isUploading ? "Finishing..." : "End Interview"}
              </button>
            )
          }

          <button
            className="text-xs text-zinc-300 hover:text-white underline"
            onClick={() => navigate("/profile")}
          >
            Edit profile
          </button>
        </div>
      </header>

      {/* Main 2-column layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Tavus video area - Reduced flex grow to 2 */}
        <section className="flex-[2] min-w-0 border-r border-zinc-800 flex flex-col relative bg-black">
          <div className="flex-1 p-4 flex flex-col gap-3 h-full justify-center">
            {tavusError && !conversationUrl && (
              <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3">
                <h3 className="text-sm text-red-400 font-semibold mb-1">Avatar unavailable</h3>
                <p className="text-xs text-red-300/80 break-words">
                  {tavusError.includes("402") || tavusError.toLowerCase().includes("credits")
                    ? "The AI interviewer is currently out of credits. Please try again later or contact the administrator."
                    : tavusError}
                </p>
              </div>
            )}

            {!conversationUrl && (
              <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40">
                <p className="text-sm text-zinc-400 max-w-sm text-center">
                  Click <span className="font-medium">Start</span> to launch the AI interviewer.
                  <br /><span className="text-xs text-zinc-500">(Your camera and microphone will be recorded)</span>
                </p>
              </div>
            )}

            {conversationUrl && (
              <div className="flex-1 rounded-xl overflow-hidden bg-black/40 border border-zinc-700 relative">
                <TavusFrame url={conversationUrl} />
                {/* Live Transcript Overlay (Optional) */}
                <div className="absolute bottom-4 left-4 right-4 text-center">
                  {transcript.length > 0 && (
                    <span className="bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                      {transcript[transcript.length - 1].text.slice(-50)}
                      {transcript[transcript.length - 1].text.length > 50 ? "..." : ""}
                    </span>
                  )}
                </div>
              </div>
            )}

            {question && (
              <div className="mt-3 bg-zinc-900 border border-zinc-700 rounded-xl p-3">
                <h2 className="text-sm font-semibold mb-1">Current Question</h2>
                <p className="text-sm text-zinc-100 mb-1">{question.text}</p>
                <p className="text-xs text-zinc-500">
                  Speak your answer to the avatar. This question is tracked for scoring in the backend.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Right: Transcript sidebar - Increased width/flex */}
        <aside className="flex-[1.5] min-w-[400px] border-l border-zinc-800 flex flex-col bg-zinc-950/80 backdrop-blur-sm">
          <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
            <h2 className="text-sm font-semibold">Live Transcript</h2>
            <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          </div>

          <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto" ref={scrollRef}>
            {transcript.length === 0 ? (
              <p className="text-xs text-zinc-500 italic text-center mt-10">
                Conversation history will appear here...
              </p>
            ) : (
              transcript.map((item, i) => (
                <div key={i} className={`flex flex-col ${item.sender === 'User' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs ${item.sender === 'User'
                    ? 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/30'
                    : 'bg-zinc-800 text-zinc-300'
                    }`}>
                    <p>{item.text}</p>
                  </div>
                  <span className="text-[10px] text-zinc-600 mt-1 px-1">{item.timestamp}</span>
                </div>
              ))
            )}
            {question && (
              <div className="flex flex-col items-start mt-2 border-t border-zinc-800 pt-2">
                <span className="text-[10px] text-zinc-500 mb-1">AI Interviewer</span>
                <div className="max-w-[95%] rounded-lg px-3 py-2 text-xs bg-zinc-800 text-zinc-200 border border-zinc-700">
                  {question.text}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800 p-3 bg-zinc-900/50">
            <p className="text-[10px] text-zinc-500 text-center">
              Listening to your microphone...
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
