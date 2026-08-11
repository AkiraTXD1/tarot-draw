"use strict";

/* ------------------------------
   固定配置：牌阵与显示标签
------------------------------ */

const SPREADS = Object.freeze({
  single: Object.freeze({
    name: "单张牌",
    positions: Object.freeze(["本次指引"])
  }),
  "past-present-future": Object.freeze({
    name: "过去、现在、未来",
    positions: Object.freeze(["过去", "现在", "未来"])
  }),
  "situation-obstacle-advice": Object.freeze({
    name: "现状、阻碍、建议",
    positions: Object.freeze(["现状", "阻碍", "建议"])
  }),
  options: Object.freeze({
    name: "选项A、选项B、综合建议",
    positions: Object.freeze(["选项 A", "选项 B", "综合建议"])
  }),
  "near-development-result": Object.freeze({
    name: "近期、发展、结果",
    positions: Object.freeze(["近期", "发展", "结果"])
  }),
  custom: Object.freeze({
    name: "自定义抽牌",
    positions: Object.freeze([])
  })
});

const SUIT_LABELS = Object.freeze({
  "Major Arcana": "大阿卡纳",
  Wands: "权杖",
  Cups: "圣杯",
  Swords: "宝剑",
  Pentacles: "星币"
});

const STORAGE_KEY = "quiet-tarot-reading-history-v1";
const DECK_THEME_STORAGE_KEY = "quiet-tarot-deck-theme-v1";
const LEGACY_HISTORY_DECK_THEME_ID = "text";
const UINT32_RANGE = 4294967296;
const warnedMissingDeckImages = new Set();

const appState = {
  currentReading: null,
  revealedIndexes: new Set(),
  saved: false,
  history: [],
  historySummaryModel: null,
  deckThemeId: window.DEFAULT_TAROT_DECK_THEME || "text"
};

/* ------------------------------
   安全随机：只使用浏览器加密随机源
------------------------------ */

/**
 * 返回 [0, maxExclusive) 内均匀分布的整数。
 * 拒绝采样消除了直接取模可能造成的微小偏差。
 */
function secureRandomInt(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new RangeError("随机上限必须是 1 到 2^32 之间的整数。");
  }

  const randomBuffer = new Uint32Array(1);
  const acceptedRange = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  let value;

  do {
    window.crypto.getRandomValues(randomBuffer);
    value = randomBuffer[0];
  } while (value >= acceptedRange);

  return value % maxExclusive;
}

/**
 * 先独立随机选牌，再用另一次随机读取决定正逆位。
 * 牌从临时池移除，所以同一牌阵绝不会重复。
 */
function drawCards(positions) {
  const availableCards = [...window.TAROT_CARDS];

  return positions.map((position) => {
    const cardIndex = secureRandomInt(availableCards.length);
    const card = availableCards.splice(cardIndex, 1)[0];
    const isReversed = secureRandomInt(2) === 1;

    return Object.freeze({ position, card, isReversed });
  });
}

/* ------------------------------
   牌面渲染：未来图片版本的唯一入口
------------------------------ */

/**
 * 统一生成牌面。
 * 图片主题使用“标题 → 大图 → 牌位信息 → 牌义”的专属层级；
 * 图片加载失败时会恢复原有文字牌面的结构与样式。
 */
function renderCardFace(card, isReversed, position) {
  const content = document.createElement("span");
  content.className = "card-face-content";

  const deckThemeId = appState.deckThemeId;
  const cardImage = getCardThemeImage(card, deckThemeId);

  if (getDeckTheme(deckThemeId)?.type === "image" && !cardImage) {
    warnDeckImageMissing(card, deckThemeId);
  }

  const positionLabel = document.createElement("span");
  positionLabel.className = "card-position";
  positionLabel.textContent = `牌位 · ${position}`;

  const symbol = document.createElement("span");
  symbol.className = "card-symbol";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = card.symbol;

  const number = document.createElement("span");
  number.className = "card-number";
  number.textContent = formatCardNumber(card);

  const nameZh = document.createElement("span");
  nameZh.className = "card-name-zh";
  nameZh.textContent = card.nameZh;

  const nameEn = document.createElement("span");
  nameEn.className = "card-name-en";
  nameEn.textContent = card.nameEn;

  const meta = document.createElement("span");
  meta.className = "card-meta";

  const suit = document.createElement("span");
  suit.className = "card-suit";
  suit.textContent = SUIT_LABELS[card.suit];

  const orientation = document.createElement("span");
  orientation.className = "orientation-badge";
  orientation.textContent = isReversed ? "逆位" : "正位";

  meta.append(suit, orientation);

  const reading = document.createElement("span");
  reading.className = "card-reading";

  const keywordsLabel = document.createElement("span");
  keywordsLabel.className = "card-keywords-label";
  keywordsLabel.textContent = "关键词";

  const keywords = document.createElement("span");
  keywords.className = "card-keywords";
  keywords.textContent = getKeywords(card, isReversed).join(" · ");

  const meaningLabel = document.createElement("span");
  meaningLabel.className = "card-meaning-label";
  meaningLabel.textContent = "牌义";

  const meaning = document.createElement("span");
  meaning.className = "card-meaning";
  meaning.textContent = isReversed ? card.reversedMeaning : card.uprightMeaning;

  reading.append(keywordsLabel, keywords, meaningLabel, meaning);

  if (cardImage) {
    content.classList.add("is-image-layout");

    const titleOrientation = document.createElement("span");
    titleOrientation.className = "card-title-orientation";
    titleOrientation.textContent = ` · ${orientation.textContent}`;
    nameZh.append(titleOrientation);
    meta.replaceChildren(suit);

    const title = document.createElement("span");
    title.className = "card-image-title";
    title.append(number, nameZh, nameEn);

    const image = document.createElement("img");
    image.className = "card-image";
    image.classList.toggle("is-reversed-image", isReversed);
    image.src = cardImage;
    image.alt = `${card.nameZh}卡面`;
    image.loading = "eager";
    image.decoding = "async";
    image.hidden = true;

    const facts = document.createElement("span");
    facts.className = "card-image-facts";
    facts.append(positionLabel, meta);

    image.addEventListener("load", () => {
      image.hidden = false;
      content.classList.add("has-image");
    });
    image.addEventListener("error", () => {
      warnDeckImageMissing(card, deckThemeId);
      image.remove();
      content.classList.remove("has-image", "is-image-layout");
      nameZh.textContent = card.nameZh;
      meta.replaceChildren(suit, orientation);
      content.replaceChildren(positionLabel, symbol, number, nameZh, nameEn, meta, reading);
    });

    content.append(title, image, facts, reading);
  } else {
    // 文字牌组保持原有 DOM 顺序与视觉布局不变。
    content.append(positionLabel, symbol, number, nameZh, nameEn, meta, reading);
  }

  return content;
}

