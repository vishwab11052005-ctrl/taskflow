from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models import Project, Task, User
from app.schemas import ProjectInsightsInput, SubtaskInput, TaskAnalysisInput
from app.services.ollama import generate_json


router = APIRouter(prefix="/api/ai", tags=["AI"])


@router.post("/analyze-task")
async def analyze_task(payload: TaskAnalysisInput, user: User = Depends(get_current_user)):
    try:
        result = await generate_json(
            "You are a project management assistant. Return JSON with priority (Low, Medium, High, Urgent), category, tags array, and explanation. Do not return markdown.",
            f"Title: {payload.title}\nDescription: {payload.description}",
        )
        if result.get("priority") not in ["Low", "Medium", "High", "Urgent"]:
            result["priority"] = "Medium"
        result["tags"] = result.get("tags", [])[:8]
        return result
    except Exception:
        raise HTTPException(status_code=503, detail="AI service is unavailable. Start Ollama and confirm the model is installed.")


@router.post("/generate-subtasks")
async def generate_subtasks(payload: SubtaskInput, user: User = Depends(get_current_user)):
    try:
        result = await generate_json(
            "You break complex work into practical steps. Return JSON with a subtasks array. Each item has title and description. Return 3 to 7 items and no markdown.",
            f"Task: {payload.title}\nDetails: {payload.description}",
        )
        return {"subtasks": result.get("subtasks", [])[:7]}
    except Exception:
        raise HTTPException(status_code=503, detail="AI service is unavailable. Start Ollama and confirm the model is installed.")


@router.post("/project-insights")
async def project_insights(payload: ProjectInsightsInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.scalar(select(Project).where(Project.id == payload.project_id, Project.owner_id == user.id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = list(db.scalars(select(Task).where(Task.project_id == project.id)))
    snapshot = [
        {"title": task.title, "status": task.status, "priority": task.priority, "due_date": task.due_date}
        for task in tasks
    ]
    try:
        result = await generate_json(
            "You are a project health analyst. Return JSON with summary, risks array, blockers array, and next_actions array. Keep recommendations concise. Do not return markdown.",
            f"Project: {project.name}\nTasks: {snapshot}",
        )
        return result
    except Exception:
        raise HTTPException(status_code=503, detail="AI service is unavailable. Start Ollama and confirm the model is installed.")
