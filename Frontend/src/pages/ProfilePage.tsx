import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface ProfileEnrichResponse {
  user_id: number;
  resume_summary: string;
  skills: string[];
}

interface UserProfileResponse {
  age?: number;
  target_role?: string;
  target_company?: string;
  tech_stack: string[];
  work_experiences: string[];
  projects: string[];
  companies_worked: string[];
}

export function ProfilePage() {
  const { state, setState } = useAuth();
  const navigate = useNavigate();

  const [age, setAge] = useState<string>("");
  const [targetRole, setTargetRole] = useState<string>("");
  const [targetCompany, setTargetCompany] = useState<string>("");
  const [techStack, setTechStack] = useState<string>("");
  const [workExperiences, setWorkExperiences] = useState<string>("");
  const [projects, setProjects] = useState<string>("");
  const [companiesWorked, setCompaniesWorked] = useState<string>("");
  const [resumeText, setResumeText] = useState<string>("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = state.user;

  // Fetch existing profile data on mount
  useEffect(() => {
    if (user) {
      apiGet<UserProfileResponse>(`/api/profile/me`)
        .then((data) => {
          if (data.age) setAge(data.age.toString());
          if (data.target_role) setTargetRole(data.target_role);
          if (data.target_company) setTargetCompany(data.target_company);
          if (data.tech_stack && data.tech_stack.length > 0) setTechStack(data.tech_stack.join(", "));
          if (data.work_experiences && data.work_experiences.length > 0) setWorkExperiences(data.work_experiences.join("\n"));
          if (data.projects && data.projects.length > 0) setProjects(data.projects.join("\n"));
          if (data.companies_worked && data.companies_worked.length > 0) setCompaniesWorked(data.companies_worked.join("\n"));
        })
        .catch((err) => {
          console.error("Failed to fetch profile:", err);
          // Fail silently, user can just enter new data
        });
    }
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // If a PDF resume is uploaded and no manual resume text is provided,
      // send the PDF to the backend to extract raw text first.
      let finalResumeText = resumeText;
      if (resumeFile && !resumeText) {
        const formData = new FormData();
        formData.append("file", resumeFile);

        const data = await apiPost<{ resume_text?: string }>("/api/profile/upload_resume", formData);
        finalResumeText = data.resume_text || "";
        setResumeText(finalResumeText);
      }

      const payload = {
        age: age ? Number(age) : undefined,
        tech_stack: techStack
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        work_experiences: workExperiences
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        projects: projects
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        companies_worked: companiesWorked
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        target_role: targetRole || undefined,
        target_company: targetCompany || undefined,
        resume_text: finalResumeText || undefined,
      };

      const data = await apiPost<ProfileEnrichResponse>(
        "/api/profile/enrich",
        payload,
      );

      setState({
        ...state,
        resumeSummary: data.resume_summary,
        skills: data.skills,
      });

      navigate("/interview");
    } catch (err: any) {
      setError(err.message ?? "Failed to analyze profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center">
      <div className="w-full max-w-3xl mt-10 mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6 shadow-lg">
        <h1 className="text-xl font-semibold mb-4">Candidate Profile</h1>
        <p className="text-sm text-zinc-300 mb-4">
          Logged in as <span className="font-medium text-indigo-400">{user?.email}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block mb-1">Target Role</label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block mb-1">Target Company</label>
              <input
                type="text"
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block mb-1">Tech Stack (comma separated)</label>
              <input
                type="text"
                placeholder="Python, FastAPI, React, PostgreSQL"
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1">Work Experiences (one per line)</label>
            <textarea
              rows={3}
              value={workExperiences}
              onChange={(e) => setWorkExperiences(e.target.value)}
              className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block mb-1">Projects (one per line)</label>
            <textarea
              rows={3}
              value={projects}
              onChange={(e) => setProjects(e.target.value)}
              className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block mb-1">Companies Worked (one per line)</label>
            <textarea
              rows={2}
              value={companiesWorked}
              onChange={(e) => setCompaniesWorked(e.target.value)}
              className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block mb-1">Resume (PDF or text)</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setResumeFile(file);
              }}
              className="mb-2 block w-full text-xs text-zinc-300 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
            />
            <textarea
              rows={4}
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm font-medium"
            >
              Back to Dashboard
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium disabled:opacity-60"
            >
              {loading ? "Analyzing..." : "Save & Start Interview"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