/* ------------------------------
   紧凑总结：只读取已经确定的牌面
------------------------------ */

function createSummaryModelFromReading(reading) {
  return Object.freeze({
    deckId: appState.deckThemeId,
    question: reading.question,
    spreadName: reading.spreadName,
    createdAt: reading.createdAt,
    cards: Object.freeze(reading.results.map((result) => Object.freeze({
      position: result.position,
      cardId: result.card.id,
      nameZh: result.card.nameZh,
      nameEn: result.card.nameEn,
      orientation: result.isReversed ? "逆位" : "正位",
      keywords: Object.freeze([...getKeywords(result.card, result.isReversed)].slice(0, 3)),
      meaning: result.isReversed ? result.card.reversedMeaning : result.card.uprightMeaning,
      symbol: result.card.symbol,
      image: result.card.image
    })))
  });
}

function createSummaryModelFromRecord(record) {
  return {
    deckId: getRecordDeckThemeId(record),
    question: record.question,
    spreadName: record.spreadName,
    createdAt: record.createdAt,
    cards: record.cards.map((savedCard) => {
      const sourceCard = window.TAROT_CARDS.find((card) => card.id === savedCard.cardId);
      const isReversed = savedCard.orientation === "逆位";
      const sourceKeywords = sourceCard ? getKeywords(sourceCard, isReversed) : [];
      const savedKeywords = Array.isArray(savedCard.keywords) ? savedCard.keywords : [];

      return {
        position: savedCard.position || "未命名牌位",
        cardId: savedCard.cardId || "",
        nameZh: savedCard.nameZh || (sourceCard ? sourceCard.nameZh : "牌名未知"),
        nameEn: savedCard.nameEn || (sourceCard ? sourceCard.nameEn : ""),
        orientation: isReversed ? "逆位" : "正位",
        keywords: (savedKeywords.length ? savedKeywords : sourceKeywords).slice(0, 3),
        meaning: savedCard.meaning || (sourceCard
          ? (isReversed ? sourceCard.reversedMeaning : sourceCard.uprightMeaning)
          : ""),
        symbol: savedCard.symbol || (sourceCard ? sourceCard.symbol : "·"),
        image: sourceCard ? sourceCard.image : (savedCard.image || null)
      };
    })
  };
}

function renderSummaryReport(model) {
  const report = document.createElement("article");
  report.className = "summary-report summary-count-" + Math.min(model.cards.length, 10);

  const header = document.createElement("header");
  header.className = "summary-report-header";

  const eyebrow = document.createElement("p");
  eyebrow.className = "summary-report-eyebrow";
  eyebrow.textContent = "READING SUMMARY";

  const title = document.createElement("h3");
  title.textContent = "本次牌阵总结";

  const facts = document.createElement("dl");
  facts.className = "summary-facts";

  appendSummaryFact(facts, "问题", "「" + model.question + "」", "summary-question");
  appendSummaryFact(facts, "牌阵", model.spreadName, "summary-spread");
  appendSummaryFact(facts, "牌位", model.cards.map((card) => card.position).join(" · "), "summary-positions");
  appendSummaryFact(facts, "抽牌时间", formatDate(model.createdAt), "summary-time");

  header.append(eyebrow, title, facts);

  const grid = document.createElement("div");
  grid.className = "summary-card-grid";

  model.cards.forEach((card, index) => {
    grid.append(renderSummaryMiniCard(card, index, model.deckId));
  });

  const trend = document.createElement("section");
  trend.className = "summary-trend";

  const trendTitle = document.createElement("h4");
  trendTitle.textContent = "整体走势";

  const trendList = document.createElement("ul");
  model.cards.forEach((card) => {
    const item = document.createElement("li");
    const position = document.createElement("strong");
    position.textContent = card.position + "：";
    item.append(position, document.createTextNode(card.meaning));
    trendList.append(item);
  });

  const combined = document.createElement("p");
  combined.className = "summary-combined";
  combined.textContent = createCombinedTrend(model.cards);

  trend.append(trendTitle, trendList, combined);

  const aiBlock = document.createElement("section");
  aiBlock.className = "summary-ai-block";

  const aiTitle = document.createElement("h4");
  aiTitle.textContent = "AI 解读信息";

  const aiText = document.createElement("pre");
  aiText.textContent = createAiReadingText(model);

  const sourceNote = document.createElement("p");
  sourceNote.className = "summary-source-note";
  sourceNote.textContent = "仅整理本次已确定的牌面数据，不进行 AI 解读。";

  aiBlock.append(aiTitle, aiText);
  report.append(header, grid, trend, aiBlock, sourceNote);

  return report;
}

