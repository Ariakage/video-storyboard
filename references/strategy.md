# Tiers, strategies and cost

## One frame = one shot

Cuts are detected first; long takes are additionally sampled by integrating on-screen change.
Each resulting frame gets a **tier** `k ∈ {1,2,3,4,5,6,7,8}`; its cell side is `1/k` of the
canvas. Tier is computed from local cut density (100-frame convolution → smoothed cut
probability → 7 thresholds with 5% hysteresis). Frames created by the integral sampler get
`+2` tiers because the picture keeps changing there.

So the same image shows both:

- a 20-second take → a full-width cell (tier 1, 800×450 on an 800-wide canvas);
- 24 flash cuts → 1/8-side cells (100×56).

Cell size is therefore information, not decoration.

## Strategies

| `strategy` | Effect | Typical use |
|---|---|---|
| **`auto` (default)** | image count from duration (~4 min/image), then the cheapest tier whose smallest cell stays readable | when you don't pick |
| `full` | one tier bigger per frame (tier 1 stays 1) | read signs/faces in the overview |
| `standard` | tier 1 becomes 1/2; others unchanged | every shot legible |
| `compact` | one tier smaller per frame | clear and cheap |
| `skim` | all 1/8, integral sampling off, cuts merged at 0.35 s | one PV → one image |
| `brief` | all 1/8, cut spacing widened until the whole clip fits one image | 5-minute clip in one look |

`auto` can be disabled with `VIDEO_STORYBOARD_AUTO=0` (or `{"storyboard":{"auto":false}}` in
`video.json`), which falls back to `compact`.

Old names map automatically: `quality→full`, `balanced→standard`, `saver/frugal→compact`,
`thrifty→skim`, `ultra→brief`.

`--tier-map` applies after the strategy and overrides exact tiers:
`--tier-map '{"5":4,"6":4}'` means tiers 5–8 render at 1/4. Unlisted tiers keep their computed
value; multiple tiers mapping to one value just merge cell sizes. Filler frames (free-size)
ignore the map; out-of-range keys are ignored.

## Packing

Tier sequence → a dynamic-programming row packer fills a square canvas optimally, opening a
new image only when full, then crops the canvas to content. If a sheet's fill ratio is below
68% (e.g. end titles + credits), the longest shots on that sheet are split further to reach a
perfect square of cells, which packs fuller without adding an image.

## Measured cost (90 s concept PV, 1080p24, 59 cuts + 13 integral marks)

| strategy | frames | images | vision tokens | smallest cell |
|---|---|---|---|---|
| `full` | 73 | 18 | ~4.2k | — |
| `standard` | 73 | 5 | ~1.2k | 95×62 |
| `compact` | 74 | 3 | ~700 | 114×54 |
| `skim` | 53 | 1 | ~233 | 114×54 |
| `brief` | 56 | 1 | ~233 | 100×56 |

5-minute clip (299 s, 150 cuts):

| strategy | frames | images | tokens |
|---|---|---|---|
| `standard` | 195 | 19 | ~4.4k |
| `compact` | 201 | 10 | ~2.3k |
| `skim` | 149 | 3 | ~700 |
| `brief` | 51 | 1 | ~233 |

One 800×450 image is ~233 vision tokens (42px token grid, floor 544², cap 994 at 1300×1300);
the number of cells does not change that. **Image count is the cost**, which is why
`max-sheets` and `--dry-run` exist.

## Reading guidance

- `auto` is the right default for “what happened”. Use `full` only for specific cells where
  text/faces matter — or better, `zoom` those cells.
- For a film, read sequentially (`--segment`) instead of one wide pass: one overview of a
  2-hour film makes every cell unreadable and spoils the ending.
- When the manifest warns that the smallest cells are below readable size, either raise the
  strategy or accept that the overview is only for rhythm/structure and zoom for detail.
