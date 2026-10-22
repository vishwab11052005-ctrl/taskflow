from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


Status = Literal["To Do", "In Progress", "Blocked", "Completed"]
Priority = Literal["Low", "Medium", "High", "Urgent"]


class RegisterInput(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class UserOutput(BaseModel):
    id: int
    name: str
    email: EmailStr
    model_config = ConfigDict(from_attributes=True)


class AuthOutput(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOutput


class ProjectInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=3000)
    color: str = Field(default="#8b7cff", max_length=20)


class ProjectOutput(BaseModel):
    id: int
    name: str
    description: str
    color: str
    created_at: datetime
    task_count: int = 0
    completed_count: int = 0


class TaskInput(BaseModel):
    title: str = Field(min_length=2, max_length=220)
    description: str = Field(default="", max_length=5000)
    status: Status = "To Do"
    priority: Priority = "Medium"
    category: str = Field(default="General", max_length=80)
    tags: list[str] = []
    due_date: str | None = None


class TaskOutput(BaseModel):
    id: int
    title: str
    description: str
    status: str
    priority: str
    category: str
    tags: list[str]
    due_date: str | None
    project_id: int
    created_at: datetime


class TaskAnalysisInput(BaseModel):
    title: str = Field(min_length=2, max_length=220)
    description: str = Field(default="", max_length=5000)


class SubtaskInput(BaseModel):
    title: str = Field(min_length=2, max_length=220)
    description: str = Field(default="", max_length=5000)


class ProjectInsightsInput(BaseModel):
    project_id: int