function appendSummaryFact(list, label, value, className) {
  const group = document.createElement("div");
  group.className = "summary-fact " + className;

  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  group.append(term, description);
  list.append(group);
}

function renderSummaryMiniCard(card, index, deckThemeId = appState.deckThemeId) {
  const miniCard = document.createElement("article");
  miniCard.className = "summary-mini-card " + (card.orientation === "逆位" ? "is-reversed" : "is-upright");
  miniCard.setAttribute("aria-label", card.position + "：" + card.nameZh + "，" + card.orientation);

  const position = document.createElement("p");
  position.className = "summary-mini-position";
  position.textContent = card.position;

  const visual = document.createElement("div");
  visual.className = "summary-mini-visual";

  const symbol = document.createElement("span");
  symbol.className = "summary-mini-symbol";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = card.symbol;

  const cardImage = getCardThemeImage(card, deckThemeId);
  if (getDeckTheme(deckThemeId)?.type === "image" && !cardImage) {
    warnDeckImageMissing(card, deckThemeId);
  }

  if (cardImage) {
    const image = document.createElement("img");
    image.className = "summary-mini-image";
    image.classList.toggle("is-reversed-image", card.orientation === "逆位");
    image.alt = card.nameZh + "缩略卡面";
    image.loading = "eager";
    image.decoding = "async";
    image.addEventListener("load", () => miniCard.classList.add("has-thumbnail"));
    image.addEventListener("error", () => {
      warnDeckImageMissing(card, deckThemeId);
      image.remove();
      miniCard.classList.remove("has-thumbnail");
    });
    image.src = cardImage;
    visual.append(image);
  }

  visual.append(symbol);

  const number = document.createElement("span");
  number.className = "summary-mini-index";
  number.textContent = String(index + 1).padStart(2, "0");

  const nameZh = document.createElement("h4");
  nameZh.textContent = card.nameZh;

  if (cardImage) {
    const titleOrientation = document.createElement("span");
    titleOrientation.className = "summary-title-orientation";
    titleOrientation.textContent = ` · ${card.orientation}`;
    nameZh.append(titleOrientation);
  }

  const nameEn = document.createElement("p");
  nameEn.className = "summary-mini-name-en";
  nameEn.textContent = card.nameEn;

  const orientation = document.createElement("p");
  orientation.className = "summary-mini-orientation";
  orientation.textContent = card.orientation;

  const keywords = document.createElement("p");
  keywords.className = "summary-mini-keywords";
  keywords.textContent = card.keywords.join(" · ");

  const meaning = document.createElement("p");
  meaning.className = "summary-mini-meaning";
  meaning.textContent = card.meaning;

  miniCard.append(position, visual, number, nameZh, nameEn);
  if (!cardImage) {
    miniCard.append(orientation);
  }
  miniCard.append(keywords, meaning);
  return miniCard;
}

function createCombinedTrend(cards) {
  const clues = cards.map((card) => card.position + "「" + (card.keywords[0] || card.meaning) + "」");

  if (clues.length === 1) {
    return "本次核心线索为：" + clues[0] + "。";
  }

  return "牌位线索依次为：" + clues.join(" → ") + "。";
}

function createAiReadingText(model) {
  return [
    "问题：" + model.question,
    "牌阵：" + model.spreadName,
    ...model.cards.map((card) => (
      card.position + "：" + card.nameZh + "｜" + card.orientation + "｜" + card.keywords.join("、")
    ))
  ].join("\n");
}

function showCurrentSummary(elements) {
  if (!appState.currentReading) {
    return;
  }

  const model = createSummaryModelFromReading(appState.currentReading);
  elements.currentSummary.replaceChildren(renderSummaryReport(model));
  elements.summarySection.hidden = false;
}

function openHistorySummary(elements, record) {
  const model = createSummaryModelFromRecord(record);
  appState.historySummaryModel = model;
  elements.historySummary.replaceChildren(renderSummaryReport(model));

  if (typeof elements.historySummaryDialog.showModal === "function") {
    elements.historySummaryDialog.showModal();
  } else {
    elements.historySummaryDialog.setAttribute("open", "");
  }
}

