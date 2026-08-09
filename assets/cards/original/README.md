# 手绘牌组（Sketch）卡面

本目录保存项目所有者提供并最终确认的完整手绘牌面。文件按稳定 `card ID + 英文短名` 命名；文件名只用于显示，不参与抽牌或正逆位判断。

## 接入状态

- 大阿卡纳：22 张（`major-00`–`major-21`）
- 权杖：14 张（`wands-01`–`wands-14`）
- 圣杯：14 张（`cups-01`–`cups-14`）
- 宝剑：14 张（`swords-01`–`swords-14`）
- 星币：14 张（`pentacles-01`–`pentacles-14`）
- 总计：78 张；缺牌 0，重复映射 0，歧义文件 0

## 文件处理

来源文件均为 PNG。项目的主题映射可以直接读取 PNG，并不强制 WebP，因此全部保持原始格式、像素尺寸、长宽比和图像内容；没有裁切、缩放、重绘、调色、加框或加字。项目内 78 张文件与来源逐一通过 SHA-256 校验一致。

## 命名规则

大阿卡纳使用卡牌编号与英文短名：

```text
major-00-fool.png
major-20-judgement.png
major-21-world.png
```

小阿卡纳使用花色、两位编号与牌阶：

```text
wands-01-ace.png
cups-12-knight.png
swords-13-queen.png
pentacles-14-king.png
```

`cards.js` 使用同一规则生成全部 `image.original` 相对路径。详细牌面、总结缩略图和历史总结共用这组路径；图片加载失败时统一回退到文字牌面，不会重新抽牌。
