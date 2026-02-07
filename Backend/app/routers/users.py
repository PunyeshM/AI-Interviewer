from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..dependencies import get_current_user

router = APIRouter()


@router.get("/me", response_model=dict)
def get_current_user_details(current_user: models.User = Depends(get_current_user)):
    """Return details of the currently authenticated user."""
    return {
        "user_id": current_user.user_id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active
    }


@router.get("/{user_id}", response_model=dict)
def get_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Note: in a real app, restrict this to admin or self
    user = db.query(models.User).filter_by(user_id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    skills = [
        {"skill_id": us.skill_id, "skill_name": us.skill.skill_name, "proficiency": us.proficiency}
        for us in user.user_skills
    ]

    return {
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "skills": skills,
    }



@router.put("/me", response_model=dict)
def update_my_user(
    payload: schemas.UserUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user profile (name, password)."""
    user = current_user
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.name is not None:
        user.name = payload.name
    
    if payload.password is not None and len(payload.password) > 0:
        # Import hash_password from auth router or duplicate logic to avoid circular imports?
        # Better to have utility. accessing auth router function might be circular if auth imports users.
        # Checking auth.py imports... auth imports models, schemas. users imports models.
        # So we can import hash_password from auth if auth doesn't import users router.
        # auth.py does NOT import users router.
        from .auth import hash_password
        user.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(user)

    return {
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


@router.post("/me/skills", response_model=dict)
def add_skills_to_me(
    skill_names: List[str],
    proficiencies: Optional[List[str]] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attach one or more skills to the current user."""
    user = current_user
    user_id = user.user_id
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if proficiencies and len(proficiencies) != len(skill_names):
        raise HTTPException(status_code=400, detail="proficiencies length must match skill_names length")

    created = []
    for idx, name in enumerate(skill_names):
        skill = db.query(models.Skill).filter_by(skill_name=name).first()
        if not skill:
            skill = models.Skill(skill_name=name)
            db.add(skill)
            db.commit()
            db.refresh(skill)

        proficiency = None
        if proficiencies:
            proficiency = proficiencies[idx]

        link = db.query(models.UserSkill).filter_by(user_id=user_id, skill_id=skill.skill_id).first()
        if not link:
            link = models.UserSkill(user_id=user_id, skill_id=skill.skill_id, proficiency=proficiency)
            db.add(link)
        else:
            link.proficiency = proficiency
        created.append({"skill_id": skill.skill_id, "skill_name": skill.skill_name, "proficiency": proficiency})

    db.commit()

    return {"user_id": user_id, "skills": created}