function closeHistorySummary(elements) {
  setShareMode(elements, null);
  appState.historySummaryModel = null;

  if (typeof elements.historySummaryDialog.close === "function") {
    elements.historySummaryDialog.close();
  } else {
    elements.historySummaryDialog.removeAttribute("open");
  }
}

function toggleShareMode(elements, source) {
  const isSameMode = document.body.classList.contains("is-share-mode") &&
    document.body.dataset.shareSource === source;
  setShareMode(elements, isSameMode ? null : source);
}

function setShareMode(elements, source) {
  const isActive = Boolean(source);
  document.body.classList.toggle("is-share-mode", isActive);

  if (isActive) {
    document.body.dataset.shareSource = source;
  } else {
    delete document.body.dataset.shareSource;
  }

  const currentActive = source === "current";
  const historyActive = source === "history";

  elements.shareButton.textContent = currentActive ? "退出截图模式" : "分享 / 截图模式";
  elements.shareButton.setAttribute("aria-pressed", String(currentActive));
  elements.historyShareButton.textContent = historyActive ? "退出截图模式" : "分享 / 截图模式";
  elements.historyShareButton.setAttribute("aria-pressed", String(historyActive));

  if (isActive) {
    const target = historyActive ? elements.historySummaryDialog : elements.summarySection;
    window.requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

/* ------------------------------
   牌组主题：只控制显示层
------------------------------ */

function getDeckTheme(themeId = appState.deckThemeId) {
  const themes = window.TAROT_DECK_THEMES || {};
  return themes[themeId] || themes[window.DEFAULT_TAROT_DECK_THEME] || themes.text || null;
}

function getCardThemeImage(card, themeId = appState.deckThemeId) {
  const theme = getDeckTheme(themeId);
  if (!theme || theme.type !== "image" || !card) {
    return null;
  }

  const sourceCard = card.id
    ? card
    : window.TAROT_CARDS.find((candidate) => candidate.id === card.cardId);
  const imageSources = sourceCard ? sourceCard.image : card.image;

  if (typeof imageSources === "string") {
    return imageSources;
  }

  if (!imageSources || typeof imageSources !== "object") {
    return null;
  }

  const imageKey = theme.imageKey || theme.id;
  const source = imageSources[imageKey];
  return typeof source === "string" && source.trim() ? source : null;
}

function warnDeckImageMissing(card, themeId = appState.deckThemeId) {
  const theme = getDeckTheme(themeId);
  if (!theme || theme.id !== "apple") {
    return;
  }

  const cardId = card?.id || card?.cardId || "unknown";
  const warningKey = `${theme.id}:${cardId}`;
  if (warnedMissingDeckImages.has(warningKey)) {
    return;
  }

  warnedMissingDeckImages.add(warningKey);
  console.warn(`Apple Tarot image missing: ${cardId}`);
}

function getRecordDeckThemeId(record) {
  const savedThemeId = record && typeof record.deckId === "string" ? record.deckId : "";
  const themes = window.TAROT_DECK_THEMES || {};
  return savedThemeId && themes[savedThemeId] ? savedThemeId : LEGACY_HISTORY_DECK_THEME_ID;
}

function loadDeckThemePreference() {
  const fallback = window.DEFAULT_TAROT_DECK_THEME || "text";

  try {
    const savedTheme = window.localStorage.getItem(DECK_THEME_STORAGE_KEY);
    return getDeckTheme(savedTheme) ? savedTheme : fallback;
  } catch (error) {
    console.warn("无法读取牌组主题偏好。", error);
    return fallback;
  }
}

function saveDeckThemePreference(themeId) {
  try {
    window.localStorage.setItem(DECK_THEME_STORAGE_KEY, themeId);
  } catch (error) {
    console.warn("无法保存牌组主题偏好。", error);
  }
}

function applyDeckTheme(elements, themeId, options = {}) {
  const { persist = true, rerender = true } = options;
  const fallback = window.DEFAULT_TAROT_DECK_THEME || "text";
  const theme = getDeckTheme(themeId) || getDeckTheme(fallback);

  if (!theme) {
    return;
  }

  appState.deckThemeId = theme.id;
  document.documentElement.dataset.deckTheme = theme.id;
  document.documentElement.dataset.deckType = theme.type;

  elements.deckThemeInputs.forEach((input) => {
    input.checked = input.value === theme.id;
  });

  elements.deckThemeNote.textContent = theme.note || (theme.type === "image"
    ? "当前显示图像牌面；缺图时自动回退文字版，不会重新抽牌。"
    : "当前显示文字牌面；切换只改变显示，不会重新抽牌。");

  if (persist) {
    saveDeckThemePreference(theme.id);
  }

  if (rerender) {
    rerenderForDeckTheme(elements);
  }
}

function rerenderForDeckTheme(elements) {
  const reading = appState.currentReading;

  if (reading) {
    const cardButtons = elements.cardsGrid.querySelectorAll(".tarot-card");
    reading.results.forEach((result, index) => {
      if (!appState.revealedIndexes.has(index)) {
        return;
      }

      const front = cardButtons[index] ? cardButtons[index].querySelector(".card-front") : null;
      if (front) {
        front.replaceChildren(renderCardFace(result.card, result.isReversed, result.position));
      }
    });

    if (appState.revealedIndexes.size === reading.results.length) {
      showCurrentSummary(elements);
    }
  }

  if (appState.historySummaryModel) {
    elements.historySummary.replaceChildren(renderSummaryReport(appState.historySummaryModel));
  }

  renderHistory(elements);
}

function getKeywords(card, isReversed) {
  return isReversed ? card.reversedKeywords : card.uprightKeywords;
}

function formatCardNumber(card) {
  if (card.suit === "Major Arcana") {
    return card.number === 0 ? "0 · MAJOR ARCANA" : `${toRoman(card.number)} · MAJOR ARCANA`;
  }

  const minorLabels = {
    1: "ACE",
    11: "PAGE",
    12: "KNIGHT",
    13: "QUEEN",
    14: "KING"
  };
  return `${minorLabels[card.number] || toRoman(card.number)} · ${card.suit.toUpperCase()}`;
}

function toRoman(number) {
  const values = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ];
  let rest = number;
  let result = "";

  values.forEach(([value, numeral]) => {
    while (rest >= value) {
      result += numeral;
      rest -= value;
    }
  });

  return result;
}

/* ------------------------------
   页面状态与抽牌流程
------------------------------ */

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
  const elements = getElements();

  if (!window.crypto || typeof window.crypto.getRandomValues !== "function") {
    elements.drawButton.disabled = true;
    elements.drawButton.title = "当前浏览器不支持安全随机数";
    showSetupError(elements, "当前浏览器不支持安全随机数，无法进行抽牌。");
    return;
  }

  const deckCheck = validateDeck(window.TAROT_CARDS);
  if (!deckCheck.valid) {
    elements.drawButton.disabled = true;
    elements.drawButton.title = "牌库校验失败";
    showSetupError(elements, `牌库校验失败：${deckCheck.errors.join("；")}`);
    return;
  }

  appState.history = loadHistory();
  applyDeckTheme(elements, loadDeckThemePreference(), { persist: false, rerender: false });
  bindEvents(elements);
  updateSpreadControls(elements);
  updateQuestionCount(elements);
  renderHistory(elements);
}

