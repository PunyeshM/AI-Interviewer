from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..db import get_db
from ..auth_utils import hash_password, verify_password, create_access_token


router = APIRouter()


# Removed local hashing functions - now in ..auth_utils


@router.post("/auth/register_admin", response_model=schemas.User)
def register_admin(db: Session = Depends(get_db)):
    """One-time endpoint to create the admin user.

    Email and password are currently hardcoded as requested. If the user
    already exists, this simply returns the existing admin row.
    """

    email = "prajwalts.is23@rvce.edu.in"
    password = "1234"

    user = db.query(models.User).filter_by(email=email).first()
    if user:
        return user

    user = models.User(
        name="Prajwal",
        email=email,
        password_hash=hash_password(password),
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/register", response_model=schemas.AuthLoginResponse)
def register(payload: schemas.UserRegisterRequest, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(models.User).filter_by(email=payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new user
    new_user = models.User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role or "candidate",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Auto-login: Generate real JWT token
    access_token = create_access_token(data={"sub": str(new_user.user_id)})

    return schemas.AuthLoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=schemas.User.model_validate(new_user),
    )


@router.post("/auth/login", response_model=schemas.AuthLoginResponse)
def login(payload: schemas.AuthLoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=payload.email).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Generate real JWT token
    access_token = create_access_token(data={"sub": str(user.user_id)})

    return schemas.AuthLoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=schemas.User.model_validate(user),
    )
