# video-storyboard · Agent Skill

> 让 AI 真正"看过"一段视频：**一张可引用的分镜图 + 一份带时间码的文本清单**，模型据此回答
> "第 3 分钟发生了什么""这句话对应哪一格"。
>
> English: [README.en.md](README.en.md) · 技能入口：[SKILL.md](SKILL.md) · 参数全表：[references/cli.md](references/cli.md)

这是一个**通用 Agent Skill**：不依赖任何宿主插件系统，靠 `SKILL.md` + `bin/` 下的
Node 命令行工作。Claude Code、Codex、Cursor、任何能跑 shell 并读取图片的 agent 都能用。

---

## 它解决什么问题

多模态模型看视频有两种笨办法：

- **逐帧抽图** —— 10 分钟片子按 1 fps 抽就是 600 张图，token 直接爆。
- **只喂字幕** —— 画面里的信息（构图、动作、场景变化）全丢。

本 Skill 走第三条：**把画面压成一张宫格图**（384 token 封顶），旁边配一份**按时间对齐的文本清单**
（每格起止时间 + 这一格里的台词 + 切了几刀）。模型得到的是"这 90 秒里发生了什么、大概在第几秒"，
需要细节时再用 `zoom` 放大某一段。

**一格 = 一个镜头，格子大小由切点密度决定**：20 秒的长镜头占满整幅，0.3 秒的快闪只有 1/8 边长。
所以一张图里同时写着"这里是个长镜头"和"这里 24 个镜头连闪"——不读文字，看格子大小就知道节奏。

## 安装

```bash
git clone https://github.com/Ariakage/dsh-video-storyboard.git
cd dsh-video-storyboard

node scripts/install-skill.mjs            # 复制到 ~/.claude/skills/video-storyboard
# node scripts/install-skill.mjs --link   # 或者软链（改代码立即生效）
# node scripts/install-skill.mjs --dest DIR   # 装到别的 skills 目录

node bin/doctor.mjs                        # 检查 ffmpeg / yt-dlp / ASR / 缓存目录
```

装完重开 agent 会话，让技能索引重新加载。

**依赖：**

| 依赖 | 必须吗 | 不装会怎样 |
|---|---|---|
| Node ≥ 20 | **必须** | 跑不起来 |
| ffmpeg + ffprobe | **必须** | 第一步就报错 |
| yt-dlp | 可选 | 本地文件照常能用，贴链接不行 |
| ASR 服务 / 字幕文件 | 可选 | 能出图，但清单里没有台词 |

本 Skill **不打包** ffmpeg 和 yt-dlp，只调用你自己装的那份；找不到时给出安装指引，不会静默失败。

## 怎么用

Agent 的推荐阅读顺序（详细说明在 [SKILL.md](SKILL.md)）：

```bash
# 1) 只读容器头：多长、分辨率、帧率、有没有音轨/字幕（不花图片 token）
node bin/probe.mjs "video.mp4" --json

# 2) 出分镜图 + 文本清单（--json 的 stdout 是纯 JSON，进度在 stderr）
node bin/storyboard.mjs "video.mp4" --out sheet.png --text --json > sheet.json
#    → 然后让 agent 用 Read 工具读 sheet.png

# 3) 某一段放大看（一张图、n 帧、统一档位）
node bin/zoom.mjs "video.mp4" --from 72 --to 80 --frames 9 --out zoom.png --json
node bin/zoom.mjs "video.mp4" --cell-id 7 --out cell7.png --json

# 4) 纯文本定位：那句话在第几分钟（不出图）
node bin/locate.mjs "video.mp4" "关键词" --json

# 5) 硬字幕长图（PV / 唱歌 / 没字幕轨、ASR 也转不出来时）
node bin/subtitles.mjs "video.mp4" --max-strips 24 --step 3 --out strip.jpg --json
```

### 五个命令

