from datetime import datetime, date, time as time_type
from typing import Optional, List
from pydantic import BaseModel

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None

class UserBase(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password_hash: Optional[str] = None
    role: Optional[str] = None
    resume_summary: Optional[str] = None

class User(UserBase):
    user_id: int

    class Config:
        from_attributes = True

class InterviewStartRequest(BaseModel):
    interview_type: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    skills: Optional[List[str]] = None
    interviewer_id: Optional[int] = None

class CandidateProfileInput(BaseModel):
    age: Optional[int] = None
    tech_stack: Optional[List[str]] = None
    work_experiences: Optional[List[str]] = None
    projects: Optional[List[str]] = None
    companies_worked: Optional[List[str]] = None
    target_role: Optional[str] = None
    target_company: Optional[str] = None
    resume_text: Optional[str] = None

class UserProfileResponse(BaseModel):
    age: Optional[int] = None
    target_role: Optional[str] = None
    target_company: Optional[str] = None
    tech_stack: List[str] = []
    work_experiences: List[str] = []
    projects: List[str] = []
    companies_worked: List[str] = []

class ProfileEnrichResponse(BaseModel):
    user_id: int
    resume_summary: str
    skills: List[str]

class UserRegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "candidate"

class AuthLoginRequest(BaseModel):
    email: str
    password: str

class AuthLoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: User

class Question(BaseModel):
    question_id: int
    text: str

class InterviewStartResponse(BaseModel):
    interview_id: int
    questions: List[Question]
    conversation_url: Optional[str] = None
    tavus_error: Optional[str] = None
    recording_url: Optional[str] = None

class AnswerRequest(BaseModel):
    answer_text: str

class AnswerResponse(BaseModel):
    interview_id: int
    question_id: int
    follow_up_question: Optional[Question] = None
    done: bool

class InterviewSummaryItem(BaseModel):
    question: str
    answer: Optional[str]
    relevance_score: Optional[int]
    confidence_level: Optional[int]

class InterviewSummaryResponse(BaseModel):
    interview_id: int
    overall_score: Optional[int]
    items: List[InterviewSummaryItem]
    transcript: Optional[str] = None
    completed_at: Optional[datetime]
    recording_url: Optional[str] = None

class SystemMessageRequest(BaseModel):
    message: str

class UserChatMessage(BaseModel):
    message: str

class AssistantResponse(BaseModel):
    tip: str

class InterviewFinishResponse(BaseModel):
    interview_id: int
    transcript: Optional[str] = None
    status: str
