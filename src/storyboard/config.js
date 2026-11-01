/**
 * config.js — 中立的配置与环境变量解析，一处定义、所有模块共用。
 *
 * 从前这些名字都带 DSH_ 前缀（DSH_HOME / DSH_VIDEO_COOKIES / DSH_FFMPEG_PATH …），
 * 因为项目最初只作为 DeepSeek Harness 插件分发。现在它同时是一个通用 Skill，
 * 所以引入 **VIDEO_STORYBOARD_** 前缀，并把旧的 DSH_* 保留成兼容别名 ——
 * 老用户不配置也能继续用，新用户不会被一个空 `~/.dsh` 劫持。
 *
 * 优先级统一为：**显式参数 > 新环境变量 > 旧环境变量 > 配置文件 > 内置默认**。
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** 配置文件目录：新名字优先，旧的 DSH_HOME 仍然认。 */
export const HOME_ENV = 'VIDEO_STORYBOARD_HOME';
export const LEGACY_HOME_ENV = 'DSH_HOME';

/** 配置文件名（video.json / asr.json）。 */
export const VIDEO_CONFIG_FILE = 'video.json';
export const ASR_CONFIG_FILE = 'asr.json';

const userHome = (env) => env.USERPROFILE || env.HOME || homedir();

/**
 * 取第一个非空的环境变量。
 * @returns {{name:string, value:string}|null}
 */
export function envPick(env, ...names) {
  for (const name of names) {
    const value = env?.[name];
    if (value !== undefined && value !== null && value !== '') return { name, value };
  }
  return null;
}

/** 取第一个非空环境变量的值；都没有返回 undefined。 */
export function envValue(env, ...names) {
  return envPick(env, ...names)?.value;
}

/** 布尔环境变量：1 / true / yes 视为开。 */
export function envFlag(env, ...names) {
  const value = envValue(env, ...names);
  return value === '1' || value === 'true' || value === 'yes';
}

/**
 * 配置目录。
 *
 * 顺序：
 * 1. `VIDEO_STORYBOARD_HOME`
 * 2. `DSH_HOME`（旧用户显式设置，照旧）
 * 3. 旧目录 `~/.dsh` —— **只有里面确实有 video.json / asr.json 才用**
 *    （否则一个空目录会把新用户的默认配置顶掉）
 * 4. 新默认 `~/.video-storyboard`
 */
export function configHome(env = process.env) {
  const explicit = envValue(env, HOME_ENV, LEGACY_HOME_ENV);
  if (explicit) return explicit;
  const home = userHome(env);
  const legacy = join(home, '.dsh');
  if (existsSync(join(legacy, VIDEO_CONFIG_FILE)) || existsSync(join(legacy, ASR_CONFIG_FILE))) {
    return legacy;
  }
  return join(home, '.video-storyboard');
}

/** 某个配置文件在磁盘上的路径。 */
export function configPath(name, env = process.env) {
  return join(configHome(env), name);
}

/**
 * 应用数据目录（缓存、临时媒体）。
 * 与配置目录分开：配置要备份，缓存可以随时删。
 */
export function appDir(env = process.env, platform = process.platform) {
  if (platform === 'win32' && env.LOCALAPPDATA) return join(env.LOCALAPPDATA, 'video-storyboard');
  return join(env.XDG_CACHE_HOME || join(userHome(env), '.cache'), 'video-storyboard');
}

/* ------------------------------------------------------------ 具体变量的别名 */

export const ENV = Object.freeze({
  cacheDir: ['VIDEO_STORYBOARD_CACHE_DIR', 'DSH_VIDEO_CACHE_DIR'],
  mediaDir: ['VIDEO_STORYBOARD_MEDIA_DIR', 'DSH_VIDEO_MEDIA_DIR'],
  mediaMaxMb: ['VIDEO_STORYBOARD_MEDIA_MAX_MB', 'DSH_VIDEO_MEDIA_MAX_MB'],
  cookies: ['VIDEO_STORYBOARD_COOKIES', 'DSH_VIDEO_COOKIES'],
  ytdlp: ['VIDEO_STORYBOARD_YTDLP', 'DSH_YTDLP_PATH'],
  debug: ['VIDEO_STORYBOARD_DEBUG', 'DSH_VIDEO_DEBUG'],
  ffmpegPath: ['VIDEO_STORYBOARD_FFMPEG_PATH', 'DSH_FFMPEG_PATH', 'FFMPEG_PATH'],
  ffprobePath: ['VIDEO_STORYBOARD_FFPROBE_PATH', 'DSH_FFPROBE_PATH', 'FFPROBE_PATH'],
  ffmpegDir: ['VIDEO_STORYBOARD_FFMPEG_DIR', 'DSH_FFMPEG_DIR'],
  hwaccel: ['VIDEO_STORYBOARD_HWACCEL', 'DSH_HWACCEL'],
  python: ['VIDEO_STORYBOARD_PYTHON', 'DSH_PYTHON'],
  ocrPython: ['VIDEO_STORYBOARD_OCR_PYTHON', 'DSH_OCR_PYTHON'],
  ocrDebug: ['VIDEO_STORYBOARD_OCR_DEBUG', 'DSH_OCR_DEBUG'],
  asrBaseUrl: ['VIDEO_STORYBOARD_ASR_BASE_URL', 'DSH_ASR_BASE_URL'],
  asrKey: ['VIDEO_STORYBOARD_ASR_KEY', 'DSH_ASR_KEY'],
  asrModel: ['VIDEO_STORYBOARD_ASR_MODEL', 'DSH_ASR_MODEL'],
  asrLang: ['VIDEO_STORYBOARD_ASR_LANG', 'DSH_ASR_LANG'],
  asrTerms: ['VIDEO_STORYBOARD_ASR_TERMS', 'DSH_ASR_TERMS'],
  asrDebug: ['VIDEO_STORYBOARD_ASR_DEBUG', 'DSH_ASR_DEBUG'],
  planDebug: ['VIDEO_STORYBOARD_PLAN_DEBUG', 'DSH_PLAN_DEBUG'],
  browserPort: ['VIDEO_STORYBOARD_BROWSER_PORT', 'DSH_BROWSER_DEBUG_PORT'],
  hwaccelUnknownWarning: ['VIDEO_STORYBOARD_HWACCEL_UNKNOWN', 'DSH_HWACCEL_UNKNOWN'],
  watchPython: ['VIDEO_STORYBOARD_WATCH_PYTHON', 'DSH_WATCH_PYTHON'],
  extractMode: ['VIDEO_STORYBOARD_EXTRACT_MODE', 'DSH_EXTRACT_MODE'],
});

/** 读一个已知变量（用 ENV 里的键）。 */
export function readEnv(key, env = process.env) {
  return envValue(env, ...(ENV[key] ?? [key]));
}

/** 给人看的变量名（提示里只写新名字，旧名字在文档里列一次就够）。 */
export function envName(key) {
  return ENV[key]?.[0] ?? key;
}
