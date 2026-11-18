/**
 * help.js — 视频工具的**唯一一份**手册。
 *
 * 在本仓库里它的读者是 `bin/storyboard.mjs --dry-run`：扫描新鲜时印一次，因为下一步正要花钱。
 * （上游还有第二个入口 `video_help` 工具，本仓库不带插件层，只留这一份手册本体。）
 *
 * **为什么不写进 usage / SKILL.md 正文**：命令行用法是每次 `--help` 都要给的常驻文案，
 * 而这里的内容一个会话里问不到两次。（历史：这些数字原来写在参数描述里，
 * 实测 22,855 字符 ≈ 14.9k token/轮。）
 *
 * 维护约定：改契约时先问一句"删掉这句，模型还会不会用错？"
 * 会 → 留在契约里；不会 → 搬到这里。**两份手册不许出现**：以前干跑里另抄了一份，
 * 改档位时只改了一处。
 */

const TITLE = [
  'VIDEO STORYBOARD MANUAL — read what you need; every section is also its own `topic`.',
  'topics: cost · strategy · tiers · cuts · text · links · order · subtitles',
].join('\n');

const SECTIONS = {
  cost: [
    '## cost',
    'Images bill by PIXELS on a 42px token grid, not by frame count: 798x449 = 222 tokens, anything',
    'under 544x544 = 192 (the floor — drawing smaller saves nothing), 1300x1300 = 994 (the ceiling).',
    'A window costs ≈ Σ(cell pixel area) ÷ fill, so packing MORE frames into the SAME canvas is nearly',
    'free, while opening one more image is not. Frames are what cost money, not window width.',
    'The text index is billed on top and is often the bigger bill (--detail high: 400 chars per cell).',
    '`--budget` is pixels per image (64000..1690000; below ~296000 saves nothing because of the floor).',
  ].join('\n'),

  strategy: [
    '## strategy (how many cells per sheet)',
    'Cheapest first: skim (all cells 1/8, no integral frames, cuts merged) · brief (skim widened until',
    'the window fits ONE image) · compact (one tier smaller per frame; the factory default) · standard',
    '(tier 1 shrunk to 1/2) · full (one tier BIGGER = more images AND more tokens).',
    '`auto` (the default) is not a size: it plans the same frames under compact/standard/full and keeps',
    'the cheapest whose smallest cell is still readable, then prints what the others would have cost.',
    '**Never pass "full" as a safe default** — it is the most expensive setting, not the most complete:',
    'on a 191-cut 5-minute window it wants 59 images where compact wants 8.',
    'Do not pass `--strategy` unless the user asked for a specific look.',
  ].join('\n'),

  tiers: [
    '## tiers / --tier-map',
    'Each frame gets a tier 1..8 from cut density (7 thresholds, 5% hysteresis, 100-frame window).',
    'Tier k means the cell side is 1/k of the canvas: tier 1 = one full-width cell, tier 2 = 4 cells,',
    'tier 4 = 16 cells, tier 8 = 64 tofu blocks. Cells are numbered across images, in time order.',
    '`--tier-map` overrides the result AFTER the strategy — \'{"1":3,"5":4}\' means "tier 1 becomes 3,',
    'tier 5 becomes 4"; keys and values are both tiers 1..8. It is the right knob when the user says',
    '"6格 / 12格" (≈ tier 3 / 4 on a square canvas) or "make the cells bigger/smaller". A default map',
    'can live in video.json as `storyboard.tierMap` (`native` = use the computed tier untouched).',
  ].join('\n'),

  cuts: [
    '## cuts / frames',
    '`cutFloor` 0-255 (omit → 80; set `storyboard.cutFloor` in video.json): 80 suits documentary/film',
    '(long shots, sparse cuts), 60 suits short-form and fast-cut content (median shot < 3s). Lower',
    'detects more shots: more images and tokens, but fewer torn-together scenes.',
    '`--scan-gap` = minimum seconds between cuts (0 = merge none).',
    '`--integral on|off` (default on) adds frames inside long takes; `--integral-seconds` is the accumulated',
    'change ONE sampled frame stands for (1-30, default 6), measured against a fixed reference level:',
    'busy footage yields more frames, slow footage fewer. It is NOT "one frame every N seconds".',
    '`--max-frames` (0 = no cap) merges the shortest segments first; `--max-sheets` (0 = no cap) caps',
    'the bill but merges segments into longer frames.',
    'LONG FILM / EPISODE: read in windows — `--from` + `--segment` (default 300 s), then follow the',
    '`next: from=...` printed at the end of each result. A one-shot overview of a 2-hour film shrinks',
    'every cell to 1/8 and still spoils the pacing.',
  ].join('\n'),

  text: [
    '## text index',
    '`--detail` = transcript chars per cell (low 60 / med 120 / high 400) — the real lever on token',
    'cost. Hard-subtitle OCR only runs at --detail high (zoom also takes `--ocr on|off`). `hotwords`',
    'in asr.json biases transcription; `--transcript-file` skips the subtitle track and ASR entirely.',
    '`--text-only` returns the index with no frames (no decode, no image tokens); `--cell-range A-B`',
    're-renders the index for cells that already exist — together they page a long index for free.',
    'The index never prints the same sentence twice: a line shared by many cells is listed once and',
    'referenced as "→ L1". `--dry-run` plans only. `--source-hash` is internal (scan cache key).',
  ].join('\n'),

  links: [
    '## links',
    '`--quality` picks the download height (low/medium/high = 360/720/1080p) and `--scan-height`',
    'overrides it exactly. `--cookies` is a cookies.txt path (or VIDEO_STORYBOARD_COOKIES);',
    '`--allow-anonymous` lets a link through without them (default false).',
  ].join('\n'),

  order: [
    '## order of use',
    'bin/probe.mjs (duration/tracks, free) → bin/storyboard.mjs in windows → bin/zoom.mjs on one cell',
    '→ bin/locate.mjs for "where was that said". locate reuses the transcript storyboard already',
    'produced; without it, ASR runs for the window (slow if long). bin/subtitles.mjs is the fallback',
    'when the subtitles are BURNED IN and ASR cannot read them.',
  ].join('\n'),

  subtitles: [
    '## bin/subtitles.mjs',
    'For hard-coded subtitles with no track and no usable transcript (PV / lyrics / bilingual titles).',
    '`--max-strips` (default 24), `--step` (default 3), `--band y0,y1` as frame fractions',
    '(default 0.82-0.98). Each strip is one moment, top to bottom; a blank strip means "no subtitle',
    'here", which is also information. Strips are cut SEQUENTIALLY — parallel cropping on a',
    'memory-tight machine dies with 0xC000012D.',
  ].join('\n'),
};

export const VIDEO_HELP_TOPICS = Object.freeze(Object.keys(SECTIONS));

/**
 * @param {string} [topic]  某一节的名字；不给就返回整本手册
 * @returns {string}
 */
export function videoHelp(topic) {
  const key = String(topic ?? '').trim().toLowerCase();
  const section = SECTIONS[key];
  return section ? `${TITLE}\n\n${section}` : [TITLE, '', ...Object.values(SECTIONS)].join('\n\n');
}
