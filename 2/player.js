(async function(){
  // 获取 DOM 元素
  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('playPause');
  const nextBtn = document.getElementById('next');
  const prevBtn = document.getElementById('prev');
  const modeBtn = document.getElementById('modeBtn');
  const speedBtn = document.getElementById('speedBtn');
  const tabMusic = document.getElementById('tabMusic');
  const tabStory = document.getElementById('tabStory');
  const titleEl = document.getElementById('title');
  const songListEl = document.getElementById('songList');
  const coverImg = document.querySelector('.cover-img'); // 获取封面图

  // 状态变量
  const playlists = { music: [], story: [] };
  let currentCategory = 'music';
  let currentPlaylist = [];
  let idx = 0;
  let playbackRate = 1.0;
  // 播放模式: 'sequence' (顺序), 'loop' (单曲), 'random' (随机)
  let playMode = 'sequence'; 

  // 工具函数：设置标题
  function setTitle(t){ 
    titleEl.textContent = t || '';
    // 移动端/以及浏览器标题也更新一下
    document.title = (t ? t + ' - ' : '') + '简单音乐播放器';
  }

  // 工具函数：从路径解析文件名（并去除扩展名）
  function basename(path){
    let name = path.replace(/^.*\//, '');
    try{ name = decodeURIComponent(name); }catch(e){}
    return name.replace(/\.[^.]+$/, '');
  }

  // 工具函数：尝试获取 JSON
  async function tryJson(p){
    try{ const r = await fetch(p); if(r.ok) return await r.json(); }catch(e){ console.error('Fetch json failed:', e); }
    return null;
  }

  // 工具函数：检查文件是否存在（用于数字文件 fallback）
  async function fileExists(p){
    try{ const r = await fetch(p, {method:'HEAD'}); return r.ok; }catch(e){return false}
  }

  // 构建播放列表
  async function buildPlaylist(baseDir){
    // 优先使用 baseDir/playlist.json
    const json = await tryJson(`${baseDir}/playlist.json`);
    if(Array.isArray(json) && json.length){
        return json.map(s=> s.startsWith(baseDir+'/')? s : baseDir + '/' + s);
    }

    // Fallback: 仅对音乐做数字探测
    if(baseDir === 'music'){
      console.log('playlist.json not found or empty, trying numeric fallback...');
      const found = [];
      for(let i=1;i<=20;i++){
        const p = `music/${i}.m4a`;
        if(await fileExists(p)) found.push(p);
      }
      return found;
    }
    return [];
  }

    // 渲染左侧歌单任务3
    function renderPlaylist(){
      if(!songListEl) return;
      songListEl.innerHTML = ''; // 清空
      if(!currentPlaylist.length){
        songListEl.innerHTML = '<li class="empty-tip">暂无内容</li>';
        return;
      }

      currentPlaylist.forEach((src, i) => {
        const li = document.createElement('li');
        li.textContent = basename(src);
        li.dataset.index = i;
        li.addEventListener('click', () => {
          playIndex(i);
        });
        songListEl.appendChild(li);
      });
      updateActiveSongInList();
    }

  // 高亮当前播放的歌曲
    function updateActiveSongInList(){
      if(!songListEl) return;
      const items = songListEl.querySelectorAll('li');
      items.forEach((item, i) => {
        if(i === idx) item.classList.add('active');
        else item.classList.remove('active');
      });
      if(items[idx]){
        items[idx].scrollIntoView({behavior: 'smooth', block: 'nearest'});
      }
    }

  // 切换到指定索引播放
    async function playIndex(i){
      if(i < 0 || i >= currentPlaylist.length) return;
      idx = i;
      await updateSourceAndTitle();
      try{ await audio.play(); }catch(e){ console.error(e); }
    }

  // 更新 Media Session Metadata
    function updateMediaSession() {
      if ('mediaSession' in navigator && currentPlaylist.length) {
        const title = basename(currentPlaylist[idx]);
          navigator.mediaSession.metadata = new MediaMetadata({
              title: title,
              artist: '朱青青天天开心',
              album: '简单音乐播放器',
              artwork: [
                  { src: 'ppp1.jpg', sizes: '512x512', type: 'image/jpeg' }
              ]
          });
          
          // 更新播放状态绑定
          navigator.mediaSession.setActionHandler('play', function() { audio.play(); });
          navigator.mediaSession.setActionHandler('pause', function() { audio.pause(); });
          navigator.mediaSession.setActionHandler('previoustrack', function() { 
              if(prevBtn) prevBtn.click(); 
          });
          navigator.mediaSession.setActionHandler('nexttrack', function() { 
              if(nextBtn) nextBtn.click(); 
          });
          navigator.mediaSession.setActionHandler('seekto', function(details) {
               if (details.fastSeek && 'fastSeek' in audio) {
                   audio.fastSeek(details.seekTime);
                   return;
               }
               audio.currentTime = details.seekTime;
          });
      }
  }

  // 更新播放源和界面信息
  async function updateSourceAndTitle(){
    if(!currentPlaylist.length){
      setTitle(currentCategory === 'story' ? '未找到故事' : '未找到歌曲');
      playBtn.disabled = true; nextBtn.disabled = true;
      if(coverImg) coverImg.style.animationPlayState = 'paused';
      return;
    }
    
    // 如果是同一首歌，就不重新加载src了？不，切歌必须要重新加载
    // 但如果是暂停后再播放不需要调用这个，这个只在切歌时调用
    audio.src = currentPlaylist[idx];
    setTitle(basename(currentPlaylist[idx]));
    audio.playbackRate = (currentCategory === 'story') ? playbackRate : 1.0;
    updateActiveSongInList();
    updateMediaSession(); // 更新媒体中心信息
  }

  function updateSpeedBtnText(){
    if(speedBtn) speedBtn.textContent = playbackRate.toFixed(2).replace(/\.00$/, '') + 'x';
  }

  function toggleSpeed(){
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.8];
    let idxSpeed = speeds.indexOf(playbackRate);
    if(idxSpeed === -1) idxSpeed = 0;
    playbackRate = speeds[(idxSpeed + 1) % speeds.length];
    if(currentCategory === 'story') audio.playbackRate = playbackRate;
    updateSpeedBtnText();
  }

  function switchCategory(category){
    currentCategory = category;
    currentPlaylist = playlists[category] || [];
    idx = 0;

    if(tabMusic && tabStory){
      tabMusic.classList.toggle('active', category === 'music');
      tabStory.classList.toggle('active', category === 'story');
    }

    if(speedBtn){
      speedBtn.style.display = category === 'story' ? 'inline-block' : 'none';
    }
    updateSpeedBtnText();
    renderPlaylist();
    updateSourceAndTitle();
  }

  // 进度条元素
  const progressBar = document.getElementById('progressBar');
  const progressInner = document.getElementById('progressInner');
  const currentTimeEl = document.getElementById('currentTime');
  const durationEl = document.getElementById('duration');

  function formatTime(sec){
    sec = Math.floor(sec || 0);
    return Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
  }

  audio.addEventListener('timeupdate', ()=>{
    if(audio.duration && progressInner){
      const pct = (audio.currentTime / audio.duration) * 100;
      progressInner.style.width = pct + '%';
      if(currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
      if(durationEl) durationEl.textContent = formatTime(audio.duration);
    }
  });

  // 点击进度条跳转
  if(progressBar){
    progressBar.addEventListener('click', function(e){
      if(!audio.duration) return;
      const rect = progressBar.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x/rect.width));
      audio.currentTime = ratio * audio.duration;
    });
  }

  // metadata 可用时显示总时长
  audio.addEventListener('loadedmetadata', ()=>{
    if(durationEl && audio.duration) durationEl.textContent = formatTime(audio.duration);
  });

  // 播放按钮逻辑
  playBtn.addEventListener('click', ()=>{
    if(!currentPlaylist.length) return;
    if(audio.paused) audio.play(); else audio.pause();
  });

  function getNextIndex(currentIdx, direction = 1) {
      if(!currentPlaylist.length) return 0;
      if(playMode === 'random') {
          // 随机模式，下一首/上一首都是随机
          let newIdx = currentIdx;
          // 简单的防重复随机
          if(currentPlaylist.length > 1) {
            while(newIdx === currentIdx) {
                newIdx = Math.floor(Math.random() * currentPlaylist.length);
            }
          }
          return newIdx;
      } else if(playMode === 'loop') {
          // 单曲循环模式下，点击上一首/下一首还是切歌，只有自然结束才循环
          // 这里实现的是“强制切歌”，如果不希望切歌，直接返回 currentIdx 即可
          // 通常逻辑：手动切歌时忽略单曲循环，只在自动播放结束时生效。
          // 这里按常规逻辑：手动点击切换到下一首
             return (currentIdx + direction + currentPlaylist.length) % currentPlaylist.length;
      } else {
          // 顺序模式
            return (currentIdx + direction + currentPlaylist.length) % currentPlaylist.length;
      }
  }

  // 下一首逻辑
  nextBtn.addEventListener('click', async ()=>{
    if(!currentPlaylist.length) return;
    idx = getNextIndex(idx, 1);
    await updateSourceAndTitle();
    try{ await audio.play(); }catch(e){}
  });

  // 上一首逻辑
  if(prevBtn) {
      prevBtn.addEventListener('click', async ()=>{
        if(!currentPlaylist.length) return;
        idx = getNextIndex(idx, -1);
        await updateSourceAndTitle();
        try{ await audio.play(); }catch(e){}
      });
  }

  // 模式切换逻辑
  if(modeBtn) {
      const modes = [
          { key: 'sequence', label: '顺序' },
          { key: 'random',   label: '随机' },
          { key: 'loop',     label: '单曲' }
      ];
      let modeIdx = 0;
      modeBtn.addEventListener('click', ()=>{
          modeIdx = (modeIdx + 1) % modes.length;
          playMode = modes[modeIdx].key;
          modeBtn.textContent = modes[modeIdx].label;
      });
  }

  if(speedBtn) {
    speedBtn.addEventListener('click', toggleSpeed);
  }

  if(tabMusic) {
    tabMusic.addEventListener('click', () => {
      if(currentCategory !== 'music') switchCategory('music');
    });
  }
  if(tabStory) {
    tabStory.addEventListener('click', () => {
      if(currentCategory !== 'story') switchCategory('story');
    });
  }

  // 播放状态监听：更新按钮文字 + 封面旋转动画
  audio.addEventListener('play', ()=> {
      playBtn.textContent = '暂停';
      if(coverImg) coverImg.style.animationPlayState = 'running';
  });
  
  audio.addEventListener('pause', ()=> {
      playBtn.textContent = '播放';
      if(coverImg) coverImg.style.animationPlayState = 'paused';
  });

  // 播放结束自动下一首
  audio.addEventListener('ended', async ()=>{
    if(playMode === 'loop') {
        // 单曲循环
        audio.currentTime = 0;
        try{ await audio.play(); }catch(e){}
    } else {
        // 顺序 or 随机
        if(!currentPlaylist.length) return;
        idx = getNextIndex(idx, 1);
        await updateSourceAndTitle();
        try{ await audio.play(); }catch(e){}
    }
  });

  // 错误处理
  audio.addEventListener('error', async ()=>{
    console.warn('Audio play error, skipping...');
    // 可以添加逻辑防止无限跳过
    if(!currentPlaylist.length) return;
    // idx = (idx + 1) % playlist.length;
    // await updateSourceAndTitle();
  });

  // --- 初始化流程 ---
    try {
      const [musicList, storyList] = await Promise.all([
        buildPlaylist('music'),
        buildPlaylist('story')
      ]);
      playlists.music = musicList;
      playlists.story = storyList;

      if(!playlists.music.length && !playlists.story.length){
        setTitle('未找到音乐或故事');
        if(songListEl) songListEl.innerHTML = '<li class="empty-tip">未找到内容</li>';
        playBtn.disabled = true;
        nextBtn.disabled = true;
      } else {
        switchCategory('music');
      }
    } catch (e) {
      console.error('Init error:', e);
      setTitle('初始化失败');
    }

})();
