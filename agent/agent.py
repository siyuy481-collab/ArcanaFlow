import re

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from config import DEEPSEEK_API_KEY
from minds_client import MindsAgentError, minds_is_configured, run_mind_single_turn
from prompts import PET_CHAT_PROMPT, PET_DRAW_PROMPT, TAROT_PROMPT
from tarot_draw import draw_cards


prompt = ChatPromptTemplate.from_template(TAROT_PROMPT)
pet_prompt = ChatPromptTemplate.from_template(PET_CHAT_PROMPT)
pet_draw_prompt = ChatPromptTemplate.from_template(PET_DRAW_PROMPT)
model = None
tarot_chain = None
pet_chain = None
pet_draw_chain = None

if DEEPSEEK_API_KEY:
    model = ChatOpenAI(
        model="deepseek-chat",
        api_key=DEEPSEEK_API_KEY,
        base_url="https://api.deepseek.com",
        timeout=25,
        max_retries=1,
    )
    tarot_chain = prompt | model
    pet_chain = pet_prompt | model
    pet_draw_chain = pet_draw_prompt | model


def format_cards(cards):
    return "\n\n".join(
        (
            f"位置：{card['position']}\n"
            f"牌名：{card['name']}\n"
            f"类型：{card['arcana']}\n"
            f"状态：{card['direction']}\n"
            f"牌义：{card['meaning']}"
        )
        for card in cards
    )


def build_fallback_reading(question, cards, locale="zh"):
    details = "；".join(
        f"{card['position']}是{card['name']}（{card['direction']}），关键词为{card['meaning']}"
        for card in cards
    )
    if locale == "en":
        return (
            f"Around “{question}”, the cards offer these starting points: {details}. "
            "Separate what has already happened from what anxiety may be amplifying, then return to one thing you can actually change now. "
            "You do not have to solve everything at once; begin with one small, observable action."
        )
    if locale == "ja":
        return (
            f"「{question}」をめぐり、カードは次の手がかりを示しています：{details}。"
            "すでに起きた事実と、不安が大きく見せている想像を分け、今変えられる一つのことへ意識を戻してみてください。"
            "すべてを一度に解決せず、確かめられる小さな行動から始めましょう。"
        )
    return (
        f"围绕“{question}”，这组牌首先呈现出以下线索：{details}。\n\n"
        "把这些牌放在一起看，它们更像是在提醒你：先分清哪些是已经发生的事实，"
        "哪些只是由焦虑放大的想象；再把注意力放回目前真正能够改变的一件事。"
        "你不必一次解决全部问题，可以从一个明确、可验证的小行动开始。"
    )


def run_tarot_reading(question, cards=None, locale="zh"):
    selected_cards = cards or draw_cards()
    formatted_cards = format_cards(selected_cards)

    if tarot_chain is None:
        return {"cards": selected_cards, "result": build_fallback_reading(question, selected_cards, locale)}

    try:
        language = {"en": "English", "ja": "日本語", "zh": "简体中文"}.get(locale, "简体中文")
        response = tarot_chain.invoke({"question": question, "cards": formatted_cards, "language": language})
        result = response.content
    except Exception:
        result = build_fallback_reading(question, selected_cards, locale)

    return {"cards": selected_cards, "result": result}


def format_pet_history(history):
    if not history:
        return "（这是本次会话的第一句话）"
    labels = {"user": "用户", "assistant": "阿卡娜"}
    return "\n".join(
        f"{labels.get(item.get('role'), '用户')}：{item.get('content', '').strip()}"
        for item in history[-8:]
        if item.get("content", "").strip()
    )


def build_pet_fallback(message, locale="zh"):
    lowered = message.lower()
    if locale == "en":
        if any(word in lowered for word in ("draw", "card", "tarot", "begin", "start")):
            return "Begin with one thing you genuinely want to understand, then phrase it as an open question rather than a prediction. When it feels clear enough, choose a card on the draw page—your first response to it matters too."
        if any(word in lowered for word in ("choose", "choice", "undecided", "hesitate")):
            return "You do not need to force an answer yet. Separate what you want, what you fear, and what you can verify today; one of those usually reveals the next useful step."
        return "I hear you. Try naming the part that feels most uncertain in one sentence, and we can turn it into a question that the cards can help you reflect on."
    if locale == "ja":
        if any(word in message for word in ("カード", "タロット", "引く", "占い", "始め")):
            return "まず、本当に確かめたいことを一つ選び、未来を断定する形ではなく、開かれた問いにしてみよう。問いが整ったら抽牌ページで一枚選び、その絵を見た最初の感覚も大切にしてね。"
        if any(word in message for word in ("迷", "選", "悩", "決め")):
            return "今すぐ答えを決めなくても大丈夫。望んでいること、不安に感じていること、今日確かめられることを分けると、次の一歩が見えやすくなるよ。"
        return "聞いているよ。いちばん曖昧に感じる部分を一文にしてみて。そこから、カードに向ける問いを一緒に整えよう。"
    if any(word in message for word in ("抽牌", "卡牌", "塔罗", "占卜", "怎么开始", "如何开始")):
        return "先选出一件你真正想看清的事，把它写成开放式问题，而不是要求预测一个确定结果。问题清楚以后，就去抽牌页选择牌面；看到图像时最先出现的感受，也值得记下来。"
    if any(word in message for word in ("犹豫", "选择", "纠结", "决定", "迷茫")):
        return "不用急着逼自己立刻得出答案。可以先把“我想要什么”“我在害怕什么”“今天能验证什么”分开写下来，下一步往往会在这三者之间变得清楚。"
    return "我听见了。试着用一句话说出这件事里最不确定的部分，我们可以从那里把它整理成更适合向牌面提问的问题。"


