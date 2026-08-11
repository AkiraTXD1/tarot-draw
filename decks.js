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
      label: "手绘牌组",
      shortLabel: "手绘",
      nameEn: "Sketch",
      type: "image",
      imageKey: "original",
      imageDirectory: "assets/cards/original/",
      fallbackThemeId: "text",
      note: "当前显示手绘牌组（Sketch）；78 张最终卡面按需加载，切换不会重新抽牌。"
    }),
    apple: Object.freeze({
      id: "apple",
      label: "苹果塔罗",
      shortLabel: "苹果",
      nameEn: "Apple Tarot",
      description: "原创苹果主题塔罗牌组",
      type: "image",
      imageKey: "apple",
      imageDirectory: "assets/cards/apple/",
      fallbackThemeId: "text",
      note: "当前显示苹果塔罗（Apple Tarot）；78 张原创卡面按需加载，切换不会重新抽牌。"
    })
  };

  window.TAROT_DECK_THEMES = Object.freeze(themes);
  window.DEFAULT_TAROT_DECK_THEME = "text";
})();
