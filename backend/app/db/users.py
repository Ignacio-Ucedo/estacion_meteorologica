import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

import bcrypt

_conn: sqlite3.Connection | None = None


def init_db(path: str) -> None:
    global _conn
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    _conn = sqlite3.connect(path, check_same_thread=False)
    _conn.row_factory = sqlite3.Row
    _conn.execute("PRAGMA journal_mode=WAL")
    _conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    _conn.commit()


def _db() -> sqlite3.Connection:
    if _conn is None:
        raise RuntimeError("Database not initialized — call init_db() first")
    return _conn


def create_user(username: str, password: str) -> dict:
    user_id = str(uuid.uuid4())
    created_at = datetime.now(UTC).isoformat()
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    db = _db()
    db.execute(
        "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
        (user_id, username, password_hash, created_at),
    )
    db.commit()
    return {"id": user_id, "username": username, "created_at": created_at}


def get_user_by_username(username: str) -> dict | None:
    row = _db().execute(
        "SELECT id, username, password_hash, created_at FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    return dict(row) if row else None


def list_users() -> list[dict]:
    rows = _db().execute("SELECT id, username, created_at FROM users ORDER BY created_at").fetchall()
    return [{"id": r["id"], "username": r["username"], "created_at": r["created_at"]} for r in rows]


def delete_user(user_id: str) -> bool:
    cursor = _db().execute("DELETE FROM users WHERE id = ?", (user_id,))
    _db().commit()
    return cursor.rowcount > 0


def verify_password(username: str, password: str) -> dict | None:
    user = get_user_by_username(username)
    if user is None:
        return None
    if bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        return {"id": user["id"], "username": user["username"], "created_at": user["created_at"]}
    return None
