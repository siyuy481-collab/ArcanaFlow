const LOCALE_KEY = "arcana.locale.v1"
const SUPPORTED = ["zh", "en", "ja"]

const messages = {
  zh: {
    "nav.home": "首页", "nav.draw": "抽牌", "nav.cards": "牌义图鉴", "nav.archive": "占卜档案", "nav.drawAgain": "再次抽牌",
    "account.guest": "登录 / 注册", "account.named": "{username} 的档案",
    "footer.notice": "占卜用于自我觉察与娱乐，不替代医疗、法律或财务建议。",
    "home.eyebrow": "ARCANA · 象征与直觉之间", "home.title": "凝视未知<br /><em>听见自己</em>",
    "home.intro": "问题沉入夜色，象征从心底回应。无需寻找标准答案，只需留意最先吸引你的那张牌。",
    "home.begin": "写下一个问题", "home.explore": "翻阅牌义图鉴", "home.whisper": "YOUR INTUITION KNOWS",
    "draw.eyebrow": "一次安静的抽牌", "draw.title": "让直觉先于解释", "draw.intro": "写下此刻真正困扰你的问题，然后放慢速度，选择第一张令你停留的牌。牌面会在另一页揭晓。",
    "draw.questionLabel": "你想询问什么？", "draw.questionPlaceholder": "例如：未来三个月，我该如何调整自己的职业方向？", "draw.questionHint": "清楚地描述处境，不必预设答案",
    "draw.modeSingle": "单牌指引", "draw.modeSingleHint": "一张牌 · 凝视当下", "draw.modeThree": "三牌展开", "draw.modeThreeHint": "过去 · 当下 · 未来",
    "draw.instinct": "跟随第一直觉", "draw.selected": "已选择", "draw.open": "揭开牌面 →", "draw.gateHint": "让一张牌停在光框中", "draw.fanInstruction": "点击牌面，或左右移动食指，让目标牌滑入中央发光虚框",
    "draw.status.start": "请写下问题并选择 {count} 张牌", "draw.status.more": "再选择 {count} 张牌即可揭开牌面", "draw.status.ready": "牌阵已完成，答案将在新页面显现", "draw.status.limit": "这一牌阵只需选择 {count} 张牌，可以先取消一张", "draw.entering": "正在进入解读…", "draw.chooseCard": "选择第 {count} 张牌",
    "gesture.title": "以手势选牌", "gesture.intro": "食指移动焦点，张开手掌确认", "gesture.start": "开启摄像头", "gesture.stop": "结束", "gesture.loading": "正在准备手势识别…", "gesture.privacy": "影像仅在当前浏览器中用于识别，不会上传", "gesture.noHand": "请将一只手放入画面", "gesture.point": "移动食指，指向一张牌", "gesture.hold": "保持张开手掌以确认", "gesture.selected": "牌面已确认，可继续选择", "gesture.denied": "无法启用摄像头，请检查 Chrome 的相机权限", "gesture.network": "手势模型加载失败，请检查网络后重试",
    "zoom.notice": "Chrome 当前可能不是 100% 缩放，页面会显得过小。", "zoom.reset": "按 Ctrl + 0 恢复",
    "result.title": "你所选择的<br /><em>正在显现</em>", "result.loadingQuestion": "正在读取你的问题…", "result.water": "让视线停留片刻，牌面会像一句话般缓缓浮现", "result.waterReady": "牌面已经显现，向下阅读它留下的线索",
    "result.interpretation": "你的解读", "result.save": "保存到占卜档案", "result.redraw": "重新抽牌", "result.loading": "AI 正在连接牌面线索…",
    "result.footer": "请把牌面视作整理内心的镜子，而非确定未来的结论。", "result.saved": "已保存在占卜档案", "result.savedNote": "这是你此前保存的占卜记录",
    "result.saveReady": "登录状态已确认，这条结果可以保存", "result.loginSave": "登录后保存", "result.loginSaveNote": "当前未登录；登录后会自动保存这次解读", "result.saving": "正在保存…", "result.savedDone": "已保存到占卜档案", "result.savedLink": "保存成功 · 查看档案", "result.retrySave": "重新保存", "result.backDraw": "返回抽牌页面",
    "cards.eyebrow": "THE MAJOR ARCANA", "cards.title": "二十二种<br /><em>心灵原型</em>", "cards.intro": "大阿卡那不是二十二个固定结论，而是二十二面镜子。选择任意牌面，查看它在正位与逆位时可能指向的经验。",
    "cards.search": "搜索牌名或关键词", "cards.count": "共 {count} 张大阿卡那", "cards.open": "查看牌义", "cards.upright": "正位", "cards.reversed": "逆位", "cards.empty": "没有找到相符的牌。", "cards.close": "关闭", "cards.footer": "牌义是象征的入口，不是唯一的答案。",
    "auth.eyebrow": "一间只属于你的档案室", "auth.title": "收藏每一次<br /><em>与内心的对话</em>", "auth.intro": "登录不是为了追踪你，而是让散落的提问和牌面在时间里留下安静的坐标。",
    "auth.safe1": "密码经过加盐哈希后保存", "auth.safe2": "每位用户只能读取自己的记录", "auth.safe3": "本地 SQLite 存储，适合个人使用",
    "auth.login": "登录", "auth.register": "注册", "auth.identifier": "用户名或邮箱", "auth.password": "密码", "auth.username": "用户名", "auth.email": "邮箱",
    "auth.identifierPlaceholder": "输入用户名或邮箱", "auth.passwordPlaceholder": "至少 8 位", "auth.usernamePlaceholder": "3–24 位中文、字母或数字", "auth.loginSubmit": "进入我的档案", "auth.registerSubmit": "创建 ARCANA 账号",
    "profile.welcome": "欢迎回来", "profile.suffix": "的<br /><em>占卜档案</em>", "profile.new": "开始新的占卜", "profile.logout": "退出登录", "profile.history": "历史记录", "profile.count": "{count} 次占卜", "profile.joined": "加入于 {date}",
    "history.loading": "正在读取记录…", "history.emptyTitle": "档案还是空的", "history.emptyText": "完成一次抽牌并保存后，结果会出现在这里。", "history.first": "开始第一次占卜", "history.open": "打开解读 →", "history.delete": "删除", "history.confirm": "确定删除这条占卜记录吗？删除后无法恢复。",
    "auth.checking": "正在验证账号…", "auth.creating": "正在创建账号…", "auth.savedPending": "登录成功，上一次占卜已自动保存", "account.footer": "你的问题与解读仅保存在当前项目的本地数据库中。",
    "card.upright": "正位", "card.reversed": "逆位", "card.arcana": "大阿卡那", "position.single": "核心牌 / 当下指引", "position.past": "过去 / 背景", "position.present": "当下 / 核心", "position.future": "未来 / 建议",
    "error.timeout": "请求超时，请检查网络后重试", "error.noReading": "没有找到待解读的牌阵，请先完成抽牌", "error.loginReading": "请先登录，再查看这条占卜记录",
  },
  en: {
    "nav.home": "Home", "nav.draw": "Draw", "nav.cards": "Card Meanings", "nav.archive": "Archive", "nav.drawAgain": "Draw Again",
    "account.guest": "Sign in / Register", "account.named": "{username}'s Archive",
    "footer.notice": "Tarot is for reflection and entertainment, not medical, legal, or financial advice.",
    "home.eyebrow": "ARCANA · BETWEEN SYMBOL AND INTUITION", "home.title": "Look into the unknown<br /><em>Listen within</em>",
    "home.intro": "Let the question sink into the night and allow the symbol to answer. There is no standard answer—only the first card that holds your gaze.",
    "home.begin": "Write a question", "home.explore": "Explore card meanings", "home.whisper": "YOUR INTUITION KNOWS",
    "draw.eyebrow": "A QUIET DRAW", "draw.title": "Let intuition speak first", "draw.intro": "Write what truly concerns you, slow down, and choose the first card that makes you pause. Its face will be revealed on another page.",
    "draw.questionLabel": "What would you like to ask?", "draw.questionPlaceholder": "For example: How should I adjust my career direction over the next three months?", "draw.questionHint": "Describe the situation clearly without deciding the answer",
    "draw.modeSingle": "Single Card", "draw.modeSingleHint": "One card · the present", "draw.modeThree": "Three Cards", "draw.modeThreeHint": "Past · present · future",
    "draw.instinct": "Follow the first impulse", "draw.selected": "selected", "draw.open": "Reveal the cards →", "draw.gateHint": "Hold one card inside the light frame", "draw.fanInstruction": "Click a card, or slide your index finger sideways to guide it into the glowing frame",
    "draw.status.start": "Write a question and choose {count} card(s)", "draw.status.more": "Choose {count} more card(s) to continue", "draw.status.ready": "The spread is complete; the reading awaits", "draw.status.limit": "This spread needs only {count} card(s); deselect one first", "draw.entering": "Entering the reading…", "draw.chooseCard": "Choose card {count}",
    "gesture.title": "Choose by gesture", "gesture.intro": "Point to focus; open your palm to confirm", "gesture.start": "Start camera", "gesture.stop": "Stop", "gesture.loading": "Preparing hand tracking…", "gesture.privacy": "Video stays in this browser and is never uploaded", "gesture.noHand": "Place one hand inside the frame", "gesture.point": "Move your index finger toward a card", "gesture.hold": "Keep your palm open to confirm", "gesture.selected": "Card confirmed; continue when ready", "gesture.denied": "The camera could not start. Check Chrome camera permissions", "gesture.network": "The hand model could not load. Check your connection",
    "zoom.notice": "Chrome may not be at 100% zoom, so the page appears too small.", "zoom.reset": "Press Ctrl + 0 to reset",
    "result.title": "What you chose<br /><em>is taking form</em>", "result.loadingQuestion": "Retrieving your question…", "result.water": "Hold your gaze; the cards will appear like words arriving on a page", "result.waterReady": "The cards have appeared; continue downward to read their thread",
    "result.interpretation": "Your Reading", "result.save": "Save to Archive", "result.redraw": "Draw Again", "result.loading": "AI is connecting the symbols…",
    "result.footer": "Treat the cards as a mirror for reflection, not a fixed prediction.", "result.saved": "Saved in your archive", "result.savedNote": "This is a previously saved reading",
    "result.saveReady": "You are signed in; this reading can be saved", "result.loginSave": "Sign in to save", "result.loginSaveNote": "You are not signed in; this reading will be saved after login", "result.saving": "Saving…", "result.savedDone": "Saved to your archive", "result.savedLink": "Saved · View archive", "result.retrySave": "Try saving again", "result.backDraw": "Return to the draw",
    "cards.eyebrow": "THE MAJOR ARCANA", "cards.title": "Twenty-two<br /><em>inner archetypes</em>", "cards.intro": "The Major Arcana are not fixed conclusions but twenty-two mirrors. Open any card to explore what its upright and reversed positions may illuminate.",
    "cards.search": "Search names or keywords", "cards.count": "{count} Major Arcana", "cards.open": "View meaning", "cards.upright": "Upright", "cards.reversed": "Reversed", "cards.empty": "No matching card found.", "cards.close": "Close", "cards.footer": "A card meaning is an entrance into a symbol, never its only answer.",
    "auth.eyebrow": "A PRIVATE ROOM OF READINGS", "auth.title": "Keep each conversation<br /><em>with your inner world</em>", "auth.intro": "Signing in is not about tracking you. It gives your questions and cards a quiet place to remain over time.",
    "auth.safe1": "Passwords are salted and hashed", "auth.safe2": "Each user can access only their own records", "auth.safe3": "Local SQLite storage for personal use",
    "auth.login": "Sign in", "auth.register": "Register", "auth.identifier": "Username or email", "auth.password": "Password", "auth.username": "Username", "auth.email": "Email",
    "auth.identifierPlaceholder": "Enter username or email", "auth.passwordPlaceholder": "At least 8 characters", "auth.usernamePlaceholder": "3–24 letters, numbers, or CJK characters", "auth.loginSubmit": "Enter my archive", "auth.registerSubmit": "Create an ARCANA account",
    "profile.welcome": "WELCOME BACK", "profile.suffix": "'s<br /><em>Reading Archive</em>", "profile.new": "Begin a new reading", "profile.logout": "Sign out", "profile.history": "Reading History", "profile.count": "{count} readings", "profile.joined": "Joined {date}",
    "history.loading": "Loading your readings…", "history.emptyTitle": "The archive is still empty", "history.emptyText": "Complete and save a reading; it will appear here.", "history.first": "Begin your first reading", "history.open": "Open reading →", "history.delete": "Delete", "history.confirm": "Delete this reading permanently?",
    "auth.checking": "Verifying your account…", "auth.creating": "Creating your account…", "auth.savedPending": "Signed in; your previous reading was saved", "account.footer": "Your questions and readings are stored only in this project's local database.",
    "card.upright": "Upright", "card.reversed": "Reversed", "card.arcana": "Major Arcana", "position.single": "Core / Present Guidance", "position.past": "Past / Background", "position.present": "Present / Core", "position.future": "Future / Guidance",
    "error.timeout": "The request timed out. Check your connection and try again.", "error.noReading": "No pending spread was found. Please draw your cards first.", "error.loginReading": "Sign in before opening this saved reading.",
  },
  ja: {
    "nav.home": "ホーム", "nav.draw": "カードを引く", "nav.cards": "カードの意味", "nav.archive": "占いの記録", "nav.drawAgain": "もう一度引く",
    "account.guest": "ログイン / 登録", "account.named": "{username}の記録",
    "footer.notice": "タロットは自己理解と娯楽のためのもので、医療・法律・金融の助言ではありません。",
    "home.eyebrow": "ARCANA · 象徴と直感のあいだ", "home.title": "未知を見つめ<br /><em>内なる声を聴く</em>",
    "home.intro": "問いを夜の静けさへ沈め、象徴からの応答を待ちましょう。正解を探すのではなく、最初に視線を留めたカードに耳を澄ませます。",
    "home.begin": "問いを書き留める", "home.explore": "カードの意味を見る", "home.whisper": "YOUR INTUITION KNOWS",
    "draw.eyebrow": "静かなドロー", "draw.title": "解釈より先に、直感を", "draw.intro": "今ここにある本当の問いを書き、ゆっくりと最初に心を引いたカードを選んでください。カードは次のページで姿を現します。",
    "draw.questionLabel": "何を尋ねたいですか？", "draw.questionPlaceholder": "例：これから三か月、仕事の方向性をどう整えるべきですか？", "draw.questionHint": "答えを決めず、状況を具体的に書いてください",
    "draw.modeSingle": "ワンカード", "draw.modeSingleHint": "一枚 · 今を見つめる", "draw.modeThree": "スリーカード", "draw.modeThreeHint": "過去 · 現在 · 未来",
    "draw.instinct": "最初の直感に従う", "draw.selected": "選択済み", "draw.open": "カードを開く →", "draw.gateHint": "一枚を光の枠に重ねてください", "draw.fanInstruction": "カードをクリックするか、人差し指を左右へ動かして光る枠へ導きます",
    "draw.status.start": "問いを書き、{count}枚のカードを選んでください", "draw.status.more": "あと{count}枚選ぶとカードを開けます", "draw.status.ready": "スプレッドが整いました。次のページへ進めます", "draw.status.limit": "このスプレッドは{count}枚です。先に一枚外してください", "draw.entering": "リーディングへ移動中…", "draw.chooseCard": "{count}枚目を選ぶ",
    "gesture.title": "ジェスチャーで選ぶ", "gesture.intro": "人差し指で移動し、手のひらを開いて確定", "gesture.start": "カメラを開始", "gesture.stop": "終了", "gesture.loading": "手の認識を準備しています…", "gesture.privacy": "映像はブラウザ内の認識だけに使われ、送信されません", "gesture.noHand": "手を一つ画面に入れてください", "gesture.point": "人差し指をカードへ動かしてください", "gesture.hold": "手のひらを開いたまま確定してください", "gesture.selected": "カードを確定しました。続けて選べます", "gesture.denied": "カメラを開始できません。Chrome の権限を確認してください", "gesture.network": "手の認識モデルを読み込めません。接続を確認してください",
    "zoom.notice": "Chrome のズームが100%ではないため、ページが小さく見える可能性があります。", "zoom.reset": "Ctrl + 0 で戻す",
    "result.title": "選んだものが<br /><em>姿を現します</em>", "result.loadingQuestion": "問いを読み込んでいます…", "result.water": "視線を留めると、言葉が現れるようにカードが浮かびます", "result.waterReady": "カードが現れました。下へ進み、そのつながりを読んでください",
    "result.interpretation": "あなたのリーディング", "result.save": "記録に保存", "result.redraw": "もう一度引く", "result.loading": "AIがカードの象徴を結んでいます…",
    "result.footer": "カードは未来を固定する答えではなく、心を映す鏡として受け取ってください。", "result.saved": "記録に保存済み", "result.savedNote": "以前に保存したリーディングです",
    "result.saveReady": "ログイン済みです。この結果を保存できます", "result.loginSave": "ログインして保存", "result.loginSaveNote": "未ログインです。ログイン後に自動で保存されます", "result.saving": "保存中…", "result.savedDone": "記録に保存しました", "result.savedLink": "保存しました · 記録を見る", "result.retrySave": "もう一度保存", "result.backDraw": "ドローへ戻る",
    "cards.eyebrow": "THE MAJOR ARCANA", "cards.title": "二十二の<br /><em>心の原型</em>", "cards.intro": "大アルカナは固定された結論ではなく、二十二枚の鏡です。カードを選び、正位置と逆位置が照らす経験を見てみましょう。",
    "cards.search": "カード名・キーワードを検索", "cards.count": "大アルカナ 全{count}枚", "cards.open": "意味を見る", "cards.upright": "正位置", "cards.reversed": "逆位置", "cards.empty": "一致するカードがありません。", "cards.close": "閉じる", "cards.footer": "カードの意味は象徴への入口であり、唯一の答えではありません。",
    "auth.eyebrow": "あなただけの記録室", "auth.title": "内なる世界との対話を<br /><em>静かに残す</em>", "auth.intro": "ログインは追跡のためではありません。問いとカードを、時間の中にそっと残すための場所です。",
    "auth.safe1": "パスワードはソルト付きハッシュで保存", "auth.safe2": "自分の記録だけを閲覧可能", "auth.safe3": "個人利用向けのローカルSQLite保存",
    "auth.login": "ログイン", "auth.register": "登録", "auth.identifier": "ユーザー名またはメール", "auth.password": "パスワード", "auth.username": "ユーザー名", "auth.email": "メール",
    "auth.identifierPlaceholder": "ユーザー名またはメールを入力", "auth.passwordPlaceholder": "8文字以上", "auth.usernamePlaceholder": "3～24文字", "auth.loginSubmit": "記録室へ入る", "auth.registerSubmit": "ARCANAアカウントを作る",
    "profile.welcome": "おかえりなさい", "profile.suffix": "の<br /><em>占いの記録</em>", "profile.new": "新しい占いを始める", "profile.logout": "ログアウト", "profile.history": "過去の記録", "profile.count": "{count}件の占い", "profile.joined": "{date}から利用", 
    "history.loading": "記録を読み込んでいます…", "history.emptyTitle": "記録はまだありません", "history.emptyText": "占いを保存すると、ここに表示されます。", "history.first": "最初の占いを始める", "history.open": "リーディングを開く →", "history.delete": "削除", "history.confirm": "この記録を完全に削除しますか？",
    "auth.checking": "アカウントを確認中…", "auth.creating": "アカウントを作成中…", "auth.savedPending": "ログインしました。前回の占いを保存しました", "account.footer": "問いとリーディングは、このプロジェクトのローカルデータベースにのみ保存されます。",
    "card.upright": "正位置", "card.reversed": "逆位置", "card.arcana": "大アルカナ", "position.single": "中心 / 今への導き", "position.past": "過去 / 背景", "position.present": "現在 / 核心", "position.future": "未来 / 助言",
    "error.timeout": "時間切れになりました。接続を確認してもう一度お試しください。", "error.noReading": "カードが見つかりません。先にカードを引いてください。", "error.loginReading": "保存した記録を見るにはログインしてください。",
  },
}