| 命令 | 干什么 | 何时用 |
|---|---|---|
| `bin/probe.mjs` | 只读容器头：时长/分辨率/帧率/音轨/字幕轨 | **第一次接触一部片子时先调它**，不花图片 token |
| `bin/storyboard.mjs` | 出宫格图 + 文本清单 | 主体功能 |
| `bin/zoom.mjs` | 只看某一段：一张图、n 帧、统一 `ceil(√n)` 档 | 清单看完觉得某段重要，再放大 |
| `bin/locate.mjs` | **纯文本**：一句话 → 时间码 | 知道说了什么、不知道在第几分钟 |
| `bin/subtitles.mjs` | 把画面里的**硬字幕**裁成一张竖长图 + 每条的秒数 | 没有字幕轨、ASR 也转不出来 |

辅助：`bin/doctor.mjs`（环境自检）、`bin/scan-video.mjs` / `bin/scan-stats.mjs`（调阈值）、
`bin/asr-check.mjs`（十几秒音频验证转写链路）。

## 档位：格子为什么大小不一样

一张图 800×800、384 token 封顶，格子越小能塞的帧越多 —— 所以"这一帧占多大"本身就是信息量分配。

| 档位 | 格子边长 | 800 宽画布上的实际像素 | 典型场景 |
|---|---|---|---|
| 1 | 1/1 | 800×450 | 20 秒的长镜头 |
| 2 | 1/2 | 400×225 | 3–5 秒的常规镜头 |
| 4 | 1/4 | 200×113 | 1 秒左右的快切 |
| 8 | 1/8 | 100×56 | 0.3 秒一闪而过的快闪 |

档位是算出来的（100 帧卷积窗 → 每帧切点概率 → 50 帧平滑 → 7 阈值 + 5% 滞回），
由**积分假切点**切出来的帧再 **+2 档**。两个旋钮可以覆盖它：

```bash
node bin/storyboard.mjs video.mp4 --strategy saver                    # 旧名自动映射
node bin/storyboard.mjs video.mp4 --tier-map '{"5":4,"6":4,"7":4,"8":4}'   # 5–8 档一律 1/4
```

### 五个档位

| `strategy` | 每帧多大 | 90 秒 PV 实测 | 什么时候用 |
|---|---|---|---|
| `full` | 升一档（1 档不再升） | 18 张 / 6912 token | 要读画面里的字、认脸 |
| `standard` | 1 档压成 1/2 | 5 张 / 1920 | 想看清每个镜头 |
| **`compact`（默认）** | 降一档 | **3 张 / 1152** | 日常：看得清又便宜 |
| `skim` | 全部 1/8，无假切点，切点按 0.35 s 合并 | 1 张 / 384 | 一条 PV 一张图 |
| `brief` | 全 1/8，切点间隔自适应到整段装进一张图 | 1 张 / 384 | 5 分钟视频一张图看完 |

旧名 `quality` / `balanced` / `saver` / `frugal` / `thrifty` / `ultra` 仍然认，会自动映射，不会报错。
档位与实测成本详见 [references/strategy.md](references/strategy.md)。

## 长视频怎么读

```bash
# 顺序读（不剧透）：每次 300 秒，跟着结果里的 next: from=... 走
node bin/storyboard.mjs film.mp4 --from 0 --segment 300 --out seg.png --text

# 一次扫完（看结构，会剧透）：最多 96 帧
node bin/storyboard.mjs film.mp4 --max-frames 96 --out overview.png --text

# 长片批量：每 5 分钟一窗，窗口边界吸附到真实剪辑点，另写一份 timeline.md
node bin/storyboard.mjs film.mp4 --batch 300 --out film.png
```

一部 2 小时电影不要"一张图看完"——格子会小到读不出内容，还会剧透。先 `probe`，再决定顺序读还是扫结构。

## 台词与字幕

优先级：**视频自带字幕轨 → `--transcript-file` → ASR 服务**。

ASR 是可选配置。默认读 `~/.video-storyboard/asr.json`（旧的 `~/.dsh/asr.json` 仍然认）：

```json
{
  "baseUrl": "http://127.0.0.1:8000/v1",
  "model": "paraformer-zh-2024-03-09",
  "language": "zh",
  "manage": { "start": ["python", "server.py"], "idleMs": 5000 }
}
```

本机地址（`127.0.0.1` / `localhost` / `[::1]`）不需要 key；云端服务需要 `key` 或
`VIDEO_STORYBOARD_ASR_KEY`。完整配置、热词、OCR 校正见 [references/asr.md](references/asr.md)。

## 需要登录的视频

