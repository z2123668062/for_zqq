// 简单播放器：加载 music/playlist.json（或数字文件），支持 播放/暂停/下一首
(async function(){
  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('playPause');
  const nextBtn = document.getElementById('next');
  const titleEl = document.getElementById('title');

  let playlist = [];
  let idx = 0;

  function setTitle(t){ titleEl.textContent = t || '' }

  function basename(path){
    let name = path.replace(/^.*\//, '');
    try{ name = decodeURIComponent(name); }catch(e){}
    return name.replace(/\.[^.]+$/, '');
  }

  async function tryJson(p){
    try{ const r = await fetch(p); if(r.ok) return await r.json(); }catch(e){}
    return null;
  }

  async function fileExists(p){
    try{ const r = await fetch(p, {method:'HEAD'}); return r.ok; }catch(e){return false}
  }

  async function buildPlaylist(){
    // 优先使用 playlist.json
    const json = await tryJson('music/playlist.json');
    if(Array.isArray(json) && json.length) return json.map(s=> s.startsWith('music/')? s : 'music/'+s);

    // fallback: 尝试 1..20
    const found = [];
    for(let i=1;i<=20;i++){
      const p = `music/${i}.m4a`;
      if(await fileExists(p)) found.push(p);
    }
    return found;
  }

  async function updateSourceAndTitle(){
    if(!playlist.length){
      setTitle('未找到歌曲');
      playBtn.disabled = true; nextBtn.disabled = true;
      return;
    }
    audio.src = playlist[idx];
    setTitle(basename(playlist[idx]));
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

  playBtn.addEventListener('click', ()=>{
    if(!playlist.length) return;
    if(audio.paused) audio.play(); else audio.pause();
  });
  nextBtn.addEventListener('click', async ()=>{
    if(!playlist.length) return;
    idx = (idx + 1) % playlist.length;
    await updateSourceAndTitle();
    try{ await audio.play(); }catch(e){}
  });

  audio.addEventListener('play', ()=> playBtn.textContent = '暂停');
  audio.addEventListener('pause', ()=> playBtn.textContent = '播放');
  audio.addEventListener('ended', async ()=>{
    idx = (idx + 1) % playlist.length;
    await updateSourceAndTitle();
    try{ await audio.play(); }catch(e){}
  });
  audio.addEventListener('error', async ()=>{
    // 若当前曲目出错，尝试下一首
    console.warn('audio error, skip to next');
    if(!playlist.length) return;
    idx = (idx + 1) % playlist.length;
    await updateSourceAndTitle();
  });

  // 初始化
  const list = await buildPlaylist();
  if(!list.length){ setTitle('未找到歌曲（请把 .m4a 放到 music/）'); playBtn.disabled = true; nextBtn.disabled = true; return; }
  playlist = list;
  idx = 0;
  await updateSourceAndTitle();

})();
