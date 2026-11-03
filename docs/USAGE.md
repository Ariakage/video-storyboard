# Usage (current)

> Full CLI: [references/cli.md](../references/cli.md) ·
> Tiers and cost: [references/strategy.md](../references/strategy.md) ·
> Transcription: [references/asr.md](../references/asr.md) · Skill entry: [SKILL.md](../SKILL.md)

## Shape of one call

```bash
node bin/storyboard.mjs <input> --out <sheet.png> --text --json
```

`--json` keeps stdout a single JSON object (progress goes to stderr):
`{ probe, window, plan, sheets:[{path,width,height,cells}], evidence, text }`.
With multiple sheets the output becomes `sheet-2.png`, `sheet-3.png`, …

## Six common reads

```bash
# 1. overview of a short clip
node bin/probe.mjs clip.mp4 --json
node bin/storyboard.mjs clip.mp4 --out /tmp/vs/sheet.png --text --json

# 2. one window only (does not scan the whole file)
node bin/storyboard.mjs clip.mp4 --from 120 --to 180 --out /tmp/vs/win.png --text

# 3. long film, sequential and spoiler-free — follow "next: from=..."
node bin/storyboard.mjs film.mp4 --from 0 --segment 300 --out /tmp/vs/seg.png --text

# 4. bulk windows snapped to real cuts (+ film-timeline.md); add --no-snap to disable
node bin/storyboard.mjs film.mp4 --batch 300 --out /tmp/vs/film.png

# 5. close-up of one cell (or --from/--to)
node bin/zoom.mjs film.mp4 --cell-id 7 --frames 9 --out /tmp/vs/cell7.png --json

# 6. text locator — no image cost
node bin/locate.mjs film.mp4 "keyword" --json
```

## Choosing a strategy

| Need | Flag |
|---|---|
| everyday reading | default `auto` |
| read signs / recognize faces | `--strategy full`, or `zoom` the key cells |
| a PV in one image | `--strategy skim` |
| a 5-minute clip in one image | `--strategy brief` |
| hard image cap | `--max-sheets 4` |
| exact tier override | `--tier-map '{"5":4,"6":4,"7":4,"8":4}'` |

**Image count is the cost** (~233 tokens at the default 800×450; up to ~994). Probe first, then decide granularity.

## Evidence

Each storyboard writes `<out>.evidence.json` beside the image: cuts, tiers, parameters, source
info. It is the reproducibility record for your report — keep it until the report is done.

## Errors

| Message | Meaning | Fix |
|---|---|---|
| `invalid pick` | bad frame-selection mode | `--pick mid\|sharp\|thumb` |
| `this video needs a signed-in session` | site requires login | export cookies.txt, see [SETUP.md](SETUP.md) |
| `no cell map recorded` | no storyboard for this input yet | run `storyboard` first, or pass `--from/--to` |
| `transcript=no-key` in the index | ASR not configured | see [references/asr.md](../references/asr.md), or pass `--transcript-file` |
