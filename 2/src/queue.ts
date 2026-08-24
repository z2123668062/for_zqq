/**
 * 播放队列 —— 集中管理"当前是哪一首"和"下一首是哪一首"，
 * 三种模式（顺序/随机/单曲）的细节逻辑都封在这里。
 */
import type { PlayMode, Track } from './types';

export class PlaybackQueue {
  private tracks: Track[] = [];
  private index = 0;

  constructor(private mode: PlayMode = 'sequence') {}

  get current(): Track | undefined {
    return this.tracks[this.index];
  }

  /** 只读歌单（供预加载下一首等使用） */
  get playlist(): readonly Track[] {
    return this.tracks;
  }

  get currentIndex(): number {
    return this.index;
  }

  get length(): number {
    return this.tracks.length;
  }

  get playMode(): PlayMode {
    return this.mode;
  }

  /** 切换歌单（分类切换 / 重新加载时调用），重置到第一首 */
  setTracks(tracks: Track[]): void {
    this.tracks = tracks;
    this.index = 0;
  }

  setMode(mode: PlayMode): void {
    this.mode = mode;
  }

  /** 跳转到指定索引（仅当索引合法） */
  setIndex(i: number): void {
    if (i >= 0 && i < this.tracks.length) this.index = i;
  }

  /**
   * 手动切歌时计算下一首的索引。
   * direction: 1 = 下一首，-1 = 上一首。
   * 注意：与旧版行为保持一致 —— 单曲循环模式下"手动切歌"依然顺序切换，
   * 只有"自然播放结束"才重播本曲（见 onEndedNext）。
   */
  nextIndex(direction: 1 | -1): number {
    if (this.tracks.length === 0) return 0;

    if (this.mode === 'random') {
      // 随机模式：简单防重复（歌不止一首时，不和当前重复）
      if (this.tracks.length === 1) return this.index;
      let n = this.index;
      while (n === this.index) {
        n = Math.floor(Math.random() * this.tracks.length);
      }
      return n;
    }

    // 顺序 / 单曲循环：手动切歌都按顺序滑
    return (this.index + direction + this.tracks.length) % this.tracks.length;
  }

  /** 一首歌自然播完后的去向：单曲循环重播本曲，否则切下一首 */
  onEndedNext(): number {
    if (this.mode === 'loop') return this.index;
    return this.nextIndex(1);
  }
}
