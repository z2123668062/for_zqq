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
import { basename, fileExists, tryJson } from './utils';
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
      return;
    }

    audio.load(track.src);
    ui.setTitle(track.title);
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
  ui.onToggle = () => audio.toggle();
  ui.onPrev = async () => {
    if (queue.length === 0) return;
    queue.setIndex(queue.nextIndex(-1));
    await updateSourceAndTitle();
    await audio.play();
  };
  ui.onNext = async () => {
    if (queue.length === 0) return;
    queue.setIndex(queue.nextIndex(1));
    await updateSourceAndTitle();
    await audio.play();
  };
  ui.onPlayIndex = (index) => void playIndex(index);
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

  /* ---- 音频事件 ---- */
  audio.onPlay(() => ui.updatePlayState(true));
  audio.onPause(() => ui.updatePlayState(false));
  audio.onTimeUpdate(() => ui.updateProgress(audio.currentTime, audio.duration));
  audio.onLoadedMetadata(() => ui.updateProgress(0, audio.duration));

  audio.onEnded(async () => {
    if (queue.length === 0) return;
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
