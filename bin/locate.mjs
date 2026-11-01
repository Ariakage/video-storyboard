#!/usr/bin/env node
/**
 * locate — 纯文本定位：一句话 → 时间码。不读帧、不出图。
 *
 *   node bin/locate.mjs <video-or-url> "<query>" [--from 0] [--to 300] [--max 5]
 *                       [--transcript-file subs.srt] [--cookies cookies.txt] [--json]
 *
 * 没有现成转写时补跑一次 textOnly 的管线（复用 storyboard 的全部配置）。
 */
import { args as parse } from './_args.mjs';
import { formatMatches, matchSegments, recallSegments } from '../src/storyboard/locate.js';
import { resolveInput } from '../src/storyboard/fetch.js';
import { runStoryboard } from '../src/storyboard/pipeline.js';

const opt = parse(process.argv.slice(2), {
  from: 0, to: 0, max: 5, 'transcript-file': null,
  cookies: null, 'allow-anonymous': false, json: false,
});
const input = opt._[0];
const query = opt._[1];
if (!input || !query) {
  console.error('usage: node bin/locate.mjs <video-or-url> "<query>" [--from 0] [--to 300] [--max 5] [--json]');
  process.exit(2);
}

const max = Math.min(20, Math.max(1, Number(opt.max) || 5));
const hasWindow = Number(opt.to) > Number(opt.from);
const from = Number(opt.from) || 0;
const to = hasWindow ? Number(opt.to) : 0;

try {
  const resolved = await resolveInput(input, {
    cookies: opt.cookies ?? undefined,
    allowAnonymous: opt['allow-anonymous'] === true,
  });
  // 跑一次纯文本管线：转写会写进缓存，下一次定位直接命中。
  const result = await runStoryboard({
    input: resolved.path,
    from: hasWindow ? from : undefined,
    to: hasWindow ? to : undefined,
    transcriptFile: opt['transcript-file'] ?? undefined,
    textOnly: true,
    encode: false,
  });
  // 同一进程里管线会把转写留给 locate；拿不到再退回内存表。
  const segments = result.transcript?.segments?.length
    ? result.transcript.segments
    : recallSegments(resolved.path);
  if (!segments || segments.length === 0) {
    const text = 'no transcript available for this file: run the storyboard command first, '
      + 'or pass --transcript-file. Without a transcript there is nothing to match on.';
    if (opt.json) console.log(JSON.stringify({ query, matches: [], text }, null, 2));
    else console.log(text);
    process.exit(0);
  }
  const lo = hasWindow ? from : 0;
  const hi = hasWindow ? to : Infinity;
  const inWindow = segments.filter((x) => x.to >= lo && x.from <= hi);
  const matches = matchSegments(inWindow, query, { max });
  const text = formatMatches(query, matches, { total: inWindow.length });
  if (opt.json) console.log(JSON.stringify({ query, window: hasWindow ? { from, to } : null, matches, text }, null, 2));
  else console.log(text);
} catch (error) {
  console.error(`locate failed: ${error.message}`);
  process.exit(1);
}
