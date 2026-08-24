/**
 * 常量配置 —— 把所有"魔法数字/字符串"集中管理，
 * 以后想改倍速档位、加分类，只需要改这里。
 */
import type { CategoryConfig, PlayMode } from './types';

/** 分类列表（顺序决定 tab 的排列顺序） */
export const CATEGORIES: readonly CategoryConfig[] = [
  { key: 'music', label: '音乐', dir: 'music', speedEnabled: false },
  { key: 'story', label: '故事', dir: 'story', speedEnabled: true },
];

/** 倍速档位（循环切换顺序） */
export const SPEED_STEPS: readonly number[] = [1.0, 1.25, 1.5, 2.0, 0.8];

/** 播放模式列表（据 key 查 label） */
export const PLAY_MODES: readonly { key: PlayMode; label: string }[] = [
  { key: 'sequence', label: '顺序' },
  { key: 'random', label: '随机' },
  { key: 'loop', label: '单曲' },
];

/** Media Session（锁屏/耳机控制）里展示的信息 */
export const MEDIA_SESSION = {
  artist: '朱青青天天开心',
  album: '青听',
  artwork: 'photos/合照.jpg',
} as const;

/**
 * 照片墙配置 —— 照片与歌曲完全解耦，独立轮播。
 *
 * ✍️ 想加照片？两步：
 *   1. 把照片文件放进 public/photos/ 目录（任意尺寸都行，页面会自动裁切固定尺寸）
 *   2. 在 public/photos/list.json 里加一行文件名，如 "新照片.jpg"
 * （list.json 是运行时接口；这里的 PHOTOS 是代码兜底，通常不需要改）
 */
export const PHOTOS: readonly string[] = [
  'photos/合照.jpg',
  'photos/Q版朱青青.jpg',
  'photos/Q版王羊羊.jpg',
  'photos/王羊羊唱歌.jpg',
  'photos/我的照片1.jpg',
];

/** 照片轮播间隔（毫秒） */
export const CAROUSEL_INTERVAL_MS = 6000;

/**
 * 拍立得默认配文。
 * ✍️ 实际配文在 public/photos/captions.json（「青听管理台」可直接修改），
 * 这里的默认值只在 JSON 缺失或未配置该照片时兜底。
 */
export const DEFAULT_CAPTION = '某个可爱的瞬间 ♡';

/** 站点文案默认值（实际文案在 public/site.json，管理台可改） */
export const SITE_DEFAULTS = {
  title: '青听',
  mark: '· 相册电台',
  sub: '朱青青 ♡ 王羊羊 的稀罕小本子',
  date: '二〇二六 · 冬 ♡',
} as const;

/** 主题色兜底（照片颜色提取失败时使用） */
export const DEFAULT_THEME: readonly [string, string] = ['#e5666d', '#7ea8df'];
