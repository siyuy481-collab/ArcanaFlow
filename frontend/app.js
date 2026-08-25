import { initDesktopPet } from "./pet.js"
import { initI18n, t } from "./i18n.js"
import {
  PENDING_READING_KEY,
  TAROT_CARDS,
  hydrateAccountLinks,
  shuffle,
  toReadingCard,
} from "./shared.js"
import { initGestureSelection } from "./gesture.js"

const questionInput = document.querySelector("#questionInput")
const questionCount = document.querySelector("#questionCount")
const cardGrid = document.querySelector("#cardGrid")
const fanStage = document.querySelector("#fanStage")
const fanPrev = document.querySelector("#fanPrev")
const fanNext = document.querySelector("#fanNext")
const gateNumber = document.querySelector("#gateNumber")
const selectedCount = document.querySelector("#selectedCount")
const requiredCount = document.querySelector("#requiredCount")
const openReading = document.querySelector("#openReading")
const drawStatus = document.querySelector("#drawStatus")
const modeButtons = [...document.querySelectorAll("[data-mode]")]

let mode = "single"
let visibleCards = []
let selected = []
let activeIndex = 0
let wheelLock = false

initI18n()
initDesktopPet()
hydrateAccountLinks()
renderDeck()
initHeroParallax()
initFanControls()
initGestureSelection({ cardGrid })

questionInput.addEventListener("input", updateState)
modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)))
cardGrid.addEventListener("click", handleCardClick)
openReading.addEventListener("click", beginReading)
window.addEventListener("resize", updateFanLayout, { passive: true })
window.addEventListener("arcana:gesturefocus", (event) => {
  if (Number.isInteger(event.detail?.index)) setActiveIndex(event.detail.index, { focus: false })
})
window.addEventListener("arcana:localechange", () => {
  updateState()
  updateCardLabels()
  hydrateAccountLinks()
})

function setMode(nextMode) {
  if (nextMode === mode) return
  mode = nextMode
  selected = []
  modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === mode))
  renderDeck()
}

function renderDeck() {
  cardGrid.classList.remove("is-dealt")
  visibleCards = shuffle(TAROT_CARDS).slice(0, 12)
  activeIndex = Math.floor((visibleCards.length - 1) / 2)
  cardGrid.innerHTML = visibleCards.map((card, index) => `
    <button class="pick-card" type="button" data-card-index="${index}" style="--deal-order:${index}" aria-label="${t("draw.chooseCard", { count: index + 1 })}" aria-pressed="false">
      <span class="pick-card-order"></span>
      <span class="pick-card-back"><i></i></span>
      <small>${String(index + 1).padStart(2, "0")}</small>
    </button>`).join("")
  updateSelectionClasses()
  updateFanLayout()
  requestAnimationFrame(() => requestAnimationFrame(() => cardGrid.classList.add("is-dealt")))
  updateState()
}

function initFanControls() {
  fanPrev?.addEventListener("click", () => setActiveIndex(activeIndex - 1, { focus: true }))
  fanNext?.addEventListener("click", () => setActiveIndex(activeIndex + 1, { focus: true }))
  fanStage?.addEventListener("wheel", (event) => {
    if (wheelLock || Math.abs(event.deltaY) + Math.abs(event.deltaX) < 3) return
    event.preventDefault()
    wheelLock = true
    setActiveIndex(activeIndex + (event.deltaY + event.deltaX > 0 ? 1 : -1), { focus: false })
    window.setTimeout(() => { wheelLock = false }, 150)
  }, { passive: false })
  fanStage?.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    setActiveIndex(activeIndex + (event.key === "ArrowRight" ? 1 : -1), { focus: true })
  })
}

function setActiveIndex(index, { focus = false } = {}) {
  if (!visibleCards.length) return
  activeIndex = Math.max(0, Math.min(visibleCards.length - 1, index))
  updateFanLayout()
  if (focus) cardGrid.querySelector(`[data-card-index="${activeIndex}"]`)?.focus({ preventScroll: true })
}

function updateFanLayout() {
  if (!fanStage || !cardGrid) return
  const width = Math.max(300, fanStage.clientWidth)
  const spread = Math.min(78, Math.max(39, width / 9.6))
  const cards = [...cardGrid.querySelectorAll(".pick-card")]
  cards.forEach((button, index) => {
    const offset = index - activeIndex
    const distance = Math.abs(offset)
    const rotation = offset * Math.min(5.2, 39 / Math.max(5, visibleCards.length - 1))
    const rise = Math.pow(distance, 1.45) * Math.min(6.8, width / 135)
    const scale = Math.max(0.7, 1 - distance * 0.042)
    button.style.setProperty("--fan-x", `${offset * spread}px`)
    button.style.setProperty("--fan-y", `${rise}px`)
    button.style.setProperty("--fan-rotate", `${rotation}deg`)
    button.style.setProperty("--fan-scale", scale.toFixed(3))
    button.style.setProperty("--fan-z", String(60 - distance))
    button.classList.toggle("is-in-gate", index === activeIndex)
  })
  gateNumber.textContent = String(activeIndex + 1).padStart(2, "0")
  fanPrev.disabled = activeIndex === 0
  fanNext.disabled = activeIndex === visibleCards.length - 1
}

