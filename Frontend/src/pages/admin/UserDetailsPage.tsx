import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { ArrowLeft, Mail, Briefcase, Code, FileText, Download } from "lucide-react";
import { apiGet } from "@/lib/api";

type UserDetail = {
    user_id: number;
    name: string | null;
    email: string | null;
    role: string | null;
    resume_summary: string | null;
    resume_raw: string | null;
    profile: {
        age: number | null;
        target_role: string | null;
        target_company: string | null;
        tech_stack: string | null; // stored as stringified dict/json often in this legacy model
        work_experiences: string | null;
        projects: string | null;
        companies_worked: string | null;
    };
    skills: { name: string; proficiency: string }[];
    documents: { file_name: string; file_type: string; file_url: string }[];
};

export function UserDetailsPage() {
    const { userId } = useParams();
    const [user, setUser] = useState<UserDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchDetail() {
            try {
                const data = await apiGet<UserDetail>(`/api/admin/users/${userId}`);
                setUser(data);
            } catch (error) {
                console.error("Failed to fetch user details:", error);
            } finally {
                setLoading(false);
            }
        }
        if (userId) fetchDetail();
    }, [userId]);

    if (loading) return <div className="text-white p-8">Loading profile...</div>;
    if (!user) return <div className="text-red-400 p-8">User not found</div>;

    return (
        <div className="space-y-6">
            <div>
                <Link to="/admin/users">
                    <Button variant="ghost" className="pl-0 gap-2 text-zinc-400 hover:text-white mb-4">
                        <ArrowLeft className="h-4 w-4" /> Back to Users
                    </Button>
                </Link>

                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">{user.name || "Unnamed User"}</h1>
                        <div className="flex items-center gap-2 mt-2 text-zinc-400">
                            <Mail className="h-4 w-4" />
                            <span>{user.email}</span>
                            <span className="h-1 w-1 bg-zinc-600 rounded-full mx-2"></span>
                            <Badge variant="outline" className="text-zinc-300 border-zinc-700">{user.role}</Badge>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Sidebar Info */}
                <Card className="bg-zinc-900/50 border-zinc-800 md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-white text-lg">Quick Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-zinc-300">
                        <div>
                            <label className="text-zinc-500 block text-xs uppercase tracking-wider mb-1">Target Role</label>
                            <div className="font-medium text-white">{user.profile?.target_role || "Not set"}</div>
                        </div>
                        <div>
                            <label className="text-zinc-500 block text-xs uppercase tracking-wider mb-1">Target Company</label>
                            <div className="font-medium text-white">{user.profile?.target_company || "Not set"}</div>
                        </div>
                        <div>
                            <label className="text-zinc-500 block text-xs uppercase tracking-wider mb-1">Age</label>
                            <div>{user.profile?.age || "N/A"}</div>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Tabs */}
                <div className="md:col-span-2">
                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="bg-zinc-900 border border-zinc-800">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="resume">Resume</TabsTrigger>
                            <TabsTrigger value="skills">Skills & Stack</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="mt-4 space-y-4">
                            {/* Resume Summary */}
                            <Card className="bg-zinc-900/50 border-zinc-800">
                                <CardHeader>
                                    <CardTitle className="text-white flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-indigo-400" />
                                        Resume Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                        {user.resume_summary || "No resume summary available."}
                                    </p>
                                </CardContent>
                            </Card>
                            {/* Activity could go here */}
                        </TabsContent>

                        <TabsContent value="resume" className="mt-4">
                            <Card className="bg-zinc-900/50 border-zinc-800">
                                <CardHeader>
                                    <CardTitle className="text-white">Raw Resume Data</CardTitle>
                                    <CardDescription>Content extracted from uploaded documents</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-zinc-950 p-4 rounded-md border border-zinc-800 text-zinc-400 font-mono text-xs overflow-auto max-h-[500px]">
                                        {user.resume_raw || "No raw resume data found."}
                                    </div>

                                    {user.documents.length > 0 && (
                                        <div className="mt-6">
                                            <h3 className="text-white font-medium mb-3">Uploaded Files</h3>
                                            <div className="space-y-2">
                                                {user.documents.map((doc, idx) => (
                                                    <a key={idx} href={doc.file_url || "#"} target="_blank" rel="noreferrer"
                                                        className="flex items-center p-3 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-colors group">
                                                        <FileText className="h-8 w-8 text-zinc-500 group-hover:text-indigo-400 mr-3" />
                                                        <div className="flex-1 overflow-hidden">
                                                            <div className="text-zinc-200 font-medium truncate">{doc.file_name}</div>
                                                            <div className="text-zinc-500 text-xs">{doc.file_type}</div>
                                                        </div>
                                                        <Download className="h-4 w-4 text-zinc-500 group-hover:text-white" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="skills" className="mt-4 space-y-4">
                            <Card className="bg-zinc-900/50 border-zinc-800">
                                <CardHeader>
                                    <CardTitle className="text-white">Assessed Skills</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {user.skills.length === 0 ? (
                                        <p className="text-zinc-500">No skills recorded.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {user.skills.map((skill, idx) => (
                                                <Badge key={idx} variant="secondary" className="bg-zinc-800 text-zinc-200">
                                                    {skill.name} <span className="text-zinc-500 ml-1">({skill.proficiency})</span>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {(user.profile?.tech_stack || user.profile?.projects) && (
                                <Card className="bg-zinc-900/50 border-zinc-800">
                                    <CardHeader>
                                        <CardTitle className="text-white">Profile Details</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-zinc-300 text-sm">
                                        {user.profile.tech_stack && (
                                            <div>
                                                <span className="font-semibold text-white block mb-1">Tech Stack:</span>
                                                <div className="bg-zinc-950 p-2 rounded border border-zinc-800/50">
                                                    {user.profile.tech_stack}
                                                </div>
                                            </div>
                                        )}
                                        {user.profile.projects && (
                                            <div>
                                                <span className="font-semibold text-white block mb-1">Projects:</span>
                                                <div className="bg-zinc-950 p-2 rounded border border-zinc-800/50 whitespace-pre-wrap">
                                                    {user.profile.projects}
                                                </div>
                                            </div>
                                        )}

                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
