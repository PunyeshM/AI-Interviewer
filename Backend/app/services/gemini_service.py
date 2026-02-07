from typing import Any, Dict, List
import logging

import requests

from ..core_config import get_settings


settings = get_settings()
logger = logging.getLogger(__name__)


class GeminiService:
    """Wrapper around Gemini API for question generation and answer evaluation."""

    def __init__(self) -> None:
        self.api_key = settings.GEMINI_API_KEY
        # You can change the model name here if needed.
        self.model = "gemini-1.5-flash-001"
        self.base_url = "https://generativelanguage.googleapis.com/v1"

    def _generate(self, prompt: str, system_instruction: str | None = None) -> str:
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"

        contents: List[Dict[str, Any]] = []
        if system_instruction:
            contents.append({"role": "user", "parts": [{"text": system_instruction}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        payload = {"contents": contents}

        resp = requests.post(url, json=payload, timeout=60)
        if resp.status_code >= 400:
            raise RuntimeError(f"Gemini error {resp.status_code}: {resp.text}")

        data = resp.json()
        candidates = data.get("candidates") or []
        if not candidates:
            return ""

        parts = (candidates[0].get("content") or {}).get("parts") or []
        texts = [p.get("text", "") for p in parts]
        return " ".join(texts).strip()

    def extract_resume_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """Use Gemini to extract plain text from a PDF resume.

        This sends the PDF as inlineData and asks Gemini to return only the
        extracted plain text. This generally yields better structure than
        basic PDF parsing.
        """

        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        import base64

        b64 = base64.b64encode(pdf_bytes).decode("utf-8")

        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"

        contents: List[Dict[str, Any]] = [
            {
                "role": "user",
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": "application/pdf",
                            "data": b64,
                        }
                    },
                    {
                        "text": (
                            "Extract and return the full plain-text content of this resume. "
                            "Return only plain text, no markdown or JSON."
                        )
                    },
                ],
            }
        ]

        resp = requests.post(url, json={"contents": contents}, timeout=90)
        if resp.status_code >= 400:
            raise RuntimeError(f"Gemini PDF error {resp.status_code}: {resp.text}")

        data = resp.json()
        candidates = data.get("candidates") or []
        if not candidates:
            return ""
        parts = (candidates[0].get("content") or {}).get("parts") or []
        texts = [p.get("text", "") for p in parts]
        return " ".join(texts).strip()

    def generate_question(self, candidate_profile: Dict[str, Any]) -> str:
        role = candidate_profile.get("role") or "this role"
        name = candidate_profile.get("name") or "the candidate"
        summary = candidate_profile.get("resume_summary") or ""
        skills = candidate_profile.get("skills") or []
        skills_str = ", ".join(skills) if skills else "unspecified skills"

        prompt = (
            f"You are an AI interviewer preparing the very first question for a mock "
            f"interview. The candidate is {name}, targeting the role '{role}'. "
            f"Their summarized background is: {summary}\n"
            f"Key skills: {skills_str}.\n\n"
            "Write a single, open-ended first question that invites them to introduce "
            "themselves and connect their experience to this role. Return only the question text."
        )

        try:
            text = self._generate(prompt)
            return text or "To start, could you briefly introduce yourself and explain why you are a good fit for this role?"
        except RuntimeError:
            return "To start, could you briefly introduce yourself and explain why you are a good fit for this role?"

    def evaluate_answer(self, question: str, answer: str) -> Dict[str, int]:
        prompt = (
            "You are evaluating a candidate's answer in a mock interview. "
            "Given the question and answer, provide two integer scores from 1 to 10: "
            "relevance_score and confidence_level. Respond strictly as JSON, for example: "
            "{\"relevance_score\": 8, \"confidence_level\": 7}.\n\n"
            f"Question: {question}\n\nAnswer: {answer}"
        )

        try:
            raw = self._generate(prompt)
            import json

            data = json.loads(raw)
            rel = int(data.get("relevance_score", 7))
            conf = int(data.get("confidence_level", 7))
            rel = max(1, min(10, rel))
            conf = max(1, min(10, conf))
            return {"relevance_score": rel, "confidence_level": conf}
        except Exception:
            return {"relevance_score": 8, "confidence_level": 7}

    def summarize_candidate_profile(self, raw_profile: Dict[str, Any]) -> Dict[str, Any]:
        name = raw_profile.get("name") or "The candidate"
        target_role = raw_profile.get("target_role") or "the desired role"
        companies = raw_profile.get("companies_worked") or []
        tech_stack = raw_profile.get("tech_stack") or []
        resume_text = raw_profile.get("resume_text") or ""

        companies_str = "; ".join(companies)
        tech_str = ", ".join(tech_stack)

        system_instruction = (
            "You are helping summarize a candidate's background for an AI interviewer. "
            "Given structured profile fields and optional raw resume text, write a concise "
            "2-4 sentence resume-style summary and extract a cleaned list of 5-15 key skills."
        )

        prompt = (
            f"Name: {name}\n"
            f"Target role: {target_role}\n"
            f"Companies worked: {companies_str or 'N/A'}\n"
            f"Tech stack: {tech_str or 'N/A'}\n\n"
        )
        if resume_text:
            prompt += f"Resume text:\n{resume_text}\n\n"

        prompt += (
            "Return your answer strictly as JSON with two fields: "
            "`resume_summary` (string) and `skills` (array of strings)."
        )

        try:
            raw = self._generate(prompt, system_instruction)
            import json

            data = json.loads(raw)
            summary = str(data.get("resume_summary") or "")
            skills = data.get("skills") or []
            skills = [str(s).strip() for s in skills if str(s).strip()]
            return {"resume_summary": summary, "skills": skills}
        except Exception:
            # Fallback: simple heuristic if Gemini fails
            base_summary = (
                f"{name} is aiming for {target_role}. They have worked at {companies_str or 'various organizations'} "
                f"and used technologies such as {tech_str or 'multiple technologies'}."
            )
            return {"resume_summary": base_summary, "skills": tech_stack}

    def summarize_interview(self, interview: Dict[str, Any], qa_items: List[Dict[str, Any]], raw_transcript: str | None = None) -> Dict[str, Any]:
        candidate_name = interview.get("candidate_name") or "The candidate"
        role = interview.get("role") or "the target role"

        # Construct the context input
        # If we have a raw chat-style transcript (preferred for conversational context), use it.
        # Otherwise fallback to the QA items list.
        transcript_context = ""
        if raw_transcript:
            transcript_context = raw_transcript
        else:
            qa_text_lines = []
            for idx, item in enumerate(qa_items, start=1):
                q = item.get("question") or ""
                a = item.get("answer") or "(no answer recorded)"
                qa_text_lines.append(f"Q{idx}: {q}\nA{idx}: {a}")
            transcript_context = "\n\n".join(qa_text_lines)

        system_instruction = (
            "You are an expert AI Interview Coach evaluating a candidate's mock interview performance. "
            "Your goal is to provide a comprehensive evaluation including a score, detailed feedback, and future improvement tips. "
            "Analyze the conversation for communication clarity, technical depth, STAR method usage, and confidence."
        )

        prompt = (
            f"Candidate: {candidate_name}\n"
            f"Role: {role}\n\n"
            f"Full Interview Transcript:\n{transcript_context}\n\n"
            "Based on the transcript above, provide a structured evaluation strictly in JSON format with the following keys:\n"
            "1. \"overall_score\": An integer from 1-100 representing the candidate's overall performance. Evaluate based on: Communication (30%), Technical Depth (40%), Question Relevance (20%), and Confidence (10%).\n"
            "2. \"comments\": A detailed paragraph summarizing the performance. Explicitly mention if the candidate answered the specific questions asked by the interviewer or went off-topic.\n"
            "3. \"suggestions\": A bulleted list (formatted as a paragraph) of specific, actionable areas for improvement for their next placement interview.\n\n"
            "Return ONLY valid JSON. No markdown blocks."
        )

        try:
            # We enforce strict JSON via prompt engineering.
            raw = self._generate(prompt, system_instruction)
            # Cleanup potential markdown wrapping
            cleaned = raw.replace("```json", "").replace("```", "").strip()
            
            import json
            data = json.loads(cleaned)
            
            score = data.get("overall_score")
            try:
                score = int(score)
            except (ValueError, TypeError):
                score = 70 # Default fallback

            comments = str(data.get("comments") or "")
            suggestions = str(data.get("suggestions") or "")
            
            if not comments:
                comments = "The interview was completed, but no specific feedback was generated."
            if not suggestions:
                suggestions = "Focus on practicing common interview questions and reviewing your technical fundamentals."
                
            return {"comments": comments, "suggestions": suggestions, "overall_score": score}
        except Exception as e:
            # Enhanced fallback logging
            print(f"Gemini feedback generation failed: {e}")
            fallback_comments = (
                f"{candidate_name} completed a mock interview for {role}. "
                "The system recorded the session but could not generate a deep analysis at this moment."
            )
            fallback_suggestions = (
                "Review the recording yourself to identify areas for improvement. Focus on answering with the STAR method and speaking confidently."
            )
            return {"comments": fallback_comments, "suggestions": fallback_suggestions, "overall_score": 75}

    def generate_tavus_interviewer_context(self, payload: Dict[str, Any]) -> str:
        """Generate compact Tavus conversation context from stored profile + resume.

        Tavus CVI supports a `context` field at conversation creation which gets
        appended to the persona/system prompt. We keep this concise to improve
        avatar grounding without hitting context limits.
        """

        name = payload.get("name") or "Candidate"
        target_role = payload.get("target_role") or payload.get("interview_type") or "the role"
        skills = payload.get("skills") or []
        resume_summary = payload.get("resume_summary") or ""
        resume_raw = payload.get("resume_raw") or ""

        if isinstance(skills, list):
            skills_str = ", ".join([str(s).strip() for s in skills if str(s).strip()])
        else:
            skills_str = str(skills)

        if resume_raw and len(resume_raw) > 12000:
            resume_raw = resume_raw[:12000]

        system_instruction = (
            "You are preparing context for an AI interviewer avatar. "
            "Write a clear, compact conversational_context that will be appended to a system prompt. "
            "It must tell the interviewer who the candidate is, what role they target, their key skills, "
            "and 5-8 high-signal facts from the resume. Also include strict interviewing guidelines. "
            "Return ONLY plain text (no markdown, no JSON). Keep it under 1800 characters."
        )

        prompt = (
            f"Candidate name: {name}\n"
            f"Target role: {target_role}\n"
            f"Skills: {skills_str or 'N/A'}\n\n"
        )
        if resume_summary:
            prompt += f"Resume summary:\n{resume_summary}\n\n"
        if resume_raw:
            prompt += f"Resume raw text (may be noisy):\n{resume_raw}\n\n"

        prompt += (
            "Now produce the interviewer context. Include:\n"
            "- a short candidate briefing\n"
            "- what to probe (projects, skills, gaps)\n"
            "- interview structure (intro, technical, behavioral, closing)\n"
            "- tone and constraints (professional, friendly, ask one question at a time)"
        )

        try:
            ctx = self._generate(prompt, system_instruction)
            ctx = (ctx or "").strip()
            if len(ctx) > 1800:
                ctx = ctx[:1800]
            return ctx
        except Exception:
            fallback = (
                "You are an AI interviewer. Interview the candidate for "
                f"{target_role}. Candidate: {name}. "
                f"Skills: {skills_str or 'N/A'}. "
                f"Resume summary: {resume_summary or 'N/A'}. "
                "Guidelines: Be professional and friendly. Ask one question at a time. "
                "Start with a brief intro, then ask about background, projects, and key skills. "
                "Include behavioral questions (STAR), then close with next steps."
            )
            return fallback[:1800]


    def generate_interview_questions(self, candidate_profile: Dict[str, Any], count: int = 5) -> List[str]:
        role = candidate_profile.get("role") or "the target role"
        name = candidate_profile.get("name") or "the candidate"
        summary = candidate_profile.get("resume_summary") or ""
        skills = candidate_profile.get("skills") or []
        skills_str = ", ".join(skills) if skills else "unspecified skills"

        prompt = (
            f"You are an AI interview designer. Generate {count} high-quality, targeted interview questions "
            f"for {name}, who is applying for the role of '{role}'.\n"
            f"Candidate Summary: {summary}\n"
            f"Key Skills: {skills_str}\n\n"
            f"Requirements:\n"
            f"1. Mix technical and behavioral questions.\n"
            f"2. Questions should be progressive (starting easier, getting harder).\n"
            f"3. Return ONLY a JSON list of strings, e.g., [\"Question 1\", \"Question 2\"]."
        )

        try:
            raw = self._generate(prompt)
            import json
            # Often Gemini wraps JSON in code blocks
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0].strip()
            elif "```" in raw:
                raw = raw.split("```")[1].split("```")[0].strip()
            
            questions = json.loads(raw)
            if isinstance(questions, list):
                return [str(q).strip() for q in questions][:count]
            return [self.generate_question(candidate_profile)]
        except Exception as e:
            logger.error(f"Failed to generate questions: {e}")
            return [self.generate_question(candidate_profile)]

    def get_chat_assistant_response(self, transcript: str, candidate_name: str, role: str) -> str:
        if not transcript or transcript.strip() == "":
            return "The interview is just starting. Good luck! Remember to be yourself and speak clearly."

        system_instruction = (
            "You are an expert AI Interview Coach. Your job is to provide short, helpful, and encouraging tips "
            "to the candidate during their mock interview based on the current transcript."
        )

        prompt = (
            f"Candidate: {candidate_name}\n"
            f"Role: {role}\n\n"
            f"Current Interview Transcript:\n{transcript}\n\n"
            "Provide a single, concise tip (max 2 sentences) to help the candidate improve their performance "
            "right now. Focus on things like: STAR method, technical depth, clarity, or body language/tone hints. "
            "Address the candidate directly."
        )

        try:
            return self._generate(prompt, system_instruction)
        except Exception:
            return "Keep going! Remember to use specific examples from your past experience."

gemini_service = GeminiService()
