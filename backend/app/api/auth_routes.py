from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, HTTPException, Request, status

from app.config import get_settings
from app.db.users import create_user, delete_user, get_user_by_username, list_users, verify_password
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter()


def _make_token(user: dict) -> str:
    s = get_settings()
    payload = {
        "user_id": user["id"],
        "username": user["username"],
        "exp": datetime.now(UTC) + timedelta(days=30),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def _user_from_request(request: Request) -> dict | None:
    s = get_settings()
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        payload = jwt.decode(
            auth.removeprefix("Bearer "),
            s.jwt_secret,
            algorithms=[s.jwt_algorithm],
        )
        return {"id": payload.get("user_id"), "username": payload.get("username")}
    except jwt.PyJWTError:
        return None


@router.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest) -> UserResponse:
    if get_user_by_username(body.username) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username ya existe")
    user = create_user(body.username, body.password or body.username)
    return UserResponse(**user)


@router.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest) -> TokenResponse:
    user = verify_password(body.username, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    return TokenResponse(access_token=_make_token(user), token_type="bearer")


@router.get("/auth/me", response_model=UserResponse)
def me(request: Request) -> UserResponse:
    user = _user_from_request(request)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
    db_user = get_user_by_username(user["username"])
    if db_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return UserResponse(**{k: v for k, v in db_user.items() if k != "password_hash"})


@router.get("/users")
def get_users() -> list[dict]:
    """Lista todos los clientes — sin auth, uso exclusivo del operator-app en red local."""
    return list_users()


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_endpoint(user_id: str) -> None:
    if not delete_user(user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
