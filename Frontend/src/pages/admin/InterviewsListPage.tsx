import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Button } from "@/app/components/ui/button";
import { Eye } from "lucide-react";
import { apiGet } from "@/lib/api";

type InterviewSummary = {
    interview_id: number;
    candidate_name: string;
    date: string | null;
    time: string | null;
    type: string | null;
    overall_score: number | null;
    status: string;
};

export function InterviewsListPage() {
    const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchInterviews() {
            try {
                const data = await apiGet<InterviewSummary[]>("/api/admin/interviews");
                setInterviews(data);
            } catch (error) {
                console.error("Failed to fetch interviews:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchInterviews();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Interviews</h1>
                <p className="text-zinc-400">View and manage all interview sessions.</p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-zinc-400">Loading interviews...</div>
                ) : interviews.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400">No interviews found.</div>
                ) : (
                    <Table>
                        <TableHeader className="bg-zinc-900">
                            <TableRow className="border-zinc-800 hover:bg-zinc-900">
                                <TableHead className="text-zinc-400 font-medium">ID</TableHead>
                                <TableHead className="text-zinc-400 font-medium">Candidate</TableHead>
                                <TableHead className="text-zinc-400 font-medium">Role</TableHead>
                                <TableHead className="text-zinc-400 font-medium">Date & Time</TableHead>
                                <TableHead className="text-zinc-400 font-medium">Score</TableHead>
                                <TableHead className="text-zinc-400 font-medium">Status</TableHead>
                                <TableHead className="text-right text-zinc-400 font-medium">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {interviews.map((interview) => (
                                <TableRow key={interview.interview_id} className="border-zinc-800 hover:bg-zinc-800/50">
                                    <TableCell className="text-zinc-300 font-mono text-xs text-center">{interview.interview_id}</TableCell>
                                    <TableCell className="text-white font-medium">{interview.candidate_name}</TableCell>
                                    <TableCell className="text-zinc-300">{interview.type || "General"}</TableCell>
                                    <TableCell className="text-zinc-400 text-xs">
                                        {interview.date ? `${interview.date} at ${interview.time}` : "N/A"}
                                    </TableCell>
                                    <TableCell>
                                        {interview.overall_score !== null ? (
                                            <span className={`font-bold ${interview.overall_score >= 80 ? 'text-green-400' :
                                                interview.overall_score >= 60 ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                {interview.overall_score}/100
                                            </span>
                                        ) : <span className="text-zinc-600">-</span>}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium 
                      ${interview.status === 'Completed' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-700/50 text-zinc-300'}`}>
                                            {interview.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link to={`/admin/interviews/${interview.interview_id}`}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}
