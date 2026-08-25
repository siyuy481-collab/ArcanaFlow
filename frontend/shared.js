import { getLocale, t } from "./i18n.js"

export const PENDING_READING_KEY = "arcana.pending-reading.v2"
export const UNSAVED_READING_KEY = "arcana.unsaved-reading.v2"
const TOKEN_KEY = "arcana.auth-token.v2"

const BASE_TAROT_CARDS = [
  { number: "0", zh: "愚者", en: "THE FOOL", symbol: "✦", upright: "新的开始、自由、冒险与开放的可能", reversed: "冲动、准备不足、逃避责任与鲁莽尝试" },
  { number: "I", zh: "魔术师", en: "THE MAGICIAN", symbol: "∞", upright: "行动力、创造力、资源整合与主动出击", reversed: "能力未发挥、分心、操控与行动迟滞" },
  { number: "II", zh: "女祭司", en: "THE HIGH PRIESTESS", symbol: "☾", upright: "直觉、潜意识、内在智慧与保持观察", reversed: "压抑直觉、信息不明、沉默过度与迷惘" },
  { number: "III", zh: "皇后", en: "THE EMPRESS", symbol: "♀", upright: "滋养、成长、创造与关系中的温度", reversed: "停滞、过度付出、依赖与缺少边界" },
  { number: "IV", zh: "皇帝", en: "THE EMPEROR", symbol: "♜", upright: "秩序、责任、结构与稳定的领导力", reversed: "控制欲、僵化、权威压力与缺少弹性" },
  { number: "V", zh: "教皇", en: "THE HIEROPHANT", symbol: "☩", upright: "传统、学习、规则与可靠的指导", reversed: "质疑规则、突破惯性与被框架限制" },
  { number: "VI", zh: "恋人", en: "THE LOVERS", symbol: "♡", upright: "选择、关系、价值观一致与真诚连接", reversed: "犹豫、关系失衡、价值冲突与逃避选择" },
  { number: "VII", zh: "战车", en: "THE CHARIOT", symbol: "✧", upright: "推进、意志、目标明确与掌控方向", reversed: "失控、方向混乱、急躁与阻力增加" },
  { number: "VIII", zh: "力量", en: "STRENGTH", symbol: "♌", upright: "勇气、耐心、温柔的掌控与内在力量", reversed: "自我怀疑、情绪失控、疲惫与逃避压力" },
  { number: "IX", zh: "隐者", en: "THE HERMIT", symbol: "✺", upright: "独处、反思、寻找答案与内在沉淀", reversed: "孤立、逃避现实、封闭过度与缺少沟通" },
  { number: "X", zh: "命运之轮", en: "WHEEL OF FORTUNE", symbol: "☸", upright: "变化、转折、机会与周期流动", reversed: "抗拒变化、停滞、时机未到与反复拉扯" },
  { number: "XI", zh: "正义", en: "JUSTICE", symbol: "⚖", upright: "公平、理性、因果与清晰判断", reversed: "偏见、不公、逃避责任与判断失衡" },
  { number: "XII", zh: "倒吊人", en: "THE HANGED MAN", symbol: "◇", upright: "暂停、转换视角、等待与主动放下", reversed: "拖延、卡住、牺牲感与无法松手" },
  { number: "XIII", zh: "死神", en: "DEATH", symbol: "♇", upright: "结束、转化、告别旧阶段与重生", reversed: "抗拒改变、停留过去与迟迟不愿结束" },
  { number: "XIV", zh: "节制", en: "TEMPERANCE", symbol: "△", upright: "平衡、协调、耐心与逐步融合", reversed: "失衡、极端、节奏混乱与耐心不足" },
  { number: "XV", zh: "恶魔", en: "THE DEVIL", symbol: "♄", upright: "欲望、束缚、依赖与看见真实诱因", reversed: "摆脱束缚、觉醒与释放旧模式" },
  { number: "XVI", zh: "高塔", en: "THE TOWER", symbol: "ϟ", upright: "突变、崩塌、真相显现与打破旧结构", reversed: "延迟冲突、害怕改变与危机后的修复" },
  { number: "XVII", zh: "星星", en: "THE STAR", symbol: "☆", upright: "希望、疗愈、信心与重新看见方向", reversed: "失望、信心不足、怀疑未来与能量低落" },
  { number: "XVIII", zh: "月亮", en: "THE MOON", symbol: "☽", upright: "未知、直觉、幻想与潜意识波动", reversed: "真相浮现、迷雾散开与恐惧被看见" },
  { number: "XIX", zh: "太阳", en: "THE SUN", symbol: "☀", upright: "清晰、快乐、成功与能量恢复", reversed: "短暂低落、过度乐观与光亮被遮住" },
  { number: "XX", zh: "审判", en: "JUDGEMENT", symbol: "♬", upright: "复盘、觉醒、决定与新阶段召唤", reversed: "逃避决定、自我怀疑与迟迟不愿回应" },
  { number: "XXI", zh: "世界", en: "THE WORLD", symbol: "◎", upright: "完成、整合、圆满与进入新循环", reversed: "尚未完成、缺少收尾与停在最后一步" },
]

