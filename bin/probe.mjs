#!/usr/bin/env node
/**
 * probe — 只读容器头：片长、分辨率、帧率、音轨/字幕轨，以及建议的阅读顺序。
 *
 *   node bin/probe.mjs <video-or-url> [--cookies cookies.txt] [--allow-anonymous] [--json]
 *
 * 链接只解析元数据，**不下载**：probe 的全部价值就是便宜。
 */
import { args as parse } from './_args.mjs';
import { probeVideo } from '../src/storyboard/probe.js';
import { probeUrl } from '../src/storyboard/fetch.js';
import { formatProbe, formatRemoteProbe } from '../src/storyboard/format.js';
import { isHttpUrl } from '../src/storyboard/url.js';

const opt = parse(process.argv.slice(2), { cookies: null, 'allow-anonymous': false, json: false });
const input = opt._[0];
if (!input) {
  console.error('usage: node bin/probe.mjs <video-or-url> [--cookies cookies.txt] [--allow-anonymous] [--json]');
  process.exit(2);
}

const fetchOptions = {
  cookies: opt.cookies ?? undefined,
  allowAnonymous: opt['allow-anonymous'] === true,
};

try {
  if (isHttpUrl(input)) {
    const remote = await probeUrl(input, fetchOptions);
    if (opt.json) console.log(JSON.stringify({ kind: 'url', ...remote }, null, 2));
    else console.log(formatRemoteProbe(remote));
  } else {
    const info = { ...(await probeVideo(input)), path: input };
    if (opt.json) console.log(JSON.stringify({ kind: 'file', ...info }, null, 2));
    else console.log(await formatProbe(info));
  }
} catch (error) {
  console.error(`probe failed: ${error.message}`);
  process.exit(1);
}
