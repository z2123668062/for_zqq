/**
 * 核心类型定义 —— TypeScript 最精华的部分就在这里。
 * 给数据"规定形状"，编译器就能在写代码时帮你发现错误。
 */

/** 播放模式：顺序 / 随机 / 单曲循环（联合类型：只能取这三个字面量之一） */
export type PlayMode = 'sequence' | 'random' | 'loop';

/** 内容分类：音乐 / 故事 */
export type Category = 'music' | 'story';

/** 一首歌（或一个故事）的最小描述 */
export interface Track {
  /** 相对于页面根目录的音频地址，如 "music/云烟成雨.m4a" */
  src: string;
  /** 展示用标题（由文件名解析出来） */
  title: string;
}

/** 分类的静态配置 */
export interface CategoryConfig {
  key: Category;
  /** tab 上显示的文案 */
  label: string;
  /** 音频所在目录 */
  dir: string;
  /** 该分类是否支持倍速（只有故事支持） */
  speedEnabled: boolean;
}
