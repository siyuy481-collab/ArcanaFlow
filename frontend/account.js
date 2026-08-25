import { initDesktopPet } from "./pet.js"
import { initI18n, t } from "./i18n.js"
import {
  UNSAVED_READING_KEY,
  apiFetch,
  clearSession,
  currentUser,
  escapeHtml,
  formatDate,
  setSession,
} from "./shared.js"

const authView = document.querySelector("#authView")
const profileView = document.querySelector("#profileView")
const loginForm = document.querySelector("#loginForm")
const registerForm = document.querySelector("#registerForm")
const authMessage = document.querySelector("#authMessage")
const historyList = document.querySelector("#historyList")
let user = null

initI18n()
initDesktopPet()
document.querySelectorAll("[data-auth-tab]").forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.authTab)))
loginForm.addEventListener("submit", (event) => submitAuth(event, "login"))
registerForm.addEventListener("submit", (event) => submitAuth(event, "register"))
document.querySelector("#logoutButton").addEventListener("click", logout)
historyList.addEventListener("click", handleHistoryAction)

init()
window.addEventListener("arcana:localechange", () => {
  if (user) showProfile()
  else showAuth()
})

async function init() {
  user = await currentUser()
  if (user) showProfile()
  else showAuth()
}

function switchTab(tab) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.authTab === tab))
  loginForm.hidden = tab !== "login"
  registerForm.hidden = tab !== "register"
  authMessage.textContent = ""
}

async function submitAuth(event, type) {
  event.preventDefault()
  const form = event.currentTarget
  const submit = form.querySelector("button[type='submit']")
  const data = Object.fromEntries(new FormData(form))
  submit.disabled = true
  authMessage.textContent = type === "login" ? t("auth.checking") : t("auth.creating")
  try {
    const auth = await apiFetch(`/api/auth/${type}`, { method: "POST", body: JSON.stringify(data) })
    setSession(auth)
    user = auth.user
    const saved = await savePendingReading()
    showProfile()
    if (saved) authMessage.textContent = t("auth.savedPending")
  } catch (error) {
    authMessage.textContent = error.message
    authMessage.classList.add("is-error")
  } finally {
    submit.disabled = false
  }
}

async function savePendingReading() {
  const raw = sessionStorage.getItem(UNSAVED_READING_KEY)
  if (!raw) return false
  try {
    await apiFetch("/api/readings", { method: "POST", body: raw })
    sessionStorage.removeItem(UNSAVED_READING_KEY)
    return true
  } catch {
    return false
  }
}

function showAuth() {
  authView.hidden = false
  profileView.hidden = true
  document.querySelectorAll("[data-account-link]").forEach((link) => { link.textContent = t("account.guest") })
}

async function showProfile() {
  authView.hidden = true
  profileView.hidden = false
  document.querySelector("#profileName").textContent = user.username
  document.querySelector("#profileEmail").textContent = `${user.email} · ${t("profile.joined", { date: formatDate(user.created_at) })}`
  document.querySelectorAll("[data-account-link]").forEach((link) => { link.textContent = t("account.named", { username: user.username }) })
  await loadHistory()
}

async function loadHistory() {
  historyList.innerHTML = `<div class="history-loading">${escapeHtml(t("history.loading"))}</div>`
  try {
    const readings = await apiFetch("/api/readings")
    document.querySelector("#historyCount").textContent = t("profile.count", { count: readings.length })
    if (!readings.length) {
      historyList.innerHTML = `<div class="history-empty"><span>☾</span><h3>${escapeHtml(t("history.emptyTitle"))}</h3><p>${escapeHtml(t("history.emptyText"))}</p><a class="button button-primary" href="./index.html#draw">${escapeHtml(t("history.first"))}</a></div>`
      return
    }
    historyList.innerHTML = readings.map((reading) => `
      <article class="history-item">
        <div class="history-index">${String(reading.id).padStart(2, "0")}</div>
        <div class="history-content"><time>${formatDate(reading.created_at)}</time><h3>${escapeHtml(reading.title)}</h3><p>${escapeHtml(reading.question)}</p><small>${reading.cards.map((card) => `${escapeHtml(card.name)} · ${escapeHtml(card.direction)}`).join("　")}</small></div>
        <div class="history-actions"><a href="./result.html?id=${reading.id}">${escapeHtml(t("history.open"))}</a><button type="button" data-delete-id="${reading.id}">${escapeHtml(t("history.delete"))}</button></div>
      </article>`).join("")
  } catch (error) {
    historyList.innerHTML = `<div class="history-loading is-error">${escapeHtml(error.message)}</div>`
  }
}

async function handleHistoryAction(event) {
  const button = event.target.closest("[data-delete-id]")
  if (!button) return
  if (!window.confirm(t("history.confirm"))) return
  button.disabled = true
  try {
    await apiFetch(`/api/readings/${button.dataset.deleteId}`, { method: "DELETE" })
    await loadHistory()
  } catch (error) {
    button.disabled = false
    button.textContent = error.message
  }
}

async function logout() {
  try { await apiFetch("/api/auth/logout", { method: "POST" }) } catch {}
  clearSession()
  user = null
  showAuth()
}