function getElements() {
  return {
    questionInput: document.getElementById("questionInput"),
    questionCount: document.getElementById("questionCount"),
    spreadSelect: document.getElementById("spreadSelect"),
    deckThemeInputs: [...document.querySelectorAll('input[name="deckTheme"]')],
    deckThemeNote: document.getElementById("deckThemeNote"),
    customCountField: document.getElementById("customCountField"),
    customCount: document.getElementById("customCount"),
    countMinus: document.getElementById("countMinus"),
    countPlus: document.getElementById("countPlus"),
    positionPreview: document.getElementById("positionPreview"),
    drawButton: document.getElementById("drawButton"),
    readingArea: document.getElementById("readingArea"),
    readingTitle: document.getElementById("readingTitle"),
    questionDisplay: document.getElementById("questionDisplay"),
    spreadDisplay: document.getElementById("spreadDisplay"),
    flipInstruction: document.getElementById("flipInstruction"),
    cardsGrid: document.getElementById("cardsGrid"),
    summarySection: document.getElementById("summarySection"),
    currentSummary: document.getElementById("currentSummary"),
    shareButton: document.getElementById("shareButton"),
    saveButton: document.getElementById("saveButton"),
    resetButton: document.getElementById("resetButton"),
    actionStatus: document.getElementById("actionStatus"),
    cardTemplate: document.getElementById("cardTemplate"),
    historyPanel: document.getElementById("historyPanel"),
    historyCount: document.getElementById("historyCount"),
    historyList: document.getElementById("historyList"),
    emptyHistory: document.getElementById("emptyHistory"),
    clearHistoryButton: document.getElementById("clearHistoryButton"),
    historySummaryDialog: document.getElementById("historySummaryDialog"),
    historySummary: document.getElementById("historySummary"),
    historyShareButton: document.getElementById("historyShareButton"),
    closeHistorySummaryButton: document.getElementById("closeHistorySummaryButton")
  };
}

function bindEvents(elements) {
  elements.questionInput.addEventListener("input", () => updateQuestionCount(elements));
  elements.spreadSelect.addEventListener("change", () => updateSpreadControls(elements));
  elements.deckThemeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        applyDeckTheme(elements, input.value);
      }
    });
  });
  elements.customCount.addEventListener("input", () => {
    clampCustomCount(elements);
    updatePositionPreview(elements);
  });
  elements.customCount.addEventListener("change", () => {
    clampCustomCount(elements);
    updatePositionPreview(elements);
  });

  elements.countMinus.addEventListener("click", () => changeCustomCount(elements, -1));
  elements.countPlus.addEventListener("click", () => changeCustomCount(elements, 1));
  elements.drawButton.addEventListener("click", () => startReading(elements));
  elements.saveButton.addEventListener("click", () => saveCurrentReading(elements));
  elements.resetButton.addEventListener("click", () => resetReading(elements));
  elements.shareButton.addEventListener("click", () => toggleShareMode(elements, "current"));
  elements.historyShareButton.addEventListener("click", () => toggleShareMode(elements, "history"));
  elements.closeHistorySummaryButton.addEventListener("click", () => closeHistorySummary(elements));
  elements.historySummaryDialog.addEventListener("close", () => {
    setShareMode(elements, null);
    appState.historySummaryModel = null;
  });
  elements.clearHistoryButton.addEventListener("click", () => clearAllHistory(elements));
}

