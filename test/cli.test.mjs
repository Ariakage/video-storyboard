/**
 * cli.test.mjs — Skill 的命令行入口 e2e。
 *
 * Skill 不是靠宿主注册工具，而是靠这五个命令：probe / storyboard / zoom / locate / subtitles。
 * 这里真跑一遍，盯住三件事：
 *   1. `--json` 的 stdout 必须是**纯 JSON**（进度行走 stderr），否则 agent 解析不了；
 *   2. 图片真的落盘、真的是 PNG/JPEG；
 *   3. storyboard 记下的 cell 表能被后续 zoom --cell-id 用上。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { DEFAULT_FFMPEG, DEFAULT_FFPROBE } from '../src/storyboard/probe.js';

const run = promisify(execFile);
const HERE = dirname(dirname(fileURLToPath(import.meta.url)));
const BIN = join(HERE, 'bin');

let hasFfmpeg = false;
try { await run(DEFAULT_FFMPEG, ['-version']); hasFfmpeg = true; } catch { /* 无 */ }

async function makeFixture(dir) {
  const out = join(dir, 'clip.mp4');
  await run(DEFAULT_FFMPEG, [
    '-hide_banner', '-v', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=24:duration=6',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', out,
  ]);
  return out;
}

const cli = (script, argv, opts = {}) => run(
  process.execPath, [join(BIN, script), ...argv],
  { maxBuffer: 8 * 1024 * 1024, ...opts },
);

test('CLI: probe --json 返回可解析的容器信息', async (t) => {
  if (!hasFfmpeg || !DEFAULT_FFPROBE) return t.skip('ffmpeg/ffprobe not on PATH');
  const dir = await mkdtemp(join(tmpdir(), 'vs-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = await makeFixture(dir);
  const { stdout } = await cli('probe.mjs', [file, '--json'], {
    env: { ...process.env, VIDEO_STORYBOARD_CACHE_DIR: join(dir, 'cache') },
  });
  const info = JSON.parse(stdout);
  assert.equal(info.kind, 'file');
  assert.ok(info.duration >= 5.9 && info.duration <= 6.1);
  assert.equal(info.width, 320);
  assert.equal(info.hasAudio, true);
});

test('CLI: storyboard --json 出图 + 文本清单，zoom --cell-id 复用格子表', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not on PATH');
  const dir = await mkdtemp(join(tmpdir(), 'vs-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = await makeFixture(dir);
  const out = join(dir, 'sheet.png');

  const env = { ...process.env, VIDEO_STORYBOARD_CACHE_DIR: join(dir, 'cache') };
  const { stdout, stderr } = await cli('storyboard.mjs', [
    file, '--frames', '4', '--out', out, '--text', '--json',
  ], { env });
  // stdout 必须是纯 JSON；进度行只能在 stderr
  const payload = JSON.parse(stdout);
  assert.match(stderr, /\[scan\]|\[plan\]/);
  assert.ok(payload.sheets.length >= 1);
  assert.equal(payload.sheets[0].path, out);
  assert.ok(existsSync(out));
  const png = await readFile(out);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', '必须是 PNG 魔数');
  assert.match(payload.text, /<storyboard[\s\S]*cell 1/);

  // 格子表已经落盘：zoom 不用再从秒数换算
  const zoomOut = join(dir, 'zoom.png');
  const zoom = JSON.parse((await cli('zoom.mjs', [
    file, '--cell-id', '1', '--frames', '4', '--out', zoomOut, '--json',
  ], { env })).stdout);
  assert.ok(zoom.window.to > zoom.window.from);
  assert.ok(existsSync(zoomOut));
  const jpg = await readFile(zoomOut);
  assert.equal(jpg.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});

test('CLI: locate 用 transcript 文件定位，不碰 ASR', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not on PATH');
  const dir = await mkdtemp(join(tmpdir(), 'vs-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = await makeFixture(dir);
  const srt = join(dir, 'subs.srt');
  await writeFile(srt, [
    '1', '00:00:01,000 --> 00:00:02,000', 'hello world', '',
    '2', '00:00:03,000 --> 00:00:04,000', 'second line about memory', '',
  ].join('\n'), 'utf8');

  const { stdout } = await cli('locate.mjs', [file, 'memory', '--transcript-file', srt, '--json'], {
    env: { ...process.env, VIDEO_STORYBOARD_CACHE_DIR: join(dir, 'cache') },
  });
  const found = JSON.parse(stdout);
  assert.equal(found.matches.length, 1);
  assert.equal(found.matches[0].from, 3);
  assert.match(found.text, /second line about memory/);
});

test('CLI: subtitles 裁出竖长图并给时间码', async (t) => {
  if (!hasFfmpeg) return t.skip('ffmpeg not on PATH');
  const dir = await mkdtemp(join(tmpdir(), 'vs-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = await makeFixture(dir);
  const out = join(dir, 'strip.jpg');
  const { stdout } = await cli('subtitles.mjs', [
    file, '--max-strips', '3', '--step', '2', '--out', out, '--json',
  ], { env: { ...process.env, VIDEO_STORYBOARD_CACHE_DIR: join(dir, 'cache') } });
  const payload = JSON.parse(stdout);
  assert.equal(payload.image, out);
  assert.equal(payload.strips.length, 3);
  assert.ok(existsSync(out));
  const jpg = await readFile(out);
  assert.equal(jpg.subarray(0, 2).toString('hex'), 'ffd8', '必须是 JPEG 魔数');
});
