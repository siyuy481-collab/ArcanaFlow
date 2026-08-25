"""ARCANA native Windows desktop pet.

The browser pet remains part of the site. This small Tk application is the
actual desktop resident: it can be dragged, locked, kept above other windows,
plays the refined animated pet, and supports trilingual chat plus one-card readings.
"""

from __future__ import annotations

import argparse
import ctypes
import json
import math
import os
import random
import re
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path
from tkinter import BooleanVar, Button, Entry, Frame, Label, Menu, Message, StringVar, Tk, Toplevel

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageSequence, ImageTk


PROJECT_ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = PROJECT_ROOT / "agent"
PET_ASSET_DIR = PROJECT_ROOT / "frontend" / "public" / "assets" / "pet"
CARD_ASSET_DIR = PROJECT_ROOT / "frontend" / "public" / "assets" / "cards"
CARD_BACK_PATH = PROJECT_ROOT / "frontend" / "assets" / "fate-tarot-card.png"
PET_GIF_PATH = PET_ASSET_DIR / "pet_hover.gif"
DRAW_API_URL = "http://127.0.0.1:8010/api/pet/draw"
MIND_API_URL = "http://127.0.0.1:8010/api/pet/mind"
TRANSPARENT = "#010203"
PANEL_BG = "#090d10"
PANEL_SURFACE = "#101519"
GOLD = "#c5a96d"
MUTED = "#858b8c"
TEXT = "#e7e2d7"

COPY = {
    "zh": {
        "title": "ARCANA · 桌面问答",
        "hint": "问她一个问题；她会提取关键词，并翻出一张牌。",
        "placeholder": "输入此刻想问的问题…",
        "ask": "问她",
        "draw": "抽一张",
        "listening": "正在倾听…",
        "drawing": "牌面正在靠近…",
        "empty": "请先写下一个问题。",
        "answered": "阿卡娜回应了你。",
        "revealed": "牌面已回应。",
        "error": "暂时未连接服务。你可以稍后再问，或先从一个能验证的小行动开始。",
        "you": "你",
        "unknown": "未知牌",
        "again": "再抽一张",
        "keywords": "关键词",
    },
    "en": {
        "title": "ARCANA · Desktop Companion",
        "hint": "Ask one question; she will find its keywords and turn into a card.",
        "placeholder": "What is on your mind?",
        "ask": "Ask",
        "draw": "Draw",
        "listening": "Listening…",
        "drawing": "A card is approaching…",
        "empty": "Write a question first.",
        "answered": "Arcana has answered.",
        "revealed": "The card has answered.",
        "error": "The service is unavailable for a moment. Try again shortly, or begin with one small action you can verify.",
        "you": "You",
        "unknown": "Unknown card",
        "again": "Draw again",
        "keywords": "Keywords",
    },
    "ja": {
        "title": "ARCANA · デスクトップ対話",
        "hint": "一つ質問してね。言葉を拾い、カードへ姿を変えます。",
        "placeholder": "今、何を聞きたい？",
        "ask": "聞く",
        "draw": "一枚引く",
        "listening": "聞いています…",
        "drawing": "カードが近づいています…",
        "empty": "まず質問を書いてね。",
        "answered": "アルカナが答えました。",
        "revealed": "カードが応えました。",
        "error": "今はサービスにつながらないみたい。少し後でもう一度試すか、確かめられる小さな一歩から始めてみて。",
        "you": "あなた",
        "unknown": "不明なカード",
        "again": "もう一枚",
        "keywords": "キーワード",
    },
}

CARD_FILES = [
    "00-fool.jpg", "01-magician.jpg", "02-high-priestess.jpg", "03-empress.jpg",
    "04-emperor.jpg", "05-hierophant.jpg", "06-lovers.jpg", "07-chariot.jpg",
    "08-strength.jpg", "09-hermit.jpg", "10-wheel-of-fortune.jpg", "11-justice.jpg",
    "12-hanged-man.jpg", "13-death.jpg", "14-temperance.jpg", "15-devil.jpg",
    "16-tower.jpg", "17-star.jpg", "18-moon.jpg", "19-sun.jpg",
    "20-judgement.jpg", "21-world.jpg",
]


def state_path() -> Path:
    base = Path(os.environ.get("LOCALAPPDATA") or Path.home())
    folder = base / "ArcanaMuse"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / "desktop-pet.json"


