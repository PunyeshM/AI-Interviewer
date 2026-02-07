from datetime import date

from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True, unique=True)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(50), nullable=True)  # e.g., "candidate", "interviewer", "admin"
    resume_summary = Column(Text, nullable=True)
    # Raw resume text extracted from uploaded PDF or plain text input
    resume_raw = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    # Relationships
    candidate_interviews = relationship(
        "Interview",
        back_populates="candidate",
        foreign_keys="Interview.candidate_id",
    )
    interviewer_interviews = relationship(
        "Interview",
        back_populates="interviewer",
        foreign_keys="Interview.interviewer_id",
    )
    user_skills = relationship("UserSkill", back_populates="user", cascade="all, delete-orphan")
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    profile_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, unique=True)
    age = Column(Integer, nullable=True)
    target_role = Column(String(255), nullable=True)
    target_company = Column(String(255), nullable=True)
    
    # Storing lists as JSON strings for simplicity in SQLite/Generic SQL
    tech_stack = Column(Text, nullable=True) 
    work_experiences = Column(Text, nullable=True)
    projects = Column(Text, nullable=True)
    companies_worked = Column(Text, nullable=True)

    user = relationship("User", back_populates="profile")


class Skill(Base):
    __tablename__ = "skills"

    skill_id = Column(Integer, primary_key=True, index=True)
    skill_name = Column(String(100), nullable=False, unique=True)

    user_skills = relationship("UserSkill", back_populates="skill", cascade="all, delete-orphan")
    question_bank_items = relationship("QuestionBank", secondary="question_bank_skills", back_populates="skills")


class UserSkill(Base):
    __tablename__ = "user_skills"

    user_id = Column(Integer, ForeignKey("users.user_id"), primary_key=True)
    skill_id = Column(Integer, ForeignKey("skills.skill_id"), primary_key=True)
    proficiency = Column(String(50), nullable=True)

    user = relationship("User", back_populates="user_skills")
    skill = relationship("Skill", back_populates="user_skills")


class Interview(Base):
    __tablename__ = "interviews"

    interview_id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    interviewer_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    date = Column(Date, nullable=True)
    time = Column(Time, nullable=True)
    type = Column(String(100), nullable=True)
    overall_score = Column(Integer, nullable=True)
    status = Column(String(50), default="Scheduled") # Scheduled, In Progress, Completed, Aborted
    tavus_conversation_id = Column(String(100), nullable=True)
    transcript = Column(Text, nullable=True)  # Store full conversation transcript
    tavus_conversation_url = Column(String(255), nullable=True)
    recording_url = Column(String(512), nullable=True)

    candidate = relationship("User", foreign_keys=[candidate_id], back_populates="candidate_interviews")
    interviewer = relationship("User", foreign_keys=[interviewer_id], back_populates="interviewer_interviews")
    questions = relationship("Question", back_populates="interview", cascade="all, delete-orphan")
    feedback = relationship("Feedback", back_populates="interview", uselist=False, cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    category_id = Column(Integer, primary_key=True, index=True)
    category_name = Column(String(100), nullable=False, unique=True)

    questions = relationship("Question", back_populates="category")
    question_bank = relationship("QuestionBank", back_populates="category")


class QuestionBank(Base):
    __tablename__ = "question_bank"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    difficulty = Column(String(50), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=True)
    created_at = Column(Date, default=date.today)
    is_active = Column(Boolean, default=True)

    category = relationship("Category", back_populates="question_bank")
    skills = relationship("Skill", secondary="question_bank_skills", back_populates="question_bank_items")


class QuestionBankSkill(Base):
    __tablename__ = "question_bank_skills"

    question_id = Column(Integer, ForeignKey("question_bank.id"), primary_key=True)
    skill_id = Column(Integer, ForeignKey("skills.skill_id"), primary_key=True)


class Question(Base):
    __tablename__ = "questions"

    question_id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.interview_id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=True)
    question_text = Column(Text, nullable=False)

    interview = relationship("Interview", back_populates="questions")
    category = relationship("Category", back_populates="questions")
    response = relationship("Response", back_populates="question", uselist=False, cascade="all, delete-orphan")


class Response(Base):
    __tablename__ = "responses"

    response_id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.question_id"), nullable=False, unique=True)
    answer_text = Column(Text, nullable=True)
    relevance_score = Column(Integer, nullable=True)
    confidence_level = Column(Integer, nullable=True)

    question = relationship("Question", back_populates="response")


class Feedback(Base):
    __tablename__ = "feedbacks"

    feedback_id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.interview_id"), nullable=False, unique=True)
    comments = Column(Text, nullable=True)
    suggestions = Column(Text, nullable=True)
    report_url = Column(String(255), nullable=True)

    interview = relationship("Interview", back_populates="feedback")


class Document(Base):
    __tablename__ = "documents"

    document_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)  # Path in Supabase Storage
    file_type = Column(String(50), nullable=True)     # e.g., "resume", "syllabus"
    file_url = Column(String(512), nullable=True)     # Public/Signed URL
    created_at = Column(Date, default=date.today)

    user = relationship("User", back_populates="documents")    


