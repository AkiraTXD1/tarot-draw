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
const UINT32_RANGE = 4294967296;

const appState = {
  currentReading: null,
  revealedIndexes: new Set(),
  saved: false,
  history: []
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
 * card.image 有值时先加入图片；图片加载失败会移除图片，
 * 已同时生成的文字内容会自然成为回退牌面。
 */
function renderCardFace(card, isReversed, position) {
  const content = document.createElement("span");
  content.className = "card-face-content";

  if (card.image) {
    const image = document.createElement("img");
    image.className = "card-image";
    image.src = card.image;
    image.alt = `${card.nameZh}卡面`;
    image.loading = "eager";
    image.addEventListener("error", () => {
      image.remove();
      content.classList.remove("has-image");
    });
    content.classList.add("has-image");
    content.append(image);
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
  content.append(positionLabel, symbol, number, nameZh, nameEn, meta, reading);

  return content;
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
    saveButton: document.getElementById("saveButton"),
    resetButton: document.getElementById("resetButton"),
    actionStatus: document.getElementById("actionStatus"),
    cardTemplate: document.getElementById("cardTemplate"),
    historyPanel: document.getElementById("historyPanel"),
    historyCount: document.getElementById("historyCount"),
    historyList: document.getElementById("historyList"),
    emptyHistory: document.getElementById("emptyHistory"),
    clearHistoryButton: document.getElementById("clearHistoryButton")
  };
}

function bindEvents(elements) {
  elements.questionInput.addEventListener("input", () => updateQuestionCount(elements));
  elements.spreadSelect.addEventListener("change", () => updateSpreadControls(elements));
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
    results: Object.freeze(results)
  });
  appState.revealedIndexes = new Set();
  appState.saved = false;

  setSetupLocked(elements, true);
  elements.saveButton.disabled = true;
  elements.saveButton.textContent = "保存本次记录";
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
    elements.flipInstruction.textContent = "所有牌已翻开，现在可以保存本次记录。";
    elements.actionStatus.textContent = "牌面已全部揭示。";
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
  elements.cardsGrid.replaceChildren();
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
    createdAt: new Date().toISOString(),
    question: reading.question,
    spreadKey: reading.spreadKey,
    spreadName: reading.spreadName,
    cards: reading.results.map((result) => ({
      position: result.position,
      cardId: result.card.id,
      nameZh: result.card.nameZh,
      nameEn: result.card.nameEn,
      orientation: result.isReversed ? "逆位" : "正位",
      keywords: [...getKeywords(result.card, result.isReversed)]
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

      const position = document.createElement("span");
      position.className = "history-position";
      position.textContent = savedCard.position;

      const name = document.createElement("span");
      name.textContent = savedCard.nameZh;

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

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "button button-danger button-small";
    deleteButton.textContent = "删除这条记录";
    deleteButton.addEventListener("click", () => deleteHistoryRecord(elements, record.id));

    actions.append(deleteButton);
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

    const badImage = card.image !== null && (typeof card.image !== "string" || !card.image.trim());

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


