# 从零安装

> 目标：从一台什么都没装的机器，到能跑出第一张分镜图。大约 10 分钟，其中大半是等下载。

## 1. 安装 Node 与 ffmpeg

| 平台 | Node ≥ 20 | ffmpeg + ffprobe |
|---|---|---|
| macOS | `brew install node` | `brew install ffmpeg` |
| Windows | `winget install OpenJS.NodeJS.LTS` | `winget install Gyan.FFmpeg` |
| Linux | 发行版包管理器 / nvm | `apt install ffmpeg` / `dnf install ffmpeg` |

验证：

```bash
node --version      # v20 或更高
ffmpeg -version
ffprobe -version
```

装着但不在 `PATH` 上也可以：设 `VIDEO_STORYBOARD_FFMPEG_PATH` /
`VIDEO_STORYBOARD_FFPROBE_PATH` 指向可执行文件（旧的 `DSH_FFMPEG_PATH` 仍然认）。

## 2. 可选依赖

```bash
# 只有贴 B 站/YouTube 等链接才需要
brew install yt-dlp          # macOS
pip install --user -U yt-dlp # 跨平台
winget install yt-dlp        # Windows

# 台词转写（可选）：本机 ASR 服务或云端 OpenAI 兼容端点，见 references/asr.md
```

## 3. 安装 Skill

```bash
git clone https://github.com/Ariakage/video-storyboard.git
cd video-storyboard
node scripts/install-skill.mjs
```

默认装到 `~/.claude/skills/video-storyboard`。其他选择：

```bash
node scripts/install-skill.mjs --link          # 软链，改代码立即生效
node scripts/install-skill.mjs --dest DIR      # 换一个 skills 根目录（如 ~/.agents/skills）
node scripts/install-skill.mjs --check         # 看装没装、装在哪
node scripts/install-skill.mjs --remove        # 卸载
```

装完**重开 agent 会话**，让技能索引重新加载。

不用 Skill 也行：直接在仓库里跑 `node bin/storyboard.mjs ...`。

## 4. 自检

```bash
node bin/doctor.mjs
```

它会逐项检查 ffmpeg / ffprobe、yt-dlp、ASR 配置、缓存目录可写，并在每条后面写"缺什么、怎么补"。
退出码 0 表示硬性依赖齐全；1 表示还差至少一项。

## 5. 第一张图

```bash
mkdir -p /tmp/video-storyboard
node bin/probe.mjs "你的视频.mp4"                       # 只读头，不花图片 token
node bin/storyboard.mjs "你的视频.mp4" \
  --out /tmp/video-storyboard/sheet.png --text --json
```

然后把 `sheet.png` 交给 agent 的图片读取能力，同时保留文本清单。清单长这样：

```
<storyboard path="你的视频.mp4" duration="18.40" window="0.00-18.40" ...>
cell 1 = 00:00.00-00:02.00  k=2 (1/2)
cell 7 = 00:12.00-00:12.27  cuts 1  k=6 (1/6)
    "这段台词"
```

## 常见安装问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `ffmpeg 跑不起来` | 没装或不在 PATH | 装好后重开终端；或设 `VIDEO_STORYBOARD_FFMPEG_PATH` |
| 贴链接报 `yt-dlp not found` | 没装 yt-dlp | 见第 2 步；本地文件不受影响 |
| 链接只有 360p / HTTP 567 | 站点要求登录 | 导出 `cookies.txt`，用 `--cookies`，见 [SETUP.zh.md](SETUP.zh.md) |
| 清单里没有台词 | 没配 ASR，也没有字幕轨 | 配 ASR 或传 `--transcript-file`，见 [references/asr.md](../references/asr.md) |
| 装了 Skill 但 agent 没发现 | 会话没重开 | 重开会话；用 `--check` 确认 `SKILL.md` 在目标目录 |
| Windows 中文路径报错 | 旧版 Node/ffmpeg 处理不佳 | 升级 Node ≥ 20；必要时把视频复制到短路径 |

更细的配置：[SETUP.zh.md](SETUP.zh.md) · [CONFIG.zh.md](CONFIG.zh.md) · 命令行全表：[references/cli.md](../references/cli.md)
