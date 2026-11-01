# 使用指南（当前版本）

> 参数全表：[references/cli.md](../references/cli.md) · 档位与成本：[references/strategy.md](../references/strategy.md) ·
> 转写配置：[references/asr.md](../references/asr.md) · 技能入口：[SKILL.md](../SKILL.md)

## 一条命令的骨架

```bash
node bin/storyboard.mjs <输入> --out <图.png> --text --json
```

- `<输入>`：本地路径，或 yt-dlp 支持的 http(s) 链接。
- `--out`：图片输出路径。多张图时自动变成 `图-2.png`、`图-3.png`…
- `--text`：在 stdout 打印可引用的文本清单。
- `--json`：stdout 只留一个 JSON（进度改走 stderr），给 agent 解析。

JSON 形状：

```json
{
  "probe": { "duration": 299.4, "width": 1920, "fps": 24, "hasAudio": true },
  "window": { "from": 0, "to": 299.4 },
  "plan": { "strategy": "compact", "sheets": 3, "produced": 74, "tiers": { "2": 5 } },
  "sheets": [{ "path": "sheet.png", "width": 800, "height": 469, "cells": [ ... ] }],
  "evidence": "sheet.evidence.json",
  "text": "<storyboard ...>\ncell 1 = ..."
}
```

## 六种常见读法

### 1. 短视频，先看全貌

```bash
node bin/probe.mjs clip.mp4 --json
node bin/storyboard.mjs clip.mp4 --out /tmp/vs/sheet.png --text --json
```

### 2. 只看某一段

```bash
node bin/storyboard.mjs clip.mp4 --from 120 --to 180 --out /tmp/vs/win.png --text
```

只扫这一段，不碰全片。

### 3. 长片顺序读（不剧透）

```bash
node bin/storyboard.mjs film.mp4 --from 0 --segment 300 --out /tmp/vs/seg.png --text
```

结果会打印 `segment 5/22 · 22% watched · 82 min left · next: from=1180`，照着走。

### 4. 长片批量出图

```bash
node bin/storyboard.mjs film.mp4 --batch 300 --out /tmp/vs/film.png
```

窗口边界默认吸附到真实剪辑点；写出一份 `film-timeline.md`。不想要吸附就加 `--no-snap`。

### 5. 放大某一格

```bash
node bin/zoom.mjs film.mp4 --cell-id 7 --frames 9 --out /tmp/vs/cell7.png --json
```

`--cell-id` 用上一次 storyboard 记下的时间区间；查不到会明确报错，不猜窗口。

### 6. 找一句台词

```bash
node bin/locate.mjs film.mp4 "关键词" --json
node bin/locate.mjs film.mp4 "关键词" --from 0 --to 600 --json
```

纯文本、零图片开销。拿到 `{from,to}` 后再 `zoom`。

## 怎么选档位

| 需求 | 参数 |
|---|---|
| 日常看剧情 | 默认（`compact`） |
| 要读画面里的字/认脸 | `--strategy full`，或只对关键格 `zoom` |
| 一条 PV 一张图 | `--strategy skim` |
| 5 分钟片子一张图 | `--strategy brief` |
| 限制总张数 | `--max-sheets 4` |
| 精确覆盖某几档 | `--tier-map '{"5":4,"6":4,"7":4,"8":4}'` |

**图片张数才是成本**：一张约 384 token，格子数不影响单图价格。先 `probe`，再决定读到什么粒度。

## 台账与证据

每次 `storyboard` 都会在旁边写一份 `<out>.evidence.json`：切点、档位、参数、源文件信息。
它是报告的可复现记录，**报告写完再删**。

## 常见错误

| 报错 | 含义 | 处理 |
|---|---|---|
| `invalid pick` | 取帧策略拼错 | `--pick mid\|sharp\|thumb` |
| `this video needs a signed-in session` | 站点要登录 | 导出 cookies.txt，见 [SETUP.zh.md](SETUP.zh.md) |
| `no cell map recorded` | 还没对这个输入跑过分镜 | 先 `storyboard`，或改用 `--from/--to` |
| 清单里 `transcript=no-key` | ASR 没配 | 见 [references/asr.md](../references/asr.md)，或传 `--transcript-file` |
