from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models import Project, Task, User
from app.schemas import ProjectInput, ProjectOutput


router = APIRouter(prefix="/api/projects", tags=["Projects"])


def serialize_project(project: Project, db: Session) -> ProjectOutput:
    tasks = list(db.scalars(select(Task).where(Task.project_id == project.id)))
    return ProjectOutput(
        id=project.id,
        name=project.name,
        description=project.description,
        color=project.color,
        created_at=project.created_at,
        task_count=len(tasks),
        completed_count=sum(task.status == "Completed" for task in tasks),
    )


def owned_project(project_id: int, user: User, db: Session) -> Project:
    project = db.scalar(select(Project).where(Project.id == project_id, Project.owner_id == user.id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("", response_model=list[ProjectOutput])
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    projects = list(db.scalars(select(Project).where(Project.owner_id == user.id).order_by(Project.created_at.desc())))
    return [serialize_project(project, db) for project in projects]


@router.post("", response_model=ProjectOutput, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = Project(name=payload.name.strip(), description=payload.description, color=payload.color, owner_id=user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return serialize_project(project, db)


@router.patch("/{project_id}", response_model=ProjectOutput)
def update_project(project_id: int, payload: ProjectInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = owned_project(project_id, user, db)
    project.name = payload.name.strip()
    project.description = payload.description
    project.color = payload.color
    db.commit()
    db.refresh(project)
    return serialize_project(project, db)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = owned_project(project_id, user, db)
    db.delete(project)
    db.commit()
