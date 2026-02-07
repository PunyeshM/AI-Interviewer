import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..services.gemini_service import gemini_service
from ..services.tavus_service import tavus_service
from ..dependencies import get_current_user

router = APIRouter()

from ..services.cloudinary_utils import get_upload_signature

logger = logging.getLogger(__name__)


# --- Routes -------------------------------------------------------------------


@router.get("/signature", response_model=dict)
def get_signature():
    """
    Get Cloudinary signature for client-side upload.
    """
    try:
        return get_upload_signature()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{interview_id}/recording")
def update_recording_url(interview_id: int, payload: dict, db: Session = Depends(get_db)):
    """
    Update the recording URL for a finished interview.
    """
    interview = db.query(models.Interview).filter_by(interview_id=interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    url = payload.get("recording_url")
    if not url:
        raise HTTPException(status_code=400, detail="recording_url is required")

    interview.recording_url = url
    db.commit()
    
    return {"status": "updated", "recording_url": url}


@router.post("/start", response_model=schemas.InterviewStartResponse)
def start_interview(
    payload: schemas.InterviewStartRequest, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Use the authenticated user
    candidate = current_user

    # Attach skills to candidate if provided
    skill_names: list[str] = []
    if payload.skills:
        for skill_name in payload.skills:
            normalized = (skill_name or "").strip()
            if not normalized:
                continue
            existing_skill = (
                db.query(models.Skill)
                .filter(models.Skill.skill_name.ilike(normalized))
                .first()
            )
            if existing_skill is None:
                existing_skill = models.Skill(skill_name=normalized)
                db.add(existing_skill)
                db.commit()
                db.refresh(existing_skill)

            link_exists = (
                db.query(models.UserSkill)
                .filter_by(user_id=candidate.user_id, skill_id=existing_skill.skill_id)
                .first()
            )
            if not link_exists:
                user_skill = models.UserSkill(
                    user_id=candidate.user_id,
                    skill_id=existing_skill.skill_id,
                    proficiency=None,
                )
                db.add(user_skill)
                db.commit()

            skill_names.append(existing_skill.skill_name)

    # For now, interviewer is not created dynamically; we require an interviewer_id
    if payload.interviewer_id is None:
        raise HTTPException(status_code=400, detail="interviewer_id is required")

    interviewer = db.query(models.User).filter_by(user_id=payload.interviewer_id).first()
    if not interviewer:
        raise HTTPException(status_code=404, detail="Interviewer not found")

    # Parse date and time
    interview_date = datetime.now().date()
    if payload.date:
        try:
            # Assuming YYYY-MM-DD
            interview_date = datetime.strptime(payload.date, "%Y-%m-%d").date()
        except ValueError:
            pass # Keep default or handle error

    interview_time = datetime.now().time()
    if payload.time:
        try:
            if len(payload.time) == 5:
                interview_time = datetime.strptime(payload.time, "%H:%M").time()
            elif len(payload.time) == 8:
                interview_time = datetime.strptime(payload.time, "%H:%M:%S").time()
        except ValueError:
            pass

    interview = models.Interview(
        candidate_id=candidate.user_id,
        interviewer_id=interviewer.user_id,
        date=interview_date,
        time=interview_time,
        type=payload.interview_type,
        status="In Progress",
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)

    # Create Tavus CVI conversation for this interview
    candidate_profile = {
        "name": candidate.name,
        "email": candidate.email,
        "role": candidate.role,
        "resume_summary": candidate.resume_summary,
        "resume_raw": candidate.resume_raw,
        "skills": skill_names,
    }

    skills_section = ", ".join(skill_names) if skill_names else "(skills not provided)"
    resume_section = candidate.resume_summary or "No explicit resume summary was provided."

    # Pre-generate 5 questions using Gemini
    question_texts = gemini_service.generate_interview_questions(candidate_profile, count=5)
    
    db_questions = []
    for q_text in question_texts:
        q_model = models.Question(
            interview_id=interview.interview_id,
            question_text=q_text,
        )
        db.add(q_model)
        db_questions.append(q_model)
    
    db.commit()
    for q in db_questions:
        db.refresh(q)

    # Regerate Tavus context with the specific questions included
    questions_list_str = "\n".join([f"- {q}" for q in question_texts])
    context_str = gemini_service.generate_tavus_interviewer_context(
        {
            "name": candidate_profile.get("name"),
            "target_role": candidate_profile.get("role") or payload.interview_type,
            "interview_type": payload.interview_type,
            "skills": skill_names,
            "resume_summary": candidate.resume_summary,
            "resume_raw": candidate.resume_raw,
            "questions": question_texts,
        }
    )
    # Append the list of questions explicitly to the context
    context_str += f"\n\nPlease ask these specific questions in order:\n{questions_list_str}"

    tavus_data: dict | None = None
    tavus_error: str | None = None
    conv_id: str | None = None
    conv_url: str | None = None
    try:
        tavus_data = tavus_service.create_conversation(
            conversation_name=f"InterviewDost Interview {interview.interview_id}",
            context=context_str,
        )

        if tavus_data:
            nested = tavus_data.get("data") if isinstance(tavus_data.get("data"), dict) else None
            conv_id = (
                tavus_data.get("conversation_id")
                or tavus_data.get("id")
                or (nested.get("conversation_id") if nested else None)
                or (nested.get("id") if nested else None)
            )
            conv_url = (
                tavus_data.get("conversation_url")
                or tavus_data.get("conversationUrl")
                or (nested.get("conversation_url") if nested else None)
                or (nested.get("conversationUrl") if nested else None)
            )

        if conv_id and not conv_url:
            try:
                detail = tavus_service.get_conversation(conv_id)
                nested_detail = detail.get("data") if isinstance(detail.get("data"), dict) else None
                conv_url = (
                    detail.get("conversation_url")
                    or detail.get("conversationUrl")
                    or (nested_detail.get("conversation_url") if nested_detail else None)
                    or (nested_detail.get("conversationUrl") if nested_detail else None)
                )
            except RuntimeError as e:
                logger.warning("Tavus conversation created but could not fetch details: %s", e)
    except RuntimeError as e:
        tavus_error = str(e)

    interview.tavus_conversation_id = conv_id
    interview.tavus_conversation_url = conv_url
    db.add(interview)
    db.commit()
    db.refresh(interview)

    if tavus_error:
        logger.error("Tavus setup failed: %s", tavus_error)

    return schemas.InterviewStartResponse(
        interview_id=interview.interview_id,
        questions=[
            schemas.Question(question_id=q.question_id, text=q.question_text)
            for q in db_questions
        ],
        conversation_url=conv_url,
        tavus_error=tavus_error,
    )


@router.post("/{interview_id}/questions/{question_id}/answer", response_model=schemas.AnswerResponse)
def submit_answer(
    interview_id: int,
    question_id: int,
    payload: schemas.AnswerRequest,
    db: Session = Depends(get_db),
):
    interview: Optional[models.Interview] = (
        db.query(models.Interview).filter_by(interview_id=interview_id).first()
    )
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    question: Optional[models.Question] = (
        db.query(models.Question)
        .filter_by(question_id=question_id, interview_id=interview_id)
        .first()
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found for this interview")

    # Check for existing response to handle multi-part answers (streaming speech)
    existing_response = db.query(models.Response).filter_by(question_id=question_id).first()
    
    full_answer_text = payload.answer_text
    if existing_response and existing_response.answer_text:
        # Append new text to existing
        full_answer_text = f"{existing_response.answer_text} {payload.answer_text}"

    scores = gemini_service.evaluate_answer(question.question_text, full_answer_text)

    if existing_response:
        existing_response.answer_text = full_answer_text
        existing_response.relevance_score = scores["relevance_score"]
        existing_response.confidence_level = scores["confidence_level"]
        db.add(existing_response)
        db.commit()
        db.refresh(existing_response)
    else:
        response = models.Response(
            question_id=question.question_id,
            answer_text=full_answer_text,
            relevance_score=scores["relevance_score"],
            confidence_level=scores["confidence_level"],
        )
        db.add(response)
        db.commit()
        db.refresh(response)

    # Update overall score - Simple average of all responses so far
    all_responses = (
        db.query(models.Response)
        .join(models.Question)
        .filter(models.Question.interview_id == interview_id)
        .all()
    )
    
    if all_responses:
        total_score = sum([(r.relevance_score + r.confidence_level) / 2 for r in all_responses])
        interview.overall_score = int(total_score / len(all_responses))
        db.add(interview)
        db.commit()

    return schemas.AnswerResponse(
        interview_id=interview.interview_id,
        question_id=question.question_id,
        follow_up_question=None,
        done=True,
    )


@router.post("/{interview_id}/end")
def end_interview(interview_id: int, db: Session = Depends(get_db)):
    """
    Explicitly end the interview (e.g. on tab close or finish button).
    """
    interview = db.query(models.Interview).filter_by(interview_id=interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    interview.status = "Completed"
    
    # End Tavus conversation if active AND fetch transcript
    if interview.tavus_conversation_id:
        try:
            # 1. Fetch transcript details first (while it might still be active/accessible)
            detail = tavus_service.get_conversation(interview.tavus_conversation_id)
            logger.info(f"End Interview {interview_id}: Tavus response: {detail}")

            nested = detail.get("data") if isinstance(detail.get("data"), dict) else {}
            transcript_data = detail.get("transcript") or nested.get("transcript") or []
            
            transcript_text = ""
            if isinstance(transcript_data, list):
                lines = []
                for entry in transcript_data:
                    # Log entry to see its structure
                    # logger.debug(f"Transcript entry: {entry}")
                    
                    raw_role = entry.get("role", "unknown")
                    text = entry.get("text", "")
                    
                    # Normalize roles for storage
                    role = "Interviewer" if raw_role == "conversational_ai" else "Candidate"
                    if raw_role == "unknown": role = "System"
                    if raw_role == "user": role = "Candidate" # Handle 'user' role from Tavus

                    lines.append(f"{role}: {text}")
                transcript_text = "\n".join(lines)
            
            if transcript_text:
                interview.transcript = transcript_text
                logger.info(f"End Interview {interview_id}: Saved transcript length {len(transcript_text)}")
            else:
                 logger.warning(f"End Interview {interview_id}: No transcript found in Tavus response")

            # 2. End the conversation
            tavus_service.end_conversation(interview.tavus_conversation_id)
        except Exception as e:
            logger.warning(f"Failed to process Tavus end sequence: {e}")

    db.commit()
    return {"status": "Interview marked as completed", "transcript": interview.transcript}


    db.commit()
    return {"status": "Interview marked as completed", "transcript": interview.transcript}


@router.get("/{interview_id}/transcript")
def get_live_transcript(interview_id: int, db: Session = Depends(get_db)):
    """
    Fetch the live conversation transcript from Tavus.
    """
    interview = db.query(models.Interview).filter_by(interview_id=interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    if not interview.tavus_conversation_id:
        # If no Tavus ID, return empty list or local transcript if we had it
        return {"transcript": []}

    try:
        detail = tavus_service.get_conversation(interview.tavus_conversation_id)
        # Handle nested data structure if present
        nested = detail.get("data") if isinstance(detail.get("data"), dict) else {}
        transcript_data = detail.get("transcript") or nested.get("transcript") or []
        
        formatted_transcript = []
        if isinstance(transcript_data, list):
            for entry in transcript_data:
                role = entry.get("role", "unknown")
                text = entry.get("text", "")
                # Map Tavus roles to UI roles
                # 'conversational_ai' -> 'AI'
                # 'user' -> 'User'
                ui_sender = "AI" if role == "conversational_ai" else "User"
                
                # Use current time if timestamp missing (Tavus usually has 'created_at' or similar but plain text is fine for list)
                # entry usually has 'id', 'role', 'text', 'created_at'
                ts = entry.get("created_at") or datetime.now().isoformat()
                
                formatted_transcript.append({
                    "sender": ui_sender,
                    "text": text,
                    "timestamp": ts,  # Frontend can format this
                    "original_role": role
                })
        
        return {"transcript": formatted_transcript}
    except Exception as e:
        logger.error(f"Failed to fetch live transcript: {e}")
        return {"transcript": []}
def push_system_message(
    interview_id: int,
    payload: schemas.SystemMessageRequest,
    db: Session = Depends(get_db),
):
    interview: Optional[models.Interview] = (
        db.query(models.Interview).filter_by(interview_id=interview_id).first()
    )
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    if not interview.tavus_conversation_id:
        raise HTTPException(status_code=400, detail="No Tavus conversation linked")
    try:
        tavus_service.send_system_message(interview.tavus_conversation_id, payload.message)
        return {"status": "ok"}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/{interview_id}/assistant", response_model=schemas.AssistantResponse)
def interview_assistant(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    interview = db.query(models.Interview).filter_by(interview_id=interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if not interview.tavus_conversation_id:
        return schemas.AssistantResponse(tip="Avatar not started yet. Good luck!")

    try:
        detail = tavus_service.get_conversation(interview.tavus_conversation_id)
        # Tavus provides a transcript in the conversation details if available
        # Note: Tavus API structure for transcript might vary, usually in 'data' or top-level
        nested = detail.get("data") if isinstance(detail.get("data"), dict) else {}
        transcript_data = detail.get("transcript") or nested.get("transcript") or []
        
        # Format transcript for Gemini
        transcript_str = ""
        if isinstance(transcript_data, list):
            for entry in transcript_data:
                role = entry.get("role", "unknown")
                text = entry.get("text", "")
                transcript_str += f"{role}: {text}\n"
        
        tip = gemini_service.get_chat_assistant_response(
            transcript_str, 
            interview.candidate.name or "Candidate", 
            interview.type or "Job Interview"
        )
        return schemas.AssistantResponse(tip=tip)
    except Exception as e:
        logger.error(f"Assistant error: {e}")
        return schemas.AssistantResponse(tip="Keep calm and continue! Focus on your core strengths.")


@router.post("/{interview_id}/finish", response_model=schemas.InterviewFinishResponse)
def finish_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    interview = db.query(models.Interview).filter_by(interview_id=interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    transcript_text = "No transcript available."
    if interview.tavus_conversation_id:
        try:
            detail = tavus_service.get_conversation(interview.tavus_conversation_id)
            logger.info(f"Finish Interview {interview_id}: Tavus response: {detail}")

            nested = detail.get("data") if isinstance(detail.get("data"), dict) else {}
            transcript_data = detail.get("transcript") or nested.get("transcript") or []
            
            if isinstance(transcript_data, list):
                lines = []
                for entry in transcript_data:
                    raw_role = entry.get("role", "unknown")
                    text = entry.get("text", "")
                    
                    # Normalize roles for storage
                    role = "Interviewer" if raw_role == "conversational_ai" else "Candidate"
                    if raw_role == "unknown": role = "System"
                    if raw_role == "user": role = "Candidate"
                    
                    lines.append(f"{role}: {text}")
                transcript_text = "\n".join(lines)
            
            if not transcript_text or transcript_text == "No transcript available.":
                 logger.warning(f"Finish Interview {interview_id}: No transcript text extracted.")
            else:
                 logger.info(f"Finish Interview {interview_id}: Transcript extracted, len={len(transcript_text)}")

            # Explicitly end the conversation to save credits
            tavus_service.end_conversation(interview.tavus_conversation_id)
        except Exception as e:
            logger.warning(f"Could not fetch final transcript or end conversation: {e}")

    interview.transcript = transcript_text
    db.add(interview)
    db.commit()

    return schemas.InterviewFinishResponse(
        interview_id=interview.interview_id,
        transcript=transcript_text,
        status="completed"
    )


@router.get("/{interview_id}/summary", response_model=schemas.InterviewSummaryResponse)
def get_summary(interview_id: int, db: Session = Depends(get_db)):
    interview: Optional[models.Interview] = (
        db.query(models.Interview).filter_by(interview_id=interview_id).first()
    )
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    questions = (
        db.query(models.Question)
        .filter_by(interview_id=interview_id)
        .order_by(models.Question.question_id)
        .all()
    )

    items: list[schemas.InterviewSummaryItem] = []
    for q in questions:
        resp = q.response
        items.append(
            schemas.InterviewSummaryItem(
                question=q.question_text,
                answer=resp.answer_text if resp else None,
                relevance_score=resp.relevance_score if resp else None,
                confidence_level=resp.confidence_level if resp else None,
            )
        )

    return schemas.InterviewSummaryResponse(
        interview_id=interview.interview_id,
        overall_score=interview.overall_score,
        items=items,
        transcript=interview.transcript,
        completed_at=None,
        recording_url=interview.recording_url,
    )


@router.post("/{interview_id}/feedback", response_model=dict)
def create_feedback(
    interview_id: int,
    comments: Optional[str] = None,
    suggestions: Optional[str] = None,
    report_url: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Create or update feedback for an interview.

    Later this can be auto-generated via Gemini based on all Q&A.
    """

    interview = db.query(models.Interview).filter_by(interview_id=interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    fb = db.query(models.Feedback).filter_by(interview_id=interview_id).first()
    if not fb:
        fb = models.Feedback(
            interview_id=interview_id,
            comments=comments,
            suggestions=suggestions,
            report_url=report_url,
        )
        db.add(fb)
    else:
        if comments is not None:
            fb.comments = comments
        if suggestions is not None:
            fb.suggestions = suggestions
        if report_url is not None:
            fb.report_url = report_url

    db.commit()
    db.refresh(fb)

    return {
        "feedback_id": fb.feedback_id,
        "interview_id": fb.interview_id,
        "comments": fb.comments,
        "suggestions": fb.suggestions,
        "report_url": fb.report_url,
    }


@router.get("/{interview_id}/feedback", response_model=dict)
def get_feedback(interview_id: int, db: Session = Depends(get_db)):
    fb = db.query(models.Feedback).filter_by(interview_id=interview_id).first()

    if not fb:
        interview = db.query(models.Interview).filter_by(interview_id=interview_id).first()
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        # Fallback: specific check for missing transcript
        if not interview.transcript and interview.tavus_conversation_id:
            try:
                # Attempt to fetch it one last time
                from ..services.tavus_service import tavus_service
                detail = tavus_service.get_conversation(interview.tavus_conversation_id)
                nested = detail.get("data") if isinstance(detail.get("data"), dict) else {}
                transcript_data = detail.get("transcript") or nested.get("transcript") or []
                
                transcript_text = ""
                if isinstance(transcript_data, list):
                    lines = []
                    for entry in transcript_data:
                        raw_role = entry.get("role", "unknown")
                        text = entry.get("text", "")
                        # Normalize roles
                        role = "Interviewer" if raw_role == "conversational_ai" else "Candidate"
                        if raw_role == "unknown": role = "System"
                        if raw_role == "user": role = "Candidate"
                        lines.append(f"{role}: {text}")
                    transcript_text = "\n".join(lines)
                
                if transcript_text:
                    interview.transcript = transcript_text
                    db.add(interview)
                    db.commit()
            except Exception as e:
                # Log but proceed with what we have
                print(f"Fallback transcript fetch failed: {e}")

        # Build a simple structure for Gemini summary
        interview_info = {
            "candidate_name": interview.candidate.name if interview.candidate else None,
            "role": interview.type,
        }

        questions = (
            db.query(models.Question)
            .filter_by(interview_id=interview_id)
            .order_by(models.Question.question_id)
            .all()
        )

        qa_items: list[dict] = []
        for q in questions:
            resp = q.response
            qa_items.append(
                {
                    "question": q.question_text,
                    "answer": resp.answer_text if resp else None,
                }
            )

        summary = gemini_service.summarize_interview(
            interview_info, 
            qa_items, 
            raw_transcript=interview.transcript # Pass the full raw transcript
        )

        fb = models.Feedback(
            interview_id=interview_id,
            comments=summary.get("comments"),
            suggestions=summary.get("suggestions"),
            report_url=None,
        )

        # Update overall score from the smart analysis
        if summary.get("overall_score"):
            interview.overall_score = summary.get("overall_score")
            db.add(interview) # ensure interview update is tracked

        db.add(fb)
        db.commit()
        db.refresh(fb)

    return {
        "feedback_id": fb.feedback_id,
        "interview_id": fb.interview_id,
        "comments": fb.comments,
        "suggestions": fb.suggestions,
        "report_url": fb.report_url,
    }
