import { t } from "./i18n.js"

const HANDS_BASE = "./vendor/mediapipe/hands"
const CAMERA_SCRIPT = "./vendor/mediapipe/camera/camera_utils.js"
const CONFIRM_TIME = 900

export function initGestureSelection({ cardGrid }) {
  const startButton = document.querySelector("#gestureStart")
  const stopButton = document.querySelector("#gestureStop")
  const session = document.querySelector("#gestureSession")
  const video = document.querySelector("#gestureVideo")
  const status = document.querySelector("#gestureStatus")
  const progress = document.querySelector("#gestureProgress")
  const cursor = document.querySelector("#gestureCursor")
  if (!startButton || !cardGrid || !navigator.mediaDevices?.getUserMedia) return

  let hands = null
  let camera = null
  let stream = null
  let focusedButton = null
  let confirmStartedAt = 0
  let selectionLatched = false
  let running = false

  startButton.addEventListener("click", start)
  stopButton?.addEventListener("click", stop)
  window.addEventListener("pagehide", stop)
  window.addEventListener("arcana:localechange", () => {
    if (running) setStatus(focusedButton ? "gesture.point" : "gesture.noHand")
  })

  async function start() {
    startButton.disabled = true
    startButton.classList.add("is-loading")
    session.hidden = false
    setStatus("gesture.loading")
    try {
      await Promise.all([
        loadScript(`${HANDS_BASE}/hands.js`, "mediapipe-hands"),
        loadScript(CAMERA_SCRIPT, "mediapipe-camera"),
      ])
      if (!window.Hands || !window.Camera) throw new Error("MODEL_UNAVAILABLE")

      hands = new window.Hands({ locateFile: (file) => `${HANDS_BASE}/${file}` })
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.66,
        minTrackingConfidence: 0.66,
      })
      hands.onResults(handleResults)
      camera = new window.Camera(video, {
        onFrame: async () => { if (running) await hands.send({ image: video }) },
        width: 640,
        height: 400,
      })
      running = true
      await camera.start()
      stream = video.srcObject
      document.body.classList.add("gesture-is-active")
      startButton.hidden = true
      setStatus("gesture.noHand")
    } catch (error) {
      stop()
      session.hidden = false
      startButton.hidden = false
      startButton.disabled = false
      setStatus(error?.name === "NotAllowedError" || error?.name === "NotFoundError" ? "gesture.denied" : "gesture.network")
    } finally {
      startButton.classList.remove("is-loading")
    }
  }

  function handleResults(results) {
    const landmarks = results.multiHandLandmarks?.[0]
    if (!landmarks) {
      clearFocus()
      selectionLatched = false
      setStatus("gesture.noHand")
      return
    }

    const indexTip = landmarks[8]
    const gridBounds = cardGrid.getBoundingClientRect()
    const x = gridBounds.left + (1 - indexTip.x) * gridBounds.width
    const y = gridBounds.top + indexTip.y * gridBounds.height
    cursor.style.setProperty("--gesture-x", `${x}px`)
    cursor.style.setProperty("--gesture-y", `${y}px`)
    cursor.classList.add("is-visible")
    focusNearest(x, y, 1 - indexTip.x)

    const openPalm = isOpenPalm(landmarks)
    if (!openPalm) {
      confirmStartedAt = 0
      selectionLatched = false
      updateProgress(0)
      setStatus(focusedButton ? "gesture.point" : "gesture.noHand")
      return
    }
    if (!focusedButton || selectionLatched) return

    if (!confirmStartedAt) confirmStartedAt = performance.now()
    const amount = Math.min(1, (performance.now() - confirmStartedAt) / CONFIRM_TIME)
    updateProgress(amount)
    setStatus("gesture.hold")
    if (amount < 1) return

    confirmStartedAt = 0
    selectionLatched = true
    updateProgress(0)
    if (focusedButton.getAttribute("aria-pressed") !== "true") focusedButton.click()
    focusedButton.classList.add("gesture-confirmed")
    window.setTimeout(() => focusedButton?.classList.remove("gesture-confirmed"), 650)
    setStatus("gesture.selected")
  }

  function focusNearest(x, y, normalizedX) {
    const candidates = [...cardGrid.querySelectorAll(".pick-card")]
    if (!candidates.length) return
    // Horizontal finger motion is mapped directly across the fan. This avoids
    // focus jumping when cards overlap and lets the active card glide through
    // the fixed selection gate while the hand moves sideways.
    const mappedIndex = Math.max(0, Math.min(candidates.length - 1, Math.round(normalizedX * (candidates.length - 1))))
    const nearest = candidates[mappedIndex]
    if (nearest === focusedButton) return
    focusedButton?.classList.remove("is-gesture-focus")
    focusedButton = nearest
    focusedButton.classList.add("is-gesture-focus")
    window.dispatchEvent(new CustomEvent("arcana:gesturefocus", { detail: { index: mappedIndex, x, y } }))
    confirmStartedAt = 0
    updateProgress(0)
  }

  function clearFocus() {
    focusedButton?.classList.remove("is-gesture-focus")
    focusedButton = null
    confirmStartedAt = 0
    updateProgress(0)
    cursor.classList.remove("is-visible")
  }

  function stop() {
    running = false
    try { camera?.stop() } catch {}
    for (const track of stream?.getTracks?.() || video?.srcObject?.getTracks?.() || []) track.stop()
    stream = null
    camera = null
    try { hands?.close() } catch {}
    hands = null
    if (video) video.srcObject = null
    clearFocus()
    document.body.classList.remove("gesture-is-active")
    if (session) session.hidden = true
    if (startButton) {
      startButton.hidden = false
      startButton.disabled = false
    }
  }

  function setStatus(key) {
    if (status) status.textContent = t(key)
  }

  function updateProgress(amount) {
    progress?.style.setProperty("--gesture-progress", `${Math.round(amount * 100)}%`)
  }
}

function isOpenPalm(landmarks) {
  const wrist = landmarks[0]
  const tips = [8, 12, 16, 20]
  const bases = [5, 9, 13, 17]
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const extended = tips.filter((tip, index) => distance(landmarks[tip], wrist) > distance(landmarks[bases[index]], wrist) * 1.24)
  const thumbOpen = distance(landmarks[4], landmarks[8]) > 0.14
  return extended.length >= 4 && thumbOpen
}

function loadScript(src, id) {
  if (document.querySelector(`script[data-loader="${id}"]`)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.crossOrigin = "anonymous"
    script.dataset.loader = id
    script.addEventListener("load", resolve, { once: true })
    script.addEventListener("error", reject, { once: true })
    document.head.append(script)
  })
}
