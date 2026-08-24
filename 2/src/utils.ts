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
