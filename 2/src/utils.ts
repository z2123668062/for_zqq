/**
 * 纯工具函数 —— 不依赖任何状态的函数，方便单独测试。
 */

/** 秒数 → "3:05" 格式 */
export function formatTime(sec: number): string {
  const total = Math.floor(sec || 0);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/** 从路径中取出文件名并去掉扩展名："music/云烟成雨.m4a" → "云烟成雨" */
export function basename(path: string): string {
  // 兼容 / 和 \ 两种分隔符
  let name = path.replace(/^.*[\\/]/, '');
  try {
    name = decodeURIComponent(name);
  } catch {
    /* 名字里有非法编码时保持原样 */
  }
  return name.replace(/\.[^.]+$/, '');
}

/** 尝试以 JSON 读取远端文件，失败返回 null（不抛异常） */
export async function tryJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (res.ok) return (await res.json()) as T;
  } catch {
    /* 网络或解析失败都视为不存在 */
  }
  return null;
}

/** 检查文件是否存在（HEAD 请求） */
export async function fileExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------
 * 播放进度记忆：localStorage 按音频地址分别保存（story/xxx.m4a）
 * 下次打开同一段音频时可"继续播放"。
 * ------------------------------------------------------------------ */

export interface ProgressEntry {
  /** 上次播放位置（秒） */
  t: number;
  /** 当时的音频总时长（秒），用于判断是否接近结尾 */
  d: number;
  /** 曲目名（方便调试） */
  title: string;
  /** 更新时间戳 */
  at: number;
}

const PROGRESS_KEY = 'qingting:progress';

type ProgressStore = Record<string, ProgressEntry>;

/** 读取全部进度（损坏/不存在时返回空对象，不抛错） */
export function readProgress(): ProgressStore {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') as ProgressStore;
  } catch {
    return {};
  }
}

/** 写入单个音频的进度 */
export function writeProgress(src: string, entry: ProgressEntry): void {
  try {
    const store = readProgress();
    store[src] = entry;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(store));
  } catch {
    /* 隐私模式等场景下 localStorage 不可用：静默降级 */
  }
}

/** 删除某个音频的进度（听完后调用） */
export function clearProgress(src: string): void {
  try {
    const store = readProgress();
    delete store[src];
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(store));
  } catch {
    /* 同上：静默降级 */
  }
}