function updateCardLabels() {
  document.querySelectorAll(".pick-card").forEach((button, index) => {
    button.setAttribute("aria-label", t("draw.chooseCard", { count: index + 1 }))
  })
}

function handleCardClick(event) {
  const button = event.target.closest("[data-card-index]")
  if (!button) return
  const index = Number(button.dataset.cardIndex)
  setActiveIndex(index)
  const existing = selected.indexOf(index)
  const required = mode === "single" ? 1 : 3

  if (existing >= 0) selected.splice(existing, 1)
  else if (selected.length < required) selected.push(index)
  else {
    drawStatus.textContent = t("draw.status.limit", { count: required })
    drawStatus.classList.add("is-warning")
    fanStage.classList.add("is-limit")
    window.setTimeout(() => fanStage.classList.remove("is-limit"), 520)
    return
  }

  updateSelectionClasses()
  updateState()
}

function updateSelectionClasses() {
  document.querySelectorAll(".pick-card").forEach((button) => {
    const selectedIndex = selected.indexOf(Number(button.dataset.cardIndex))
    button.classList.toggle("is-selected", selectedIndex >= 0)
    button.setAttribute("aria-pressed", String(selectedIndex >= 0))
    button.querySelector(".pick-card-order").textContent = selectedIndex >= 0 ? selectedIndex + 1 : ""
  })
}

function updateState() {
  const required = mode === "single" ? 1 : 3
  const question = questionInput.value.trim()
  questionCount.textContent = questionInput.value.length
  selectedCount.textContent = selected.length
  requiredCount.textContent = required
  openReading.disabled = !question || selected.length !== required
  drawStatus.classList.remove("is-warning")

  if (!question) drawStatus.textContent = t("draw.status.start", { count: required })
  else if (selected.length < required) drawStatus.textContent = t("draw.status.more", { count: required - selected.length })
  else drawStatus.textContent = t("draw.status.ready")
}

function beginReading() {
  const question = questionInput.value.trim()
  const required = mode === "single" ? 1 : 3
  if (!question) {
    questionInput.focus()
    return
  }
  if (selected.length !== required) return

  const positions = mode === "single"
    ? ["核心牌 / 当下指引"]
    : ["过去 / 背景", "当下 / 核心", "未来 / 建议"]
  const cards = selected.map((index, order) => toReadingCard(visibleCards[index], positions[order], order))
  sessionStorage.setItem(PENDING_READING_KEY, JSON.stringify({ question, cards, mode, createdAt: new Date().toISOString() }))
  openReading.classList.add("is-loading")
  openReading.textContent = t("draw.entering")
  window.location.assign("./result.html")
}

function initHeroParallax() {
  const visual = document.querySelector("#heroVisual")
  const hero = document.querySelector(".hero-section")
  if (!visual || matchMedia("(pointer: coarse)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return

  const current = { x: 0, y: 0 }
  const target = { x: 0, y: 0 }
  let frame = 0

  const paint = () => {
    current.x += (target.x - current.x) * 0.085
    current.y += (target.y - current.y) * 0.085
    visual.style.setProperty("--pointer-x", current.x.toFixed(4))
    visual.style.setProperty("--pointer-y", current.y.toFixed(4))
    visual.style.setProperty("--tilt-x", `${(-current.y * 8.5).toFixed(2)}deg`)
    visual.style.setProperty("--tilt-y", `${(current.x * 11).toFixed(2)}deg`)
    visual.style.setProperty("--eye-x", `${(current.x * 13).toFixed(2)}px`)
    visual.style.setProperty("--eye-y", `${(current.y * 8).toFixed(2)}px`)
    if (Math.abs(target.x - current.x) > 0.001 || Math.abs(target.y - current.y) > 0.001) frame = requestAnimationFrame(paint)
    else frame = 0
  }

  const schedule = () => { if (!frame) frame = requestAnimationFrame(paint) }
  const updateFromPointer = (event) => {
    const bounds = (hero || visual).getBoundingClientRect()
    target.x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1))
    target.y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1))
    visual.classList.add("is-observing")
    schedule()
  }
  const resetPointer = () => {
    target.x = 0
    target.y = 0
    visual.classList.remove("is-observing")
    schedule()
  }

  ;(hero || visual).addEventListener("pointermove", updateFromPointer, { passive: true })
  ;(hero || visual).addEventListener("pointerleave", resetPointer)
  window.addEventListener("scroll", () => {
    const bounds = (hero || visual).getBoundingClientRect()
    if (bounds.bottom < 0 || bounds.top > window.innerHeight) resetPointer()
  }, { passive: true })
}
