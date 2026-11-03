# CLI reference

All commands live in `bin/` and run on plain Node ≥ 20. `<input>` is a local path or any
http(s) URL `yt-dlp` supports. Examples assume the skill directory as cwd; from elsewhere,
use the absolute path (`node "$CLAUDE_SKILL_DIR/bin/storyboard.mjs" ...`).

Common options on every command that touches a URL:

| Option | Meaning |
|---|---|
| `--cookies cookies.txt` | Netscape cookie jar for login-gated / high-res sources |
| `--allow-anonymous` | Suppress the "anonymous resolution not guaranteed" note |
| `--json` | stdout becomes a single JSON object; progress goes to stderr |

## `probe.mjs` — metadata only

```
node bin/probe.mjs <input> [--cookies f] [--allow-anonymous] [--json]
```

Reads the container header (local) or resolves metadata (URL, **no download**). Returns
duration, resolution, rotation, fps, codecs, audio/subtitle tracks and a suggested plan.
JSON: `{ kind:'file'|'url', duration, width, height, fps, hasAudio, hasSubtitle, ... }`.

## `storyboard.mjs` — the main pass

```
node bin/storyboard.mjs <input> [options]
```

| Option | Default | Meaning |
|---|---|---|
| `--out PATH` | `storyboard.png` | output image; with multiple sheets → `PATH-2.png`, `PATH-3.png` … |
| `--manifest PATH` | — | write the full machine-readable manifest JSON |
| `--text` | off | also print the citable text index |
| `--json` | off | print one JSON object: `{ probe, window, plan, sheets, evidence, manifest, text }` |
| `--dry-run` | off | scan + plan only; print cut count and image count per strategy, render nothing |
| `--probe` | — | only probe metadata, even for a URL (never downloads) |
| `--from N` / `--to N` | whole file | analyse this window only |
| `--segment N` | 0 | when only `--from` is given, window length; prints the next window |
| `--plan N` | — | print a segmented reading plan (N ≈ seconds per window) and exit |
| `--batch N` | — | split into N-second windows, render each, write `-timeline.md` |
| `--no-snap` | snap on | with `--batch`, don't align window edges to cuts |
| `--max-frames N` | 0 (no cap) | cap frames; 0 = one frame per shot |
| `--max-sheets N` | 0 (no cap) | hard cap on images; re-merges shots when exceeded |
| `--strategy NAME` | `auto` | `auto` / `full` / `standard` / `compact` / `skim` / `brief` |
| `--tier-map JSON` | — | exact override, e.g. `'{"5":4,"6":4,"7":4,"8":4}'` |
| `--budget PIXELS` | 360000 | per-image pixel budget; default 360k = 800×450 (~233 tokens), ceiling 1.69M = 1300×1300 (~994 tokens) |
| `--pick mid\|sharp\|thumb` | `mid` | frame selection inside a shot |
| `--burn index\|none` | `index` | stamp the cell number into the cell |
| `--threshold N\|auto` | `auto` | cut-detection threshold |
| `--scan-gap N` | 0 | minimum seconds between cuts (merge flash cuts) |
| `--integral on\|off` | on | sample extra frames inside long takes |
| `--integral-seconds N` | 6 | seconds of accumulated change per sampled frame |
| `--transcript auto\|off` | `auto` | speech lines |
| `--transcript-file PATH` | — | use an existing SRT / JSON transcript |
| `--detail low\|med\|high` | `med` | dialogue characters per cell (60/120/400); `high` enables subtitle OCR |
| `--cell-range A-B` | — | render only cells A..B in the text index (pagination) |
| `--cell-id N` | — | reuse the cell range saved by a previous storyboard of this input |
| `--quality low\|medium\|high` | `medium` | download resolution for URLs (local files always read original) |
| `--scan-height N` / `--zoom-height N` | 0 / 1080 | explicit URL scan / close-up heights |
| `--source-hash` | off | add the source file SHA-256 to the manifest |

The text index format:

```
cell 7 (image 2) = 00:12.76-00:31.40  k=3 (1/3)  cuts 2
    "台词…"
```

`k` is the tier: cell side = 1/k of the canvas. The manifest also prints the smallest cell,
its readability, the tier histogram, fill ratio and token cost.

## `zoom.mjs` — one window, big cells

```
node bin/zoom.mjs <input> (--from S --to S | --cell-id N) [options]
```

| Option | Default | Meaning |
|---|---|---|
| `--frames N` | 9 | frames in the window (uniform `ceil(√N)` tier) |
| `--max-sheets N` | 1 | images (a zoom is meant to be one image) |
| `--strategy NAME` | `full` | lower only if the window is long |
| `--pick` / `--burn` | `sharp` / `index` | as above |
| `--detail` | `med` | dialogue characters per cell |
| `--out` | `zoom.png` | output image |
| `--json` | off | `{ window, plan, sheets, evidence, text }` |

`--cell-id` reads the map written by the last storyboard of the same input string; if no map
exists it fails loudly rather than guessing a window.

## `locate.mjs` — text only

```
node bin/locate.mjs <input> "<query>" [--from 0] [--to S] [--max 5]
                    [--transcript-file PATH] [--json]
```

Runs a text-only pass when no transcript is cached, then returns the best matching segments
(`{ from, to, text, score }`). No frames are decoded and no image is produced. Needs a
transcript source: subtitle track, `--transcript-file`, or a configured ASR.

## `subtitles.mjs` — hard-subtitle strip

```
node bin/subtitles.mjs <input> [--from 0] [--to S] [--max-strips 24] [--step 3]
                       [--band y0,y1] [--out subtitle-strip.jpg] [--json]
```

Clips the burned-in subtitle band and stacks strips vertically in time order. `--band` is in
fractions of frame height (default `0.82,0.98`, auto-detected when possible). JSON includes
`image`, `strips:[{t,bytes}]`, `band`, `bandSource`, `text`.

## Auxiliary

```
node bin/doctor.mjs                       # environment check, exit 1 on hard failure
node bin/scan-video.mjs <input>           # raw cut list + scores (threshold tuning)
node bin/scan-stats.mjs <input>           # score distribution, threshold sweep
node bin/asr-check.mjs <input> --from S --seconds N   # verify the speech pipeline cheaply
```
