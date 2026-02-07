import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Target } from "lucide-react";
import { apiGet } from "../lib/api";

interface InterviewSummaryItem {
  question: string;
  answer: string | null;
  relevance_score: number | null;
  confidence_level: number | null;
}

interface InterviewSummaryResponse {
  interview_id: number;
  overall_score: number | null;
  items: InterviewSummaryItem[];
  transcript: string | null;
  completed_at: string | null;
  recording_url?: string | null;
}

interface FeedbackResponse {
  feedback_id: number;
  interview_id: number;
  comments: string | null;
  suggestions: string | null;
  report_url: string | null;
}

export function ResultsPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<InterviewSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);

  useEffect(() => {
    if (!interviewId) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [summaryData, feedbackData] = await Promise.all([
          apiGet<InterviewSummaryResponse>(
            `/api/interview/${interviewId}/summary`,
          ),
          apiGet<FeedbackResponse>(
            `/api/interview/${interviewId}/feedback`,
          ),
        ]);

        setSummary(summaryData);
        setFeedback(feedbackData);
      } catch (err: any) {
        setError(err.message ?? "Failed to load summary");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [interviewId]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center">
      <div className="w-full max-w-4xl mt-10 mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Interview Results</h1>
            <p className="text-sm text-zinc-400">
              Interview ID: {interviewId}
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-zinc-300 hover:text-white underline transition-colors"
          >
            Back to dashboard
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-10 justify-center">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-zinc-400">Analysing your performance...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-950/20 border border-red-900 text-red-200 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        {summary && (
          <>
            <div className="mb-8 p-5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-400 uppercase font-bold tracking-widest mb-1">Overall Performance</p>
                <p className="text-3xl font-bold text-white">{summary.overall_score ?? "N/A"}<span className="text-lg text-zinc-500 font-normal">/100</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest mb-1">Status</p>
                <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20">COMPLETED</span>
              </div>
            </div>

            {summary.recording_url && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold mb-2 text-zinc-300">Session Recording</h3>
                <video controls className="w-full max-h-[400px] rounded-lg bg-black/50 border border-zinc-700">
                  <source src={summary.recording_url} type="video/webm" />
                  <source src={summary.recording_url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <div className="mt-2 text-right">
                  <a href={summary.recording_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline">
                    Open recording in new tab
                  </a>
                </div>
              </div>
            )}

            <h2 className="text-lg font-semibold mb-4">Question Breakdown</h2>
            <div className="space-y-4 text-sm">
              {summary.items.map((item, idx) => (
                <div
                  key={idx}
                  className="border border-zinc-800 rounded-xl p-4 bg-zinc-950/40 hover:border-zinc-700 transition-colors"
                >
                  <p className="font-semibold text-zinc-200 mb-2">Q{idx + 1}: {item.question}</p>
                  {item.answer && (
                    <div className="bg-zinc-900/50 rounded-lg p-3 mb-3 border border-zinc-800/50">
                      <p className="text-zinc-400 italic">"{item.answer}"</p>
                    </div>
                  )}
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                      <span className="text-xs text-zinc-500">Relevance: <span className="text-zinc-300 font-medium">{item.relevance_score ?? "N/A"}</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <span className="text-xs text-zinc-500">Confidence: <span className="text-zinc-300 font-medium">{item.confidence_level ?? "N/A"}</span></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {summary.transcript && (
              <div className="mt-10 bg-zinc-950/40 border border-zinc-800 rounded-xl p-6 shadow-inner">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  Interview Transcript
                </h2>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
                  {summary.transcript.split('\n').filter(line => line.trim() !== "").map((line, i) => {
                    const colonIndex = line.indexOf(':');
                    if (colonIndex === -1) return <p key={i} className="text-zinc-500 italic text-xs py-1 border-b border-zinc-900">{line}</p>;

                    const speaker = line.substring(0, colonIndex).trim();
                    const text = line.substring(colonIndex + 1).trim();

                    // Identify if speaker is candidate (User) or Avatar
                    const isCandidate = speaker.toLowerCase().includes('candidate') || speaker.toLowerCase().includes('user') || speaker.toLowerCase().includes('you');

                    return (
                      <div key={i} className={`flex w-full ${isCandidate ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex flex-col max-w-[80%] ${isCandidate ? 'items-end' : 'items-start'}`}>
                          <span className={`text-[10px] uppercase font-bold tracking-widest mb-1 px-1 ${isCandidate ? 'text-indigo-400' : 'text-emerald-500'
                            }`}>
                            {isCandidate ? "You" : "Interviewer"}
                          </span>
                          <div className={`relative px-5 py-3 text-sm leading-relaxed shadow-sm ${isCandidate
                            ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none'
                            : 'bg-zinc-800 text-zinc-200 rounded-2xl rounded-tl-none border border-zinc-700'
                            }`}>
                            {text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {feedback && (
              <div className="mt-10 border-t border-zinc-800 pt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-indigo-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-white">Full AI Evaluation</h2>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Comments / General Feedback */}
                  <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 shadow-lg">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Performance Summary</h3>
                    <div className="text-zinc-300 text-sm leading-7 whitespace-pre-wrap">
                      {feedback.comments || "No specific comments available."}
                    </div>
                  </div>

                  {/* Suggestions */}
                  <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <Target className="w-24 h-24" /> {/* Assuming Target icon is imported, if not will remove on verify step */}
                    </div>
                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4">Areas for Improvement</h3>
                    <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-7">
                      {feedback.suggestions || "No specific suggestions available."}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
