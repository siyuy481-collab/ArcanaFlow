import re

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from agent import run_pet_chat, run_pet_draw, run_pet_mind, run_tarot_reading
from database import (
    authenticate,
    create_reading,
    create_session,
    create_user,
    delete_reading,
    delete_session,
    get_reading,
    init_database,
    list_readings,
    user_for_token,
)
from minds_client import minds_is_configured
from schemas import (
    AuthResponse,
    LoginRequest,
    PetChatRequest,
    PetChatResponse,
    PetMindRequest,
    PetMindResponse,
    PetDrawRequest,
    PetDrawResponse,
    ReadingCreate,
    ReadingResponse,
    RegisterRequest,
    TarotRequest,
    TarotResponse,
    UserResponse,
)


app = FastAPI(
    title="ARCANA Tarot API",
    description="塔罗解读、账号与个人占卜记录 API",
    version="2.3.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5174", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
init_database()


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录状态无效")
    return token


def current_user(authorization: str | None = Header(default=None)) -> dict:
    token = _bearer_token(authorization)
    user = user_for_token(token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已过期，请重新登录")
    return user


@app.get("/")
def root():
    return {"message": "ARCANA API is ready", "version": "2.3.0"}


@app.post("/api/tarot", response_model=TarotResponse)
def tarot_reading(question_data: TarotRequest):
    question = question_data.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="请输入你想咨询的问题")
    cards = [card.model_dump() for card in question_data.cards] if question_data.cards else None
    return run_tarot_reading(question, cards=cards, locale=question_data.locale)


@app.post("/api/pet/chat", response_model=PetChatResponse)
def pet_chat(payload: PetChatRequest):
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="请先和阿卡娜说点什么")
    locale = payload.locale if payload.locale in {"zh", "en", "ja"} else "zh"
    history = [item.model_dump() for item in payload.history]
    return {"reply": run_pet_chat(message, history=history, locale=locale)}


@app.post("/api/pet/mind", response_model=PetMindResponse)
def pet_mind(payload: PetMindRequest):
    """Run one independent turn against one configured Mind and reveal one card."""
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="请先写下你想问的问题")
    locale = payload.locale if payload.locale in {"zh", "en", "ja"} else "zh"
    return run_pet_mind(message, locale=locale)


@app.get("/api/pet/mind/status")
def pet_mind_status():
    return {
        "configured": minds_is_configured(),
        "provider": "minds" if minds_is_configured() else "local",
        "mode": "single-turn",
    }


@app.post("/api/pet/draw", response_model=PetDrawResponse)
def pet_draw(payload: PetDrawRequest):
    keyword = payload.keyword.strip()
    if not keyword:
        raise HTTPException(status_code=422, detail="请输入一个关键词或短句")
    locale = payload.locale if payload.locale in {"zh", "en", "ja"} else "zh"
    return run_pet_draw(keyword, locale=locale)


@app.post("/api/auth/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest):
    username = payload.username.strip()
    email = payload.email.strip().lower()
    if not re.fullmatch(r"[A-Za-z0-9_\u4e00-\u9fff]{3,24}", username):
        raise HTTPException(status_code=422, detail="用户名需为 3–24 位中文、字母、数字或下划线")
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or len(email) > 254:
        raise HTTPException(status_code=422, detail="请输入有效的邮箱地址")
    if len(payload.password) < 8 or len(payload.password) > 128:
        raise HTTPException(status_code=422, detail="密码需为 8–128 位")
    try:
        user = create_user(username, email, payload.password)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"token": create_session(user["id"]), "user": user}


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    user = authenticate(payload.identifier.strip(), payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="账号或密码不正确")
    return {"token": create_session(user["id"]), "user": user}


@app.get("/api/auth/me", response_model=UserResponse)
def me(user: dict = Depends(current_user)):
    return user


@app.post("/api/auth/logout", status_code=204)
def logout(authorization: str | None = Header(default=None)):
    delete_session(_bearer_token(authorization))


@app.post("/api/readings", response_model=ReadingResponse, status_code=201)
def save_reading(payload: ReadingCreate, user: dict = Depends(current_user)):
    question = payload.question.strip()
    result = payload.result.strip()
    if not question or not result or not payload.cards:
        raise HTTPException(status_code=422, detail="占卜内容不完整，无法保存")
    title = (payload.title or question).strip()[:60]
    cards = [card.model_dump() for card in payload.cards]
    return create_reading(user["id"], title, question, cards, result)


@app.get("/api/readings", response_model=list[ReadingResponse])
def reading_history(user: dict = Depends(current_user)):
    return list_readings(user["id"])


@app.get("/api/readings/{reading_id}", response_model=ReadingResponse)
def reading_detail(reading_id: int, user: dict = Depends(current_user)):
    reading = get_reading(user["id"], reading_id)
    if reading is None:
        raise HTTPException(status_code=404, detail="没有找到这条占卜记录")
    return reading


@app.delete("/api/readings/{reading_id}", status_code=204)
def remove_reading(reading_id: int, user: dict = Depends(current_user)):
    if not delete_reading(user["id"], reading_id):
        raise HTTPException(status_code=404, detail="没有找到这条占卜记录")