function updateQuestionCount(elements) {
  elements.questionCount.textContent = `${elements.questionInput.value.length} / 300`;
}

function updateSpreadControls(elements) {
  const isCustom = elements.spreadSelect.value === "custom";
  elements.customCountField.hidden = !isCustom;
  elements.customCount.disabled = !isCustom;
  elements.countMinus.disabled = !isCustom;
  elements.countPlus.disabled = !isCustom;
  clampCustomCount(elements);
  updatePositionPreview(elements);
}

function clampCustomCount(elements) {
  const parsed = Number.parseInt(elements.customCount.value, 10);
  const normalized = Number.isFinite(parsed) ? Math.min(10, Math.max(1, parsed)) : 1;
  elements.customCount.value = String(normalized);
}

function changeCustomCount(elements, delta) {
  const current = Number.parseInt(elements.customCount.value, 10) || 1;
  elements.customCount.value = String(Math.min(10, Math.max(1, current + delta)));
  updatePositionPreview(elements);
}

function getSelectedSpread(elements) {
  const selectedKey = elements.spreadSelect.value;
  const selected = SPREADS[selectedKey];

  if (selectedKey === "custom") {
    const count = Number.parseInt(elements.customCount.value, 10);
    return {
      key: selectedKey,
      name: `${selected.name}（${count} 张）`,
      positions: Array.from({ length: count }, (_, index) => `第 ${index + 1} 张`)
    };
  }

  return {
    key: selectedKey,
    name: selected.name,
    positions: [...selected.positions]
  };
}

function updatePositionPreview(elements) {
  const spread = getSelectedSpread(elements);
  elements.positionPreview.replaceChildren();

  spread.positions.forEach((position) => {
    const tag = document.createElement("span");
    tag.className = "position-tag";
    tag.textContent = position;
    elements.positionPreview.append(tag);
  });
}

