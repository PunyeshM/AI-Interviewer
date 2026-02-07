import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState, useRef } from "react";
import { apiPut, apiGet, apiPost } from "../lib/api";

export function StudentDashboardPage() {
    const { state, setState } = useAuth();
    const navigate = useNavigate();

    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Edit Form State
    const [editName, setEditName] = useState("");
    const [editPassword, setEditPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!state.user) {
            navigate("/login");
        } else {
            // Initialize form with current name
            setEditName(state.user.name || "");
        }
    }, [state.user, navigate]);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowProfileMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        // Navigate first to unmount this component before clearing state
        // This prevents the useEffect from redirecting to /login due to missing user
        navigate("/");

        setTimeout(() => {
            localStorage.removeItem("access_token");
            setState({ user: null, accessToken: null, resumeSummary: null, skills: [] });
        }, 0);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (!state.user) return;

            const body: any = { name: editName };
            if (editPassword) {
                body.password = editPassword;
            }

            const updatedData = await apiPut<any>(`/api/users/me`, body);

            // Update local context
            setState({
                ...state,
                user: {
                    ...state.user,
                    name: updatedData.name
                    // do not store password
                }
            });

            setMessage({ type: 'success', text: "Profile updated successfully!" });
            setTimeout(() => {
                setShowEditModal(false);
                setMessage(null);
                setEditPassword(""); // clear password field
            }, 1500);

        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || "Failed to update profile. Try again." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-indigo-500/30">
            {/* Header */}
            <header className="w-full border-b border-zinc-800 px-6 py-4 flex items-center justify-between bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold">
                        ID
                    </div>
                    <h1 className="text-lg font-bold tracking-tight">InterviewDost</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-zinc-200">{state.user?.name || "Student"}</p>
                        <p className="text-xs text-zinc-500">{state.user?.email}</p>
                    </div>

                    {/* Profile Dropdown */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <span className="sr-only">Open user menu</span>
                            <span className="font-semibold text-sm text-zinc-300">
                                {state.user?.name?.charAt(0).toUpperCase() || "U"}
                            </span>
                        </button>

                        {showProfileMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50">
                                <div className="px-4 py-3 border-b border-zinc-800">
                                    <p className="text-sm text-white font-medium truncate">{state.user?.name}</p>
                                    <p className="text-xs text-zinc-500 truncate">{state.user?.email}</p>
                                </div>
                                <div className="py-1">
                                    <button
                                        onClick={() => {
                                            setShowProfileMenu(false);
                                            setShowEditModal(true);
                                            setEditName(state.user?.name || "");
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                                    >
                                        Edit Profile
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowProfileMenu(false);
                                            navigate("/profile");
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                                    >
                                        View Resume Data
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300 transition-colors"
                                    >
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-6 py-8 max-w-6xl">
                <div className="mb-10">
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-2">
                        Welcome back, {state.user?.name?.split(" ")[0] || "Scholar"}
                    </h2>
                    <p className="text-zinc-400">Ready to crush your next interview?</p>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Primary Action: Start Interview */}
                    <div onClick={() => navigate("/interview")} className="col-span-1 md:col-span-2 lg:col-span-2 group relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-zinc-900/40 p-8 hover:bg-zinc-900/60 transition-all cursor-pointer hover:border-indigo-500/50 hover:shadow-[0_0_30px_-5px_theme(colors.indigo.500/0.3)]">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-all"></div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                </span>
                                AI Interviewer Ready
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">Start Mock Interview</h3>
                            <p className="text-zinc-400 mb-6 max-w-md">
                                Practice with our AI avatar. Get real-time feedback on your answers, body language, and speaking pace.
                            </p>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate("/interview");
                                }}
                                className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 group-hover:translate-x-1"
                            >
                                Start Session
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Resume / Documents Card */}
                    <ResumeCard user={state.user} />

                    {/* Secondary Action: Analytics/History */}
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-zinc-700 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mb-4 text-purple-400">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1">Performance</h3>
                        <p className="text-sm text-zinc-500 mb-4">Check your previous scores and improvement over time.</p>
                        <button disabled className="text-sm text-zinc-600 cursor-not-allowed">Coming Soon</button>
                    </div>

                    {/* Tertiary Action: Coding */}
                    <div onClick={() => navigate("/coding")} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-zinc-700 transition-colors cursor-pointer group">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1">Coding Practice</h3>
                        <p className="text-sm text-zinc-500 mb-4">Solve problems and improve your technical skills.</p>
                        <span className="text-xs text-emerald-400 font-medium group-hover:underline">Start coding →</span>
                    </div>

                    {/* Profile Quick Link */}
                    <div onClick={() => navigate("/profile")} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-zinc-700 transition-colors cursor-pointer group">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mb-4 text-blue-400 group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1">My Profile (Resume)</h3>
                        <p className="text-sm text-zinc-500 mb-4">View your resume summary and skills.</p>
                        <span className="text-xs text-blue-400 font-medium group-hover:underline">Manage resume →</span>
                    </div>
                </div>
            </main>

            {/* Edit Profile Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-6 relative">
                        <button
                            onClick={() => setShowEditModal(false)}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-white"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                        </button>

                        <h3 className="text-xl font-bold text-white mb-4">Edit Profile</h3>

                        {message && (
                            <div className={`mb-4 px-3 py-2 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-1">Display Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Your Name"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-1">New Password <span className="text-zinc-600 text-xs">(leave blank to keep current)</span></label>
                                <input
                                    type="password"
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="New Password"
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {loading ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function ResumeCard({ user }: { user: any }) {
    const [uploading, setUploading] = useState(false);
    const [resumeUrl, setResumeUrl] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            // Fetch existing documents
            const fetchDocs = async () => {
                try {
                    const docs = await apiGet<any[]>(`/api/documents/me`);
                    // Find latest resume
                    const resume = docs.find((d: any) => d.file_type === "resume");
                    if (resume) setResumeUrl(resume.file_url);
                } catch (e) {
                    console.error("Failed to fetch documents", e);
                }
            };
            fetchDocs();
        }
    }, [user]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("file_type", "resume");

        try {
            const data = await apiPost<any>(`/api/documents/upload?file_type=resume`, formData);
            setResumeUrl(data.url);
            alert("Resume uploaded successfully!");
        } catch (error) {
            console.error(error);
            alert("Failed to upload resume.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-zinc-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mb-4 text-pink-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">My Resume</h3>
            <p className="text-sm text-zinc-500 mb-4 h-10">
                {resumeUrl ? "Resume uploaded and ready." : "Upload your resume to personalise your interview."}
            </p>

            <div className="flex gap-3 items-center mt-auto">
                {resumeUrl && (
                    <a
                        href={resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-md bg-zinc-800 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
                    >
                        View
                    </a>
                )}

                <label className={`px-3 py-1.5 rounded-md ${resumeUrl ? 'bg-zinc-800 text-zinc-300' : 'bg-pink-600 text-white'} hover:opacity-90 text-xs font-medium cursor-pointer transition-colors flex items-center gap-2`}>
                    <span>{resumeUrl ? "Replace" : "Upload Resume"}</span>
                    <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
                    {uploading && <span className="animate-spin inline-block w-2 h-2 border-2 border-current border-t-transparent rounded-full"></span>}
                </label>
            </div>
        </div>
    );
}
