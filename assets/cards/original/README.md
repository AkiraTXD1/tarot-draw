# 原创牌组卡面

本目录保存项目所有者提供并最终确认的原创牌面。文件按稳定 `card ID + 英文短名` 命名；文件名只用于显示，不参与抽牌或正逆位判断。

## 当前接入状态

- 已接入：21 张大阿卡纳（`major-00`–`major-19`、`major-21`）
- 未收到：`major-20` Judgement / 审判
- 小阿卡纳：尚未接入
- 歧义文件：0

原创主题遇到尚未接入的牌时会直接显示完整文字牌面，不会读取经典牌组图片，也不会重新抽牌。

## 文件处理

原文件均为 PNG。项目的主题映射可以直接读取 PNG，并不强制 WebP，因此本批文件保持原始格式、原始像素尺寸和原始长宽比；没有裁切、缩放、重绘、调色、加框或加字。

## 大阿卡纳映射

| ID | Card | 文件 | 状态 |
| --- | --- | --- | --- |
| `major-00` | The Fool | `major-00-fool.png` | 已接入 |
| `major-01` | The Magician | `major-01-magician.png` | 已接入 |
| `major-02` | The High Priestess | `major-02-high-priestess.png` | 已接入 |
| `major-03` | The Empress | `major-03-empress.png` | 已接入 |
| `major-04` | The Emperor | `major-04-emperor.png` | 已接入 |
| `major-05` | The Hierophant | `major-05-hierophant.png` | 已接入 |
| `major-06` | The Lovers | `major-06-lovers.png` | 已接入 |
| `major-07` | The Chariot | `major-07-chariot.png` | 已接入 |
| `major-08` | Strength | `major-08-strength.png` | 已接入 |
| `major-09` | The Hermit | `major-09-hermit.png` | 已接入 |
| `major-10` | Wheel of Fortune | `major-10-wheel-of-fortune.png` | 已接入 |
| `major-11` | Justice | `major-11-justice.png` | 已接入 |
| `major-12` | The Hanged Man | `major-12-hanged-man.png` | 已接入 |
| `major-13` | Death | `major-13-death.png` | 已接入 |
| `major-14` | Temperance | `major-14-temperance.png` | 已接入 |
| `major-15` | The Devil | `major-15-devil.png` | 已接入 |
| `major-16` | The Tower | `major-16-tower.png` | 已接入 |
| `major-17` | The Star | `major-17-star.png` | 已接入 |
| `major-18` | The Moon | `major-18-moon.png` | 已接入 |
| `major-19` | The Sun | `major-19-sun.png` | 已接入 |
| `major-20` | Judgement | `major-20-judgement.png` | 未收到，不创建占位文件 |
| `major-21` | The World | `major-21-world.png` | 已接入 |

