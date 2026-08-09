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
      fallbackThemeId: null,
      note: "当前显示文字牌面；切换只改变显示，不会重新抽牌。"
    }),
    classic: Object.freeze({
      id: "classic",
      label: "经典牌组",
      shortLabel: "经典",
      type: "image",
      imageKey: "classic",
      imageDirectory: "assets/cards/classic/",
      fallbackThemeId: "text",
      note: "当前显示经典公版卡面；缺图时自动回退文字版，不会重新抽牌。"
    }),
    original: Object.freeze({
      id: "original",
      label: "原创牌组",
      shortLabel: "原创",
      type: "image",
      imageKey: "original",
      imageDirectory: "assets/cards/original/",
      fallbackThemeId: "text",
      note: "当前显示原创牌组；已接入的最终卡面按需加载，其余缺图自动回退文字版，不会重新抽牌。"
    })
  };

  window.TAROT_DECK_THEMES = Object.freeze(themes);
  window.DEFAULT_TAROT_DECK_THEME = "text";
})();
