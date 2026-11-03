---
name: video-storyboard
description: >-
  Turn a video (local file, or any URL yt-dlp supports) into storyboard images you can cite:
  one frame per shot, cell size follows cut density (1/1 … 1/8), packed into as few images as
  possible, with a timestamped text index, a text locator, a high-resolution zoom and a
  hard-subtitle strip. Use when the user asks you to watch, summarize, analyze, describe,
  compare or search inside a video; to find when a line is spoken; to read on-screen subtitles;
  or whenever a question needs visual grounding from footage. Triggers include “看视频”,
  “分析这个视频”, “视频里发生了什么”, “第几分钟”, “这句话在哪”, “分镜”, “剧情”, “字幕”.
---

# Video storyboard

Make a video legible to a text-only model without burning tokens on every frame:
**one grid image per few dozen shots + one text index with time codes**. Each cell is one
shot; the cell's size encodes how fast that stretch cuts, so a single image shows both
"a 20-second take" and "24 flash cuts" at once.

Every command is a plain Node CLI in this skill directory — no host plugin, no tool
registration. Output is files on disk plus text on stdout, so any agent harness can use it.

## Before you start

```bash
node "$CLAUDE_SKILL_DIR/bin/doctor.mjs"     # checks node, ffmpeg, yt-dlp, ASR, cache dir
```

Commands below use `$CLAUDE_SKILL_DIR` (Claude Code sets it to this folder). If your harness
does not set it, prefix with the absolute path to this skill directory, e.g.
`node /path/to/video-storyboard/bin/probe.mjs ...`. Each block is self-contained: do not rely
on `cd` or variables from a previous shell call.

- **Required:** Node ≥ 20, `ffmpeg` + `ffprobe` on `PATH`.
- **Optional:** `yt-dlp` (URLs only), an ASR endpoint or `--transcript-file` (spoken lines).
  Without either you still get images; the index just has no dialogue.
- If `doctor` is red on ffmpeg, stop and tell the user what to install. Do not guess.

## The reading loop (do this, in this order)

1. **Probe — free, no image tokens.**
   ```bash
   node "$CLAUDE_SKILL_DIR/bin/probe.mjs" "<input>" --json
   ```
   Gives duration, resolution, fps, audio/subtitle tracks and a suggested plan. Called on a
   URL it does **not** download.

2. **Storyboard — the main pass.**
   ```bash
   OUT="${TMPDIR:-/tmp}/video-storyboard"; mkdir -p "$OUT"
   node "$CLAUDE_SKILL_DIR/bin/storyboard.mjs" "<input>" --out "$OUT/sheet.png" --text --json > "$OUT/sheet.json"
   ```
   Stdout is pure JSON (`--json` sends progress to stderr):
   `{ probe, window, plan, sheets:[{path,width,height,cells}], evidence, text }`.
   The text index is in `.text` (and on stdout when you omit `--json`).

3. **Look at the images.** Call the Read tool on **every** path in `sheets[].path`, in order.
   A sheet is ~233 vision tokens at the default 800×450 canvas (up to ~994 at 1300×1300); read the image *and* its `[sheet]`/`cell` index together —
   the image shows composition, the index gives exact time ranges.

4. **Go deeper only where it matters.**
   ```bash
   node "$CLAUDE_SKILL_DIR/bin/zoom.mjs" "<input>" --from 72 --to 80 --frames 9 --out "${TMPDIR:-/tmp}/video-storyboard/zoom.png" --json
   node "$CLAUDE_SKILL_DIR/bin/zoom.mjs" "<input>" --cell-id 7 --out "${TMPDIR:-/tmp}/video-storyboard/cell7.png" --json
   ```
   One image, few large cells: faces, signs, on-screen text. `--cell-id` uses the map the
   storyboard just saved, so you never convert seconds by hand.

5. **Find a spoken line (text only, zero image cost).**
   ```bash
   node "$CLAUDE_SKILL_DIR/bin/locate.mjs" "<input>" "关键词" --json
   node "$CLAUDE_SKILL_DIR/bin/locate.mjs" "<input>" "关键词" --from 0 --to 300 --transcript-file subs.srt --json
   ```
   Returns `{ matches:[{from,to,text,score}] }`. Feed a window straight into `zoom.mjs`.

6. **Hard subtitles when there is no transcript** (PV, songs, bilingual art titles):
   ```bash
   node "$CLAUDE_SKILL_DIR/bin/subtitles.mjs" "<input>" --max-strips 24 --step 3 --out "${TMPDIR:-/tmp}/video-storyboard/strip.jpg" --json
   ```
   One tall JPEG: strip *i* in reading order corresponds to the *i*-th time in
   `timeline`. Blank strips are information too.

## Choosing size and coverage

There are only three knobs that change the picture; everything else has a sane default.

| Situation | Command |
|---|---|
| Short clip (≤ ~3 min), normal reading | default (`strategy=auto`) |
| Need to read signs/faces in the overview | `--strategy full` (more images, sharper) |
| One wide look at a long film, spoilers OK | `--max-frames 96` |
| Watch a long film in order (no spoilers) | `--from 0 --segment 300`, follow `next: from=...` |
| Bulk windows for a 2-hour film | `--batch 300 --out "$OUT/film.png"` (writes a timeline table) |
| Hard cap on images | `--max-sheets 4` |
| Cheap one-image skim | `--strategy skim` or `--strategy brief` |
| Preview image counts without rendering | `--dry-run` |
| Precise tier override | `--tier-map '{"5":4,"6":4,"7":4,"8":4}'` |

