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
 * 拍立得的手写配文（按文件名匹配，没配的用默认文案）。
 * 想写点甜言蜜语就改这里 ♡
 */
export const PHOTO_CAPTIONS: Record<string, string> = {
  合照: '奶茶店猫耳那天 ♡',
  微信图片_20260824122659_2531_1: '脸被橙子茶抢走了',
  Q版朱青青: '朱青青 · 王羊羊 ♡',
  王羊羊唱歌: 'KTV 深情献唱',
  微信图片_20260824122700_2532_1: '饿到想变成小狗',
  Q版王羊羊: '王羊羊 · 朱青青 ♡',
  我的照片1: '唱到忘我',
};

/** 拍立得默认配文 */
export const DEFAULT_CAPTION = '某个可爱的瞬间 ♡';

/** 主题色兜底（照片颜色提取失败时使用） */
export const DEFAULT_THEME: readonly [string, string] = ['#e5666d', '#7ea8df'];
