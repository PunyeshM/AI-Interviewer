from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..db import get_db
from ..services.storage import storage_service
from ..dependencies import get_current_user
from datetime import date

router = APIRouter()

@router.post("/upload", response_model=dict)
async def upload_document(
    file: UploadFile = File(...),
    file_type: str = "resume",
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a document (PDF only) to Supabase Storage.
    Replaces existing document of the same type for the user.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
    
    # Use authenticated user from dependency
    user = current_user
    user_id = user.user_id

    content = await file.read()
    
    # Define storage path: user_id/file_type.pdf (e.g., 123/resume.pdf)
    # This ensures "replace" logic naturally works if we overwrite
    file_ext = "pdf"
    file_path = f"{user_id}/{file_type}.{file_ext}"
    bucket_name = "pdfs" # Ensure this bucket exists in Supabase

    try:
        # Upload to Supabase
        public_url = storage_service.upload_file(bucket_name, file_path, content)
        
        # Check DB for existing document of this type
        existing_doc = db.query(models.Document).filter(
            models.Document.user_id == user_id,
            models.Document.file_type == file_type
        ).first()

        if existing_doc:
            # Update existing record
            existing_doc.file_name = file.filename
            existing_doc.file_path = file_path
            existing_doc.file_url = public_url
            existing_doc.created_at = date.today()
        else:
            # Create new record
            new_doc = models.Document(
                user_id=user_id,
                file_name=file.filename,
                file_path=file_path,
                file_type=file_type,
                file_url=public_url
            )
            db.add(new_doc)
        
        db.commit()
        
        return {"url": public_url, "message": "Upload successful"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me", response_model=list)
def get_my_documents(
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    user_id = current_user.user_id
    docs = db.query(models.Document).filter(models.Document.user_id == user_id).all()
    return [
        {
            "document_id": d.document_id,
            "file_name": d.file_name,
            "file_type": d.file_type,
            "file_url": d.file_url,
            "created_at": d.created_at
        }
        for d in docs
    ]
