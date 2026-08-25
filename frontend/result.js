import { initDesktopPet } from "./pet.js"
import { getLocale, initI18n, t } from "./i18n.js"
import {
  PENDING_READING_KEY,
  TAROT_CARDS,
  UNSAVED_READING_KEY,
  apiFetch,
  cardFaceMarkup,
  cardMeaning,
  cardName,
  currentUser,
  enrichCard,
  escapeHtml,
  formatDate,
  hydrateAccountLinks,
  directionLabel,
  positionLabel,
  readingParagraphs,
  tarotPayload,
} from "./shared.js"

const resultQuestion = document.querySelector("#resultQuestion")
const resultDate = document.querySelector("#resultDate")
const revealedCards = document.querySelector("#revealedCards")
const waterStage = document.querySelector("#waterStage")
const waterCaption = document.querySelector("#waterCaption")
const readingLoader = document.querySelector("#readingLoader")
const readingCopy = document.querySelector("#readingCopy")
const cardNotes = document.querySelector("#cardNotes")
const saveButton = document.querySelector("#saveReading")
const saveStatus = document.querySelector("#saveStatus")

let reading = null
let user = null
let alreadySaved = false

initI18n()
initDesktopPet()
init()
window.addEventListener("arcana:localechange", () => {
  hydrateAccountLinks()
  if (reading) renderReadingShell()
})

async function init() {
  user = await hydrateAccountLinks()
  const savedId = new URLSearchParams(location.search).get("id")

  try {
    if (savedId) {
      if (!user) throw new Error(t("error.loginReading"))
      reading = await apiFetch(`/api/readings/${encodeURIComponent(savedId)}`)
      alreadySaved = true
    } else {
      const pending = sessionStorage.getItem(PENDING_READING_KEY)
      if (!pending) throw new Error(t("error.noReading"))
      reading = JSON.parse(pending)
    }
  } catch (error) {
    showFatal(error.message)
    return
  }

  reading.cards = reading.cards.map(enrichCard)
  renderReadingShell()
  revealCards()

  if (alreadySaved) {
    finishInterpretation(reading.result)
    saveButton.textContent = t("result.saved")
    saveButton.disabled = true
    saveStatus.textContent = t("result.savedNote")
    return
  }

  try {
    const response = await apiFetch("/api/tarot", {
      method: "POST",
      body: JSON.stringify({ question: reading.question, cards: tarotPayload(reading.cards), locale: getLocale() }),
    })
    reading.result = response.result
    reading.cards = response.cards.map(enrichCard)
    finishInterpretation(response.result)
  } catch (error) {
    finishInterpretation(localFallbackReading())
    saveStatus.textContent = error.message
  }
}

function renderReadingShell() {
  resultQuestion.textContent = `“${reading.question}”`
  resultDate.textContent = formatDate(reading.created_at || reading.createdAt)
  revealedCards.innerHTML = reading.cards.map((card, index) => `
    <figure class="result-card${waterStage.classList.contains("is-awake") ? " is-revealed" : ""}" style="--reveal-delay:${index * 260}ms">
      ${cardFaceMarkup(card)}
      <figcaption><span>${escapeHtml(positionLabel(card.position))}</span><strong>${escapeHtml(localCardName(card))} · ${escapeHtml(directionLabel(card.direction))}</strong></figcaption>
    </figure>`).join("")
  cardNotes.innerHTML = reading.cards.map((card) => `
    <article><span>${escapeHtml(positionLabel(card.position))}</span><h3>${escapeHtml(localCardName(card))} <small>${escapeHtml(directionLabel(card.direction))}</small></h3><p>${escapeHtml(localCardMeaning(card))}</p></article>`).join("")
}

function revealCards() {
  requestAnimationFrame(() => {
    waterStage.classList.add("is-awake")
    document.querySelectorAll(".result-card").forEach((card, index) => {
      window.setTimeout(() => card.classList.add("is-revealed"), 420 + index * 260)
    })
    window.setTimeout(() => {
      waterCaption.textContent = t("result.waterReady")
      document.querySelector("#interpretation")?.classList.add("is-ready")
    }, 1100 + reading.cards.length * 220)
  })
}

function finishInterpretation(text) {
  reading.result = text
  readingLoader.hidden = true
  readingCopy.hidden = false
  readingCopy.innerHTML = readingParagraphs(text)
  saveButton.disabled = false
  if (user) {
    saveButton.textContent = t("result.save")
    saveStatus.textContent = t("result.saveReady")
    saveButton.addEventListener("click", saveReading, { once: true })
  } else {
    saveButton.textContent = t("result.loginSave")
    saveStatus.textContent = t("result.loginSaveNote")
    saveButton.addEventListener("click", goToLogin, { once: true })
  }
}

async function saveReading() {
  saveButton.disabled = true
  saveButton.textContent = t("result.saving")
  try {
    const saved = await apiFetch("/api/readings", {
      method: "POST",
      body: JSON.stringify({
        title: reading.question.slice(0, 28),
        question: reading.question,
        cards: tarotPayload(reading.cards),
        result: reading.result,
      }),
    })
    alreadySaved = true
    saveButton.textContent = t("result.savedDone")
    saveStatus.innerHTML = `<a href="./account.html#history">${escapeHtml(t("result.savedLink"))}</a>`
    history.replaceState(null, "", `./result.html?id=${saved.id}`)
  } catch (error) {
    saveButton.disabled = false
    saveButton.textContent = t("result.retrySave")
    saveStatus.textContent = error.message
    saveButton.addEventListener("click", saveReading, { once: true })
  }
}

function goToLogin() {
  sessionStorage.setItem(UNSAVED_READING_KEY, JSON.stringify({
    title: reading.question.slice(0, 28),
    question: reading.question,
    cards: tarotPayload(reading.cards),
    result: reading.result,
  }))
  location.assign("./account.html?continue=save")
}

function showFatal(message) {
  resultQuestion.textContent = message
  resultDate.textContent = "READING NOT FOUND"
  waterCaption.innerHTML = `<a class="button button-primary" href="./index.html#draw">${escapeHtml(t("result.backDraw"))}</a>`
  readingLoader.hidden = true
  saveButton.hidden = true
}

function sourceFor(card) {
  return TAROT_CARDS.find((item) => item.zh === card.name || item.en === card.name || item.ja === card.name || item.en === card.visual?.en)
}

function localCardName(card) {
  const source = sourceFor(card)
  return source ? cardName(source) : card.name
}

function localCardMeaning(card) {
  const source = sourceFor(card)
  return source ? cardMeaning(source, card.direction) : card.meaning
}

function localFallbackReading() {
  const details = reading.cards.map((card) => `${localCardName(card)} (${directionLabel(card.direction)}): ${localCardMeaning(card)}`).join(getLocale() === "en" ? "; " : getLocale() === "ja" ? "；" : "；")
  if (getLocale() === "en") return `The online interpretation is not responding, but the cards still offer a place to begin: ${details}. Notice which phrase creates the strongest reaction, then turn it into one small action you can verify.`
  if (getLocale() === "ja") return `オンライン解釈は応答していませんが、カードは手がかりを残しています：${details}。最も心が動いた言葉に注目し、確かめられる小さな行動へ変えてみてください。`
  return `在线解读暂时没有响应，但牌面仍留下了可供观察的线索：${details}。留意哪一个词最能触动你，再把它转化为一个可以验证的小行动。`
}
