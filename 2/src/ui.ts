/**
 * 界面层 —— 所有 DOM 操作集中在这里，播放逻辑在 queue/player 中。
 * 通过回调把"用户点了一下"交给 main.ts 处理，UI 本身不持有业务逻辑。
 */
import {
  CAROUSEL_INTERVAL_MS,
  DEFAULT_CAPTION,
  DEFAULT_THEME,
  MEDIA_SESSION,
  PHOTO_CAPTIONS,
} from './config';
import { basename, formatTime } from './utils';
import type { Category, PlayMode, Track } from './types';

/** 类型化 DOM 查询：元素不存在直接抛错，避免运行期 null 错误 */
function must<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`页面缺少元素: ${selector}`);
  return el;
}

/** 三种播放模式的图标（SVG 字符串，stroke 跟随文字颜色） */
const MODE_ICONS: Record<PlayMode, string> = {
  // 顺序：循环箭头
  sequence: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  // 随机：洗牌
  random: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>`,
  // 单曲：循环箭头 + 1
  loop: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/></svg>`,
};

export interface MediaHandlers {
  play(): void;
  pause(): void;
  prev(): void;
  next(): void;
}

export class PlayerUI {
  readonly audioEl: HTMLAudioElement;

  /* 界面回调：由 main.ts 赋值 */
  onPlayIndex: (index: number) => void = () => {};
  onPrev: () => void = () => {};
  onNext: () => void = () => {};
  onToggle: () => void = () => {};
  onSeekRatio: (ratio: number) => void = () => {};
  onModeCycle: () => void = () => {};
  onSpeedCycle: () => void = () => {};
  onCategory: (category: Category) => void = () => {};
  /** 点击"继续播放"小纸片 */
  onResume: () => void = () => {};

  /* 手账元素 */
  private readonly songListEl: HTMLUListElement;
  private readonly titleEl: HTMLElement;
  private readonly currentTimeEl: HTMLElement;
  private readonly durationEl: HTMLElement;
  private readonly progressBar: HTMLElement;
  private readonly progressInner: HTMLElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly iconPlay: SVGElement;
  private readonly iconPause: SVGElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;
  private readonly modeBtn: HTMLButtonElement;
  private readonly modeIcon: HTMLElement;
  private readonly modeLabel: HTMLElement;
  private readonly speedBtn: HTMLButtonElement;
  private readonly speedLabel: HTMLElement;
  private readonly resumeChip: HTMLButtonElement;
  private readonly resumeTime: HTMLElement;
  private readonly cassette: HTMLElement;
  private readonly photoDeck: HTMLElement;
  private readonly photoDots: HTMLElement;
  private readonly tabMusic: HTMLButtonElement;
  private readonly tabStory: HTMLButtonElement;

  /* 照片墙状态 */
  private photos: string[] = [];
  private photoIndex = 0;
  private timer = 0;
  private scrollTimer = 0;
  private cards: HTMLElement[] = [];
  private suppressClick = false;

  constructor() {
    this.audioEl = must<HTMLAudioElement>('#audio');
    this.songListEl = must<HTMLUListElement>('#songList');
    this.titleEl = must<HTMLElement>('#title');
    this.currentTimeEl = must<HTMLElement>('#currentTime');
    this.durationEl = must<HTMLElement>('#duration');
    this.progressBar = must<HTMLElement>('#progressBar');
    this.progressInner = must<HTMLElement>('#progressInner');
    this.playBtn = must<HTMLButtonElement>('#playPause');
    this.iconPlay = must<SVGElement>('#iconPlay');
    this.iconPause = must<SVGElement>('#iconPause');
    this.prevBtn = must<HTMLButtonElement>('#prev');
    this.nextBtn = must<HTMLButtonElement>('#next');
    this.modeBtn = must<HTMLButtonElement>('#modeBtn');
    this.modeIcon = must<HTMLElement>('#modeIcon');
    this.modeLabel = must<HTMLElement>('#modeLabel');
    this.speedBtn = must<HTMLButtonElement>('#speedBtn');
    this.speedLabel = must<HTMLElement>('#speedLabel');
    this.resumeChip = must<HTMLButtonElement>('#resumeChip');
    this.resumeTime = must<HTMLElement>('#resumeTime');
    this.cassette = must<HTMLElement>('#cassette');
    this.photoDeck = must<HTMLElement>('#photoDeck');
    this.photoDots = must<HTMLElement>('#photoDots');
    this.tabMusic = must<HTMLButtonElement>('#tabMusic');
    this.tabStory = must<HTMLButtonElement>('#tabStory');

    this.wireEvents();
  }