export function getLocale() {
  const stored = localStorage.getItem(LOCALE_KEY)
  return SUPPORTED.includes(stored) ? stored : "zh"
}

export function t(key, variables = {}) {
  const locale = getLocale()
  const template = messages[locale]?.[key] ?? messages.zh[key] ?? key
  return Object.entries(variables).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, replacement), template)
}

export function applyTranslations(root = document) {
  const locale = getLocale()
  document.documentElement.lang = locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : "en"
  root.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n) })
  root.querySelectorAll("[data-i18n-html]").forEach((element) => { element.innerHTML = t(element.dataset.i18nHtml) })
  root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder) })
  root.querySelectorAll("[data-locale]").forEach((button) => {
    const active = button.dataset.locale === locale
    button.classList.toggle("is-active", active)
    button.setAttribute("aria-pressed", String(active))
  })
}

export function setLocale(locale) {
  if (!SUPPORTED.includes(locale)) return
  localStorage.setItem(LOCALE_KEY, locale)
  applyTranslations()
  window.dispatchEvent(new CustomEvent("arcana:localechange", { detail: { locale } }))
}

export function initI18n() {
  applyTranslations()
  initZoomNotice()
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-locale]")
    if (button) setLocale(button.dataset.locale)
  })
}

function initZoomNotice() {
  if (document.querySelector(".zoom-notice")) return
  const outer = window.outerWidth || window.screen?.availWidth || window.innerWidth
  const likelyLowZoom = window.innerWidth > Math.max(1800, outer * 1.3)
  if (!likelyLowZoom || sessionStorage.getItem("arcana.zoom-notice.dismissed")) return

  const notice = document.createElement("aside")
  notice.className = "zoom-notice"
  notice.innerHTML = `<span data-i18n="zoom.notice">${t("zoom.notice")}</span><strong data-i18n="zoom.reset">${t("zoom.reset")}</strong><button type="button" aria-label="Close">×</button>`
  notice.querySelector("button").addEventListener("click", () => {
    sessionStorage.setItem("arcana.zoom-notice.dismissed", "1")
    notice.remove()
  })
  document.body.append(notice)
}
