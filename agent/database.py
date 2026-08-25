"""Small SQLite persistence layer for local accounts and reading history."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path


AGENT_DIR = Path(__file__).resolve().parent


def _database_path() -> Path:
    configured = os.getenv("ARCANA_DB_PATH", "arcana.db")
    path = Path(configured)
    return path if path.is_absolute() else AGENT_DIR / path


def _connect() -> sqlite3.Connection:
    path = _database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_database() -> None:
    with closing(_connect()) as connection, connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                question TEXT NOT NULL,
                cards_json TEXT NOT NULL,
                result TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
            CREATE INDEX IF NOT EXISTS idx_readings_user_created
                ON readings(user_id, created_at DESC);
            """
        )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def _password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310_000)
    return f"{salt.hex()}${digest.hex()}"


def _password_matches(password: str, encoded: str) -> bool:
    try:
        salt_hex, expected_hex = encoded.split("$", 1)
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 310_000
        )
        return hmac.compare_digest(actual.hex(), expected_hex)
    except (ValueError, TypeError):
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def public_user(row: sqlite3.Row | dict) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "created_at": row["created_at"],
    }


def create_user(username: str, email: str, password: str) -> dict:
    created_at = _iso(_now())
    try:
        with closing(_connect()) as connection, connection:
            cursor = connection.execute(
                "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (username, email, _password_hash(password), created_at),
            )
            row = connection.execute(
                "SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
    except sqlite3.IntegrityError as error:
        message = str(error).lower()
        if "username" in message:
            raise ValueError("用户名已被使用") from error
        if "email" in message:
            raise ValueError("邮箱已被注册") from error
        raise ValueError("账号信息已存在") from error
    return public_user(row)


def authenticate(identifier: str, password: str) -> dict | None:
    with closing(_connect()) as connection, connection:
        row = connection.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
            (identifier, identifier),
        ).fetchone()
    if row is None or not _password_matches(password, row["password_hash"]):
        return None
    return public_user(row)


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = _now()
    with closing(_connect()) as connection, connection:
        connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (_iso(now),))
        connection.execute(
            "INSERT INTO sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (user_id, _token_hash(token), _iso(now + timedelta(days=30)), _iso(now)),
        )
    return token


def user_for_token(token: str) -> dict | None:
    with closing(_connect()) as connection, connection:
        row = connection.execute(
            """
            SELECT users.* FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ? AND sessions.expires_at > ?
            """,
            (_token_hash(token), _iso(_now())),
        ).fetchone()
    return public_user(row) if row else None


def delete_session(token: str) -> None:
    with closing(_connect()) as connection, connection:
        connection.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))


def _reading_from_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "question": row["question"],
        "cards": json.loads(row["cards_json"]),
        "result": row["result"],
        "created_at": row["created_at"],
    }


def create_reading(user_id: int, title: str, question: str, cards: list, result: str) -> dict:
    created_at = _iso(_now())
    with closing(_connect()) as connection, connection:
        cursor = connection.execute(
            """
            INSERT INTO readings (user_id, title, question, cards_json, result, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, title, question, json.dumps(cards, ensure_ascii=False), result, created_at),
        )
        row = connection.execute(
            "SELECT * FROM readings WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
    return _reading_from_row(row)


def list_readings(user_id: int) -> list[dict]:
    with closing(_connect()) as connection, connection:
        rows = connection.execute(
            "SELECT * FROM readings WHERE user_id = ? ORDER BY created_at DESC, id DESC",
            (user_id,),
        ).fetchall()
    return [_reading_from_row(row) for row in rows]


def get_reading(user_id: int, reading_id: int) -> dict | None:
    with closing(_connect()) as connection, connection:
        row = connection.execute(
            "SELECT * FROM readings WHERE user_id = ? AND id = ?",
            (user_id, reading_id),
        ).fetchone()
    return _reading_from_row(row) if row else None


def delete_reading(user_id: int, reading_id: int) -> bool:
    with closing(_connect()) as connection, connection:
        cursor = connection.execute(
            "DELETE FROM readings WHERE user_id = ? AND id = ?", (user_id, reading_id)
        )
    return cursor.rowcount > 0
