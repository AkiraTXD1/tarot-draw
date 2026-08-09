# 牌组主题与卡面来源

## 当前主题

| 主题 ID | UI 名称 | 类型 | 资源 |
| --- | --- | --- | --- |
| `text` | 文字版 | 文字 | 原有 CSS 与文字牌面 |
| `classic` | 经典牌组 | 图像 + 文字 | `assets/cards/classic/*.webp` |
| `original` | 原创牌组 | 图像 + 文字回退 | `assets/cards/original/*.png` |

主题配置位于 `decks.js`。`script.js` 中的显示辅助函数根据当前主题读取图像；`drawCards()`、`secureRandomInt()` 与正逆位判定不读取主题配置或文件名。

切换主题时只会重建已经翻开的 DOM 牌面、当前总结与已打开的历史总结。未翻开的牌不会被揭示，`appState.currentReading.results` 不会被替换。

## 原创牌组接入状态

原创牌组使用项目所有者提供并确认的最终成图。当前已接入 21 张大阿卡纳：`major-00`–`major-19` 与 `major-21`；本批未收到 `major-20` Judgement / 审判，小阿卡纳也尚未接入。

原文件是 PNG，而主题渲染器并不要求 WebP，因此全部保留原始 PNG、原始像素尺寸和原始长宽比，没有裁切、缩放、重绘、调色、加边框或加文字。逐张映射见 `assets/cards/original/README.md`。

`cards.js` 中未完成的 `image.original` 明确为 `null`。用户抽到审判或小阿卡纳时，原创主题会显示文字牌面，不创建无效图片请求；这不会改用经典图像，也不会影响抽牌结果。

## 经典牌组来源与公版状态

- 来源平台：Wikimedia Commons
- 来源分类：[Rider-Waite-Smith tarot deck (TaionWC)](https://commons.wikimedia.org/wiki/Category:Rider-Waite-Smith_tarot_deck_(TaionWC))
- 套系：1910 “Pam-A” Waite-Smith 扫描
- 原始绘制者：Pamela Colman Smith（1878–1951）
- Wikimedia 标记：`Public domain`、`Copyrighted: False`、Public Domain Mark
- 分类许可标签：`CC-PD-Mark`、`PD-old-80-expired`
- 本地处理：只做 RGB 转换、按比例缩小与 WebP 压缩；没有重新上色、重排或改动画面内容

集成时通过 Wikimedia Commons 官方 API 分批读取完整 78 项，并要求每一项同时满足 `LicenseShortName = Public domain` 与 `Copyrighted = False` 后才下载。`assets/licenses.json` 为每张牌记录：

- 卡牌 ID 与本地文件名
- Wikimedia 文件页与原图 URL
- 作者、来源平台与来源分类
- 公版标记与许可标签
- 原始 SHA-1、原始/本地尺寸、本地体积
- 下载与转换时间

## 文件命名与映射

大阿卡纳使用：

```text
major-00-fool.webp
major-17-star.webp
```

小阿卡纳使用：

```text
cups-06-six.webp
wands-11-page.webp
swords-12-knight.webp
pentacles-14-king.webp
```

`cards.js` 根据稳定卡牌 ID、编号与英文名生成这些显示路径。随机抽牌仍只从 78 张卡牌对象的临时池中抽取，不解析图片目录或文件名。

## 加载和回退

- 页面初始加载不会创建 78 个图像节点。
- 文字主题完全不请求卡面图片。
- 经典主题仅在某张牌翻开、显示当前总结或打开历史总结时创建对应图像节点。
- 详细牌面和缩略图的 `error` 事件会移除失败图像，保留正常方向的文字牌面与牌义。
- 逆位只旋转图像本身 180 度；中文、英文、关键词和牌义不旋转。

## 继续补全原创牌组

1. 使用与卡牌 ID 对应的规范文件名放入 `assets/cards/original/`。
2. 在 `cards.js` 的 `ORIGINAL_IMAGE_SOURCES` 中加入该卡牌 ID 与相对路径。
3. 不要从文件名生成或调整随机结果；文件名只属于显示层。
4. 运行缺图回退、正逆位、历史、总结和移动端检查。

第一批 12 张小阿卡纳测试提示词及视觉语言分析见 `MINOR_ARCANA_TEST_PROMPTS.md`。

## 添加其他牌组

1. 在 `decks.js` 中增加主题，例如 `anotherDeck`，设置唯一 `id`、`label`、`type: "image"`、`imageKey` 和独立资源目录。
2. 在 `cards.js` 的图像来源对象中为全部卡牌加入同名路径；缺图可以保留为 `null`。
3. 将文件放入如 `assets/cards/original/`，保持一张卡牌 ID 对应一个文件。
4. 在 `index.html` 的主题控件加入同值选项。
5. 在新的授权清单中记录来源、作者、许可与日期。
6. 运行牌库、缺图回退、正逆位、历史、总结与移动端检查。

只要新主题沿用 `imageKey` 结构，`renderCardFace()`、总结卡和历史记录无需针对具体牌组名称重写。

## GitHub Pages 更新

本项目为纯静态站点。提交 `index.html`、CSS、JavaScript、文档和本地资源后推送到 `main`，GitHub Pages 从仓库根目录重新发布。若更新了同名静态资源，可同步调整 `index.html` 中的相对版本查询参数以避免旧缓存。