def load_state() -> dict:
    defaults = {"x": None, "y": None, "locked": False, "topmost": True, "locale": "zh"}
    try:
        value = json.loads(state_path().read_text(encoding="utf-8"))
        if isinstance(value, dict):
            defaults.update({key: value[key] for key in defaults if key in value})
    except (OSError, ValueError, TypeError):
        pass
    return defaults


def save_state(value: dict) -> None:
    try:
        state_path().write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def acquire_single_instance() -> object | None:
    if os.name != "nt":
        return object()
    handle = ctypes.windll.kernel32.CreateMutexW(None, False, "Local\\ArcanaMuseDesktopPet")
    if not handle:
        return None
    if ctypes.windll.kernel32.GetLastError() == 183:
        ctypes.windll.kernel32.CloseHandle(handle)
        return None
    return handle


def mark_tool_window(window) -> None:
    if os.name != "nt":
        return
    try:
        window.update_idletasks()
        hwnd = ctypes.windll.user32.GetParent(window.winfo_id()) or window.winfo_id()
        style = ctypes.windll.user32.GetWindowLongW(hwnd, -20)
        ctypes.windll.user32.SetWindowLongW(hwnd, -20, style | 0x00000080)
    except (AttributeError, OSError):
        pass


class ArcanaDesktopPet:
    PET_WIDTH = 152
    PET_HEIGHT = 238

    def __init__(self) -> None:
        self.root = Tk()
        self.root.title("ARCANA 桌宠")
        self.root.overrideredirect(True)
        self.root.configure(bg=TRANSPARENT)
        self.root.attributes("-transparentcolor", TRANSPARENT)

        self.state = load_state()
        if self.state.get("locale") not in COPY:
            self.state["locale"] = "zh"
        self.locked_var = BooleanVar(value=bool(self.state["locked"]))
        self.topmost_var = BooleanVar(value=bool(self.state["topmost"]))
        self.panel: Toplevel | None = None
        self.panel_photo = None
        self.pet_photos: dict[str, ImageTk.PhotoImage] = {}
        self.pet_images: dict[str, Image.Image] = {}
        self.pet_animation_frames: list[ImageTk.PhotoImage] = []
        self.pet_animation_durations: list[int] = []
        self.pet_animation_job = None
        self.pet_flip_job = None
        self.pet_card_return_job = None
        self.pet_flip_photo = None
        self.pet_card_active = False
        self.pet_card_image: Image.Image | None = None
        self.current_pet_state = "normal"
        self.busy = False
        self.drag_origin = None
        self.window_origin = None
        self.dragged = False
        self._load_assets()
        self._build_pet()
        self._place_pet()
        self._apply_topmost()
        self.root.after(60, lambda: mark_tool_window(self.root))

    def _fit_pet_frame(self, source: Image.Image, max_height: int = 222) -> Image.Image:
        source = source.convert("RGBA")
        alpha_box = source.getchannel("A").getbbox()
        if alpha_box:
            padding = 5
            source = source.crop((
                max(0, alpha_box[0] - padding),
                max(0, alpha_box[1] - padding),
                min(source.width, alpha_box[2] + padding),
                min(source.height, alpha_box[3] + padding),
            ))
        source.thumbnail((132, max_height), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (self.PET_WIDTH, self.PET_HEIGHT), (0, 0, 0, 0))
        canvas.alpha_composite(source, ((self.PET_WIDTH - source.width) // 2, self.PET_HEIGHT - source.height - 2))
        return canvas

    def _load_assets(self) -> None:
        # Tammy's 67-frame asset becomes the visual source for the native pet.
        # The question mark is removed only from the resting frame; opening the
        # panel or waiting for a reply plays the original animated sequence.
        with Image.open(PET_GIF_PATH) as gif:
            gif.seek(0)
            refined_base = gif.convert("RGBA")
            refined_base.paste((0, 0, 0, 0), (112, 0, 218, 86))
            normal = self._fit_pet_frame(refined_base)

            for frame in ImageSequence.Iterator(gif):
                prepared = self._fit_pet_frame(frame.convert("RGBA"))
                self.pet_animation_frames.append(ImageTk.PhotoImage(prepared))
                self.pet_animation_durations.append(max(45, int(frame.info.get("duration", gif.info.get("duration", 100)))))

        glow_alpha = normal.getchannel("A").filter(ImageFilter.GaussianBlur(5))
        glow = Image.new("RGBA", normal.size, (202, 166, 91, 0))
        glow.putalpha(glow_alpha.point(lambda value: round(value * 0.34)))
        happy = Image.alpha_composite(glow, ImageEnhance.Brightness(normal).enhance(1.08))
        sleep = ImageEnhance.Brightness(normal).enhance(0.58)

        self.pet_images = {
            "normal": normal,
            "happy": happy,
            "question": normal,
            "sleep": sleep,
        }
        self.pet_photos = {state: ImageTk.PhotoImage(image) for state, image in self.pet_images.items()}

        self.card_back = ImageOps.fit(
            Image.open(CARD_BACK_PATH).convert("RGB"),
            (112, 178),
            method=Image.Resampling.LANCZOS,
        )

    def _build_pet(self) -> None:
        self.pet_label = Label(
            self.root,
            image=self.pet_photos["normal"],
            bg=TRANSPARENT,
            bd=0,
            highlightthickness=0,
            cursor="hand2",
        )
        self.pet_label.place(x=0, y=0, width=self.PET_WIDTH, height=self.PET_HEIGHT)
        for widget in (self.root, self.pet_label):
            widget.bind("<ButtonPress-1>", self._drag_start)
            widget.bind("<B1-Motion>", self._drag_move)
            widget.bind("<ButtonRelease-1>", self._drag_end)
            widget.bind("<Button-3>", self._show_menu)

        self.menu = Menu(
            self.root,
            tearoff=False,
            bg=PANEL_SURFACE,
            fg=TEXT,
            activebackground="#25231c",
            activeforeground="#f4dfac",
            bd=0,
        )
        self.menu.add_checkbutton(label="锁定位置", variable=self.locked_var, command=self._settings_changed)
        self.menu.add_checkbutton(label="始终置顶", variable=self.topmost_var, command=self._settings_changed)
        self.menu.add_separator()
        self.menu.add_command(label="回到右下角", command=self._reset_position)
        self.menu.add_command(label="打开 ARCANA 网站", command=self._open_site)
        self.menu.add_separator()
        self.menu.add_command(label="退出桌宠", command=self.root.destroy)

    def _place_pet(self) -> None:
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        default_x = screen_width - self.PET_WIDTH - 34
        default_y = screen_height - self.PET_HEIGHT - 78
        x = self.state.get("x")
        y = self.state.get("y")
        x = default_x if not isinstance(x, int) else max(0, min(x, screen_width - self.PET_WIDTH))
        y = default_y if not isinstance(y, int) else max(0, min(y, screen_height - self.PET_HEIGHT))
        self.root.geometry(f"{self.PET_WIDTH}x{self.PET_HEIGHT}+{x}+{y}")

    def _drag_start(self, event) -> None:
        self.drag_origin = (event.x_root, event.y_root)
        self.window_origin = (self.root.winfo_x(), self.root.winfo_y())
        self.dragged = False

    def _drag_move(self, event) -> None:
        if self.locked_var.get() or not self.drag_origin or not self.window_origin:
            return
        delta_x = event.x_root - self.drag_origin[0]
        delta_y = event.y_root - self.drag_origin[1]
        if abs(delta_x) + abs(delta_y) < 4:
            return
        self.dragged = True
        x = self.window_origin[0] + delta_x
        y = self.window_origin[1] + delta_y
        x = max(0, min(x, self.root.winfo_screenwidth() - self.PET_WIDTH))
        y = max(0, min(y, self.root.winfo_screenheight() - self.PET_HEIGHT))
        self.root.geometry(f"+{x}+{y}")
        if self.panel and self.panel.winfo_exists():
            self._position_panel()

    def _drag_end(self, _event) -> None:
        if self.dragged:
            self.state["x"] = self.root.winfo_x()
            self.state["y"] = self.root.winfo_y()
            save_state(self.state)
        elif not self.busy:
            self.toggle_panel()
        self.drag_origin = None
        self.window_origin = None

    def _show_menu(self, event) -> None:
        self.menu.tk_popup(event.x_root, event.y_root)

    def _settings_changed(self) -> None:
        self.state["locked"] = self.locked_var.get()
        self.state["topmost"] = self.topmost_var.get()
        save_state(self.state)
        self._apply_topmost()

    def _apply_topmost(self) -> None:
        topmost = self.topmost_var.get()
        self.root.attributes("-topmost", topmost)
        if self.panel and self.panel.winfo_exists():
            self.panel.attributes("-topmost", topmost)

    def _reset_position(self) -> None:
        self.state["x"] = None
        self.state["y"] = None
        save_state(self.state)
        self._place_pet()

    @staticmethod
    def _open_site() -> None:
        os.startfile("http://127.0.0.1:5174/")

    def _copy(self) -> dict[str, str]:
        return COPY.get(self.state.get("locale", "zh"), COPY["zh"])

    def set_pet_state(self, state: str, restore_after: int = 0) -> None:
        if self.pet_card_active:
            return
        if state not in self.pet_photos:
            state = "normal"
        if self.pet_animation_job:
            self.root.after_cancel(self.pet_animation_job)
            self.pet_animation_job = None
        self.current_pet_state = state
        if state == "question" and self.pet_animation_frames:
            self._play_pet_animation(0)
        else:
            self.pet_label.configure(image=self.pet_photos[state])
        if restore_after:
            self.root.after(restore_after, lambda: self.set_pet_state("normal") if not self.busy else None)

    def _play_pet_animation(self, index: int) -> None:
        if self.current_pet_state != "question" or not self.pet_animation_frames:
            return
        frame_index = index % len(self.pet_animation_frames)
        self.pet_label.configure(image=self.pet_animation_frames[frame_index])
        duration = self.pet_animation_durations[frame_index]
        self.pet_animation_job = self.root.after(duration, lambda: self._play_pet_animation(frame_index + 1))

    def toggle_panel(self) -> None:
        if self.panel and self.panel.winfo_exists():
            self.close_panel()
        else:
            self.open_panel()

    def open_panel(self) -> None:
        panel = Toplevel(self.root)
        self.panel = panel
        panel.overrideredirect(True)
        panel.configure(bg=GOLD)
        panel.attributes("-topmost", self.topmost_var.get())
        panel.geometry("430x166")
        panel.bind("<Escape>", lambda _event: self.close_panel())
        panel.bind("<FocusOut>", self._soft_focus_out)

        shell = Frame(panel, bg=PANEL_BG)
        shell.place(x=1, y=1, relwidth=1, relheight=1, width=-2, height=-2)
        self.panel_title = Label(shell, text="", bg=PANEL_BG, fg=GOLD, font=("Microsoft YaHei UI", 10, "bold"))
        self.panel_title.place(x=20, y=14)
        self.locale_buttons = {}
        for index, (locale, label) in enumerate((("zh", "中"), ("en", "EN"), ("ja", "日"))):
            button = Button(
                shell, text=label, command=lambda value=locale: self._set_locale(value),
                bg=PANEL_BG, fg=MUTED, activebackground="#211f19", activeforeground=GOLD,
                relief="flat", bd=0, font=("Segoe UI", 8), cursor="hand2",
            )
            button.place(x=286 + index * 34, y=9, width=31, height=27)
            self.locale_buttons[locale] = button
        Button(
            shell, text="×", command=self.close_panel, bg=PANEL_BG, fg=MUTED,
            activebackground=PANEL_BG, activeforeground=TEXT, relief="flat",
            bd=0, font=("Segoe UI", 14), cursor="hand2",
        ).place(x=398, y=6, width=26, height=28)
        self.panel_hint = Label(
            shell, text="",
            bg=PANEL_BG, fg=MUTED, font=("Microsoft YaHei UI", 8),
        )
        self.panel_hint.place(x=20, y=43)

        self.keyword_var = StringVar()
        self.keyword_entry = Entry(
            shell, textvariable=self.keyword_var, bg=PANEL_SURFACE, fg=TEXT,
            insertbackground=GOLD, relief="flat", bd=0, font=("Microsoft YaHei UI", 10),
        )
        self.keyword_entry.place(x=20, y=75, width=228, height=38)
        self.keyword_entry.bind("<Return>", lambda _event: self.ask_question())
        self.ask_button = Button(
            shell, text="", command=self.ask_question, bg="#191812", fg="#e4ca8b",
            activebackground="#28241a", activeforeground="#f3dfa9", relief="flat",
            bd=0, font=("Microsoft YaHei UI", 9), cursor="hand2",
        )
        self.ask_button.place(x=256, y=75, width=70, height=38)
        self.draw_button = Button(
            shell, text="", command=self.draw_card, bg=PANEL_SURFACE, fg="#aaa18e",
            activebackground="#1c2226", activeforeground="#e1ceb0", relief="flat",
            bd=0, font=("Microsoft YaHei UI", 9), cursor="hand2",
        )
        self.draw_button.place(x=334, y=75, width=72, height=38)
        self.status_label = Label(shell, text="", bg=PANEL_BG, fg=MUTED, font=("Microsoft YaHei UI", 8))
        self.status_label.place(x=20, y=120)

        self.result_rule = Frame(shell, bg="#28251e")
        self.chat_question = Label(shell, text="", bg=PANEL_BG, fg=GOLD, anchor="w", font=("Microsoft YaHei UI", 8, "bold"))
        self.chat_reply = Message(shell, text="", bg=PANEL_BG, fg=TEXT, width=378, font=("Microsoft YaHei UI", 9))
        self.card_label = Label(shell, bg="#0b0f12", bd=0)
        self.result_title = Label(shell, text="", bg=PANEL_BG, fg=GOLD, anchor="w", font=("Microsoft YaHei UI", 11, "bold"))
        self.result_meaning = Message(shell, text="", bg=PANEL_BG, fg=MUTED, width=226, font=("Microsoft YaHei UI", 8))
        self.result_reply = Message(shell, text="", bg=PANEL_BG, fg=TEXT, width=230, font=("Microsoft YaHei UI", 9))

        self._update_panel_copy()
        self._position_panel()
        self.set_pet_state("question")
        self.root.after(40, lambda: mark_tool_window(panel))
        self.root.after(80, self.keyword_entry.focus_force)

    def _set_locale(self, locale: str) -> None:
        if locale not in COPY:
            return
        self.state["locale"] = locale
        save_state(self.state)
        self._update_panel_copy()
        self.keyword_entry.focus_force()

    def _update_panel_copy(self) -> None:
        if not self.panel or not self.panel.winfo_exists():
            return
        text = self._copy()
        self.panel_title.configure(text=text["title"])
        self.panel_hint.configure(text=text["hint"])
        self.keyword_entry.configure(
            font=("Yu Gothic UI", 10) if self.state["locale"] == "ja" else ("Microsoft YaHei UI", 10)
        )
        # Tk Entry has no native placeholder, so the hint above remains visible.
        if not self.busy:
            self.ask_button.configure(text=text["ask"], state="normal")
            self.draw_button.configure(text=text["draw"], state="normal")
        for locale, button in self.locale_buttons.items():
            active = locale == self.state["locale"]
            button.configure(bg="#211f19" if active else PANEL_BG, fg=GOLD if active else MUTED)

    def _hide_results(self) -> None:
        for widget in (
            self.result_rule, self.chat_question, self.chat_reply, self.card_label,
            self.result_title, self.result_meaning, self.result_reply,
        ):
            widget.place_forget()

    def _set_busy(self, busy: bool, status: str = "") -> None:
        self.busy = busy
        state = "disabled" if busy else "normal"
        self.ask_button.configure(state=state)
        self.draw_button.configure(state=state)
        for button in self.locale_buttons.values():
            button.configure(state=state)
        self.status_label.configure(text=status, fg=MUTED)

    def _soft_focus_out(self, _event) -> None:
        # Do not auto-close while a menu or another control is receiving focus.
        pass

    def _position_panel(self) -> None:
        if not self.panel or not self.panel.winfo_exists():
            return
        self.panel.update_idletasks()
        width = self.panel.winfo_width() or 430
        height = self.panel.winfo_height() or 166
        pet_x, pet_y = self.root.winfo_x(), self.root.winfo_y()
        screen_w, screen_h = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        x = pet_x - width - 8 if pet_x + self.PET_WIDTH + width > screen_w else pet_x + self.PET_WIDTH - 12
        y = min(max(12, pet_y + self.PET_HEIGHT - height - 12), screen_h - height - 48)
        self.panel.geometry(f"+{max(8, x)}+{max(8, y)}")

    def close_panel(self) -> None:
        if self.panel and self.panel.winfo_exists():
            self.panel.destroy()
        self.panel = None
        self.busy = False
        self.set_pet_state("normal")

    def _question_text(self) -> str:
        return self.keyword_var.get().strip()

    def _prepare_request(self) -> str | None:
        if self.busy or not self.panel or not self.panel.winfo_exists():
            return None
        question = self._question_text()
        if not question:
            self.status_label.configure(text=self._copy()["empty"], fg="#bb8b78")
            self.keyword_entry.focus_force()
            return None
        self._hide_results()
        self.panel.geometry("430x166")
        self._position_panel()
        self.set_pet_state("question")
        return question

    def ask_question(self) -> None:
        question = self._prepare_request()
        if not question:
            return
        locale = self.state["locale"]
        self._set_busy(True, self._copy()["listening"])
        self.ask_button.configure(text=self._copy()["listening"])
        threading.Thread(target=self._fetch_mind, args=(question, locale), daemon=True).start()

    def _fetch_mind(self, question: str, locale: str) -> None:
        try:
            body = json.dumps({"message": question, "locale": locale}).encode("utf-8")
            request = urllib.request.Request(
                MIND_API_URL,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=180) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if not payload.get("reply") or not payload.get("card"):
                raise ValueError("Incomplete Mind response")
        except (OSError, ValueError, urllib.error.URLError):
            payload = self._local_mind(question, locale)
        self.root.after(0, lambda: self._show_mind_response(question, payload))

    @staticmethod
    def _local_chat(question: str, locale: str) -> str:
        if locale == "en":
            return (
                f"I hear the question: “{question}”. Separate what you know, what you fear, "
                "and what you can verify today; the next useful step is usually hidden between those three."
            )
        if locale == "ja":
            return (
                f"「{question}」という問い、聞いているよ。分かっていること、不安に感じること、"
                "今日確かめられることを分けると、次の一歩が見えやすくなるよ。"
            )
        return (
            f"我听见了你关于“{question}”的疑问。先把已经知道的事实、正在担心的想象，"
            "以及今天能够验证的事情分开，下一步往往会从这三者之间变得清晰。"
        )

    @staticmethod
    def _local_keywords(question: str, locale: str) -> list[str]:
        if locale == "en":
            words = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", question)
            return list(dict.fromkeys(word.lower() for word in words))[:5] or ["reflection"]
        pattern = r"[一-龯ぁ-んァ-ン]{2,10}" if locale == "ja" else r"[\u4e00-\u9fff]{2,8}"
        return list(dict.fromkeys(re.findall(pattern, question)))[:5] or [question[:12]]

    @classmethod
    def _local_mind(cls, question: str, locale: str) -> dict:
        payload = cls._local_reading(question, locale)
        reading = payload["reply"]
        payload.update({
            "reply": cls._local_chat(question, locale),
            "keywords": cls._local_keywords(question, locale),
            "reading": reading,
            "provider": "local",
        })
        return payload

    def _show_mind_response(self, question: str, payload: dict) -> None:
        payload["question"] = question
        self._reveal(payload)

    def draw_card(self) -> None:
        keyword = self._prepare_request()
        if not keyword:
            return
        locale = self.state["locale"]
        self._set_busy(True, self._copy()["drawing"])
        self.draw_button.configure(text=self._copy()["drawing"])
        threading.Thread(target=self._fetch_reading, args=(keyword, locale), daemon=True).start()

    def _fetch_reading(self, keyword: str, locale: str) -> None:
        try:
            body = json.dumps({"keyword": keyword, "locale": locale}).encode("utf-8")
            request = urllib.request.Request(
                DRAW_API_URL,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=35) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (OSError, ValueError, urllib.error.URLError):
            payload = self._local_reading(keyword, locale)
        self.root.after(0, lambda: self._reveal(payload))

    @staticmethod
    def _local_reading(keyword: str, locale: str = "zh") -> dict:
        if str(AGENT_DIR) not in sys.path:
            sys.path.insert(0, str(AGENT_DIR))
        from tarot_draw import draw_cards

        card = draw_cards(1)[0]
        if locale == "en":
            reply = (
                f"For “{keyword}”, {card['name']} ({card['direction']}) points to {card['meaning']}. "
                "Notice one small choice you can verify today before deciding the next step."
            )
        elif locale == "ja":
            reply = (
                f"「{keyword}」に現れたのは{card['name']}（{card['direction']}）。鍵は「{card['meaning']}」です。"
                "今日は自分で確かめられる小さな選択を一つ観察してみて。"
            )
        else:
            reply = (
                f"关于“{keyword}”，{card['name']}（{card['direction']}）把注意力带向“{card['meaning']}”。"
                "今天先留意一个能亲自验证的小选择，再决定下一步。"
            )
        return {"card_id": card["id"], "card": card, "reply": reply}

    def _reveal(self, payload: dict) -> None:
        if not self.panel or not self.panel.winfo_exists():
            self.busy = False
            return
        card = payload.get("card") or {}
        card_id = max(0, min(21, int(payload.get("card_id", 0))))
        face = ImageOps.fit(
            Image.open(CARD_ASSET_DIR / CARD_FILES[card_id]).convert("RGB"),
            (112, 178),
            method=Image.Resampling.LANCZOS,
        )
        if card.get("direction") == "逆位":
            face = face.rotate(180)

        self._hide_results()
        keywords = [str(value).strip() for value in payload.get("keywords", []) if str(value).strip()]
        meaning_lines = []
        if keywords:
            meaning_lines.append(f"{self._copy()['keywords']} · {' · '.join(keywords)}")
        if card.get("meaning"):
            meaning_lines.append(str(card["meaning"]))
        reply_parts = [str(payload.get("reply", "")).strip()]
        reading = str(payload.get("reading", "")).strip()
        if reading and reading not in reply_parts:
            reply_parts.append(reading)

        self.panel.geometry("430x410")
        self._position_panel()
        self.result_rule.place(x=20, y=145, width=390, height=1)
        self.card_label.place(x=20, y=160, width=112, height=178)
        self.result_title.configure(text=f"{card.get('name', self._copy()['unknown'])} · {card.get('direction', '')}")
        self.result_title.place(x=150, y=161, width=250, height=25)
        self.result_meaning.configure(text="\n".join(meaning_lines))
        self.result_meaning.place(x=150, y=191, width=250, height=58)
        self.result_reply.configure(text="\n\n".join(part for part in reply_parts if part))
        self.result_reply.place(x=150, y=252, width=250, height=140)
        self.status_label.configure(text=self._copy()["revealed"], fg=GOLD)
        self._animate_flip(face, step=0)
        self._animate_pet_to_card(face)

    def _animate_flip(self, face: Image.Image, step: int) -> None:
        if not self.panel or not self.panel.winfo_exists():
            self.busy = False
            return
        total = 22
        phase = step / (total - 1)
        width = max(2, round(112 * abs(math.cos(math.pi * phase))))
        source = self.card_back if phase < 0.5 else face
        narrowed = source.resize((width, 178), Image.Resampling.BICUBIC)
        frame = Image.new("RGB", (112, 178), PANEL_BG)
        frame.paste(narrowed, ((112 - width) // 2, 0))
        self.panel_photo = ImageTk.PhotoImage(frame)
        self.card_label.configure(image=self.panel_photo)
        if step < total - 1:
            self.root.after(34, lambda: self._animate_flip(face, step + 1))
            return
        self.busy = False
        self._update_panel_copy()
        self.draw_button.configure(text=self._copy()["again"])
        self.keyword_entry.select_range(0, "end")

    def _pet_card_canvas(self, face: Image.Image) -> Image.Image:
        face_rgba = ImageOps.fit(face.convert("RGBA"), (118, 188), method=Image.Resampling.LANCZOS)
        bordered = ImageOps.expand(face_rgba, border=3, fill=(197, 169, 109, 255))
        shadow_alpha = bordered.getchannel("A").filter(ImageFilter.GaussianBlur(7))
        shadow = Image.new("RGBA", bordered.size, (197, 169, 109, 0))
        shadow.putalpha(shadow_alpha.point(lambda value: round(value * 0.32)))
        canvas = Image.new("RGBA", (self.PET_WIDTH, self.PET_HEIGHT), (0, 0, 0, 0))
        x = (self.PET_WIDTH - bordered.width) // 2
        y = (self.PET_HEIGHT - bordered.height) // 2
        canvas.alpha_composite(shadow, (x, y + 3))
        canvas.alpha_composite(bordered, (x, y))
        return canvas

    def _animate_pet_to_card(self, face: Image.Image) -> None:
        if self.pet_animation_job:
            self.root.after_cancel(self.pet_animation_job)
            self.pet_animation_job = None
        if self.pet_flip_job:
            self.root.after_cancel(self.pet_flip_job)
            self.pet_flip_job = None
        if self.pet_card_return_job:
            self.root.after_cancel(self.pet_card_return_job)
            self.pet_card_return_job = None
        start = self.pet_card_image if self.pet_card_active and self.pet_card_image is not None else self.pet_images["normal"]
        self.pet_card_image = self._pet_card_canvas(face)
        self.pet_card_active = True
        self._animate_pet_transition(start, self.pet_card_image, 0, returning=False)

    def _animate_pet_transition(
        self,
        start: Image.Image,
        finish: Image.Image,
        step: int,
        returning: bool,
    ) -> None:
        total = 28
        phase = step / (total - 1)
        width = max(2, round(self.PET_WIDTH * abs(math.cos(math.pi * phase))))
        source = start if phase < 0.5 else finish
        narrowed = source.resize((width, self.PET_HEIGHT), Image.Resampling.BICUBIC)
        frame = Image.new("RGBA", (self.PET_WIDTH, self.PET_HEIGHT), (0, 0, 0, 0))
        frame.alpha_composite(narrowed, ((self.PET_WIDTH - width) // 2, 0))
        self.pet_flip_photo = ImageTk.PhotoImage(frame)
        self.pet_label.configure(image=self.pet_flip_photo)
        if step < total - 1:
            self.pet_flip_job = self.root.after(
                28,
                lambda: self._animate_pet_transition(start, finish, step + 1, returning),
            )
            return

        self.pet_flip_job = None
        self.pet_flip_photo = ImageTk.PhotoImage(finish)
        self.pet_label.configure(image=self.pet_flip_photo)
        if returning:
            self.pet_card_active = False
            self.pet_card_image = None
            self.set_pet_state("question" if self.panel and self.panel.winfo_exists() else "normal")
        else:
            self.pet_card_return_job = self.root.after(8000, self._return_pet_to_cat)

    def _return_pet_to_cat(self) -> None:
        self.pet_card_return_job = None
        if not self.pet_card_active or self.pet_card_image is None:
            return
        self._animate_pet_transition(self.pet_card_image, self.pet_images["normal"], 0, returning=True)

    def run(self) -> None:
        self.root.mainloop()


def self_test() -> int:
    required = [PET_ASSET_DIR / f"cat_{state}.png" for state in ("normal", "happy", "question", "sleep")]
    required.append(PET_GIF_PATH)
    required += [CARD_ASSET_DIR / name for name in CARD_FILES]
    required.append(CARD_BACK_PATH)
    missing = [path for path in required if not path.is_file()]
    if missing:
        print("Missing assets:")
        for path in missing:
            print(path)
        return 1
    for path in required:
        with Image.open(path) as image:
            image.verify()
    payload = ArcanaDesktopPet._local_reading("测试关键词")
    assert 0 <= payload["card_id"] <= 21
    assert payload["card"]["name"] in payload["reply"]
    assert "I hear the question" in ArcanaDesktopPet._local_chat("What next?", "en")
    assert "聞いているよ" in ArcanaDesktopPet._local_chat("次は？", "ja")
    print("ARCANA desktop pet self-test passed.")
    return 0


def ui_test() -> int:
    app = ArcanaDesktopPet()
    app.open_panel()
    payload = app._local_mind("最近的工作选择让我有点焦虑", "zh")
    result = {"ok": False}

    def verify() -> None:
        result["ok"] = bool(app.pet_card_active and app.pet_card_image is not None and not app.busy)
        app.root.destroy()

    app._set_busy(True, app._copy()["listening"])
    app._show_mind_response("最近的工作选择让我有点焦虑", payload)
    app.root.after(1300, verify)
    app.root.mainloop()
    if not result["ok"]:
        print("ARCANA desktop pet UI test failed.")
        return 1
    print("ARCANA desktop pet UI test passed.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="ARCANA Windows desktop pet")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--ui-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if args.ui_test:
        return ui_test()
    mutex = acquire_single_instance()
    if mutex is None:
        return 0
    app = ArcanaDesktopPet()
    app.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
