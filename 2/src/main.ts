/**
 * 入口 —— 装配所有模块：加载歌单 → 接线事件 → 启动。
 *
 * 数据流向：
 *   歌单加载(utils) → PlaybackQueue(状态) → AudioPlayer(播放)
 *        ↑                                    ↓
 *    用户点击                                 事件回调
 *        ↓                                    ↓
 *      PlayerUI(界面渲染) ←———— main.ts(编排)
 */
import './styles.css';
import { CATEGORIES, PHOTOS, PLAY_MODES, SPEED_STEPS } from './config';
import { PlaybackQueue } from './queue';
import { AudioPlayer } from './player';
import { PlayerUI } from './ui';
import { basename, clearProgress, fileExists, readProgress, tryJson, writeProgress } from './utils';
import type { Category, Track } from './types';

/* ------------------------------------------------------------------
 * 照片墙加载：优先 photos/list.json（方便随时加照片），
 * 文件缺失时回落代码里的 PHOTOS 配置
 * ------------------------------------------------------------------ */
async function loadPhotos(): Promise<string[]> {
  const json = await tryJson<unknown>('photos/list.json');
  if (Array.isArray(json) && json.length > 0) {
    const names = json.filter((item): item is string => typeof item === 'string');
    if (names.length > 0) return names.map((n) => `photos/${n}`);
  }
  return [...PHOTOS];
}

/* ------------------------------------------------------------------
 * 歌单加载：优先 playlist.json，缺失时对音乐做数字文件名探测
 * ------------------------------------------------------------------ */
async function buildPlaylist(dir: string): Promise<Track[]> {
  const json = await tryJson<unknown>(`${dir}/playlist.json`);

  if (Array.isArray(json) && json.length > 0) {
    return json
      .filter((item): item is string => typeof item === 'string')
      .map((name) => {
        const src = name.startsWith(`${dir}/`) ? name : `${dir}/${name}`;
        return { src, title: basename(name) };
      });
  }

  // 旧版兼容：没有 playlist.json 时探测 music/1.m4a ~ music/20.m4a
  if (dir === 'music') {
    const found: Track[] = [];
    for (let i = 1; i <= 20; i += 1) {
      const src = `music/${i}.m4a`;
      if (await fileExists(src)) found.push({ src, title: basename(src) });
    }
    return found;
  }

  return [];
}

/* ------------------------------------------------------------------
 * 主流程
 * ------------------------------------------------------------------ */