const CARD_LOCALIZATIONS = {
  "愚者": { ja: "愚者", uprightEn: "New beginnings, freedom, adventure, and open possibilities", reversedEn: "Impulsiveness, poor preparation, avoidance, and reckless attempts", uprightJa: "新しい始まり、自由、冒険、開かれた可能性", reversedJa: "衝動、準備不足、責任からの逃避、無謀な試み" },
  "魔术师": { ja: "魔術師", uprightEn: "Action, creativity, resourcefulness, and initiative", reversedEn: "Untapped ability, distraction, manipulation, and delayed action", uprightJa: "行動力、創造性、資源の統合、主体的な一歩", reversedJa: "力を発揮できない、散漫、操作、行動の遅れ" },
  "女祭司": { ja: "女教皇", uprightEn: "Intuition, the subconscious, inner wisdom, and observation", reversedEn: "Suppressed intuition, hidden information, silence, and confusion", uprightJa: "直感、無意識、内なる知恵、静かな観察", reversedJa: "直感の抑圧、不明瞭な情報、沈黙、迷い" },
  "皇后": { ja: "女帝", uprightEn: "Nurturing, growth, creation, and warmth in relationships", reversedEn: "Stagnation, overgiving, dependence, and weak boundaries", uprightJa: "育む力、成長、創造、関係の温かさ", reversedJa: "停滞、与えすぎ、依存、境界線の不足" },
  "皇帝": { ja: "皇帝", uprightEn: "Order, responsibility, structure, and steady leadership", reversedEn: "Control, rigidity, pressure from authority, and inflexibility", uprightJa: "秩序、責任、構造、安定した導き", reversedJa: "支配、硬直、権威の圧力、柔軟性の欠如" },
  "教皇": { ja: "法王", uprightEn: "Tradition, learning, convention, and trusted guidance", reversedEn: "Questioning convention, breaking habits, and restrictive systems", uprightJa: "伝統、学び、規範、信頼できる導き", reversedJa: "規範への疑問、慣習の突破、枠組みの制限" },
  "恋人": { ja: "恋人", uprightEn: "Choice, relationship, aligned values, and sincere connection", reversedEn: "Indecision, imbalance, conflicting values, and avoidance", uprightJa: "選択、関係、価値観の一致、誠実なつながり", reversedJa: "迷い、不均衡、価値観の衝突、選択からの逃避" },
  "战车": { ja: "戦車", uprightEn: "Momentum, will, clear goals, and command of direction", reversedEn: "Loss of control, confusion, haste, and growing resistance", uprightJa: "前進、意志、明確な目標、方向を握る力", reversedJa: "制御の喪失、混乱、焦り、増える抵抗" },
  "力量": { ja: "力", uprightEn: "Courage, patience, gentle control, and inner strength", reversedEn: "Self-doubt, emotional strain, fatigue, and avoidance", uprightJa: "勇気、忍耐、穏やかな制御、内なる強さ", reversedJa: "自己不信、感情の乱れ、疲労、圧力からの逃避" },
  "隐者": { ja: "隠者", uprightEn: "Solitude, reflection, seeking answers, and inner depth", reversedEn: "Isolation, withdrawal, avoidance, and poor communication", uprightJa: "独りで過ごすこと、内省、答えを探すこと、心の深まり", reversedJa: "孤立、現実逃避、閉じこもり、対話の不足" },
  "命运之轮": { ja: "運命の輪", uprightEn: "Change, turning points, opportunity, and the flow of cycles", reversedEn: "Resistance, stagnation, poor timing, and repeated tension", uprightJa: "変化、転機、機会、巡る周期", reversedJa: "変化への抵抗、停滞、時機のずれ、繰り返す葛藤" },
  "正义": { ja: "正義", uprightEn: "Fairness, reason, consequence, and clear judgment", reversedEn: "Bias, unfairness, avoidance, and distorted judgment", uprightJa: "公平、理性、因果、明晰な判断", reversedJa: "偏見、不公平、責任回避、判断の歪み" },
  "倒吊人": { ja: "吊るされた男", uprightEn: "Pause, a new perspective, waiting, and conscious release", reversedEn: "Delay, feeling stuck, sacrifice, and inability to let go", uprightJa: "立ち止まる、視点を変える、待つ、意識的に手放す", reversedJa: "先延ばし、行き詰まり、犠牲感、手放せない状態" },
  "死神": { ja: "死神", uprightEn: "Endings, transformation, release, and rebirth", reversedEn: "Resistance to change, clinging to the past, and delayed endings", uprightJa: "終わり、変容、古い段階との別れ、再生", reversedJa: "変化への抵抗、過去への執着、終わりの先延ばし" },
  "节制": { ja: "節制", uprightEn: "Balance, harmony, patience, and gradual integration", reversedEn: "Imbalance, extremes, disrupted rhythm, and impatience", uprightJa: "均衡、調和、忍耐、ゆるやかな統合", reversedJa: "不均衡、極端、乱れたリズム、焦り" },
  "恶魔": { ja: "悪魔", uprightEn: "Desire, bondage, dependence, and seeing the real motive", reversedEn: "Release from bondage, awakening, and breaking old patterns", uprightJa: "欲望、束縛、依存、本当の動機を見る", reversedJa: "束縛からの解放、目覚め、古いパターンを離れる" },
  "高塔": { ja: "塔", uprightEn: "Upheaval, collapse, revealed truth, and broken structures", reversedEn: "Delayed conflict, fear of change, and repair after crisis", uprightJa: "急変、崩壊、真実の露呈、古い構造の破壊", reversedJa: "衝突の先送り、変化への恐れ、危機後の修復" },
  "星星": { ja: "星", uprightEn: "Hope, healing, confidence, and a renewed direction", reversedEn: "Disappointment, low confidence, doubt, and depleted energy", uprightJa: "希望、癒やし、自信、再び見える方向", reversedJa: "失望、自信の低下、未来への疑い、消耗" },
  "月亮": { ja: "月", uprightEn: "The unknown, intuition, imagination, and subconscious tides", reversedEn: "Truth emerging, fog lifting, and fear becoming visible", uprightJa: "未知、直感、幻想、無意識の揺らぎ", reversedJa: "真実の浮上、霧が晴れる、恐れが見える" },
  "太阳": { ja: "太陽", uprightEn: "Clarity, joy, success, and renewed vitality", reversedEn: "A temporary low, excessive optimism, and obscured light", uprightJa: "明晰さ、喜び、成功、生命力の回復", reversedJa: "一時的な低調、過度な楽観、隠れた光" },
  "审判": { ja: "審判", uprightEn: "Review, awakening, decision, and a call to a new stage", reversedEn: "Avoiding a decision, self-doubt, and refusing the call", uprightJa: "振り返り、覚醒、決断、新しい段階からの呼び声", reversedJa: "決断の回避、自己不信、呼び声に応えない" },
  "世界": { ja: "世界", uprightEn: "Completion, integration, fulfillment, and a new cycle", reversedEn: "Unfinished work, weak closure, and stopping before completion", uprightJa: "完成、統合、充足、新しい循環への移行", reversedJa: "未完成、締めくくりの不足、最後の一歩で止まる" },
}