`strategy`: **`auto` (default)** picks an image count from duration (~4 min/image) and the
cheapest tier whose smallest cell stays readable → `full` (one tier bigger per frame) →
`standard` → `compact` → `skim` (all 1/8, one image) → `brief` (adaptive gaps, whole clip in
one image). Disable auto with `VIDEO_STORYBOARD_AUTO=0` to fall back to `compact`. Old names
`quality/balanced/saver/frugal/thrifty/ultra` are still accepted.

`--cell-range 12-20` paginates the text index; `--detail low|med|high` sets characters of
dialogue per cell (60/120/400). `high` also turns on hard-subtitle OCR correction.

Full parameter reference: [references/cli.md](references/cli.md).
Tier math and measured costs: [references/strategy.md](references/strategy.md).
Transcription setup: [references/asr.md](references/asr.md).

## How to talk about what you saw

- **Cite cells and absolute time**: “cell 7 (image 2), 00:12.76–00:31.40”. Both numbers
  are in the index; never invent a time code that is not printed there.
- **Say what the image shows, not what you assume.** If a cell is too small to identify a
  face or a sign, zoom instead of guessing.
- **Transcript quality is stated** in the index (`transcript=asr|file|subtitle|no-key|
  no-audio`). If it says `no-key` or `no-audio`, do not claim the video has no speech —
  say the transcript was not available.
- **Cuts are evidence of editing, not of meaning.** `cuts=N` describes rhythm.
- **Blank/odd cells are data**: black frames, title cards and credits are real content.
- If sheets were truncated (`max-sheets`), say so rather than implying full coverage.

## Long videos

`probe` first, then choose:

```bash
# sequential reading, one window at a time (recommended for films/episodes)
node "$CLAUDE_SKILL_DIR/bin/storyboard.mjs" "<input>" --from 0 --segment 300 --out "${TMPDIR:-/tmp}/video-storyboard/seg.png" --text

# no-snap bulk: every 5 minutes, aligned to real cuts, plus a timeline markdown
node "$CLAUDE_SKILL_DIR/bin/storyboard.mjs" "<input>" --batch 300 --out "${TMPDIR:-/tmp}/video-storyboard/film.png"
```

Each windowed result prints `segment k/N · % watched · next: from=…`; follow it. Do not
re-storyboard the same window twice — scan results and transcripts are cached.

## Inputs, downloads and privacy

- Local paths are read as-is; URLs are resolved by `yt-dlp` and cached locally.
- `--cookies cookies.txt` (or `VIDEO_STORYBOARD_COOKIES`) for login-gated/high-res sources.
  Cookies are credentials: never echo them, commit them, or paste them into a report.
- Downloading is the user's call. If the content is paywalled/DRM/region-locked, do not try
  to bypass it; ask the user for a local file instead.
- Cache lives under `~/.cache/video-storyboard` (macOS/Linux) or
  `%LOCALAPPDATA%\video-storyboard` (Windows) and is pruned automatically.

## Configuration (optional)

Config directory: `~/.video-storyboard` (new); an existing `~/.dsh` with `video.json` /
`asr.json` is still used. Legacy `DSH_*` environment variables remain accepted, but prefer
the `VIDEO_STORYBOARD_*` names.

- `video.json`: `{ "cookies": "...", "browserPort": 9333, "ocr": { "python": "..." } }`
- `asr.json`: `{ "baseUrl": "http://127.0.0.1:8000/v1", "model": "...", "language": "zh",
  "manage": { "start": ["python", "server.py"], "idleMs": 5000 } }`

Environment: `VIDEO_STORYBOARD_HOME`, `_COOKIES`, `_CACHE_DIR`, `_MEDIA_DIR`,
`_FFMPEG_PATH`, `_FFPROBE_PATH`, `_YTDLP`, `_ASR_BASE_URL`, `_ASR_KEY`, `_ASR_MODEL`,
`_ASR_TERMS`, `_DEBUG`.

## Install this skill

```bash
node "$CLAUDE_SKILL_DIR/scripts/install-skill.mjs"              # copy into ~/.claude/skills/video-storyboard
node "$CLAUDE_SKILL_DIR/scripts/install-skill.mjs" --link       # symlink instead (edits apply immediately)
node "$CLAUDE_SKILL_DIR/scripts/install-skill.mjs" --dest DIR   # another skills root
node "$CLAUDE_SKILL_DIR/scripts/install-skill.mjs" --remove     # uninstall
```

## What not to do

- Do not describe frames you have not read: always Read the generated sheets first.
- Do not run `--strategy full` on a feature film “to be safe”; it can be hundreds of images.
- Do not claim exact dialogue from a low-detail index; re-run with `--detail high`,
  `--transcript-file`, or `zoom` the cell.
- Do not delete the generated `.evidence.json` before you finish — it is the reproducibility
  record (parameters, cut map, tiers) for the report you write.
