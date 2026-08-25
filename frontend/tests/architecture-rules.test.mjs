import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const read = (path) => readFileSync(resolve(path), "utf8")
const index = read("index.html")
const result = read("result.html")
const account = read("account.html")
const cards = read("cards.html")
const app = read("app.js")
const gesture = read("gesture.js")
const cardsScript = read("cards.js")
const shared = read("shared.js")
const i18n = read("i18n.js")
const resultScript = read("result.js")
const styles = read("styles.css")
const pet = read("pet.js")
const petStyles = read("pet.css")
const backend = read("../agent/main.py")
const database = read("../agent/database.py")
const desktopPet = read("../desktop_pet/arcana_desktop_pet.py")

test("draw and interpretation are separated into real pages", () => {
  assert.match(app, /window\.location\.assign\("\.\/result\.html"\)/)
  assert.match(result, /id="waterStage"/)
  assert.match(resultScript, /PENDING_READING_KEY/)
  assert.doesNotMatch(index, /id="interpretation"/)
})

test("layout avoids the oversized scroll scenes that broke Chrome stability", () => {
  assert.doesNotMatch(styles, /390vh|145vh/)
  assert.match(styles, /scrollbar-gutter:\s*stable/)
  assert.match(styles, /prefers-reduced-motion:\s*reduce/)
  assert.doesNotMatch(index, /<canvas|@mediapipe|WebGL/i)
})

test("water reveal uses compositor-friendly transform and opacity", () => {
  assert.match(styles, /\.result-card\.is-revealed/)
  assert.match(styles, /translate3d/)
  assert.doesNotMatch(styles, /@keyframes[^}]+margin-(top|left|bottom|right)/s)
})

test("registration, login, and user-scoped history are wired", () => {
  assert.match(account, /id="loginForm"/)
  assert.match(account, /id="registerForm"/)
  assert.match(backend, /\/api\/auth\/register/)
  assert.match(backend, /\/api\/auth\/login/)
  assert.match(backend, /\/api\/readings/)
  assert.match(database, /WHERE user_id = \? AND id = \?/)
  assert.match(database, /pbkdf2_hmac/)
})

test("Chinese, English, and Japanese locales are restored across pages", () => {
  for (const html of [index, result, account, cards]) {
    assert.match(html, /data-locale="zh"/)
    assert.match(html, /data-locale="en"/)
    assert.match(html, /data-locale="ja"/)
  }
  assert.match(i18n, /arcana\.locale\.v1/)
  assert.match(i18n, /applyTranslations/)
})

test("the Major Arcana library exposes all card meanings", () => {
  assert.match(cards, /id="libraryGrid"/)
  assert.match(cards, /id="dialogUpright"/)
  assert.match(cards, /id="dialogReversed"/)
  assert.match(cardsScript, /TAROT_CARDS/)
  assert.match(cardsScript, /renderLibrary/)
  assert.match(shared, /assets\/cards\/\$\{CARD_IMAGE_FILES\[index\]\}/)
  assert.match(shared, /tarot-face-image/)
})

test("camera gesture selection is restored as an optional input method", () => {
  assert.match(index, /id="gestureStart"/)
  assert.match(index, /id="gestureVideo"/)
  assert.match(app, /initGestureSelection/)
  assert.match(gesture, /mediaDevices\?\.getUserMedia/)
  assert.match(gesture, /isOpenPalm/)
  assert.match(gesture, /landmarks\[8\]/)
  assert.match(gesture, /focusedButton\.click\(\)/)
  assert.match(gesture, /arcana:gesturefocus/)
  assert.match(index, /id="selectionGate"/)
  assert.match(index, /fan-deck/)
  assert.match(styles, /\.fan-deck \.pick-card/)
})

test("native desktop pet can move, lock, persist, and reveal a real card", () => {
  assert.match(desktopPet, /<B1-Motion>/)
  assert.match(desktopPet, /锁定位置/)
  assert.match(desktopPet, /始终置顶/)
  assert.match(desktopPet, /desktop-pet\.json/)
  assert.match(desktopPet, /\/api\/pet\/draw/)
  assert.match(desktopPet, /_animate_flip/)
  assert.match(desktopPet, /pet_hover\.gif/)
  assert.match(desktopPet, /MIND_API_URL/)
  assert.match(desktopPet, /_animate_pet_to_card/)
  assert.match(desktopPet, /pet_card_active/)
  assert.match(desktopPet, /"zh":\s*\{/)
  assert.match(desktopPet, /"en":\s*\{/)
  assert.match(desktopPet, /"ja":\s*\{/)
  assert.match(backend, /\/api\/pet\/draw/)
  assert.match(backend, /\/api\/pet\/mind/)
})

test("hero card parallax tracks pointer layers without layout animation", () => {
  assert.match(app, /function initHeroParallax\(\)/)
  assert.match(app, /requestAnimationFrame\(paint\)/)
  assert.match(styles, /--eye-x/)
  assert.match(styles, /rotateX\(var\(--tilt-x\)\)/)
})


test("desktop pet is integrated without opening an external agent page", () => {
  for (const html of [index, result, account, cards]) assert.match(html, /pet\.css/)
  for (const script of [app, resultScript, cardsScript]) assert.match(script, /initDesktopPet/)
  assert.match(pet, /addEventListener\("dblclick"/)
  assert.match(pet, /setPanel\(true\)/)
  assert.match(pet, /\/api\/pet\/mind/)
  assert.match(pet, /PET_HOVER_GIF/)
  assert.match(petStyles, /data-pet-hover-image/)
  assert.doesNotMatch(pet, /window\.open|hellominds|getminds/i)
  assert.match(petStyles, /\.arcana-pet-panel/)
  assert.match(backend, /\/api\/pet\/chat/)
})