const CARD_IMAGE_FILES = [
  "00-fool.jpg", "01-magician.jpg", "02-high-priestess.jpg", "03-empress.jpg",
  "04-emperor.jpg", "05-hierophant.jpg", "06-lovers.jpg", "07-chariot.jpg",
  "08-strength.jpg", "09-hermit.jpg", "10-wheel-of-fortune.jpg", "11-justice.jpg",
  "12-hanged-man.jpg", "13-death.jpg", "14-temperance.jpg", "15-devil.jpg",
  "16-tower.jpg", "17-star.jpg", "18-moon.jpg", "19-sun.jpg",
  "20-judgement.jpg", "21-world.jpg",
]

export const TAROT_CARDS = BASE_TAROT_CARDS.map((card, index) => ({
  ...card,
  ...CARD_LOCALIZATIONS[card.zh],
  image: `./assets/cards/${CARD_IMAGE_FILES[index]}`,
}))

export function cardName(card, locale = getLocale()) {
  if (locale === "en") return card.en.replace(/^THE /, "The ").replaceAll(" OF ", " of ").replace(/\b[A-Z]{2,}\b/g, (word) => word[0] + word.slice(1).toLowerCase())
  if (locale === "ja") return card.ja
  return card.zh
}

export function cardMeaning(card, direction, locale = getLocale()) {
  const reversed = direction === "逆位" || direction === "reversed"
  if (locale === "en") return reversed ? card.reversedEn : card.uprightEn
  if (locale === "ja") return reversed ? card.reversedJa : card.uprightJa
  return reversed ? card.reversed : card.upright
}

