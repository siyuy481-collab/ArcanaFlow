import { getLocale } from "./i18n.js"
import { apiFetch } from "./shared.js"

const CHAT_STORAGE_KEY = "arcana.pet-chat.v1"
const PET_IMAGES = {
  normal: "/assets/pet/cat_normal.png",
  happy: "/assets/pet/cat_happy.png",
  question: "/assets/pet/cat_question.png",
  sleep: "/assets/pet/cat_sleep.png",
}
const PET_HOVER_GIF = "/assets/pet/pet_hover.gif"

const COPY = {
  zh: {
    name: "塔罗猫 · 阿卡娜", status: "陪你整理问题，不替你决定答案",
    open: "双击塔罗猫打开对话", close: "关闭对话框",
    hint: "双击我，聊聊你此刻在意的事",
    welcome: "我在。你可以先告诉我最近在意什么，我会陪你把问题慢慢整理清楚。",
    placeholder: "和阿卡娜说点什么…", send: "发送", sending: "正在倾听…",
    keywords: "关键词",
    error: "我暂时没有连上解读服务，但还在这里。稍后再试一次，或者先去选择一张牌吧。",
    quick: ["帮我整理占卜问题", "我现在有点犹豫", "怎样开始一次抽牌"],
  },
  en: {
    name: "Arcana · Tarot Cat", status: "A quiet companion, not a decision maker",
    open: "Double-click the tarot cat to open the conversation", close: "Close conversation",
    hint: "Double-click me and tell me what is on your mind",
    welcome: "I am here. Tell me what has been on your mind, and we can shape it into a clearer question together.",
    placeholder: "Talk to Arcana…", send: "Send", sending: "Listening…",
    keywords: "Keywords",
    error: "I cannot reach the reading service just now, but I am still here. Try again shortly, or begin by choosing a card.",
    quick: ["Help me shape my question", "I feel undecided", "How do I begin a draw?"],
  },
  ja: {
    name: "タロット猫 · アルカナ", status: "答えを決めず、問いを整える相棒",
    open: "タロット猫をダブルクリックして会話を開く", close: "会話を閉じる",
    hint: "ダブルクリックして、今気になることを話してね",
    welcome: "ここにいるよ。最近気になっていることを聞かせて。一緒に少しずつ問いを整えていこう。",
    placeholder: "アルカナに話しかける…", send: "送信", sending: "聞いています…",
    keywords: "キーワード",
    error: "今は解釈サービスにつながらないみたい。でも、ここにいるよ。少し後でもう一度試すか、まず一枚選んでみよう。",
    quick: ["占いの問いを整えたい", "今、少し迷っている", "カードの引き方を教えて"],
  },
}

let initialized = false

