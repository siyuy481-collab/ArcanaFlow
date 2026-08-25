from typing import List, Optional

from pydantic import BaseModel, Field


class TarotCard(BaseModel):
    position: str
    name: str
    arcana: str
    direction: str
    meaning: str


class TarotRequest(BaseModel):
    question: str
    cards: Optional[List[TarotCard]] = None
    locale: str = "zh"


class TarotResponse(BaseModel):
    result: str
    cards: List[TarotCard] = Field(default_factory=list)


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    identifier: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class ReadingCreate(BaseModel):
    question: str
    cards: List[TarotCard] = Field(default_factory=list)
    result: str
    title: Optional[str] = None


class ReadingResponse(BaseModel):
    id: int
    title: str
    question: str
    cards: List[TarotCard] = Field(default_factory=list)
    result: str
    created_at: str


class PetChatMessage(BaseModel):
    role: str = "user"
    content: str = Field(min_length=1, max_length=800)


class PetChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=800)
    history: List[PetChatMessage] = Field(default_factory=list, max_length=8)
    locale: str = "zh"


class PetChatResponse(BaseModel):
    reply: str


class PetMindRequest(BaseModel):
    message: str = Field(min_length=1, max_length=800)
    locale: str = "zh"


class PetMindResponse(BaseModel):
    card_id: int
    card: TarotCard
    reply: str
    keywords: List[str] = Field(default_factory=list)
    reading: str
    provider: str


class PetDrawRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=240)
    locale: str = "zh"


class PetDrawResponse(BaseModel):
    card_id: int
    card: TarotCard
    reply: str
