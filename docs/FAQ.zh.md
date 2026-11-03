# 常见问题（当前版本）

> 安装：[INSTALL.zh.md](INSTALL.zh.md) · 用法：[USAGE.zh.md](USAGE.zh.md) ·
> 参数：[references/cli.md](../references/cli.md) · 转写：[references/asr.md](../references/asr.md)

## 一、听不见声音

**Q1. 能出图，但清单里没有台词？**
转写是可选能力。优先级：自带字幕轨 → `--transcript-file` → ASR。没配就会标
`transcript=no-key` 或 `no-audio`，这是状态，不是文件"没有声音"。

**Q2. 配了本机服务，还让我填 key？**
本机地址（`127.0.0.1` / `localhost` / `[::1]` / `0.0.0.0`）不需要 key。如果仍提示，
多半是 `VIDEO_STORYBOARD_ASR_BASE_URL`（旧名 `DSH_ASR_BASE_URL`）指到了云端——
环境变量优先级高于 `asr.json`。

**Q3. 台词是空的 / 质量差？**
先 `node bin/asr-check.mjs <视频> --from 60 --seconds 12` 验证链路。纯音乐、唱歌、
多人抢话本来就容易空或产生幻觉；这类片子改看硬字幕：`node bin/subtitles.mjs`。

**Q4. 改了 asr.json 要重启吗？**
不用。配置按文件 mtime 热加载。若仍无效，用 `node bin/doctor.mjs` 看它实际读的是哪份文件。

## 二、安装与"装了但用不了"

**Q5. 下载的视频没声音（但原片有）？**
yt-dlp 合流音视频要调用 ffmpeg。找不到时它**不报错**，直接写成无声 mp4。
先 `node bin/doctor.mjs`，确认 ffmpeg 解析到绝对路径。

**Q6. 装完 ffmpeg 还报错？**
重开终端 / agent 会话。进程启动时缓存了解析结果；外部程序装好后必须新会话才认。

**Q7. 贴链接很慢或反复从头下？**
首次会下载一份扫描用的低清副本并缓存；后续用本地缓存。`--quality low` 可以更省带宽。
下到一半失败通常是站点限速/风控，隔一会儿重试。

**Q8. agent 没发现这个 skill？**
`node scripts/install-skill.mjs --check` 看目标目录里有没有 `SKILL.md`；装完要重开会话。

## 三、画面与参数

**Q9. 为什么这张图里格子大小不一样？**
格子大小是信息：一格一个镜头，格子边长 = 1/k，k 由该处切点密度决定。长镜头大、快闪小。
详见 [references/strategy.md](../references/strategy.md)。

**Q10. 我要的帧数/张数没生效？**
`--max-frames` 是上限，不是目标：帧数由真实切点决定。`--max-sheets` 是硬上限，超了会合并
镜头重排（时间覆盖不变）。`--strategy` 决定每帧档位，不决定帧数。

**Q11. 某几格看不清脸/字？**
对这些格 `zoom`：`--cell-id 7` 或 `--from/--to`。整片 `--strategy full` 很贵且常常没必要。

**Q12. 同一段跑两次结果不同？**
检查是否换了参数（strategy / tierMap / threshold / scanGap / integral）。切点、转写和扫描结果
都有缓存；换参数会换缓存键。保留 `*.evidence.json` 便于对比。

**Q13. 报 `no cell map recorded`？**
`zoom --cell-id` 依赖上一次 storyboard 写下的格子表。先对同一个输入跑一次 storyboard，
或者直接用 `--from/--to`。

## 四、成本与清晰度

**Q14. 怎么算钱？**
按**图片张数**算，不按分钟。默认一张 800×450 约 **233** vision token（上限 1300×1300 ≈994）；格子数不影响单价。
90 秒 PV 默认 `auto` 约 1–3 张；`skim`/`brief` 1 张。长片张数见
[references/strategy.md](../references/strategy.md)。

**Q15. 清晰度怎么选？**
本地文件永远读原片；`--quality` 只影响贴链接时的下载清晰度（默认 720p）。

## 五、能不能下别人的视频

**Q16. 可以随便下载吗？**
不可以。本 skill 不提供绕过付费、会员、DRM 或区域限制的能力。**能否下载取决于你是否拥有
相应授权**，请自行确认并遵守目标站点条款与当地法律。只处理你有权使用的素材。

## 六、还是没解决

按这个顺序收集信息，再开 issue：

```bash
node bin/doctor.mjs
node bin/probe.mjs "<输入>" --json
node bin/storyboard.mjs "<输入>" --from 0 --to 30 --out /tmp/t.png --text --json
```

把输出（注意删掉 cookies、key、私有路径）和 `.evidence.json` 一起贴上来。