export function directionLabel(direction) {
  return t(direction === "逆位" ? "card.reversed" : "card.upright")
}

export function positionLabel(position) {
  const key = position.includes("过去") ? "position.past"
    : position.includes("未来") ? "position.future"
      : position.includes("当下 / 核心") || position.includes("现在") ? "position.present"
        : "position.single"
  return t(key)
}

export function shuffle(items) {
  const output = [...items]
  for (let index = output.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1))
    ;[output[index], output[random]] = [output[random], output[index]]
  }
  return output
}

export function toReadingCard(card, position, index = 0) {
  const direction = cryptoDirection(index) ? "正位" : "逆位"
  return {
    position,
    name: card.zh,
    arcana: "大阿卡那",
    direction,
    meaning: direction === "正位" ? card.upright : card.reversed,
    visual: { number: card.number, en: card.en, symbol: card.symbol },
  }
}

function cryptoDirection(salt) {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1)
    crypto.getRandomValues(value)
    return (value[0] + salt) % 2 === 0
  }
  return Math.random() >= 0.5
}

export function tarotPayload(cards) {
  return cards.map(({ position, name, arcana, direction, meaning }) => ({ position, name, arcana, direction, meaning }))
}

export function enrichCard(card) {
  const source = TAROT_CARDS.find((item) => [item.zh, item.en, item.ja].includes(card.name))
    || TAROT_CARDS.find((item) => item.en === card.visual?.en)
  return {
    ...card,
    visual: card.visual || {
      number: source?.number || "•",
      en: source?.en || "ARCANA",
      symbol: source?.symbol || "✦",
    },
    image: card.image || source?.image,
  }
}

export function cardFaceMarkup(card) {
  const enriched = enrichCard(card)
  const source = TAROT_CARDS.find((item) => [item.zh, item.en, item.ja].includes(enriched.name))
    || TAROT_CARDS.find((item) => item.en === enriched.visual.en)
  const isReversed = enriched.direction === "逆位"
  const image = enriched.image || source?.image
  const label = source ? `${cardName(source)} · ${directionLabel(enriched.direction)}` : enriched.name
  return `
    <div class="tarot-face${isReversed ? " is-reversed" : ""}" data-card-art="${escapeHtml(enriched.visual.number)}">
      <img class="tarot-face-image" src="${escapeHtml(image || "./assets/fate-tarot-card.png")}" alt="${escapeHtml(label)}" loading="lazy" />
      <span class="tarot-face-index">${escapeHtml(enriched.visual.number)}</span>
    </div>`
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setSession(auth) {
  localStorage.setItem(TOKEN_KEY, auth.token)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options.timeout ?? 30_000)
  const token = getToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  try {
    const { timeout: _timeout, ...fetchOptions } = options
    const response = await fetch(path, { ...fetchOptions, headers, signal: options.signal || controller.signal })
    if (!response.ok) {
      let detail = `请求失败（${response.status}）`
      try {
        const payload = await response.json()
        detail = payload.detail || detail
      } catch {}
      const error = new Error(detail)
      error.status = response.status
      throw error
    }
    if (response.status === 204) return null
    return response.json()
  } catch (error) {
    if (error.name === "AbortError") throw new Error(t("error.timeout"))
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function currentUser() {
  if (!getToken()) return null
  try {
    return await apiFetch("/api/auth/me")
  } catch (error) {
    if (error.status === 401) clearSession()
    return null
  }
}

export async function hydrateAccountLinks() {
  const user = await currentUser()
  document.querySelectorAll("[data-account-link]").forEach((link) => {
    link.textContent = user ? t("account.named", { username: user.username }) : t("account.guest")
  })
  return user
}

export function formatDate(iso = new Date().toISOString()) {
  const locale = getLocale() === "en" ? "en-US" : getLocale() === "ja" ? "ja-JP" : "zh-CN"
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso))
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

export function readingParagraphs(text) {
  const chunks = String(text).split(/\n{2,}|\r?\n/).map((part) => part.trim()).filter(Boolean)
  return chunks.map((part) => `<p>${escapeHtml(part)}</p>`).join("")
}