  /** 绑定界面事件（事件委托到列表上，避免为每首歌单独挂监听） */
  private wireEvents(): void {
    this.songListEl.addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest('li[data-index]');
      if (!li) return;
      this.onPlayIndex(Number(li.getAttribute('data-index')));
    });

    this.playBtn.addEventListener('click', () => this.onToggle());
    this.prevBtn.addEventListener('click', () => this.onPrev());
    this.nextBtn.addEventListener('click', () => this.onNext());
    this.modeBtn.addEventListener('click', () => this.onModeCycle());
    this.speedBtn.addEventListener('click', () => this.onSpeedCycle());
    this.tabMusic.addEventListener('click', () => this.onCategory('music'));
    this.tabStory.addEventListener('click', () => this.onCategory('story'));

    this.progressBar.addEventListener('click', (e) => {
      const rect = this.progressBar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.onSeekRatio(ratio);
    });

    this.resumeChip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onResume();
    });

    /* ---- 拍立得：手机横滑条 → 滚动同步；桌面扇形 → 点击/拖动 ---- */
    const isStrip = () => window.matchMedia('(max-width: 900px)').matches;

    this.photoDeck.addEventListener('click', (e) => {
      if (this.suppressClick) {
        this.suppressClick = false;
        return;
      }
      const card = (e.target as HTMLElement).closest<HTMLElement>('.polaroid');
      if (card) {
        const idx = this.cards.indexOf(card);
        if (idx >= 0) {
          this.photoIndex = idx;
          if (isStrip()) this.scrollToCard(idx);
          this.applyPhoto();
          this.startCarousel();
          return;
        }
      }
      this.nextPhoto();
    });

    // 手机横滑条：手动滑动时暂停自动轮播，2.5 秒无操作后恢复
    this.photoDeck.addEventListener(
      'pointerdown',
      () => {
        if (!isStrip()) return;
        window.clearInterval(this.timer);
        window.setTimeout(() => this.startCarousel(), 2500);
      },
      { passive: true },
    );

    // 手机横滑条：滚动位置 → 当前照片索引
    this.photoDeck.addEventListener(
      'scroll',
      () => {
        if (!isStrip()) return;
        window.clearTimeout(this.scrollTimer);
        this.scrollTimer = window.setTimeout(() => {
          const step = this.cards[0]?.offsetWidth ?? 0;
          if (!step || this.cards.length === 0) return;
          const idx = Math.max(
            0,
            Math.min(
              this.cards.length - 1,
              Math.round(this.photoDeck.scrollLeft / (step + 14)),
            ),
          );
          if (idx !== this.photoIndex) {
            this.photoIndex = idx;
            this.applyPhoto();
            this.startCarousel();
          }
        }, 120);
      },
      { passive: true },
    );

    /* ---- 拍立得：拖动玩一下（仅桌面扇形，手机交给原生滑动） ---- */
    this.photoDeck.addEventListener('pointerdown', (e) => {
      if (isStrip() || e.button !== 0) return;
      const card = (e.target as HTMLElement).closest<HTMLElement>('.polaroid');
      if (!card) return;

      let dx = 0;
      let dy = 0;
      let moved = false;
      card.classList.add('dragging');
      card.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        dx = ev.clientX - e.clientX;
        dy = ev.clientY - e.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        card.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${dx * 0.02}deg) scale(1.03)`;
      };
      const onUp = () => {
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerup', onUp);
        card.classList.remove('dragging');
        if (moved) {
          this.suppressClick = true;
          this.applyPhoto(); // 松手后弹回扇面
          setTimeout(() => {
            this.suppressClick = false;
          }, 60);
        }
      };
      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerup', onUp);
    });
  }

  /* ---------- 歌单 ---------- */

  /** 渲染整份歌单 */
  renderPlaylist(tracks: readonly Track[], activeIndex: number): void {
    this.songListEl.replaceChildren();
    if (tracks.length === 0) {
      this.setEmptyTip('暂无内容');
      return;
    }
    const frag = document.createDocumentFragment();
    tracks.forEach((track, i) => {
      const li = document.createElement('li');
      li.dataset.index = String(i);
      if (i === activeIndex) li.classList.add('active');

      const name = document.createElement('span');
      name.className = 'song-name';
      name.textContent = track.title;

      // 正在播放的小均衡器
      const eq = document.createElement('span');
      eq.className = 'eq';
      eq.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));

      li.append(name, eq);
      frag.append(li);
    });
    this.songListEl.append(frag);
  }

  /** 高亮当前曲目并滚动到可见位置 */
  activateSong(index: number): void {
    const items = this.songListEl.querySelectorAll<HTMLLIElement>('li[data-index]');
    items.forEach((item, i) => item.classList.toggle('active', i === index));
    const target = items[index];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  setEmptyTip(text: string): void {
    const li = document.createElement('li');
    li.className = 'empty-tip';
    li.textContent = text;
    this.songListEl.replaceChildren(li);
  }

  /* ---------- 卡带状态 ---------- */

  /** 标题 + 浏览器标签页标题 */
  setTitle(title: string): void {
    this.titleEl.textContent = title;
    document.title = title ? `${title} · 青听` : '青听 · 相册电台';
  }

  /** 播放/暂停状态：按钮图标、虚线圈、卡带转轮联动 */
  updatePlayState(playing: boolean): void {
    this.iconPlay.style.display = playing ? 'none' : '';
    this.iconPause.style.display = playing ? '' : 'none';
    this.playBtn.classList.toggle('playing', playing);
    this.cassette.classList.toggle('playing', playing);
  }

  updateMode(mode: PlayMode, label: string): void {
    this.modeIcon.innerHTML = MODE_ICONS[mode];
    this.modeLabel.textContent = label;
  }

  /** visible 控制倍速按钮显隐（仅故事分类可见） */
  updateSpeed(rate: number, visible: boolean): void {
    this.speedBtn.style.display = visible ? '' : 'none';
    this.speedLabel.textContent = `${rate.toFixed(2).replace(/\.00$/, '')}x`;
  }

  updateCategoryTabs(category: Category): void {
    this.tabMusic.classList.toggle('active', category === 'music');
    this.tabStory.classList.toggle('active', category === 'story');
  }

  /**
   * 显示/隐藏"继续播放"小纸片。
   * @param seconds 上次听到的秒数（<=0 时隐藏）
   */
  showResume(seconds: number): void {
    this.resumeChip.hidden = seconds <= 0;
    if (seconds > 0) this.resumeTime.textContent = formatTime(seconds);
  }

  setControlsEnabled(enabled: boolean): void {
    this.playBtn.disabled = !enabled;
    this.nextBtn.disabled = !enabled;
  }

  /* ---------- 进度条 ---------- */

  updateProgress(current: number, duration: number): void {
    const pct = duration > 0 ? (current / duration) * 100 : 0;
    this.progressInner.style.width = `${pct}%`;
    this.currentTimeEl.textContent = formatTime(current);
    if (duration > 0) this.durationEl.textContent = formatTime(duration);
  }

  /* ---------- 拍立得相册（与歌曲解耦） ---------- */

  /**
   * 设置照片列表并启动轮播。
   * 点卡片聚焦、点空白翻页、拖动松手归位；
   * 每张照片的配文来自 PHOTO_CAPTIONS（手账手写风）。
   */
  setPhotos(photos: readonly string[]): void {
    if (photos.length === 0) return;
    this.photos = [...photos];
    this.photoIndex = 0;
    this.buildCards();
    this.buildDots();
    this.applyPhoto();
    this.startCarousel();
  }

  private startCarousel(): void {
    window.clearInterval(this.timer);
    if (this.photos.length > 1) {
      this.timer = window.setInterval(() => this.nextPhoto(), CAROUSEL_INTERVAL_MS);
    }
  }

  private nextPhoto(): void {
    if (this.photos.length === 0) return;
    this.photoIndex = (this.photoIndex + 1) % this.photos.length;
    if (window.matchMedia('(max-width: 900px)').matches) {
      this.scrollToCard(this.photoIndex);
    }
    this.applyPhoto();
  }

  /** 手机横滑条：把指定卡片平滑滚到中间 */
  private scrollToCard(index: number): void {
    const card = this.cards[index];
    if (card) card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  /** 生成拍立得卡片 */
  private buildCards(): void {
    this.photoDeck.querySelectorAll('.polaroid').forEach((el) => el.remove());
    this.cards = this.photos.map((src, i) => {
      const card = document.createElement('figure');
      card.className = 'polaroid';

      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      // 懒加载：前 2 张优先，其余滑到时再下（手机上首屏更快）
      img.loading = i < 2 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.width = 156;
      img.height = 150;
      // 加载完成后停掉骨架屏微光动画（省电 + 减少播放时的合成器开销）
      img.addEventListener('load', () => img.classList.add('loaded'), { once: true });

      const caption = document.createElement('figcaption');
      caption.textContent = PHOTO_CAPTIONS[basename(src)] ?? DEFAULT_CAPTION;

      const tape = document.createElement('i');
      tape.className = 'polaroid-tape';

      card.append(img, caption, tape);
      card.style.zIndex = String(10);
      this.photoDeck.append(card);
      return card;
    });
  }

  /** 扇形排布（桌面）/ 滚动条（手机）：当前照片置前，其余围绕展开 */
  private applyPhoto(): void {
    if (window.matchMedia('(max-width: 900px)').matches) {
      // 手机：位置由 CSS 滚动决定，这里只同步状态与主题色
      void this.extractPalette(this.photos[this.photoIndex]);
      this.updateDots();
      return;
    }
    this.cards.forEach((card, i) => {
      const off = i - this.photoIndex;
      const dist = Math.abs(off);
      card.style.transform = `translate(-50%, -50%) translateX(${off * 38}px) translateY(${dist * 6}px) rotate(${off * 11}deg) scale(${dist === 0 ? 1 : 0.86})`;
      card.style.zIndex = String(100 - dist);
      card.style.opacity = dist > 2 ? '0' : String(1 - dist * 0.16);
      card.classList.toggle('active', dist === 0);
    });
    // 主题色（马克笔颜色）跟随照片
    void this.extractPalette(this.photos[this.photoIndex]);
    this.updateDots();
  }

  /** 圆点指示器 */
  private buildDots(): void {
    this.photoDots.replaceChildren();
    this.photos.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.photoIndex = i;
        this.applyPhoto();
        this.startCarousel(); // 手动切换后重新计时
      });
      this.photoDots.append(dot);
    });
  }

  private updateDots(): void {
    const dots = this.photoDots.children;
    for (let i = 0; i < dots.length; i += 1) {
      dots[i].classList.toggle('active', i === this.photoIndex);
    }
  }

  /** 从照片中提取两个主色（饱和度加权的简化直方图），写入 CSS 变量 */
  private async extractPalette(src: string): Promise<void> {
    const [c1, c2] = await this.computePalette(src);
    const root = document.documentElement.style;
    root.setProperty('--accent-1', c1);
    root.setProperty('--accent-2', c2);
  }

  private computePalette(src: string): Promise<readonly [string, string]> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const size = 24;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(DEFAULT_THEME);
            return;
          }
          ctx.drawImage(img, 0, 0, size, size);
          const { data } = ctx.getImageData(0, 0, size, size);

          // 按"颜色桶"聚合，饱和度高的像素权重更大 → 马克笔颜色更鲜亮
          const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (data[i + 3] < 128) continue;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            if (max < 30) continue; // 丢弃过暗像素
            const sat = max === 0 ? 0 : (max - min) / max;
            const w = 0.5 + sat * 1.8;
            const key = `${r >> 4},${g >> 4},${b >> 4}`;
            const bkt = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
            bkt.r += r * w;
            bkt.g += g * w;
            bkt.b += b * w;
            bkt.n += w;
            buckets.set(key, bkt);
          }
          const top = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 2);

          // 与品牌色（珊瑚红 + 雾蓝）按比例混合，保证任何照片下手账都好看
          const mix = (
            b: { r: number; g: number; b: number; n: number } | undefined,
            def: readonly [number, number, number],
            t: number,
          ) => {
            const br = b ? b.r / b.n : def[0];
            const bg = b ? b.g / b.n : def[1];
            const bb = b ? b.b / b.n : def[2];
            return `rgb(${Math.round(br * (1 - t) + def[0] * t)}, ${Math.round(
              bg * (1 - t) + def[1] * t,
            )}, ${Math.round(bb * (1 - t) + def[2] * t)})`;
          };
          const BRAND_1 = [229, 102, 109] as const; // 珊瑚红
          const BRAND_2 = [126, 168, 223] as const; // 雾蓝
          resolve([mix(top[0], BRAND_1, 0.45), mix(top[1], BRAND_2, 0.45)]);
        } catch {
          resolve(DEFAULT_THEME);
        }
      };
      img.onerror = () => resolve(DEFAULT_THEME);
      img.src = src;
    });
  }

  /* ---------- 系统媒体控制（锁屏/耳机） ---------- */

  setMediaHandlers(handlers: MediaHandlers): void {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => handlers.play());
    navigator.mediaSession.setActionHandler('pause', () => handlers.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => handlers.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => handlers.next());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime === undefined) return;
      if (details.fastSeek && 'fastSeek' in this.audioEl) {
        this.audioEl.fastSeek(details.seekTime);
      } else {
        this.audioEl.currentTime = details.seekTime;
      }
    });
  }

  updateMediaSession(track: Track): void {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: MEDIA_SESSION.artist,
      album: MEDIA_SESSION.album,
      artwork: [
        {
          src: new URL(MEDIA_SESSION.artwork, location.href).href,
          sizes: '512x512',
          type: 'image/jpeg',
        },
      ],
    });
  }
}
