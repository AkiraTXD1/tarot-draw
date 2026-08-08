/*
 * 牌组显示主题配置。
 * 主题只决定渲染方式，不参与抽牌、正逆位或历史记录的数据选择。
 */
(function () {
  "use strict";

  const themes = {
    text: Object.freeze({
      id: "text",
      label: "文字版",
      shortLabel: "文字",
      type: "text",
      imageKey: "text",
      fallbackThemeId: null
    }),
    classic: Object.freeze({
      id: "classic",
      label: "经典牌组",
      shortLabel: "经典",
      type: "image",
      imageKey: "classic",
      imageDirectory: "assets/cards/classic/",
      fallbackThemeId: "text"
    })
  };

  window.TAROT_DECK_THEMES = Object.freeze(themes);
  window.DEFAULT_TAROT_DECK_THEME = "text";
})();
