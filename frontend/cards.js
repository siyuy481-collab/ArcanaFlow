import { initDesktopPet } from "./pet.js"
import { getLocale, initI18n, t } from "./i18n.js"
import { TAROT_CARDS, cardFaceMarkup, cardMeaning, cardName, escapeHtml, hydrateAccountLinks } from "./shared.js"

const search = document.querySelector("#cardSearch")
const grid = document.querySelector("#libraryGrid")
const empty = document.querySelector("#libraryEmpty")
const count = document.querySelector("#libraryCount")
const dialog = document.querySelector("#cardDialog")
let activeCard = null

initI18n()
initDesktopPet()
hydrateAccountLinks()
renderLibrary()

search.addEventListener("input", renderLibrary)
grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-library-card]")
  if (button) openCard(TAROT_CARDS[Number(button.dataset.libraryCard)])
})
document.querySelector("#dialogClose").addEventListener("click", () => dialog.close())
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close() })
window.addEventListener("arcana:localechange", () => {
  renderLibrary()
  if (activeCard) fillDialog(activeCard)
  hydrateAccountLinks()
})

function renderLibrary() {
  const query = search.value.trim().toLocaleLowerCase(getLocale())
  const cards = TAROT_CARDS.map((card, index) => ({ card, index })).filter(({ card }) => {
    const haystack = [card.zh, card.en, card.ja, card.upright, card.reversed, card.uprightEn, card.reversedEn, card.uprightJa, card.reversedJa].join(" ").toLocaleLowerCase(getLocale())
    return !query || haystack.includes(query)
  })
  count.textContent = t("cards.count", { count: cards.length })
  empty.hidden = cards.length !== 0
  grid.innerHTML = cards.map(({ card, index }) => `
    <button class="library-card" type="button" data-library-card="${index}">
      <span class="library-card-number">${escapeHtml(card.number)}</span>
      <span class="library-art-frame"><img src="${escapeHtml(card.image)}" alt="" loading="lazy" /></span>
      <span class="library-card-name"><strong>${escapeHtml(cardName(card))}</strong><small>${escapeHtml(card.en)}</small></span>
      <span class="library-keyword">${escapeHtml(cardMeaning(card, "正位").split(/[、,]/)[0])}</span>
      <span class="library-open">${escapeHtml(t("cards.open"))} ↗</span>
    </button>`).join("")
}

function openCard(card) {
  activeCard = card
  fillDialog(card)
  dialog.showModal()
}

function fillDialog(card) {
  document.querySelector("#dialogCardArt").innerHTML = cardFaceMarkup({
    position: "", name: card.zh, arcana: "大阿卡那", direction: "正位", meaning: card.upright,
    visual: { number: card.number, en: card.en, symbol: card.symbol },
  })
  document.querySelector("#dialogCardNumber").textContent = `${card.number} · ${t("card.arcana")}`
  document.querySelector("#dialogCardName").textContent = cardName(card)
  document.querySelector("#dialogCardEnglish").textContent = card.en
  document.querySelector("#dialogUpright").textContent = cardMeaning(card, "正位")
  document.querySelector("#dialogReversed").textContent = cardMeaning(card, "逆位")
}
