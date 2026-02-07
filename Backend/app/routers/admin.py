from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timedelta

from .. import models, schemas
from ..db import get_db

router = APIRouter()

@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    """
    Get overview statistics for the admin dashboard.
    """
    total_users = db.query(models.User).count()
    total_interviews = db.query(models.Interview).count()
    
    # Active sessions: Interviews scheduled/started in the last 24 hours (Proxy logic)
    # Adjust logic based on actual "status" field if available later.
    one_day_ago = datetime.now().date() - timedelta(days=1)
    # Using 'date' column for simplicity as 'time' is separate and models.Interview.date is a Date object
    active_sessions = db.query(models.Interview).filter(models.Interview.date >= one_day_ago).count()

    return {
        "total_users": total_users,
        "total_interviews": total_interviews,
        "active_sessions": active_sessions,
        "system_health": "99.9%" # Mocked for now, implies server is reachable
    }

@router.get("/activity")
def get_recent_activity(db: Session = Depends(get_db)):
    """
    Get a combined list of recent activities (User signups, Interviews created).
    """
    # Fetch recent users
    recent_users = db.query(models.User).order_by(desc(models.User.user_id)).limit(5).all()
    
    # Fetch recent interviews
    recent_interviews = db.query(models.Interview).order_by(desc(models.Interview.interview_id)).limit(5).all()

    activity_log = []

    for user in recent_users:
        activity_log.append({
            "type": "user_signup",
            "message": f"New user joined: {user.name or user.email}",
            # No created_at on User model based on previous view, using ID as proxy for "recent"
            # In a real app, add created_at to User.
            "timestamp": "Recently" 
        })

    for interview in recent_interviews:
        # Fetch candidate name
        candidate = db.query(models.User).filter(models.User.user_id == interview.candidate_id).first()
        name = candidate.name if candidate else "Unknown Candidate"
        
        activity_log.append({
            "type": "interview_created",
            "message": f"Interview scheduled for {name}",
            "timestamp": f"{interview.date} {interview.time}" if interview.date else "Recently"
        })

    # Sort simplisticly or just return combined (refining this would require precise timestamps on all models)
    return activity_log


@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):
    """
    Get list of all users for admin table.
    """
    users = db.query(models.User).all()
    # Serialize manually or Use Schema list
    # Returning basic info for table
    return [
        {
            "user_id": u.user_id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
        }
        for u in users
    ]


@router.get("/users/{user_id}")
def get_user_details(user_id: int, db: Session = Depends(get_db)):
    """
    Get comprehensive details of a specific user.
    """
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch related profile
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user_id).first()
    
    # Fetch user skills
    user_skills = db.query(models.UserSkill).filter(models.UserSkill.user_id == user_id).all()
    skills_list = []
    for us in user_skills:
        skill = db.query(models.Skill).filter(models.Skill.skill_id == us.skill_id).first()
        if skill:
            skills_list.append({"name": skill.skill_name, "proficiency": us.proficiency})

    # Fetch documents
    documents = db.query(models.Document).filter(models.Document.user_id == user_id).all()
    docs_list = [
        {"file_name": d.file_name, "file_type": d.file_type, "file_url": d.file_url}
        for d in documents
    ]

    return {
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "resume_summary": user.resume_summary,
        "resume_raw": user.resume_raw,
        "profile": {
            "age": profile.age if profile else None,
            "target_role": profile.target_role if profile else None,
            "target_company": profile.target_company if profile else None,
            "tech_stack": profile.tech_stack if profile else None,
            "work_experiences": profile.work_experiences if profile else None,
            "projects": profile.projects if profile else None,
            "companies_worked": profile.companies_worked if profile else None,
        },
        "skills": skills_list,
        "documents": docs_list
    }


@router.get("/interviews")
def get_all_interviews(db: Session = Depends(get_db)):
    """
    Get list of all interviews in LIFO order.
    """
    interviews = db.query(models.Interview).order_by(desc(models.Interview.interview_id)).all()
    
    results = []
    for i in interviews:
        candidate = db.query(models.User).filter(models.User.user_id == i.candidate_id).first()
        results.append({
            "interview_id": i.interview_id,
            "candidate_name": candidate.name if candidate else "Unknown",
            "date": i.date,
            "time": i.time,
            "type": i.type,
            "overall_score": i.overall_score,
            "status": i.status or ("Completed" if i.overall_score else "Scheduled") 
        })
    return results


@router.get("/interviews/{interview_id}")
def get_interview_details(interview_id: int, db: Session = Depends(get_db)):
    """
    Get full details of a specific interview session.
    """
    interview = db.query(models.Interview).filter(models.Interview.interview_id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    candidate = db.query(models.User).filter(models.User.user_id == interview.candidate_id).first()
    feedback = db.query(models.Feedback).filter(models.Feedback.interview_id == interview_id).first()
    questions = db.query(models.Question).filter(models.Question.interview_id == interview_id).all()

    transcript = []
    for q in questions:
        response = db.query(models.Response).filter(models.Response.question_id == q.question_id).first()
        transcript.append({
            "question": q.question_text,
            "answer": response.answer_text if response else None,
            "score": response.relevance_score if response else None,
            "feedback": None # If per-question feedback exists later
        })

    return {
        "interview_id": interview.interview_id,
        "candidate": {
            "user_id": candidate.user_id if candidate else None,
            "name": candidate.name if candidate else "Unknown",
            "email": candidate.email if candidate else None,
        },
        "date": interview.date,
        "time": interview.time,
        "type": interview.type,
        "overall_score": interview.overall_score,
        "tavus_conversation_id": interview.tavus_conversation_id,
        "tavus_conversation_url": interview.tavus_conversation_url,
        "recording_url": interview.recording_url,
        "feedback": {
            "comments": feedback.comments if feedback else None,
            "suggestions": feedback.suggestions if feedback else None,
            "report_url": feedback.report_url if feedback else None,
        },
        "transcript_list": transcript, # Renamed to distinguish from full text
        "transcript_full": interview.transcript # The raw text from Tavus
    }


