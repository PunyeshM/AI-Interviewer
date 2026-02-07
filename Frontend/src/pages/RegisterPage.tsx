import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function RegisterPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { setState } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const data = await apiPost<any>("/api/auth/register", {
                name,
                email,
                password,
            });

            localStorage.setItem("access_token", data.access_token);

            // Update global auth state
            setState({
                user: data.user,
                accessToken: data.access_token,
                resumeSummary: null,
                skills: [],
            });

            // Redirect to dashboard (or onboarding)
            navigate("/dashboard");
        } catch (err: any) {
            setError(
                err.message && err.message.includes("Email already registered")
                    ? "This email is already registered."
                    : "Registration failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
            <div className="max-w-md w-full space-y-8 bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg font-bold mb-4">
                        ID
                    </div>
                    <h2 className="mt-2 text-3xl font-extrabold text-white">
                        Create your account
                    </h2>
                    <p className="mt-2 text-sm text-zinc-400">
                        Join InterviewDost and master your interviews
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="name" className="sr-only">
                                Full Name
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-zinc-700 placeholder-zinc-500 text-white bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:z-10 sm:text-sm"
                                placeholder="Full Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="email-address" className="sr-only">
                                Email address
                            </label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                required
                                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-zinc-700 placeholder-zinc-500 text-white bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:z-10 sm:text-sm"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-zinc-700 placeholder-zinc-500 text-white bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:z-10 sm:text-sm"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <div className="text-red-400 text-sm text-center">{error}</div>}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 transition-colors"
                        >
                            {loading ? "Creating account..." : "Sign up"}
                        </button>
                    </div>

                    <div className="text-center text-sm">
                        <span className="text-zinc-400">Already have an account? </span>
                        <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
                            Sign in
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