普通视频匿名通常能拿 360p；**要高清、会员、或遇到 HTTP 567 才需要 cookies**。

1. 浏览器装 **Cookie-Editor** → 在目标站点登录 → **Export** → Netscape 格式 → 存成 `cookies.txt`
2. 用 `--cookies cookies.txt`，或写进 `~/.video-storyboard/video.json`：

```json
{ "cookies": "D:/cookies/cookies.txt" }
```

也可以设 `VIDEO_STORYBOARD_COOKIES`（旧的 `DSH_VIDEO_COOKIES` 仍然认）。
`cookies.txt` 里的 `SESSDATA` **等同于登录凭证**：别提交、别外发、别贴到报告里。

## 配置与环境变量

配置目录：`~/.video-storyboard`（如果已有 `~/.dsh/video.json` 或 `asr.json`，会继续沿用旧目录）。
`VIDEO_STORYBOARD_HOME` 可显式指定。

| 新名字 | 旧名字（兼容） | 作用 |
|---|---|---|
| `VIDEO_STORYBOARD_COOKIES` | `DSH_VIDEO_COOKIES` | cookies.txt 路径 |
| `VIDEO_STORYBOARD_CACHE_DIR` | `DSH_VIDEO_CACHE_DIR` | 缓存目录 |
| `VIDEO_STORYBOARD_MEDIA_DIR` | `DSH_VIDEO_MEDIA_DIR` | 下载媒体目录 |
| `VIDEO_STORYBOARD_FFMPEG_PATH` | `DSH_FFMPEG_PATH` | ffmpeg 可执行文件 |
| `VIDEO_STORYBOARD_FFPROBE_PATH` | `DSH_FFPROBE_PATH` | ffprobe |
| `VIDEO_STORYBOARD_YTDLP` | `DSH_YTDLP_PATH` | yt-dlp |
| `VIDEO_STORYBOARD_ASR_*` | `DSH_ASR_*` | ASR 端点/模型/key/热词 |

缓存默认在 `~/.cache/video-storyboard`（Windows：`%LOCALAPPDATA%\video-storyboard`），有容量上限并自动淘汰。

## 算法要点

1. **画面差异**：缩到 64×36，逐帧比 HSV，色相按环形距离且按饱和度降权，得到 0–255 的变化分。
2. **切点**：分数超过阈值即一刀；阈值按本片分数分布和时长推。
3. **爆点重判**：对每个 2 秒窗口用一帧间隔重判，抓 0.35 秒以下的快闪。
4. **帧 = 镜头**：真切点切段，积分采样点在长镜头里补帧；一段一帧，时间轴永远连续。
5. **档位 = 切点密度**：切点 0/1 函数 → 100 帧卷积 → 平滑 → 7 阈值 + 5% 滞回 → 8 档；
   积分假切点额外 +2 档。
6. **排布 = 按行打包**：档位序列喂给 DP，按行精确最优填满方形画布，装不下才开下一张；排完裁到内容。
7. **补位**：填充率 < 68% 的图（片尾标题 + 演职员表）会把最长几段再切几刀，凑成能铺满的格数。

## 边界

本项目不托管、不分发任何视频内容，缓存只在本地且会自动淘汰；不提供付费内容访问、DRM 绕过、
区域限制绕过或批量抓取能力。**能不能下载某个链接取决于你有没有相应授权**，请自行确认并遵守
目标站点的条款与当地法律。完整说明见 [NOTICE](NOTICE)。

## 协议与致谢

Apache-2.0。v0.5.0 起由 MIT 变更而来；此前基于 MIT 发布的版本仍是 MIT。
原始项目与作者见 [CREDITS.md](CREDITS.md) 与 [NOTICE](NOTICE)。

## 文档

- [SKILL.md](SKILL.md) — 技能入口与 agent 工作流
- [references/cli.md](references/cli.md) — 每个命令、每个参数
- [references/strategy.md](references/strategy.md) — 档位、排布与实测成本
- [references/asr.md](references/asr.md) — 转写、热词、OCR、生命周期托管
- [CHANGELOG.md](CHANGELOG.md) — 版本历史
- [docs/INSTALL.zh.md](docs/INSTALL.zh.md) — 从零安装