def run_pet_chat(message, history=None, locale="zh"):
    clean_message = message.strip()
    clean_history = history or []
    if pet_chain is None:
        return build_pet_fallback(clean_message, locale)

    try:
        language = {"en": "English", "ja": "日本語", "zh": "简体中文"}.get(locale, "简体中文")
        response = pet_chain.invoke({
            "message": clean_message,
            "history": format_pet_history(clean_history),
            "language": language,
        })
        reply = str(response.content).strip()
        return reply or build_pet_fallback(clean_message, locale)
    except Exception:
        return build_pet_fallback(clean_message, locale)


def build_pet_draw_fallback(question, card, locale="zh"):
    if locale == "en":
        return (
            f"For '{question}', {card['name']} ({card['direction']}) points to {card['meaning']}. "
            "Notice one small choice you can make today, and let evidence—not anxiety—guide the next step."
        )
    if locale == "ja":
        return (
            f"「{question}」に現れたのは{card['name']}（{card['direction']}）。鍵は「{card['meaning']}」です。"
            "今日は一つの小さな選択を観察し、不安ではなく確かめられる事実から次の一歩を決めてみて。"
        )
    return (
        f"关于“{question}”，你抽到{card['name']}（{card['direction']}），它把注意力带向“{card['meaning']}”。"
        "今天先观察一个真正能改变的小选择，让可验证的事实替你照亮下一步。"
    )


def run_pet_draw(question, locale="zh"):
    card = draw_cards(1)[0]
    if pet_draw_chain is None:
        return {"card_id": card["id"], "card": card, "reply": build_pet_draw_fallback(question, card, locale)}

    try:
        language = {"en": "English", "ja": "日本語", "zh": "简体中文"}.get(locale, "简体中文")
        response = pet_draw_chain.invoke({
            "question": question,
            "cards": format_cards([card]),
            "language": language,
        })
        reply = str(response.content).strip()
    except Exception:
        reply = build_pet_draw_fallback(question, card, locale)
    return {"card_id": card["id"], "card": card, "reply": reply or build_pet_draw_fallback(question, card, locale)}


KEYWORD_HINTS = {
    "zh": (
        "工作", "事业", "学习", "考试", "感情", "爱情", "关系", "家庭", "朋友",
        "选择", "未来", "改变", "机会", "压力", "焦虑", "迷茫", "犹豫", "健康", "金钱",
    ),
    "en": (
        "work", "career", "study", "exam", "love", "relationship", "family", "friend",
        "choice", "future", "change", "opportunity", "stress", "anxiety", "uncertain", "health", "money",
    ),
    "ja": (
        "仕事", "進路", "勉強", "試験", "恋愛", "関係", "家族", "友人", "選択",
        "未来", "変化", "機会", "不安", "迷い", "健康", "お金",
    ),
}


def extract_dialogue_keywords(message, locale="zh"):
    """Extract a few useful terms locally when Minds is unavailable."""
    text = message.strip()
    lowered = text.lower()
    found = []
    for hint in KEYWORD_HINTS.get(locale, KEYWORD_HINTS["zh"]):
        if hint.lower() in lowered and hint not in found:
            found.append(hint)

    if locale == "en":
        stopwords = {
            "about", "after", "before", "could", "from", "have", "just", "should", "that",
            "their", "there", "these", "this", "what", "when", "where", "which", "with", "would",
        }
        candidates = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", text)
        candidates = [word.lower() for word in candidates if word.lower() not in stopwords]
    elif locale == "ja":
        candidates = re.findall(r"[一-龯ぁ-んァ-ン]{2,10}", text)
    else:
        candidates = re.findall(r"[\u4e00-\u9fff]{2,8}", text)

    for candidate in candidates:
        if candidate not in found and not any(candidate in value or value in candidate for value in found):
            found.append(candidate)
        if len(found) >= 5:
            break
    return found[:5] or [text[:16]]


def run_pet_mind(message, locale="zh"):
    """One question, one Mind completion, one card, with no conversation history."""
    clean_message = message.strip()
    card = draw_cards(1)[0]
    provider = "local"
    result = None

    if minds_is_configured():
        try:
            result = run_mind_single_turn(clean_message, card, locale)
            provider = "minds"
        except MindsAgentError:
            result = None

    if result is None:
        provider = "deepseek" if pet_chain is not None else "local"
        result = {
            "reply": run_pet_chat(clean_message, history=[], locale=locale),
            "keywords": extract_dialogue_keywords(clean_message, locale),
            "reading": build_pet_draw_fallback(clean_message, card, locale),
        }

    return {
        "card_id": card["id"],
        "card": card,
        "reply": result["reply"],
        "keywords": result["keywords"],
        "reading": result["reading"],
        "provider": provider,
    }
