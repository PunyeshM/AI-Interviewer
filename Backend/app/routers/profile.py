from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from io import BytesIO
import json
from PyPDF2 import PdfReader
from ..services.gemini_service import gemini_service
from ..dependencies import get_current_user


router = APIRouter()


@router.post("/profile/enrich", response_model=schemas.ProfileEnrichResponse)
def enrich_profile(
    payload: schemas.CandidateProfileInput, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or update a candidate profile and enrich it via Gemini.

    - Finds or creates a User by email
    - Calls GeminiService.summarize_candidate_profile to get resume_summary + skills
    - Stores resume_summary on User and skills in Skill/UserSkill tables
    """

    # Use the authenticated user
    user = current_user

    raw_profile = payload.model_dump()
    enriched = gemini_service.summarize_candidate_profile(raw_profile)
    resume_summary = enriched.get("resume_summary") or ""
    skills = enriched.get("skills") or []

    # Update user resume_summary
    user.resume_summary = resume_summary
    # Persist raw resume text (if provided) for later analysis/debugging
    if payload.resume_text:
        user.resume_raw = payload.resume_text
    db.add(user)
    db.commit()
    db.refresh(user)


    # Persist extended profile data
    profile_data = db.query(models.UserProfile).filter_by(user_id=user.user_id).first()
    if not profile_data:
        profile_data = models.UserProfile(user_id=user.user_id)
        db.add(profile_data)
    
    profile_data.age = payload.age
    profile_data.target_role = payload.target_role
    profile_data.target_company = payload.target_company
    profile_data.tech_stack = json.dumps(payload.tech_stack) if payload.tech_stack else None
    profile_data.work_experiences = json.dumps(payload.work_experiences) if payload.work_experiences else None
    profile_data.projects = json.dumps(payload.projects) if payload.projects else None
    profile_data.companies_worked = json.dumps(payload.companies_worked) if payload.companies_worked else None
    
    db.commit()

    # Persist skills
    normalized_skills = []
    for skill_name in skills:
        normalized = (skill_name or "").strip()
        if not normalized:
            continue

        skill = (
            db.query(models.Skill)
            .filter(models.Skill.skill_name.ilike(normalized))
            .first()
        )
        if skill is None:
            skill = models.Skill(skill_name=normalized)
            db.add(skill)
            db.commit()
            db.refresh(skill)

        link_exists = (
            db.query(models.UserSkill)
            .filter_by(user_id=user.user_id, skill_id=skill.skill_id)
            .first()
        )
        if not link_exists:
            link = models.UserSkill(user_id=user.user_id, skill_id=skill.skill_id)
            db.add(link)
            db.commit()

        normalized_skills.append(skill.skill_name)

    return schemas.ProfileEnrichResponse(
        user_id=user.user_id,
        resume_summary=resume_summary,
        skills=normalized_skills,
    )


@router.get("/profile/me", response_model=schemas.UserProfileResponse)
def get_my_profile(
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Retrieve detailed profile for the authenticated user."""
    user_id = current_user.user_id
    profile = db.query(models.UserProfile).filter_by(user_id=user_id).first()
    if not profile:
        return schemas.UserProfileResponse()
    
    return schemas.UserProfileResponse(
        age=profile.age,
        target_role=profile.target_role,
        target_company=profile.target_company,
        tech_stack=json.loads(profile.tech_stack) if profile.tech_stack else [],
        work_experiences=json.loads(profile.work_experiences) if profile.work_experiences else [],
        projects=json.loads(profile.projects) if profile.projects else [],
        companies_worked=json.loads(profile.companies_worked) if profile.companies_worked else [],
    )


@router.post("/profile/upload_resume")
async def upload_resume(file: UploadFile = File(...)) -> dict:
    """Accept a PDF resume upload and return extracted text.

    The frontend can then send this text as `resume_text` to the existing
    `/profile/enrich` endpoint so Gemini can generate a summary & skills.
    """

    if file.content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported")

    content = await file.read()

    # Prefer Gemini's PDF understanding via inlineData; fall back to PyPDF2
    try:
        full_text = gemini_service.extract_resume_text_from_pdf(content)
    except Exception:
        reader = PdfReader(BytesIO(content))
        extracted_text_parts = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            extracted_text_parts.append(page_text)

        full_text = "\n".join(extracted_text_parts).strip()

    # Truncate to a safe length for downstream LLM calls
    if len(full_text) > 20000:
        full_text = full_text[:20000]

    return {"resume_text": full_text}
