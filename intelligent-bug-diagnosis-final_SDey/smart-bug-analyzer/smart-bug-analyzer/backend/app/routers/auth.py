from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # Bootstrap: the very first account created becomes Admin, since there's
    # no other way to reach the Admin Panel on a brand-new install. Anyone
    # registering after that gets their requested role EXCEPT "Admin" —
    # allowing a self-requested Admin role here would be a privilege
    # escalation hole, so it's silently downgraded to the default. Granting
    # Admin to someone after the first user requires an existing Admin,
    # either via the Admin Panel or PUT /api/auth/me (see require_admin()
    # and the check in update_me() below).
    is_first_user = db.query(models.User).count() == 0
    if is_first_user:
        role = "Admin"
    else:
        requested = payload.role or "Developer"
        role = "Developer" if requested == "Admin" else requested

    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user=user)


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user=user)


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.role is not None:
        if payload.role == "Admin" and current_user.role != "Admin":
            raise HTTPException(
                status_code=403,
                detail="Only an existing Admin can grant the Admin role. Ask an admin to promote you from the Admin Panel.",
            )
        if current_user.role == "Admin" and payload.role != "Admin":
            raise HTTPException(
                status_code=400,
                detail="You can't demote yourself out of Admin here. Ask another Admin to do it from the Admin Panel.",
            )
        current_user.role = payload.role
    if payload.password:
        current_user.hashed_password = hash_password(payload.password)

    db.commit()
    db.refresh(current_user)
    return current_user
