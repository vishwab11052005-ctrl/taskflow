from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas import AuthOutput, LoginInput, RegisterInput, UserOutput


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthOutput, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterInput, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(name=payload.name.strip(), email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthOutput(access_token=create_access_token(user.id), user=UserOutput.model_validate(user))


@router.post("/login", response_model=AuthOutput)
def login(payload: LoginInput, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return AuthOutput(access_token=create_access_token(user.id), user=UserOutput.model_validate(user))


@router.get("/me", response_model=UserOutput)
def get_me(user: User = Depends(get_current_user)):
    return UserOutput.model_validate(user)
