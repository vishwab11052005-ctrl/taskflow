from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models import Project, Task, User
from app.schemas import TaskInput, TaskOutput


router = APIRouter(prefix="/api", tags=["Tasks"])


def serialize_task(task: Task) -> TaskOutput:
    return TaskOutput(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        category=task.category,
        tags=[tag.strip() for tag in task.tags.split(",") if tag.strip()],
        due_date=task.due_date,
        project_id=task.project_id,
        created_at=task.created_at,
    )


def owned_project(project_id: int, user: User, db: Session) -> Project:
    project = db.scalar(select(Project).where(Project.id == project_id, Project.owner_id == user.id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def owned_task(task_id: int, user: User, db: Session) -> Task:
    task = db.scalar(
        select(Task).join(Project, Task.project_id == Project.id)
        .where(Task.id == task_id, Project.owner_id == user.id)
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/projects/{project_id}/tasks", response_model=list[TaskOutput])
def list_tasks(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_project(project_id, user, db)
    tasks = db.scalars(select(Task).where(Task.project_id == project_id).order_by(Task.created_at.desc()))
    return [serialize_task(task) for task in tasks]


@router.post("/projects/{project_id}/tasks", response_model=TaskOutput, status_code=status.HTTP_201_CREATED)
def create_task(project_id: int, payload: TaskInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_project(project_id, user, db)
    task = Task(
        title=payload.title.strip(),
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        category=payload.category,
        tags=",".join(payload.tags),
        due_date=payload.due_date,
        project_id=project_id,
        created_by_id=user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return serialize_task(task)


@router.patch("/tasks/{task_id}", response_model=TaskOutput)
def update_task(task_id: int, payload: TaskInput, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = owned_task(task_id, user, db)
    task.title = payload.title.strip()
    task.description = payload.description
    task.status = payload.status
    task.priority = payload.priority
    task.category = payload.category
    task.tags = ",".join(payload.tags)
    task.due_date = payload.due_date
    db.commit()
    db.refresh(task)
    return serialize_task(task)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = owned_task(task_id, user, db)
    db.delete(task)
    db.commit()
