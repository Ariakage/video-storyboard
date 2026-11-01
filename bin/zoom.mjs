#!/usr/bin/env node
/**
 * zoom — 只看某一段：一张图、n 帧、统一 ceil(√n) 档。
 *
 *   node bin/zoom.mjs <video-or-url> --from 12 --to 20 [--frames 9]
 *                     [--cell-id 7] [--out zoom.png] [--json]
 *
 * `--cell-id` 用上一次 storyboard 记下的格子时间区间；不用自己换算。
 */
import { args as parse } from './_args.mjs';
import { boardOptions } from '../src/storyboard/board.js';
import { lookupCell } from '../src/storyboard/cells.js';
import { resolveInput } from '../src/storyboard/fetch.js';
import { isHttpUrl } from '../src/storyboard/url.js';
import { resolveDirectUrl } from '../src/storyboard/direct-url.js';
import { runStoryboard, formatForDetail, saveStoryboards } from '../src/storyboard/pipeline.js';

const opt = parse(process.argv.slice(2), {
  frames: 9, 'max-sheets': 1, 'max-frames': 9, from: null, to: null, 'cell-id': null,
  strategy: null, pick: 'sharp', burn: 'index', transcript: 'auto', detail: 'med',
  'transcript-file': null, cookies: null, 'allow-anonymous': false, quality: 'medium',
  'zoom-height': 1080, 'scan-height': 0, ocr: null, 'tier-map': null,
  out: 'zoom.png', json: false,
});
const input = opt._[0];
if (!input) {
  console.error('usage: node bin/zoom.mjs <video-or-url> (--from 12 --to 20 | --cell-id 7) '
    + '[--frames 9] [--out zoom.png] [--json]');
  process.exit(2);
}

try {
  // cellId → 上一次 storyboard 记下的绝对时间区间
  let from = opt.from === null || opt.from === undefined ? undefined : Number(opt.from);
  let to = opt.to === null || opt.to === undefined ? undefined : Number(opt.to);
  if (opt['cell-id'] !== null && opt['cell-id'] !== undefined && opt['cell-id'] !== true) {
    const cellId = Number(opt['cell-id']);
    const hit = await lookupCell(input, cellId);
    if (!hit) {
      console.error(`no cell map recorded for this input (cellId ${cellId}). `
        + 'Run the storyboard command on it first, or pass --from/--to.');
      process.exit(1);
    }
    from = hit.from;
    to = hit.to;
  }
  if (!(from >= 0) || !(to > 0)) {
    console.error('zoom needs --from and --to (or --cell-id from a previous storyboard run)');
    process.exit(2);
  }

  const args = {
    input,
    from,
    to,
    maxFrames: Number(opt.frames) || Number(opt['max-frames']) || 9,
    maxSheets: Number(opt['max-sheets']) || 1,
    strategy: opt.strategy ?? undefined,
    pick: String(opt.pick),
    burn: String(opt.burn),
    transcript: String(opt.transcript),
    detail: String(opt.detail),
    transcriptFile: opt['transcript-file'] ?? undefined,
    cookies: opt.cookies ?? undefined,
    allowAnonymous: opt['allow-anonymous'] === true,
    zoomHeight: Number(opt['zoom-height']) || 1080,
    scanHeight: Number(opt['scan-height']) || undefined,
    ...(opt.ocr === 'on' ? { ocr: true } : opt.ocr === 'off' ? { ocr: false } : {}),
    ...(opt['tier-map']
      ? { tierMap: (() => { try { return JSON.parse(opt['tier-map']); } catch { return undefined; } })() }
      : {}),
  };
  const opts = boardOptions(args, { kind: 'zoom' });

  // 链接：优先回原始流取高清；拿不到就退回本地低清（糊一点，但整次调用不该失败）
  let frameSource = null;
  if (isHttpUrl(input)) {
    try {
      const resolved = await resolveInput(input, opts.fetchOptions);
      frameSource = resolved.frameSource
        ?? await resolveDirectUrl(input, { ...opts.fetchOptions, height: opts.fetchOptions.zoomHeight });
    } catch { /* 退回本地低清 */ }
  }

  const result = await runStoryboard({ ...opts, frameSource });
  const paths = await saveStoryboards(result, opt.out, { quality: 4 });
  const text = formatForDetail(result, { detail: args.detail });

  if (opt.json) {
    console.log(JSON.stringify({
      input,
      window: result.window,
      plan: result.plan,
      sheets: result.sheets.map((s, i) => ({
        path: paths[i], sheet: s.sheet, width: s.width, height: s.height, cells: s.cells,
      })),
      evidence: result.evidencePath ?? null,
      text,
    }, null, 2));
  } else {
    for (const [i, sheet] of result.sheets.entries()) {
      console.log(`[sheet] ${paths[i]}  ${sheet.width}x${sheet.height}  ${sheet.cells.length} 帧`);
    }
    console.log(`\n${text}`);
  }
} catch (error) {
  console.error(`zoom failed: ${error.message}`);
  process.exit(1);
}
