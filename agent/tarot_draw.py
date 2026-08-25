import random
from tarot_cards import TAROT_CARDS


POSITIONS = [
    "过去 / 背景",
    "现在 / 核心问题",
    "未来 / 建议",
]


def draw_cards(count=3):
    count = 1 if count == 1 else 3
    selected_cards = random.sample(TAROT_CARDS, count)
    positions = ["核心牌 / 当下指引"] if count == 1 else POSITIONS
    result = []

    for index, card in enumerate(selected_cards):
        direction = random.choice(["正位", "逆位"])
        meaning = card["upright"] if direction == "正位" else card["reversed"]

        result.append({
            "id": card["id"],
            "position": positions[index],
            "name": card["name"],
            "arcana": card["arcana"],
            "direction": direction,
            "meaning": meaning,
        })

    return result
