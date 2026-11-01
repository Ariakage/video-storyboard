/**
 * binaries.js — 解析 ffmpeg / ffprobe 可执行文件。
 *
 * 优先级：
 *  1. 显式环境变量（VIDEO_STORYBOARD_FFMPEG_PATH / FFMPEG_PATH / VIDEO_STORYBOARD_FFMPEG_DIR；
 *     旧的 DSH_FFMPEG_PATH / DSH_FFMPEG_DIR 仍然认）
 *  2. 配置目录下的 tools/ffmpeg/bin、bin（$VIDEO_STORYBOARD_HOME，或沿用的 ~/.dsh）
 *  3. 它们上一级的 tools/ffmpeg/bin、bin
 *  4. PATH 上的 ffmpeg / ffprobe
 *
 * 桌面端常把媒体工具放在安装目录而不进 PATH；这个解析器让人不必改系统 PATH。
 * 找不到时保留裸命令名，让底层报错原样暴露。
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { ENV, configHome, envName } from './config.js';

const exeSuffix = (platform) => (platform === 'win32' ? '.exe' : '');

/**
 * @param {'ffmpeg'|'ffprobe'} name
 * @param {{env?:NodeJS.ProcessEnv, platform?:NodeJS.Platform}} [opts]
 * @returns {Array<{path:string, source:string, explicit:boolean}>}
 */
export function mediaCandidates(name, { env = process.env, platform = process.platform } = {}) {
  const lower = name.toLowerCase();
  const upper = name.toUpperCase();
  const suffix = exeSuffix(platform);
  const fileName = name + suffix;
  const home = configHome(env);
  const roots = [home, dirname(home)];
  const seen = new Set();
  const out = [];

  const add = (path, source, explicit = false) => {
    if (typeof path !== 'string' || path === '' || seen.has(path)) return;
    seen.add(path);
    out.push({ path, source, explicit });
  };

  // 显式覆盖：即使文件暂时不存在也尊重调用方，便于报出它自己配错的路径。
  for (const key of [`VIDEO_STORYBOARD_${upper}_PATH`, `DSH_${upper}_PATH`, `${upper}_PATH`]) {
    if (env[key]) add(env[key], `env ${key}`, true);
  }
  for (const key of [`VIDEO_STORYBOARD_${upper}_DIR`, `DSH_${upper}_DIR`]) {
    const dir = env[key];
    if (typeof dir === 'string' && dir !== '') add(join(dir, fileName), `env ${key}`);
  }

  for (const root of roots) {
    add(join(root, 'tools', 'ffmpeg', 'bin', fileName), `${root}/tools/ffmpeg/bin`);
    add(join(root, 'bin', fileName), `${root}/bin`);
  }
  return out;
}

/** 返回实际存在的第一个候选；没有则返回 null。 */
export function resolveMediaBinary(name, opts = {}) {
  for (const candidate of mediaCandidates(name, opts)) {
    if (candidate.explicit || existsSync(candidate.path)) return candidate.path;
  }
  return null;
}

/** 给错误信息用的“我试过哪些路径”，不包含任何密钥。 */
export function describeMediaSearch(name, opts = {}) {
  const candidates = mediaCandidates(name, opts);
  if (candidates.length === 0) return `no search paths for ${name}`;
  return `${name} not found; tried: ${candidates.map((c) => `${c.path} [${c.source}]`).join(', ')}; then PATH`;
}

/** 提示里用的变量名（只写新名字；旧名字在文档里列出）。 */
export const FFMPEG_ENV_NAME = envName('ffmpegPath');
export const FFPROBE_ENV_NAME = envName('ffprobePath');

export const DEFAULT_FFMPEG = resolveMediaBinary('ffmpeg') || 'ffmpeg';
export const DEFAULT_FFPROBE = resolveMediaBinary('ffprobe') || 'ffprobe';
