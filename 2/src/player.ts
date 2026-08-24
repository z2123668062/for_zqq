/**
 * 音频播放器封装 —— 把 <audio> 元素包装成带类型的方法，
 * 页面其他代码不再直接操作 audio 属性。
 */
export class AudioPlayer {
  constructor(private readonly audio: HTMLAudioElement) {}

  /** 加载新音频（切歌时调用） */
  load(src: string): void {
    this.audio.src = src;
  }

  /** 播放。浏览器可能拦截自动播放，被拦截时静默忽略 */
  async play(): Promise<void> {
    try {
      await this.audio.play();
    } catch {
      /* 自动播放被浏览器策略拦截：等待用户再次点击 */
    }
  }

  pause(): void {
    this.audio.pause();
  }

  /** 播放 / 暂停切换 */
  toggle(): void {
    if (this.audio.paused) void this.play();
    else this.pause();
  }

  /** 按比例（0~1）跳转进度 */
  seekRatio(ratio: number): void {
    const r = Math.max(0, Math.min(1, ratio));
    if (Number.isFinite(this.audio.duration)) {
      this.audio.currentTime = r * this.audio.duration;
    }
  }

  /** 跳到指定秒数（续播用；时间非法时忽略） */
  seekTo(seconds: number): void {
    if (Number.isFinite(seconds) && seconds >= 0) {
      this.audio.currentTime = seconds;
    }
  }

  /** 设置倍速（1.0 / 1.25 / …） */
  setRate(rate: number): void {
    this.audio.playbackRate = rate;
  }

  get paused(): boolean {
    return this.audio.paused;
  }

  get duration(): number {
    return this.audio.duration;
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  /* ---------- 事件订阅（类型化回调） ---------- */

  onPlay(cb: () => void): void {
    this.audio.addEventListener('play', cb);
  }

  onPause(cb: () => void): void {
    this.audio.addEventListener('pause', cb);
  }

  onTimeUpdate(cb: () => void): void {
    this.audio.addEventListener('timeupdate', cb);
  }

  onLoadedMetadata(cb: () => void): void {
    this.audio.addEventListener('loadedmetadata', cb);
  }

  onEnded(cb: () => void): void {
    this.audio.addEventListener('ended', cb);
  }

  onError(cb: () => void): void {
    this.audio.addEventListener('error', cb);
  }
}