function startReading(elements) {
  const spread = getSelectedSpread(elements);
  const question = elements.questionInput.value.trim() || "未填写问题";

  // 这一行同步完成整副结果的选取；之后的动画和点击不再参与随机。
  const results = drawCards(spread.positions);

  appState.currentReading = Object.freeze({
    question,
    spreadKey: spread.key,
    spreadName: spread.name,
    createdAt: new Date().toISOString(),
    results: Object.freeze(results)
  });
  appState.revealedIndexes = new Set();
  appState.saved = false;

  setSetupLocked(elements, true);
  elements.saveButton.disabled = true;
  elements.saveButton.textContent = "保存本次记录";
  setShareMode(elements, null);
  elements.summarySection.hidden = true;
  elements.currentSummary.replaceChildren();
  elements.actionStatus.textContent = "";
  elements.questionDisplay.textContent = question;
  elements.spreadDisplay.textContent = `${spread.name} · ${spread.positions.length} 张`;
  elements.readingTitle.textContent = "请依次翻开牌面";
  elements.flipInstruction.textContent = "点击任意牌背逐张翻牌。所有结果已在开始抽牌时确定。";
  elements.readingArea.hidden = false;

  renderCardBacks(elements, results);
  elements.readingArea.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCardBacks(elements, results) {
  elements.cardsGrid.replaceChildren();

  results.forEach((result, index) => {
    const fragment = elements.cardTemplate.content.cloneNode(true);
    const cardButton = fragment.querySelector(".tarot-card");

    cardButton.setAttribute("aria-label", `翻开第 ${index + 1} 张牌，牌位：${result.position}`);
    cardButton.addEventListener("click", () => revealCard(elements, cardButton, index));
    elements.cardsGrid.append(fragment);
  });
}

function revealCard(elements, cardButton, index) {
  if (!appState.currentReading || appState.revealedIndexes.has(index)) {
    return;
  }

  const result = appState.currentReading.results[index];
  const front = cardButton.querySelector(".card-front");

  front.classList.toggle("is-reversed", result.isReversed);
  front.append(renderCardFace(result.card, result.isReversed, result.position));
  front.setAttribute("aria-hidden", "false");

  appState.revealedIndexes.add(index);
  cardButton.classList.add("is-flipped");
  cardButton.setAttribute("aria-pressed", "true");
  cardButton.setAttribute("aria-label", `${result.position}：${result.card.nameZh}，${result.isReversed ? "逆位" : "正位"}，已翻开`);

  const total = appState.currentReading.results.length;
  const revealed = appState.revealedIndexes.size;

  if (revealed === total) {
    elements.saveButton.disabled = false;
    elements.readingTitle.textContent = "本次牌面";
    elements.flipInstruction.textContent = "所有牌已翻开，已生成本次牌阵总结。";
    elements.actionStatus.textContent = "牌面已全部揭示。";
    showCurrentSummary(elements);
  } else {
    elements.flipInstruction.textContent = `已翻开 ${revealed} / ${total} 张，继续点击牌背。`;
  }
}

function setSetupLocked(elements, locked) {
  elements.questionInput.disabled = locked;
  elements.spreadSelect.disabled = locked;
  elements.customCount.disabled = locked || elements.spreadSelect.value !== "custom";
  elements.countMinus.disabled = locked || elements.spreadSelect.value !== "custom";
  elements.countPlus.disabled = locked || elements.spreadSelect.value !== "custom";
  elements.drawButton.disabled = locked;
}

function resetReading(elements) {
  if (!appState.currentReading) {
    return;
  }

  const confirmed = window.confirm("确定要放弃当前牌面并重新抽牌吗？未保存的结果将不会保留。");
  if (!confirmed) {
    return;
  }

  appState.currentReading = null;
  appState.revealedIndexes = new Set();
  appState.saved = false;
  setShareMode(elements, null);
  elements.cardsGrid.replaceChildren();
  elements.currentSummary.replaceChildren();
  elements.summarySection.hidden = true;
  elements.readingArea.hidden = true;
  elements.actionStatus.textContent = "";
  setSetupLocked(elements, false);
  updateSpreadControls(elements);
  document.querySelector(".reading-setup").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ------------------------------
   历史记录：仅保存在 localStorage
------------------------------ */

function saveCurrentReading(elements) {
  const reading = appState.currentReading;
  if (!reading || appState.saved || appState.revealedIndexes.size !== reading.results.length) {
    return;
  }

  const record = {
    id: createRecordId(),
    deckId: appState.deckThemeId,
    createdAt: reading.createdAt,
    question: reading.question,
    spreadKey: reading.spreadKey,
    spreadName: reading.spreadName,
    cards: reading.results.map((result) => ({
      position: result.position,
      cardId: result.card.id,
      nameZh: result.card.nameZh,
      nameEn: result.card.nameEn,
      orientation: result.isReversed ? "逆位" : "正位",
      keywords: [...getKeywords(result.card, result.isReversed)],
      meaning: result.isReversed ? result.card.reversedMeaning : result.card.uprightMeaning,
      symbol: result.card.symbol,
      image: result.card.image
    }))
  };

  const nextHistory = [record, ...appState.history];

  if (!writeHistory(nextHistory)) {
    elements.actionStatus.textContent = "保存失败：当前浏览器可能禁止了本地存储。";
    return;
  }

  appState.history = nextHistory;
  appState.saved = true;
  elements.saveButton.disabled = true;
  elements.saveButton.textContent = "已保存";
  elements.actionStatus.textContent = "本次记录已保存在这台设备的当前浏览器中。";
  renderHistory(elements);
}

function createRecordId() {
  const bytes = new Uint8Array(10);
  window.crypto.getRandomValues(bytes);
  const randomPart = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `reading-${Date.now()}-${randomPart}`;
}

function loadHistory() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isUsableRecord) : [];
  } catch (error) {
    console.warn("无法读取本地历史记录。", error);
    return [];
  }
}

function writeHistory(history) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return true;
  } catch (error) {
    console.warn("无法写入本地历史记录。", error);
    return false;
  }
}

function isUsableRecord(record) {
  return Boolean(
    record &&
    typeof record.id === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.question === "string" &&
    typeof record.spreadName === "string" &&
    Array.isArray(record.cards)
  );
}

function renderHistory(elements) {
  elements.historyList.replaceChildren();
  elements.historyCount.textContent = `${appState.history.length} 条`;
  elements.emptyHistory.hidden = appState.history.length > 0;
  elements.clearHistoryButton.disabled = appState.history.length === 0;

  appState.history.forEach((record) => {
    const recordDeckThemeId = getRecordDeckThemeId(record);
    const item = document.createElement("details");
    item.className = "history-item";

    const summary = document.createElement("summary");
    const heading = document.createElement("span");

    const title = document.createElement("span");
    title.className = "history-item-title";
    title.textContent = record.question;

    const meta = document.createElement("span");
    meta.className = "history-item-meta";
    meta.textContent = `${formatDate(record.createdAt)} · ${record.spreadName}`;

    const chevron = document.createElement("span");
    chevron.className = "history-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "›";

    heading.append(title, meta);
    summary.append(heading, chevron);

    const details = document.createElement("div");
    details.className = "history-details";

    const question = document.createElement("p");
    question.className = "history-question";

    const questionLabel = document.createElement("strong");
    questionLabel.textContent = "问题：";
    question.append(questionLabel, document.createTextNode(record.question));

    const cards = document.createElement("ul");
    cards.className = "history-cards";

    record.cards.forEach((savedCard) => {
      const row = document.createElement("li");
      row.className = "history-card-row";

      const sourceCard = window.TAROT_CARDS.find((card) => card.id === savedCard.cardId);
      const cardImage = getCardThemeImage(sourceCard || savedCard, recordDeckThemeId);
      if (getDeckTheme(recordDeckThemeId)?.type === "image" && !cardImage) {
        warnDeckImageMissing(sourceCard || savedCard, recordDeckThemeId);
      }

      const position = document.createElement("span");
      position.className = "history-position";
      position.textContent = savedCard.position;

      const name = document.createElement("span");
      name.className = "history-card-name";

      if (cardImage) {
        const thumbnail = document.createElement("img");
        thumbnail.className = "history-card-thumbnail";
        thumbnail.classList.toggle("is-reversed-image", savedCard.orientation === "逆位");
        thumbnail.src = cardImage;
        thumbnail.alt = "";
        thumbnail.loading = "lazy";
        thumbnail.decoding = "async";
        thumbnail.addEventListener("error", () => {
          warnDeckImageMissing(sourceCard || savedCard, recordDeckThemeId);
          thumbnail.remove();
        });
        name.append(thumbnail);
      }

      name.append(document.createTextNode(savedCard.nameZh));

      const orientation = document.createElement("span");
      orientation.className = "history-orientation";
      orientation.textContent = savedCard.orientation;

      const keywords = document.createElement("span");
      keywords.className = "history-keywords";
      keywords.textContent = Array.isArray(savedCard.keywords) ? savedCard.keywords.join(" · ") : "";

      row.append(position, name, orientation, keywords);
      cards.append(row);
    });

    const actions = document.createElement("div");
    actions.className = "history-item-actions";

    const viewSummaryButton = document.createElement("button");
    viewSummaryButton.type = "button";
    viewSummaryButton.className = "button button-ghost button-small";
    viewSummaryButton.textContent = "查看总结";
    viewSummaryButton.addEventListener("click", () => openHistorySummary(elements, record));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "button button-danger button-small";
    deleteButton.textContent = "删除这条记录";
    deleteButton.addEventListener("click", () => deleteHistoryRecord(elements, record.id));

    actions.append(viewSummaryButton, deleteButton);
    details.append(question, cards, actions);
    item.append(summary, details);
    elements.historyList.append(item);
  });
}

