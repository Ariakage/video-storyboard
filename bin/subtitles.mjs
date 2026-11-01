#!/usr/bin/env node
/**
 * subtitles — 把画面里的**硬字幕**裁成一条竖长图：一张图读完所有台词。
 *
 *   node bin/subtitles.mjs <video-or-url> [--from 0] [--to 120]
 *                          [--max-strips 24] [--step 3] [--band 0.82,0.98]
 *                          [--out subtitle-strip.jpg] [--json]
 *
 * 用在"没有字幕轨、ASR 也转不出来"的片子（PV / 唱歌 / 双语艺术字）。
 * 有可用转写时 locate 更便宜，先试它。
 */
import { args as parse } from './_args.mjs';
import { resolveInput } from '../src/storyboard/fetch.js';
import { buildSubtitleStrip, DEFAULT_BAND } from '../src/storyboard/subtitle-strip.js';

const opt = parse(process.argv.slice(2), {
  from: 0, to: 0, 'max-strips': 24, step: 3, band: null,
  out: 'subtitle-strip.jpg', cookies: null, 'allow-anonymous': false, json: false,
});
const input = opt._[0];
if (!input) {
  console.error('usage: node bin/subtitles.mjs <video-or-url> [--from 0] [--to 120] '
    + '[--max-strips 24] [--step 3] [--band 0.82,0.98] [--out subtitle-strip.jpg] [--json]');
  process.exit(2);
}

const band = (() => {
  if (typeof opt.band !== 'string') return null;
  const parts = opt.band.split(',').map(Number);
  return parts.length === 2 && parts.every(Number.isFinite) ? parts : null;
})();

const tc = (s) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

try {
  const { path } = await resolveInput(input, {
    cookies: opt.cookies ?? undefined,
    allowAnonymous: opt['allow-anonymous'] === true,
  });
  const from = Number(opt.from) || 0;
  const to = Number(opt.to) || 0;
  const r = await buildSubtitleStrip({
    input: path,
    from,
    ...(to > from ? { to } : {}),
    maxStrips: Number(opt['max-strips']) || 24,
    stepSec: Number(opt.step) || 3,
    band,
    out: opt.out,
  });

  const bandText = r.bandSource === 'explicit'
    ? `explicit ${(r.band[0] * 100).toFixed(0)}%–${(r.band[1] * 100).toFixed(0)}%`
    : r.bandSource === 'detected'
      ? `detected ${(r.band[0] * 100).toFixed(0)}%–${(r.band[1] * 100).toFixed(0)}%`
      : `bottom ${(DEFAULT_BAND[0] * 100).toFixed(0)}%–${(DEFAULT_BAND[1] * 100).toFixed(0)}% `
        + '(fallback: no subtitle band detected — pass --band y0,y1 if the subtitles sit higher)';
  const every = r.strips.length > 1 ? (r.strips[1].t - r.strips[0].t).toFixed(1) : '—';
  const text = [
    `subtitle strip: ${r.strips.length} strips, top to bottom, ~${every}s apart · `
      + `${tc(r.strips[0]?.t ?? 0)}–${tc(r.to)} · band = ${bandText}`,
    `image: ${r.out}`,
    `timeline: ${r.strips.map((s) => tc(s.t)).join(' ')}`,
    'Read them in order: strip i (1-based) = the i-th time above. '
      + 'Blank strips mean no on-screen subtitle at that moment — that is information too, not a failure.',
  ].join('\n');

  if (opt.json) {
    console.log(JSON.stringify({
      image: r.out, from, to: r.to, band: r.band, bandSource: r.bandSource,
      strips: r.strips, text,
    }, null, 2));
  } else {
    console.log(text);
  }
} catch (error) {
  console.error(`subtitles failed: ${error.message}`);
  process.exit(1);
}
