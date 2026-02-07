import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/ui/accordion";
import { Badge } from "@/app/components/ui/badge";
import { ArrowLeft, User, Calendar, MessageSquare, Target } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { useNavigate } from "react-router-dom";

type InterviewDetail = {
    interview_id: number;
    candidate: {
        user_id: number;
        name: string;
        email: string;
    };
    date: string | null;
    time: string | null;
    type: string | null;
    status: string;
    overall_score: number | null;
    tavus_conversation_url: string | null;
    recording_url: string | null;
    feedback: {
        comments: string | null;
        suggestions: string | null;
    };
    transcript_list: {
        question: string;
        answer: string | null;
        score: number | null;
    }[];
    transcript_full: string | null;
};

export function InterviewDetailsPage() {
    const { interviewId } = useParams();
    const [data, setData] = useState<InterviewDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [terminating, setTerminating] = useState(false);
    const navigate = useNavigate();

    async function handleTerminate() {
        if (!confirm("Are you sure? This will immediately end the Tavus conversation and mark the interview as completed. This action cannot be undone.")) return;

        setTerminating(true);
        try {
            await apiPost(`/api/interview/${data?.interview_id}/end`, {});
            // Refresh data
            const res = await apiGet<InterviewDetail>(`/api/admin/interviews/${interviewId}`);
            setData(res);
        } catch (error) {
            console.error("Failed to terminate:", error);
            alert("Failed to terminate interview. See console for details.");
        } finally {
            setTerminating(false);
        }
    }

    useEffect(() => {
        async function fetchDetail() {
            try {
                const res = await apiGet<InterviewDetail>(`/api/admin/interviews/${interviewId}`);
                setData(res);
            } catch (error) {
                console.error("Failed to fetch interview details:", error);
            } finally {
                setLoading(false);
            }
        }
        if (interviewId) fetchDetail();
    }, [interviewId]);

    if (loading) return <div className="text-white p-8">Loading interview connection...</div>;
    if (!data) return <div className="text-red-400 p-8">Interview data not found</div>;

    return (
        <div className="space-y-6">
            <Link to="/admin/interviews">
                <Button variant="ghost" className="pl-0 gap-2 text-zinc-400 hover:text-white">
                    <ArrowLeft className="h-4 w-4" /> Back to Interviews
                </Button>
            </Link>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Main Content */}
                <div className="flex-1 space-y-6">
                    <div className="flex items-start justify-between bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-2">{data.type || "Interview"}</h1>
                            <div className="flex items-center gap-4 text-sm text-zinc-400">
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4 text-zinc-500" />
                                    {data.date} at {data.time}
                                </div>
                                <div className="flex items-center gap-1">
                                    <User className="h-4 w-4 text-zinc-500" />
                                    <Link to={`/admin/users/${data.candidate.user_id}`} className="hover:text-indigo-400 underline decoration-zinc-700 underline-offset-4">
                                        {data.candidate.name}
                                    </Link>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold text-white mb-1">
                                {data.overall_score ?? "-"}<span className="text-lg text-zinc-500">/100</span>
                            </div>
                            <Badge variant={
                                !data.overall_score ? "secondary" :
                                    data.overall_score >= 80 ? "default" :
                                        "destructive"
                            }>
                                {data.overall_score ? "Completed" : "In Progress"}
                            </Badge>
                            {data.status !== "Completed" && data.overall_score === null && (
                                <div className="mt-4">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleTerminate}
                                        disabled={terminating}
                                        className="w-full"
                                    >
                                        {terminating ? "Terminating..." : "Terminate Session"}
                                    </Button>
                                    <p className="text-[10px] text-zinc-500 mt-1">Force end Tavus session</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Feedback Section */}
                    {(data.feedback.comments || data.feedback.suggestions) && (
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Target className="h-5 w-5 text-rose-400" />
                                    AI Evaluation & Feedback
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {data.feedback.comments && (
                                    <div className="bg-zinc-950/50 p-4 rounded-lg border border-zinc-800/50">
                                        <h4 className="text-zinc-400 text-xs uppercase tracking-wider mb-2">General Comments</h4>
                                        <p className="text-zinc-200 text-sm leading-relaxed">{data.feedback.comments}</p>
                                    </div>
                                )}
                                {data.feedback.suggestions && (
                                    <div className="bg-zinc-950/50 p-4 rounded-lg border border-zinc-800/50">
                                        <h4 className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Areas for Improvement</h4>
                                        <p className="text-zinc-200 text-sm leading-relaxed">{data.feedback.suggestions}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Conversation Transcript */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-cyan-400" />
                                Interview Transcript
                            </CardTitle>
                            <CardDescription>Questions asked and candidate responses</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                {data.transcript_list.map((item, idx) => (
                                    <AccordionItem key={idx} value={`item-${idx}`} className="border-zinc-800">
                                        <AccordionTrigger className="hover:no-underline py-4">
                                            <div className="flex items-center justify-between w-full text-left pr-4">
                                                <span className="text-zinc-200 font-medium w-[90%]">{idx + 1}. {item.question}</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="bg-zinc-950/30 p-4 rounded-b-lg border-t border-zinc-800/50">
                                            <p className="font-medium text-xs text-zinc-400 mb-1">
                                                Answer: <span className="text-zinc-200 font-normal">{item.answer || "No answer recorded"}</span>
                                            </p>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </CardContent>
                    </Card>
                    {/* Full Raw Transcript Section */}
                    {data.transcript_full && (
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <MessageSquare className="h-5 w-5 text-green-400" />
                                    Full Session Transcript (Raw)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-zinc-950 p-4 rounded-md border border-zinc-800 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-zinc-300 font-mono">
                                    {data.transcript_full}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="w-full md:w-80 space-y-6">
                    {/* Candidate Card */}
                    <Card className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white text-lg">Candidate</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
                                    {data.candidate.name?.[0]?.toUpperCase() || "U"}
                                </div>
                                <div>
                                    <div className="text-white font-medium">{data.candidate.name}</div>
                                    <div className="text-zinc-500 text-xs">{data.candidate.email}</div>
                                </div>
                            </div>
                            <Link to={`/admin/users/${data.candidate.user_id}`}>
                                <Button variant="secondary" className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200">
                                    View Profile
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    {/* Video / Tavus Info and Recording */}
                    {(data.tavus_conversation_url || data.recording_url) && (
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardHeader>
                                <CardTitle className="text-white text-lg">Interview Session</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {data.tavus_conversation_url && (
                                    <Button className="w-full bg-indigo-600 hover:bg-indigo-500" asChild>
                                        <a href={data.tavus_conversation_url} target="_blank" rel="noreferrer">
                                            Watch on Tavus
                                        </a>
                                    </Button>
                                )}
                                {data.recording_url && (
                                    <>
                                        {/* Simple video player or link */}
                                        <div className="text-xs text-zinc-400 uppercase font-semibold">User Recording</div>
                                        <video controls src={data.recording_url} className="w-full rounded-md border border-zinc-700 bg-black mb-2" />
                                        <Button variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800" asChild>
                                            <a href={data.recording_url} target="_blank" rel="noreferrer">
                                                Open in New Tab
                                            </a>
                                        </Button>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
