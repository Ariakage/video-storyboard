# video-storyboard

[![test](https://github.com/Ariakage/video-storyboard/actions/workflows/test.yml/badge.svg)](https://github.com/Ariakage/video-storyboard/actions/workflows/test.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](package.json)

**Turn a video into citable storyboard images.** Feed in footage, get a few grid images plus a
timestamped text index: one cell = one shot, and the cell size encodes how fast that stretch cuts.
The model can cite "cell 7, 00:12.76–00:31.40" instead of guessing.

A **generic Agent Skill** — `SKILL.md` plus plain Node CLIs under `bin/` — so Claude Code, Codex,
Cursor, or any agent that can run a shell and read images can use it.

[中文说明](README.md) · Skill entry: [SKILL.md](SKILL.md) · Full CLI reference: [references/cli.md](references/cli.md)

## 30-second start

```bash
git clone https://github.com/Ariakage/video-storyboard.git
cd video-storyboard
node scripts/install-skill.mjs        # install to ~/.claude/skills/video-storyboard
node bin/doctor.mjs                   # check ffmpeg / yt-dlp / ASR

node bin/storyboard.mjs "video.mp4" --out sheet.png --text
```

You get a grid image plus an index like:

```text
cell 1 = 00:00.00-00:33.10  k=1 (1/1)  cuts 0
cell 2 = 00:33.10-00:36.42  k=2 (1/2)  cuts 3
    "the line spoken in this cell"
```

`k` is the tier: cell side = 1/k. Long takes get big cells, flash cuts get small ones.

## What it solves

Frame-per-second extraction explodes token cost; subtitles alone throw away the picture. This
skill takes the third path: **compress the picture into a grid** (~233 vision tokens per image at the default 800×450, up to ~994)
and pair it with a **time-aligned text index** (start/end per cell, dialogue inside it, cut count).
Need detail? `zoom` one window.

**One cell = one shot, and its size encodes cut density**: a 20-second take fills the frame, a
0.3-second flash gets a 1/8-side cell. One image therefore shows both rhythms without reading
a number.

## Install

The 30-second start above already installs a copy. Other options:

```bash
node scripts/install-skill.mjs --link          # symlink; edits apply immediately
node scripts/install-skill.mjs --dest DIR      # another skills root (e.g. ~/.agents/skills)
node scripts/install-skill.mjs --check         # where is it installed?
node scripts/install-skill.mjs --remove        # uninstall
```

Restart the agent session so the skill index reloads. You can also skip the skill entirely
and run `node bin/...` from the repo.

**Requirements:** Node ≥ 20 and `ffmpeg` + `ffprobe` on `PATH`. `yt-dlp` is optional (URLs only).
ASR / a transcript file is optional (dialogue lines). Nothing is bundled.

## Use

```bash
# 1) metadata only — free, no image tokens (URL: no download)
node bin/probe.mjs "video.mp4" --json

# 2) storyboard + text index; stdout is pure JSON, progress is on stderr
node bin/storyboard.mjs "video.mp4" --out sheet.png --text --json > sheet.json
#    then Read every path in sheets[].path

# 3) close-up of one window (one image, n frames, uniform tier)
node bin/zoom.mjs "video.mp4" --from 72 --to 80 --frames 9 --out zoom.png --json
node bin/zoom.mjs "video.mp4" --cell-id 7 --out cell7.png --json

# 4) text-only locator: where is that line spoken?
node bin/locate.mjs "video.mp4" "keyword" --json

# 5) hard-subtitle strip (PV, songs, no subtitle track, unusable ASR)
node bin/subtitles.mjs "video.mp4" --max-strips 24 --step 3 --out strip.jpg --json
```

| Command | Purpose | When |
|---|---|---|
| `bin/probe.mjs` | container metadata, reading plan | first contact, zero image cost |
| `bin/storyboard.mjs` | grid image + timestamped index | the main pass |
| `bin/zoom.mjs` | one window, few large cells | a cell needs detail |
| `bin/locate.mjs` | phrase → time codes, text only | you know what was said, not when |
| `bin/subtitles.mjs` | burned-in subtitles as one tall image | no usable transcript |

Auxiliary: `bin/doctor.mjs`, `bin/scan-video.mjs`, `bin/scan-stats.mjs`, `bin/asr-check.mjs`.

## Strategies

| `strategy` | Per-frame size | 90 s PV measured | Use |
|---|---|---|---|
| **`auto` (default)** | image count from duration (~4 min/image), then the cheapest tier whose smallest cell stays readable | 1–3 / ~233–700 tok | when you don't pick |
| `full` | one tier bigger | 18 / ~4.2k tok | read signs, recognize faces |
| `standard` | tier 1 → 1/2 | 5 / ~1.2k tok | every shot legible |
| `compact` | one tier smaller | 3 / ~700 tok | everyday |
| `skim` | all 1/8, no integral frames | 1 / ~233 tok | one PV, one image |
| `brief` | all 1/8, gaps widen to one image | 1 / ~233 tok | a 5-minute clip in one look |

Tokens are estimated at ~233 per 800×450 image; the canvas can go to 1300×1300 (~994/image), and the
manifest reports the real number. Disable `auto` with `VIDEO_STORYBOARD_AUTO=0` to go back to `compact`.
Old names (`quality/balanced/saver/frugal/thrifty/ultra`) still map. `--tier-map '{"5":4}'`
overrides exact tiers. Details: [references/strategy.md](references/strategy.md).

Preview the cost without rendering:

```bash
node bin/storyboard.mjs video.mp4 --dry-run
```

## Long videos

```bash
# sequential, no spoilers — follow the printed next: from=...
node bin/storyboard.mjs film.mp4 --from 0 --segment 300 --out seg.png --text

# structure at a glance (spoilers)
node bin/storyboard.mjs film.mp4 --max-frames 96 --out overview.png --text

# bulk windows, edges snapped to cuts, plus a timeline markdown
node bin/storyboard.mjs film.mp4 --batch 300 --out film.png
```

## Transcripts

First available wins: embedded subtitle track → `--transcript-file` → ASR endpoint
(OpenAI-compatible). Configure `~/.video-storyboard/asr.json` (legacy `~/.dsh/asr.json` still
read); loopback endpoints need no key. See [references/asr.md](references/asr.md).

Without a transcript the index says `transcript=no-key` / `no-audio` — never claim the video
has no speech.

## Cookies

```json
// ~/.video-storyboard/video.json
{ "cookies": "D:/cookies/cookies.txt" }
```

or `--cookies cookies.txt` / `VIDEO_STORYBOARD_COOKIES` (legacy `DSH_VIDEO_COOKIES`).
Cookies are credentials: do not commit, share or paste them. Only use download paths you are
authorized to use.

## Configuration

Config home: `~/.video-storyboard` (an existing `~/.dsh` with `video.json`/`asr.json` is still
used). Every `VIDEO_STORYBOARD_*` variable has a legacy `DSH_*` alias:
`_HOME`, `_COOKIES`, `_CACHE_DIR`, `_MEDIA_DIR`, `_FFMPEG_PATH`, `_FFPROBE_PATH`, `_YTDLP`,
`_ASR_BASE_URL`, `_ASR_KEY`, `_ASR_MODEL`, `_ASR_TERMS`.

Cache: `~/.cache/video-storyboard` (Windows `%LOCALAPPDATA%\video-storyboard`), size-capped and
auto-evicted.

## Scope

No video hosting or distribution; caches stay local and are evicted. No paid-content access, DRM
or region-lock circumvention, or bulk scraping. **Whether a link may be downloaded is your call** —
confirm you have the right to, and follow the site's terms and local law. See [NOTICE](NOTICE).

Apache-2.0 (MIT before v0.5.0; earlier MIT releases remain MIT). See [CREDITS.md](CREDITS.md).