function boot(): void {
  const ui = new PlayerUI();
  const audio = new AudioPlayer(ui.audioEl);
  const queue = new PlaybackQueue();

  let currentCategory: Category = 'music';
  let selectedSpeed = 1.0;
  let lastUserActionAt = 0;
  let pendingResume = 0; // 当前曲目可续播的秒数（0 = 无）
  let lastSaveAt = 0;
  /** 播放进度记忆（localStorage），按音频地址分别存储 */
  const progressMap = readProgress();

  /** 用户连续操作（点击切歌）间隔不足 200ms 时忽略，防止 iOS 快速换源导致的卡顿 */
  const tooSoon = (): boolean => {
    const now = Date.now();
    if (now - lastUserActionAt < 200) return true;
    lastUserActionAt = now;
    return false;
  };

  /**
   * 隐藏预载器：提前把"下一首"缓存进浏览器，
   * 切歌时无需现场下载，明显减少卡顿/等待。
   * 故事文件很大（21MB+），只预载 metadata。
   */
  const preloader = new Audio();
  const preloadNext = (src: string, heavy: boolean): void => {
    if (!src || preloader.src === src) return;
    preloader.preload = heavy ? 'auto' : 'metadata';
    preloader.src = src;
    preloader.load();
  };

  const categoryConfig = (cat: Category) =>
    CATEGORIES.find((c) => c.key === cat) ?? CATEGORIES[0];

  /* ---- 切歌核心：更新音频源 + 标题 + 倍速 + 列表高亮 ---- */
  async function updateSourceAndTitle(): Promise<void> {
    const track = queue.current;
    const cat = categoryConfig(currentCategory);

    if (!track) {
      ui.setTitle(cat.speedEnabled ? '未找到故事' : '未找到歌曲');
      ui.setControlsEnabled(false);
      ui.updatePlayState(false);
      ui.showResume(0);
      return;
    }

    // 轻微防抖：连点"下一首"不重复触发切歌（iOS 上快速换源会卡）
    audio.load(track.src);
    ui.setTitle(track.title);
    // 续播判断：听过 ≥10 秒、且离结尾还有 ≥10 秒 → 显示"继续播放"
    const saved = progressMap[track.src];
    pendingResume = saved && saved.t >= 10 && saved.d - saved.t > 10 ? saved.t : 0;
    ui.showResume(pendingResume);
    // 预载下一首（故事分类只读 metadata，避免抢占流量）
    const nextTrack = queue.playlist[queue.nextIndex(1)];
    preloadNext(nextTrack?.src ?? '', cat.speedEnabled);
    // 倍速只在故事分类生效，音乐恒为 1.0（与旧版一致）
    audio.setRate(cat.speedEnabled ? selectedSpeed : 1.0);
    ui.updateSpeed(selectedSpeed, cat.speedEnabled);
    ui.activateSong(queue.currentIndex);
    ui.updateMediaSession(track);
  }

  /* ---- 播放指定索引 ---- */
  async function playIndex(index: number): Promise<void> {
    queue.setIndex(index);
    await updateSourceAndTitle();
    await audio.play();
  }

  /* ---- 切换分类 ---- */
  function switchCategory(category: Category): void {
    currentCategory = category;

    queue.setTracks(playlists[category]);
    ui.updateCategoryTabs(category);
    ui.renderPlaylist(playlists[category], 0);
    void updateSourceAndTitle();
  }

  /* ---- 歌单数据（模块级，boot 内闭包携带） ---- */
  const playlists: Record<Category, Track[]> = { music: [], story: [] };

  /* ---- 界面回调接线 ---- */
  ui.onToggle = () => {
    if (tooSoon()) return;
    audio.toggle();
  };
  ui.onPrev = async () => {
    if (queue.length === 0 || tooSoon()) return;
    queue.setIndex(queue.nextIndex(-1));
    await updateSourceAndTitle();
    await audio.play();
  };
  ui.onNext = async () => {
    if (queue.length === 0 || tooSoon()) return;
    queue.setIndex(queue.nextIndex(1));
    await updateSourceAndTitle();
    await audio.play();
  };
  ui.onPlayIndex = (index) => {
    if (tooSoon()) return;
    void playIndex(index); // 点击当前歌曲 = 从头重播（与旧版一致）
  };
  ui.onSeekRatio = (ratio) => audio.seekRatio(ratio);
  ui.onModeCycle = () => {
    const currentIdx = PLAY_MODES.findIndex((m) => m.key === queue.playMode);
    const next = PLAY_MODES[(currentIdx + 1) % PLAY_MODES.length];
    queue.setMode(next.key);
    ui.updateMode(next.key, next.label);
  };
  ui.onSpeedCycle = () => {
    const idx = SPEED_STEPS.indexOf(selectedSpeed);
    selectedSpeed = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    if (categoryConfig(currentCategory).speedEnabled) {
      audio.setRate(selectedSpeed);
    }
    ui.updateSpeed(selectedSpeed, categoryConfig(currentCategory).speedEnabled);
  };
  ui.onCategory = (category) => {
    if (category !== currentCategory) switchCategory(category);
  };
  ui.onResume = () => {
    if (pendingResume <= 0) return;
    audio.seekTo(pendingResume);
    void audio.play();
  };

  /* ---- 进度记忆：节流保存 + 暂停/退出时即时保存 + 听完清档 ---- */
  const saveProgress = (): void => {
    const track = queue.current;
    if (!track || audio.duration <= 0 || audio.currentTime < 1) return;
    writeProgress(track.src, {
      t: audio.currentTime,
      d: audio.duration,
      title: track.title,
      at: Date.now(),
    });
  };

  /* ---- 音频事件 ---- */
  audio.onPlay(() => ui.updatePlayState(true));
  audio.onPause(() => {
    ui.updatePlayState(false);
    saveProgress();
  });
  audio.onTimeUpdate(() => {
    ui.updateProgress(audio.currentTime, audio.duration);
    const now = Date.now();
    if (now - lastSaveAt > 4000) {
      lastSaveAt = now;
      saveProgress();
    }
  });
  audio.onLoadedMetadata(() => ui.updateProgress(0, audio.duration));

  // 退出/切后台时也保存一次，保证"听完一半关掉"也能续
  window.addEventListener('pagehide', saveProgress);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveProgress();
  });

  audio.onEnded(async () => {
    if (queue.length === 0) return;
    // 听完整段：清掉进度记忆
    if (queue.current) {
      clearProgress(queue.current.src);
      pendingResume = 0;
      ui.showResume(0);
    }
    const next = queue.onEndedNext();
    if (next === queue.currentIndex) {
      // 单曲循环：重播本曲
      audio.seekRatio(0);
      await audio.play();
    } else {
      queue.setIndex(next);
      await updateSourceAndTitle();
      await audio.play();
    }
  });

  audio.onError(() => {
    // 播放失败只记录，不做自动跳过（避免坏文件无限循环）
    console.warn('音频播放失败:', queue.current?.src ?? '(无曲目)');
  });

  /* ---- 锁屏/耳机控制 ---- */
  ui.setMediaHandlers({
    play: () => void audio.play(),
    pause: () => audio.pause(),
    prev: () => ui.onPrev(),
    next: () => ui.onNext(),
  });

  /* ---- 页面宠物：点击冒爱心 ---- */
  for (const pet of [document.getElementById('petLeft'), document.getElementById('petRight')]) {
    pet?.addEventListener('click', () => {
      pet.classList.remove('pop');
      void (pet as HTMLElement).offsetWidth; // 重新触发动画
      pet.classList.add('pop');
    });
  }

  /* ---- 初始化：并行加载两个分类的歌单 ---- */
  void (async () => {
    try {
      const [musicList, storyList] = await Promise.all([
        buildPlaylist('music'),
        buildPlaylist('story'),
      ]);
      playlists.music = musicList;
      playlists.story = storyList;

      // 启动照片轮播（与歌曲解耦）
      ui.setPhotos(await loadPhotos());

      if (musicList.length === 0 && storyList.length === 0) {
        ui.setTitle('未找到音乐或故事');
        ui.setEmptyTip('未找到内容');
        ui.setControlsEnabled(false);
        return;
      }

      ui.updateMode(queue.playMode, PLAY_MODES.find((m) => m.key === queue.playMode)?.label ?? '顺序');
      switchCategory('music');
    } catch (err) {
      console.error('初始化失败:', err);
      ui.setTitle('初始化失败');
      ui.setControlsEnabled(false);
    }
  })();
}

boot();