export function initDesktopPet() {
  if (initialized || document.querySelector("[data-arcana-pet]")) return
  initialized = true

  const root = document.createElement("aside")
  root.className = "arcana-pet"
  root.dataset.arcanaPet = ""
  root.innerHTML = `
    <div class="arcana-pet-hint" data-pet-hint role="status"></div>
    <section class="arcana-pet-panel" data-pet-panel aria-hidden="true">
      <header class="arcana-pet-panel-header">
        <span class="arcana-pet-orbit" aria-hidden="true"><i></i></span>
        <span class="arcana-pet-identity"><strong data-pet-name></strong><small data-pet-status></small></span>
        <button class="arcana-pet-close" data-pet-close type="button">×</button>
      </header>
      <div class="arcana-pet-log" data-pet-log role="log" aria-live="polite"></div>
      <div class="arcana-pet-quick" data-pet-quick-list></div>
      <form class="arcana-pet-form" data-pet-form>
        <label class="sr-only" for="arcanaPetInput" data-pet-input-label></label>
        <input id="arcanaPetInput" data-pet-input type="text" maxlength="800" autocomplete="off" />
        <button data-pet-send type="submit"><span data-pet-send-label></span><i aria-hidden="true">↗</i></button>
      </form>
    </section>
    <button class="arcana-pet-character" data-pet-character type="button">
      <span class="arcana-pet-aura" aria-hidden="true"></span>
      <img data-pet-image src="${PET_IMAGES.normal}" alt="" draggable="false" />
      <img data-pet-hover-image alt="" aria-hidden="true" />
      <span class="arcana-pet-heart" data-pet-heart aria-hidden="true">✦</span>
    </button>`
  document.body.appendChild(root)

  const panel = root.querySelector("[data-pet-panel]")
  panel.inert = true
  const character = root.querySelector("[data-pet-character]")
  const image = root.querySelector("[data-pet-image]")
  const hoverImage = root.querySelector("[data-pet-hover-image]")
  const hint = root.querySelector("[data-pet-hint]")
  const heart = root.querySelector("[data-pet-heart]")
  const log = root.querySelector("[data-pet-log]")
  const form = root.querySelector("[data-pet-form]")
  const input = root.querySelector("[data-pet-input]")
  const closeButton = root.querySelector("[data-pet-close]")
  const sendButton = root.querySelector("[data-pet-send]")
  let messages = loadMessages()
  let clickTimer = null
  let stateTimer = null
  let idleTimer = null
  let busy = false
  let hoverImageReady = false

  hoverImage.addEventListener("load", () => {
    hoverImageReady = true
    root.dataset.petHoverReady = "true"
  })
  hoverImage.addEventListener("error", () => {
    hoverImageReady = false
    root.dataset.petHoverReady = "false"
  })

  const copy = () => COPY[getLocale()] || COPY.zh
  const panelIsOpen = () => root.classList.contains("is-open")

  function updateCopy() {
    const text = copy()
    root.querySelector("[data-pet-name]").textContent = text.name
    root.querySelector("[data-pet-status]").textContent = text.status
    root.querySelector("[data-pet-input-label]").textContent = text.placeholder
    root.querySelector("[data-pet-send-label]").textContent = busy ? text.sending : text.send
    character.setAttribute("aria-label", text.open)
    closeButton.setAttribute("aria-label", text.close)
    input.placeholder = text.placeholder
    hint.textContent = text.hint
    const quickList = root.querySelector("[data-pet-quick-list]")
    quickList.replaceChildren(...text.quick.map((prompt) => {
      const button = document.createElement("button")
      button.type = "button"
      button.dataset.petPrompt = prompt
      button.textContent = prompt
      return button
    }))
    if (messages.length === 0 || (messages.length === 1 && messages[0].isWelcome)) {
      messages = [{ role: "assistant", content: text.welcome, isWelcome: true }]
      saveMessages(messages)
      renderMessages()
    }
  }

  function renderMessages() {
    log.replaceChildren(...messages.map((message) => {
      const bubble = document.createElement("div")
      bubble.className = `arcana-pet-message is-${message.role}`
      bubble.textContent = message.content
      return bubble
    }))
    log.scrollTop = log.scrollHeight
  }

  function appendMessage(role, content) {
    messages.push({ role, content })
    messages = messages.slice(-16)
    saveMessages(messages)
    renderMessages()
  }

  function setState(state, duration = 0) {
    window.clearTimeout(stateTimer)
    image.src = PET_IMAGES[state] || PET_IMAGES.normal
    root.dataset.petState = state
    if (state === "question") {
      hoverImageReady = false
      hoverImage.src = PET_HOVER_GIF
    }
    if (state !== "question") {
      hoverImageReady = false
      hoverImage.removeAttribute("src")
      root.dataset.petHoverReady = "false"
    }
    if (duration > 0) stateTimer = window.setTimeout(() => setState(panelIsOpen() ? "question" : "normal"), duration)
  }

  function resetIdleTimer() {
    window.clearTimeout(idleTimer)
    if (!panelIsOpen()) idleTimer = window.setTimeout(() => setState("sleep"), 18_000)
  }

  function setPanel(open) {
    root.classList.toggle("is-open", open)
    panel.setAttribute("aria-hidden", String(!open))
    panel.inert = !open
    if (open) {
      hint.classList.remove("is-visible")
      setState("question")
      window.clearTimeout(idleTimer)
      window.setTimeout(() => input.focus({ preventScroll: true }), 180)
    } else {
      setState("normal")
      resetIdleTimer()
      character.focus({ preventScroll: true })
    }
  }

  function showAffection() {
    heart.classList.remove("is-visible")
    void heart.offsetWidth
    heart.classList.add("is-visible")
    setState("happy", 1100)
    resetIdleTimer()
  }

  async function submitMessage(event) {
    event.preventDefault()
    const message = input.value.trim()
    if (!message || busy) return
    appendMessage("user", message)
    input.value = ""
    busy = true
    sendButton.disabled = true
    form.setAttribute("aria-busy", "true")
    root.querySelector("[data-pet-send-label]").textContent = copy().sending
    setState("question")
    try {
      const response = await apiFetch("/api/pet/mind", {
        method: "POST",
        body: JSON.stringify({ message, locale: getLocale() }),
        timeout: 180_000,
      })
      const keywords = Array.isArray(response.keywords) && response.keywords.length
        ? `${copy().keywords} · ${response.keywords.join(" · ")}`
        : ""
      appendMessage("assistant", [response.reply, keywords, response.reading].filter(Boolean).join("\n\n"))
      setState("happy", 1200)
    } catch (error) {
      console.error("Arcana pet chat failed", error)
      appendMessage("assistant", copy().error)
      setState("question", 1400)
    } finally {
      busy = false
      sendButton.disabled = false
      form.removeAttribute("aria-busy")
      root.querySelector("[data-pet-send-label]").textContent = copy().send
      input.focus({ preventScroll: true })
    }
  }

  character.addEventListener("click", () => {
    window.clearTimeout(clickTimer)
    clickTimer = window.setTimeout(showAffection, 300)
  })
  character.addEventListener("dblclick", (event) => {
    event.preventDefault()
    window.clearTimeout(clickTimer)
    setPanel(true)
  })
  character.addEventListener("pointerenter", () => { if (!panelIsOpen()) setState("question"); resetIdleTimer() })
  character.addEventListener("pointerleave", () => { if (!panelIsOpen()) setState("normal"); resetIdleTimer() })
  character.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); window.clearTimeout(clickTimer); setPanel(true) }
  })
  closeButton.addEventListener("click", () => setPanel(false))
  form.addEventListener("submit", submitMessage)
  root.querySelector("[data-pet-quick-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-pet-prompt]")
    if (!button) return
    input.value = button.dataset.petPrompt
    input.focus({ preventScroll: true })
  })
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && panelIsOpen()) setPanel(false) })
  window.addEventListener("arcana:localechange", updateCopy)

  updateCopy()
  renderMessages()
  resetIdleTimer()
  window.setTimeout(() => hint.classList.add("is-visible"), 700)
  window.setTimeout(() => hint.classList.remove("is-visible"), 5200)
}

function loadMessages() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CHAT_STORAGE_KEY) || "[]")
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string").slice(-16)
      : []
  } catch { return [] }
}

function saveMessages(messages) {
  try { sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)) } catch {}
}