function deleteHistoryRecord(elements, recordId) {
  const confirmed = window.confirm("确定删除这条抽牌记录吗？删除后无法恢复。");
  if (!confirmed) {
    return;
  }

  const nextHistory = appState.history.filter((record) => record.id !== recordId);
  if (!writeHistory(nextHistory)) {
    window.alert("删除失败：当前浏览器可能禁止了本地存储。");
    return;
  }

  appState.history = nextHistory;
  renderHistory(elements);
}

function clearAllHistory(elements) {
  if (appState.history.length === 0) {
    return;
  }

  const confirmed = window.confirm("确定清空全部历史记录吗？此操作无法恢复。");
  if (!confirmed) {
    return;
  }

  if (!writeHistory([])) {
    window.alert("清空失败：当前浏览器可能禁止了本地存储。");
    return;
  }

  appState.history = [];
  renderHistory(elements);
}

function formatDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "日期未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

/* ------------------------------
   牌库自检
------------------------------ */

function validateDeck(deck) {
  const errors = [];

  if (!Array.isArray(deck)) {
    return { valid: false, errors: ["牌库未加载"] };
  }

  if (deck.length !== 78) {
    errors.push(`应为 78 张，实际为 ${deck.length} 张`);
  }

  const ids = deck.map((card) => card.id);
  const zhNames = deck.map((card) => card.nameZh);
  const enNames = deck.map((card) => card.nameEn);

  if (new Set(ids).size !== ids.length) {
    errors.push("存在重复 ID");
  }
  if (new Set(zhNames).size !== zhNames.length) {
    errors.push("存在重复中文牌名");
  }
  if (new Set(enNames).size !== enNames.length) {
    errors.push("存在重复英文牌名");
  }

  const expectedSuits = {
    "Major Arcana": 22,
    Wands: 14,
    Cups: 14,
    Swords: 14,
    Pentacles: 14
  };

  Object.entries(expectedSuits).forEach(([suit, expectedCount]) => {
    const actualCount = deck.filter((card) => card.suit === suit).length;
    if (actualCount !== expectedCount) {
      errors.push(`${suit} 应为 ${expectedCount} 张，实际为 ${actualCount} 张`);
    }
  });

  deck.forEach((card) => {
    const requiredText = ["id", "nameZh", "nameEn", "suit", "symbol", "uprightMeaning", "reversedMeaning"];
    const missingText = requiredText.some((key) => typeof card[key] !== "string" || !card[key]);
    const badKeywords = !Array.isArray(card.uprightKeywords) || !Array.isArray(card.reversedKeywords) ||
      card.uprightKeywords.length === 0 || card.reversedKeywords.length === 0;

    const imageSources = card.image;
    const badImage = !imageSources || typeof imageSources !== "object" ||
      imageSources.text !== null ||
      typeof imageSources.classic !== "string" || !imageSources.classic.trim() ||
      typeof imageSources.original !== "string" || !imageSources.original.trim() ||
      typeof imageSources.apple !== "string" || !imageSources.apple.trim();

    if (missingText || badKeywords || !Number.isInteger(card.number) || badImage) {
      errors.push(`${card.id || "未知牌"} 的字段不完整`);
    }
  });

  return { valid: errors.length === 0, errors };
}

function showSetupError(elements, message) {
  const error = document.createElement("p");
  error.className = "action-status";
  error.setAttribute("role", "alert");
  error.textContent = message;
  elements.drawButton.closest(".setup-actions").after(error);
}


