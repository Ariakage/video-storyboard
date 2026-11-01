#!/usr/bin/env node
/**
 * install-skill — 把这个仓库装成一个 Agent Skill。
 *
 *   node scripts/install-skill.mjs                # 复制到 ~/.claude/skills/video-storyboard
 *   node scripts/install-skill.mjs --link         # 软链（改代码立即生效）
 *   node scripts/install-skill.mjs --dest DIR     # 装到别的 skills 目录
 *   node scripts/install-skill.mjs --check        # 只检查
 *   node scripts/install-skill.mjs --remove       # 卸载
 *
 * 目标目录必须是一个 skill 根目录（直接含 SKILL.md）。脚本只会删除/覆盖**自己装过**的目录：
 * 目标里没有 SKILL.md 时拒绝操作，除非显式 --force。
 */
import { cp, lstat, mkdir, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(dirname(fileURLToPath(import.meta.url)));
const SKILL_NAME = 'video-storyboard';

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

const mode = has('--remove') ? 'remove'
  : has('--check') ? 'check'
    : 'install';

const skillsRoot = valueOf('--dest')
  || process.env.CLAUDE_SKILLS_DIR
  || join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'skills');
const target = join(resolve(skillsRoot.replace(/^~(?=$|\/)/, homedir())), SKILL_NAME);
const force = has('--force');

const SKIP = new Set(['.git', 'node_modules', 'test', '.tmp', '.DS_Store']);

async function status() {
  const exists = existsSync(target);
  if (!exists) return { exists: false, kind: null, valid: false };
  const st = await lstat(target);
  const kind = st.isSymbolicLink() ? 'link' : 'copy';
  const valid = existsSync(join(target, 'SKILL.md'));
  return { exists: true, kind, valid };
}

async function readFrontmatter(path) {
  try {
    const text = await readFile(join(path, 'SKILL.md'), 'utf8');
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    return m ? m[1].trim().split('\n').slice(0, 4).join('\n') : '(no frontmatter)';
  } catch {
    return '(unreadable)';
  }
}

const s = await status();
if (mode === 'check') {
  console.log(`source: ${HERE}`);
  console.log(`target: ${target}`);
  console.log(s.exists
    ? `installed: yes (${s.kind})${s.valid ? '' : ' — ⚠️ no SKILL.md'}`
    : 'installed: no');
  if (s.exists && s.valid) console.log(`\n${await readFrontmatter(target)}`);
  process.exit(s.exists && s.valid ? 0 : 1);
}

if (mode === 'remove') {
  if (!s.exists) {
    console.log(`not installed: ${target}`);
    process.exit(0);
  }
  if (!s.valid && !force) {
    console.error(`refusing to remove ${target}: it does not contain SKILL.md (use --force if you are sure)`);
    process.exit(1);
  }
  await rm(target, { recursive: true, force: true });
  console.log(`removed ${target}`);
  process.exit(0);
}

// install
if (s.exists && !s.valid && !force) {
  console.error(`refusing to overwrite ${target}: it exists but has no SKILL.md.`);
  console.error('Pick another --dest, remove it yourself, or pass --force.');
  process.exit(1);
}

await mkdir(dirname(target), { recursive: true });
if (s.exists) await rm(target, { recursive: true, force: true });

if (has('--link')) {
  await symlink(HERE, target, 'dir');
  console.log(`linked ${target} → ${HERE}`);
} else {
  await cp(HERE, target, {
    recursive: true,
    dereference: true,
    filter: (src) => !SKIP.has(src.split(/[\\/]/).pop()),
  });
  console.log(`copied ${HERE} → ${target}`);
}

// 清单：装完能立刻看出入口是否完整
const entries = await readdir(target);
const missing = ['SKILL.md', 'bin', 'src', 'references'].filter((name) => !entries.includes(name));
console.log(`\nskill: ${SKILL_NAME}`);
console.log(`entry: ${join(target, 'SKILL.md')}`);
console.log(`bin:   ${join(target, 'bin')}`);
if (missing.length) {
  console.error(`warning: missing ${missing.join(', ')} — install looks incomplete`);
  process.exit(1);
}
console.log('\nRestart the agent session (or start a new one) so the skill index reloads.');
console.log(`Health check: node "${join(target, 'bin', 'doctor.mjs')}"`);
