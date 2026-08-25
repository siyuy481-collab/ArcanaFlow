import { spawn } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { setTimeout as delay } from "node:timers/promises"

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const baseUrl = process.env.ARCANA_TEST_URL || "http://127.0.0.1:5174"
const outputDirectory = process.env.ARCANA_TEST_OUTPUT || "../.runlogs"
const debugPort = 9334
const profile = `${process.env.TEMP}\\arcana-e2e-${Date.now()}`

mkdirSync(outputDirectory, { recursive: true })
const chrome = spawn(chromePath, [
  "--headless=new",
  "--no-first-run",
  "--disable-default-apps",
  "--hide-scrollbars",
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--window-size=2048,1360",
  "--force-device-scale-factor=1",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  `${baseUrl}/`,
], { stdio: "ignore" })

let socket
let nextId = 0
const pending = new Map()
const browserErrors = []

try {
  const target = await waitForTarget()
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", reject, { once: true })
  })
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    }
    if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text)
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") browserErrors.push(message.params.entry.text)
  })

  await command("Page.enable")
  await command("Runtime.enable")
  await command("Log.enable")
  await command("Page.navigate", { url: `${baseUrl}/` })
  await delay(180)
  await waitForReady()

  const homeMetrics = await evaluate(`(() => {
    const header = document.querySelector('.site-header').getBoundingClientRect()
    const hero = document.querySelector('.hero-section').getBoundingClientRect()
    const nav = getComputedStyle(document.querySelector('.primary-nav a'))
    return { headerTop: header.top, headerHeight: header.height, heroTop: hero.top, heroHeight: hero.height, navFontSize: nav.fontSize, scrollHeight: document.documentElement.scrollHeight }
  })()`)
  assert(homeMetrics.headerTop === 0, "header must start at the top")
  assert(homeMetrics.headerHeight >= 72, "navigation must remain large enough")
  assert(Number.parseFloat(homeMetrics.navFontSize) >= 16, "navigation text must remain readable")
  await screenshot("chrome-home-e2e.png")

  await evaluate(`document.querySelector('[data-pet-character]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`)
  await waitForExpression(`document.querySelector('[data-arcana-pet]').classList.contains('is-open')`)
  await evaluate(`(() => {
    const input = document.querySelector('[data-pet-input]')
    input.value = '我最近有点犹豫，应该怎样整理问题？'
    document.querySelector('[data-pet-form]').requestSubmit()
  })()`)
  await waitForExpression(`document.querySelectorAll('.arcana-pet-message').length >= 3 && !document.querySelector('[data-pet-send]').disabled`)
  const petMetrics = await evaluate(`(() => ({
    open: document.querySelector('[data-arcana-pet]').classList.contains('is-open'),
    messages: document.querySelectorAll('.arcana-pet-message').length,
    lastReply: [...document.querySelectorAll('.arcana-pet-message')].at(-1).textContent,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))()`)
  assert(petMetrics.open && petMetrics.messages >= 3, "double-clicking the pet must open the in-page conversation")
  assert(petMetrics.lastReply.length > 0, "the in-page pet chat must receive a backend reply")
  assert(petMetrics.documentWidth <= petMetrics.viewportWidth, "the pet panel must not create horizontal overflow")
  await screenshot("chrome-pet-dialog-e2e.png")

  await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1510, y: 515 })
  await delay(500)
  const parallaxMetrics = await evaluate(`(() => ({
    tiltX: getComputedStyle(document.querySelector('#heroVisual')).getPropertyValue('--tilt-x').trim(),
    tiltY: getComputedStyle(document.querySelector('#heroVisual')).getPropertyValue('--tilt-y').trim(),
    eyeTransform: getComputedStyle(document.querySelector('.eye-tracker')).transform,
    cardTransform: getComputedStyle(document.querySelector('#heroCard')).transform,
  }))()`)
  assert(parallaxMetrics.tiltX !== "0deg" || parallaxMetrics.tiltY !== "0deg", "hero card should respond to pointer movement")
  assert(parallaxMetrics.eyeTransform !== "none", "the eye should move on a separate spatial layer")
  await screenshot("chrome-home-parallax-e2e.png")

  await command("Page.navigate", { url: `${baseUrl}/cards.html` })
  await waitForReady()
  await waitForExpression(`document.querySelectorAll('.library-card').length === 22`)
  const libraryMetrics = await evaluate(`(() => ({ count: document.querySelectorAll('.library-card').length, documentWidth: document.documentElement.scrollWidth, viewportWidth: document.documentElement.clientWidth }))()`)
  assert(libraryMetrics.count === 22, "the card library must list all 22 Major Arcana")
  assert(libraryMetrics.documentWidth <= libraryMetrics.viewportWidth, "the card library must not overflow")
  await evaluate(`document.querySelector('[data-locale="en"]').click()`)
  await delay(150)
  const englishLocale = await evaluate(`(() => { document.querySelector('.library-card').click(); return { home: document.querySelector('[data-i18n="nav.home"]').textContent, firstCard: document.querySelector('.library-card-name strong').textContent, dialogOpen: document.querySelector('#cardDialog').open, upright: document.querySelector('#dialogUpright').textContent } })()`)
  assert(englishLocale.home === "Home" && englishLocale.dialogOpen && englishLocale.upright.length > 20, "English locale and card details must work")
  await evaluate(`document.querySelector('[data-locale="ja"]').click()`)
  await delay(150)
  const japaneseLocale = await evaluate(`(() => ({ home: document.querySelector('[data-i18n="nav.home"]').textContent, cardName: document.querySelector('#dialogCardName').textContent, locale: document.documentElement.lang }))()`)
  assert(japaneseLocale.home === "ホーム" && japaneseLocale.locale === "ja-JP", "Japanese locale must work inside the card detail")
  await screenshot("chrome-card-library-e2e.png")

  await evaluate(`localStorage.setItem('arcana.locale.v1', 'zh')`)
  await command("Page.navigate", { url: `${baseUrl}/` })
  await waitForReady()

  const drawMetrics = await evaluate(`(() => {
    document.documentElement.style.scrollBehavior = 'auto'
    const section = document.querySelector('#draw')
    window.scrollTo(0, section.offsetTop - 82)
    const rect = section.getBoundingClientRect()
    const header = document.querySelector('.site-header').getBoundingClientRect()
    return { sectionTop: rect.top, sectionWidth: rect.width, headerTop: header.top, headerHeight: header.height }
  })()`)
  await delay(200)
  assert(drawMetrics.headerTop === 0, "sticky header must remain stable while scrolling")
  assert(drawMetrics.sectionWidth >= 1200, "desktop draw layout should use the available width")
  await evaluate(`window.dispatchEvent(new CustomEvent('arcana:gesturefocus', { detail: { index: 8 } }))`)
  await delay(180)
  const fanMetrics = await evaluate(`(() => ({
    gateNumber: document.querySelector('#gateNumber').textContent,
    activeIndex: Number(document.querySelector('.pick-card.is-in-gate').dataset.cardIndex),
    cardCount: document.querySelectorAll('.fan-deck .pick-card').length,
    gateVisible: getComputedStyle(document.querySelector('#selectionGate')).display !== 'none',
  }))()`)
  assert(fanMetrics.cardCount === 12 && fanMetrics.gateVisible, "fan deck and selection gate must render")
  assert(fanMetrics.activeIndex === 8 && fanMetrics.gateNumber === "09", "hand glide focus must move the fan through the fixed gate")
  await evaluate(`document.querySelector('#gestureStart').click()`)
  await waitForExpression(`document.querySelector('#gestureStart').hidden === true`)
  const gestureMetrics = await evaluate(`(() => ({
    sessionVisible: !document.querySelector('#gestureSession').hidden,
    startHidden: document.querySelector('#gestureStart').hidden,
    videoReady: document.querySelector('#gestureVideo').readyState >= 2,
    status: document.querySelector('#gestureStatus').textContent,
  }))()`)
  assert(gestureMetrics.sessionVisible && gestureMetrics.startHidden && gestureMetrics.status.length > 0, `camera gesture mode must start in Chrome: ${JSON.stringify(gestureMetrics)}`)
  await screenshot("chrome-draw-e2e.png")
  await evaluate(`document.querySelector('#gestureStop').click()`)

  await command("Page.addScriptToEvaluateOnNewDocument", { source: `
    (() => {
      const nativeFetch = window.fetch.bind(window)
      window.fetch = (input, init = {}) => {
        if (String(input).includes('/api/tarot')) {
          const body = JSON.parse(init.body)
          return Promise.resolve(new Response(JSON.stringify({ cards: body.cards, result: '这是一段用于 Chrome 跨页面验证的稳定解读结果。' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
        }
        return nativeFetch(input, init)
      }
    })()
  ` })
  await evaluate(`(() => {
    const input = document.querySelector('#questionInput')
    input.value = '未来三个月，我该如何调整自己的职业方向？'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('.pick-card').click()
    document.querySelector('#openReading').click()
    return true
  })()`)
  await waitForUrl("result.html")
  await waitForReady()
  await waitForExpression(`!document.querySelector('#readingCopy').hidden`)
  await delay(1800)
  const resultMetrics = await evaluate(`(() => ({
    cards: document.querySelectorAll('.result-card.is-revealed').length,
    question: document.querySelector('#resultQuestion')?.textContent,
    hasCopy: !document.querySelector('#readingCopy')?.hidden,
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))()`)
  assert(resultMetrics.cards === 1, "selected card must reveal on a separate result page")
  assert(resultMetrics.question.includes("职业方向"), "the question must survive page navigation")
  assert(resultMetrics.hasCopy, "interpretation must render")
  assert(resultMetrics.documentWidth <= resultMetrics.viewportWidth, `result page must not overflow horizontally (${resultMetrics.documentWidth}/${resultMetrics.viewportWidth})`)
  await screenshot("chrome-result-e2e.png")

  await command("Page.navigate", { url: `${baseUrl}/account.html` })
  await waitForReady()
  await delay(350)
  const accountMetrics = await evaluate(`(() => ({
    loginVisible: !document.querySelector('#loginForm').hidden,
    registerExists: Boolean(document.querySelector('#registerForm')),
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))()`)
  assert(accountMetrics.loginVisible && accountMetrics.registerExists, "login and registration UI must be present")
  assert(accountMetrics.documentWidth <= accountMetrics.viewportWidth, `account page must not overflow horizontally (${accountMetrics.documentWidth}/${accountMetrics.viewportWidth})`)
  await screenshot("chrome-account-e2e.png")

  const unique = Date.now()
  const registerResult = await evaluate(`(async () => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'chrome_${unique}', email: 'chrome_${unique}@example.com', password: 'chrome-test-2026' }),
    })
    const payload = await response.json()
    if (!response.ok) return { status: response.status, detail: payload.detail }
    localStorage.setItem('arcana.auth-token.v2', payload.token)
    const savedResponse = await fetch('/api/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + payload.token },
      body: JSON.stringify({ title: 'Chrome E2E', question: 'Chrome stability?', cards: [{ position: 'Now', name: 'The Star', arcana: 'Major', direction: 'Upright', meaning: 'Hope' }], result: 'Stable layout.' }),
    })
    const saved = await savedResponse.json()
    const historyResponse = await fetch('/api/readings', { headers: { Authorization: 'Bearer ' + payload.token } })
    const readings = await historyResponse.json()
    return { status: response.status, token: payload.token, savedStatus: savedResponse.status, historyStatus: historyResponse.status, readingId: saved.id, count: readings.length }
  })()`)
  assert(registerResult.status === 201, `registration must succeed: ${JSON.stringify(registerResult)}`)
  assert(registerResult.savedStatus === 201 && registerResult.count === 1, "logged-in user must be able to save and list a reading")

  await command("Page.navigate", { url: `${baseUrl}/account.html#history` })
  await waitForReady()
  await evaluate(`localStorage.setItem('arcana.auth-token.v2', ${JSON.stringify(registerResult.token)})`)
  await command("Page.reload", { ignoreCache: true })
  await waitForReady()
  await waitForExpression(`!document.querySelector('#profileView').hidden && document.querySelectorAll('.history-item').length > 0`)
  const profileMetrics = await evaluate(`(() => ({ profileVisible: !document.querySelector('#profileView').hidden, historyItems: document.querySelectorAll('.history-item').length, userName: document.querySelector('#profileName').textContent }))()`)
  assert(profileMetrics.profileVisible && profileMetrics.historyItems === 1, "saved reading must appear in the private archive")
  await screenshot("chrome-profile-e2e.png")

  await evaluate(`fetch('/api/readings/${registerResult.readingId}', { method: 'DELETE', headers: { Authorization: 'Bearer ' + localStorage.getItem('arcana.auth-token.v2') } })`)

  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await command("Page.navigate", { url: `${baseUrl}/` })
  await waitForReady()
  await delay(300)
  const mobileMetrics = await evaluate(`(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    headerHeight: document.querySelector('.site-header').getBoundingClientRect().height,
    heroWidth: document.querySelector('.hero-section').getBoundingClientRect().width,
    navFontSize: getComputedStyle(document.querySelector('.primary-nav a')).fontSize,
    overflowers: [...document.querySelectorAll('*')].filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 8).map((element) => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })),
  }))()`)
  assert(mobileMetrics.documentWidth <= mobileMetrics.viewportWidth, `mobile home must not overflow horizontally (${mobileMetrics.documentWidth}/${mobileMetrics.viewportWidth}): ${JSON.stringify(mobileMetrics.overflowers)}`)
  assert(mobileMetrics.headerHeight >= 88, `mobile navigation needs a stable second row (${mobileMetrics.headerHeight})`)
  assert(mobileMetrics.heroWidth >= 350, "mobile hero should use the viewport")
  await screenshot("chrome-mobile-e2e.png")

  assert(browserErrors.length === 0, `browser console errors: ${browserErrors.join(" | ")}`)
  delete registerResult.token
  console.log(JSON.stringify({ homeMetrics, petMetrics, parallaxMetrics, libraryMetrics, englishLocale, japaneseLocale, drawMetrics, fanMetrics, resultMetrics, accountMetrics, registerResult, profileMetrics, mobileMetrics, browserErrors }, null, 2))
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close()
  chrome.kill()
}

function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const response = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result.value
}

async function screenshot(name) {
  const result = await command("Page.captureScreenshot", { format: "png", fromSurface: true })
  writeFileSync(`${outputDirectory}/${name}`, Buffer.from(result.data, "base64"))
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json())
      const page = targets.find((target) => target.type === "page")
      if (page) return page
    } catch {}
    await delay(100)
  }
  throw new Error("Chrome DevTools target did not start")
}

async function waitForReady() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate("document.readyState === 'complete'")) return
    await delay(100)
  }
  throw new Error("page did not finish loading")
}

async function waitForUrl(fragment) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const href = await evaluate("location.href")
    if (href.includes(fragment)) return
    await delay(100)
  }
  throw new Error(`navigation to ${fragment} did not complete`)
}

async function waitForExpression(expression) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(expression)) return
    await delay(100)
  }
  throw new Error(`condition did not become true: ${expression}`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
