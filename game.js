// Orbit Hop — game một chạm cho YouTube Playables.
// Vệ tinh quay quanh hành tinh; chạm để bắn theo hướng tiếp tuyến,
// lọt vào quỹ đạo hành tinh khác thì được điểm, trượt thì thua.
(() => {
  'use strict';

  // SDK chỉ dùng khi thật sự chạy trong YouTube; ngoài ra (mở file cục bộ) thì bỏ qua.
  const YT = typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV ? ytgame : null;
  const yt = (fn) => { try { return YT ? fn(YT) : undefined; } catch (e) { console.warn(e); } };

  const TEXT = {
    vi: { title: 'NHẢY QUỸ ĐẠO', tap: 'Chạm để chơi', again: 'Chạm để chơi lại', best: 'Kỷ lục', over: 'Trượt rồi!', crash: 'Đâm mặt trăng!', rocket: 'Trúng tên lửa!', shield: 'Khiên!', shieldBreak: 'Khiên vỡ!', stock: 'Có', perfect: 'Hoàn hảo!', coins: 'Xu',
      shop: 'Cửa hàng', back: 'Quay lại', equipped: 'Đang dùng', select: 'Chọn', bought: 'Đã mua!', poor: 'Không đủ xu',
      quests: 'Nhiệm vụ', questDone: 'Xong nhiệm vụ!', claim: 'Chạm để nhận', claimed: 'Đã nhận', reset: 'Nhiệm vụ mới sau',
      settings: 'Cài đặt', music: 'Nhạc nền', sfx: 'Hiệu ứng âm thanh', language: 'Ngôn ngữ', on: 'BẬT', off: 'TẮT',
      revive: 'Xem quảng cáo để hồi sinh', skip: 'Bỏ qua', revived: 'Hồi sinh!', adLoading: 'Đang tải quảng cáo…', adFail: 'Quảng cáo chưa sẵn sàng', double: 'Nhân đôi xu',
      ranks: 'Thành tích', noRuns: 'Chơi một ván để lập thành tích!' },
    en: { title: 'ORBIT HOP', tap: 'Tap to play', again: 'Tap to play again', best: 'Best', over: 'Missed!', crash: 'Hit a moon!', rocket: 'Hit by a rocket!', shield: 'Shield!', shieldBreak: 'Shield broke!', stock: 'Have', perfect: 'Perfect!', coins: 'Coins',
      shop: 'Shop', back: 'Back', equipped: 'Equipped', select: 'Select', bought: 'Bought!', poor: 'Not enough coins',
      quests: 'Quests', questDone: 'Quest complete!', claim: 'Tap to claim', claimed: 'Claimed', reset: 'New quests in',
      settings: 'Settings', music: 'Music', sfx: 'Sound effects', language: 'Language', on: 'ON', off: 'OFF',
      revive: 'Watch ad to revive', skip: 'No thanks', revived: 'Revived!', adLoading: 'Loading ad…', adFail: 'Ad not available', double: 'Double coins',
      ranks: 'Best runs', noRuns: 'Play a run to set a record!' },
  };
  // Tiếng Anh là ngôn ngữ chính cho mọi người chơi; tiếng Việt chọn trong Cài đặt.
  // Theo quy định Playables: không tự đoán ngôn ngữ người chơi và KHÔNG lưu lựa chọn ngôn ngữ vào dữ liệu lưu,
  // nên nút đổi ngôn ngữ chỉ có tác dụng trong phiên chơi hiện tại.
  let lang = 'en', T = TEXT.en;
  const setLang = (code) => { lang = String(code || '').toLowerCase().startsWith('vi') ? 'vi' : 'en'; T = TEXT[lang]; };
  // Cài đặt âm thanh của người chơi; vẫn phải tôn trọng thêm nút tắt tiếng của YouTube (audioOn).
  let musicOn = true, sfxOn = true;

  // ---------- Màn hình ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, S = 1; // S = số pixel cho 1 đơn vị thế giới (sân rộng ~400 đơn vị)
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.min(W / 400, H / 640);
  }
  window.addEventListener('resize', resize);
  resize();

  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const HALF_FIELD = 170;  // hành tinh nằm trong |x| <= 170
  const FLY_SPEED = 720;

  // ---------- Âm thanh (tự tổng hợp, không cần file) ----------
  let audio = null, musicGain = null, audioOn = yt((y) => y.system.isAudioEnabled()) ?? true;
  yt((y) => y.system.onAudioEnabledChange((on) => { audioOn = on; }));
  // Trình duyệt chỉ cho phát tiếng sau lần chạm đầu tiên, nên tạo AudioContext lúc đó.
  function ensureAudio() {
    try {
      if (!audio) {
        audio = new (window.AudioContext || window.webkitAudioContext)();
        musicGain = audio.createGain();
        musicGain.gain.value = musicOn ? 0.7 : 0;
        musicGain.connect(audio.destination);
      }
      if (audio.state === 'suspended' && !paused) audio.resume();
      return true;
    } catch (e) { return false; }
  }
  function tone(freq, dur, type = 'sine', vol = 0.15, to = freq) {
    if (!audioOn || !sfxOn || !ensureAudio()) return;
    try {
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(audio.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) { /* trình duyệt chặn âm thanh: chơi không tiếng */ }
  }
  // Tiếng "tách" khi bấm nút trong menu: hai nốt rất ngắn, cao dần.
  function click() {
    tone(1100, 0.035, 'triangle', 0.09, 1400);
    setTimeout(() => tone(1650, 0.03, 'sine', 0.05), 25);
  }

  // Nhạc nền: mỗi loại hành tinh một bài (cùng thứ tự PTYPES), rải nốt móc đơn, lặp mãi.
  // Lên lịch trước 0,3 giây theo đồng hồ âm thanh để nhịp không bị lệch.
  // Tốc độ: BPM gốc của bài + 2 mỗi điểm (tối đa +60); không chơi thì về BPM gốc.
  // Tông: mỗi 10 điểm lên 2 bán cung, tối đa 5 lần (mốc 50 điểm).
  // chords: số nốt MIDI; arp: thứ tự rải (chỉ số nốt trong hợp âm); up: nâng quãng cho tiếng rải.
  const THEMES = [
    { chords: [[50, 53, 57, 60], [48, 52, 55, 60], [50, 53, 57, 62], [45, 48, 52, 57]], arp: [0, 2, 1, 3, 2, 1, 0, 2], wave: 'triangle', bpm: 88 },    // đá xám: Rê thứ, bí ẩn
    { chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], arp: [0, 1, 2, 3, 2, 1, 2, 3], wave: 'sine', bpm: 96 },       // cam xoáy: hợp âm 7 ấm áp
    { chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], arp: [0, 1, 2, 1, 2, 1, 0, 1], wave: 'triangle', bpm: 100 },                   // xanh lục: Am–F–C–G
    { chords: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 51, 54]], arp: [0, 0, 2, 0, 1, 0, 2, 1], wave: 'square', bpm: 108, vol: 0.022 },        // đỏ: Em–C–D–B, dồn dập
    { chords: [[48, 52, 55], [45, 48, 52], [53, 57, 60], [55, 59, 62]], arp: [0, 1, 2, 0, 1, 2, 1, 2], wave: 'triangle', bpm: 104 },                   // sọc nâu: C–Am–F–G, hùng tráng
    { chords: [[51, 55, 58, 62], [48, 51, 55, 58], [56, 60, 63, 67], [58, 62, 65]], arp: [0, 2, 1, 3, 1, 2, 0, 3], wave: 'sine', bpm: 84 },            // vành đai: mơ màng
    { chords: [[55, 59, 62], [59, 62, 66], [52, 55, 59], [50, 54, 57]], arp: [2, 1, 0, 1, 2, 1, 0, 2], wave: 'sine', bpm: 92, up: 24 },                // xanh ngọc: cao, lạnh như băng
    { chords: [[47, 50, 54], [43, 47, 50], [50, 54, 57], [45, 49, 52]], arp: [0, 1, 0, 2, 0, 1, 0, 2], wave: 'triangle', bpm: 80 },                    // xanh đậm: trầm, sâu thẳm
  ];
  let theme = THEMES[2];
  const bpm = () => theme.bpm + (state === 'play' ? Math.min(score * 2, 60) : 0);
  const key = () => (state === 'play' ? Math.min(Math.floor(score / 10), 5) * 2 : 0);
  const midi = (n) => 440 * 2 ** ((n - 69) / 12);
  let nextNote = 0, step = 0;
  function note(freq, t, dur, type, vol) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  setInterval(() => {
    if (!audio || !audioOn || !musicOn || paused) return;
    if (nextNote < audio.currentTime) nextNote = audio.currentTime + 0.05;
    const th = THEMES[planets[pl.pi].type];
    if (th !== theme) { theme = th; step = 0; }   // sang hành tinh khác loại: đổi bài, bắt đầu từ hợp âm đầu
    while (nextNote < audio.currentTime + 0.3) {
      const chord = th.chords[Math.floor(step / 8) % th.chords.length], i = step % 8, st = 60 / bpm() / 2, k = key();
      note(midi(chord[th.arp[i] % chord.length] + (th.up || 12) + k), nextNote, st * 0.9, th.wave, th.vol || 0.045);
      if (i === 0) note(midi(chord[0] - 12 + k), nextNote, st * 7.5, 'sine', 0.09);
      if (i === 4 && step % 32 >= 16) note(midi(chord[2] + 24 + k), nextNote, st * 3, 'sine', 0.03); // giai điệu điểm xuyết ở nửa sau
      nextNote += st; step++;
    }
  }, 100);

  // ---------- Giao diện vệ tinh (mua bằng xu) ----------
  // trail(i, t): màu vệt sáng ở vị trí i (0 = sát vệ tinh) tại thời điểm t; cũng dùng làm màu phát sáng.
  // Xếp theo giá tăng dần (đúng thứ tự hiện trong cửa hàng).
  // face: tên hàm vẽ đầu nhân vật trong FACES (thay cho chấm tròn).
  const SKINS = [
    { id: 'classic', vi: 'Cổ điển', en: 'Classic', price: 0, core: '#fff', trail: () => '#7ef9ff' },
    { id: 'fire', vi: 'Lửa', en: 'Fire', price: 60, core: '#fff3c4', trail: (i) => `hsl(${10 + i * 3},100%,55%)` },
    { id: 'ghost', vi: 'Bóng ma', en: 'Ghost', price: 120, core: 'rgba(255,255,255,0.55)', trail: () => '#c9b6ff' },
    { id: 'cool', vi: 'Kính râm ngầu', en: 'Too Cool', price: 150, face: 'cool', trail: () => '#ffd93b' },
    { id: 'laugh', vi: 'Cười ra nước mắt', en: 'LOL', price: 180, face: 'laugh', trail: () => '#6fc8ff' },
    { id: 'grin', vi: 'Cười đểu', en: 'Sly Grin', price: 200, face: 'grin', trail: () => '#c8f05a' },
    { id: 'smug', vi: 'Mặt gian', en: 'Smug', price: 220, face: 'smug', trail: () => '#ffb347' },
    { id: 'crycat', vi: 'Mèo khóc', en: 'Sad Cat', price: 240, face: 'crycat', trail: () => '#8fd3ff' },
    { id: 'cat', vi: 'Mèo ngơ', en: 'Derp Cat', price: 260, face: 'cat', trail: () => '#ff9f45' },
    { id: 'starecat', vi: 'Mèo ngó', en: 'Stare Cat', price: 280, face: 'starecat', trail: () => '#c9b49a' },
    { id: 'shiba', vi: 'Chó shiba', en: 'Shiba', price: 300, face: 'shiba', trail: () => '#f0b060' },
    { id: 'lava', vi: 'Dung nham', en: 'Lava', price: 400, core: '#ffcf9a', trail: (i, t) => `hsl(${(Math.sin(t * 5 + i * 0.6) + 1) * 18},100%,50%)` },
    { id: 'ninja', vi: 'Ninja xanh', en: 'Blue Ninja', price: 450, face: 'ninja', trail: () => '#4d7cff' },
    { id: 'redmask', vi: 'Mặt nạ đỏ', en: 'Red Mask', price: 500, face: 'redmask', trail: () => '#ff4d4d' },
    { id: 'astro', vi: 'Phi hành gia', en: 'Astronaut', price: 550, face: 'astro', trail: () => '#ffffff' },
    { id: 'gold', vi: 'Hoàng kim', en: 'Gold', price: 600, core: '#ffe680', trail: () => '#ffbf00' },
    { id: 'dino', vi: 'Khủng long', en: 'Dino', price: 650, face: 'dino', trail: () => '#6fdc5a' },
    { id: 'electric', vi: 'Tia điện', en: 'Electric', price: 700, core: '#fffbe0', trail: (i, t) => (Math.sin(t * 30 + i * 2) > 0 ? '#fff36b' : '#7ef9ff') },
    { id: 'robot', vi: 'Robot vàng', en: 'Gold Bot', price: 750, face: 'robot', trail: (i, t) => (Math.sin(t * 12 + i) > 0 ? '#f5c542' : '#5ff') },
    { id: 'helm', vi: 'Mũ giáp', en: 'Steel Helm', price: 800, face: 'helm', trail: () => '#5ff0ff' },
    { id: 'aurora', vi: 'Cực quang', en: 'Aurora', price: 850, core: '#eafff4', trail: (i, t) => `hsl(${140 + Math.sin(t * 2 + i * 0.3) * 50},90%,60%)` },
    { id: 'knight', vi: 'Hiệp sĩ đêm', en: 'Night Knight', price: 900, face: 'knight', trail: () => '#9b6bff' },
    { id: 'plasma', vi: 'Plasma', en: 'Plasma', price: 950, core: '#f6e6ff', trail: (i, t) => `hsl(${285 + Math.sin(t * 6 + i) * 30},100%,65%)` },
    { id: 'galaxy', vi: 'Thiên hà', en: 'Galaxy', price: 1000, core: '#fff', trail: (i, t) => `hsl(${250 + i * 5},80%,${55 + Math.sin(t * 4 + i) * 15}%)` },
    { id: 'vampire', vi: 'Ma cà rồng', en: 'Vampire', price: 1100, face: 'vampire', trail: (i) => (i % 6 < 3 ? '#c0102a' : '#2a0010') },
    { id: 'phoenix', vi: 'Phượng hoàng', en: 'Phoenix', price: 1200, core: '#fffbe6', trail: (i, t) => `hsl(${Math.max(0, 50 - i * 1.5 + Math.sin(t * 10) * 5)},100%,${Math.max(40, 65 - i)}%)` },
    { id: 'rainbow', vi: 'Cầu vồng', en: 'Rainbow', price: 1500, core: '#fff', trail: (i, t) => `hsl(${(t * 240 + i * 22) % 360},100%,65%)` },
  ];
  // Mục đầu tiên của cửa hàng: khiên dùng một lần, tự bật khi bắt đầu ván.
  const SHIELD_PRICE = 50;
  const SHOP_ITEMS = [{ id: 'shield', vi: 'Khiên', en: 'Shield', price: SHIELD_PRICE }, ...SKINS];
  const PAGE_SIZE = 6;
  const pageCount = Math.ceil(SHOP_ITEMS.length / PAGE_SIZE);

  // ---------- Nhiệm vụ hằng ngày ----------
  // max: tính giá trị cao nhất trong một lần (điểm, combo); còn lại cộng dồn trong ngày.
  const QUESTS = [
    { id: 'hop', n: 25, reward: 10, vi: 'Nhảy {n} lần', en: 'Hop {n} times' },
    { id: 'perfect', n: 8, reward: 15, vi: 'Đạt {n} cú Hoàn hảo', en: 'Land {n} Perfects' },
    { id: 'coin', n: 15, reward: 10, vi: 'Nhặt {n} xu', en: 'Collect {n} coins' },
    { id: 'score', n: 15, reward: 15, max: true, vi: 'Đạt {n} điểm trong một ván', en: 'Score {n} in one run' },
    { id: 'game', n: 5, reward: 10, vi: 'Chơi {n} ván', en: 'Play {n} runs' },
    { id: 'combo', n: 3, reward: 20, max: true, vi: 'Đạt combo x{n}', en: 'Reach combo x{n}' },
    { id: 'skip', n: 2, reward: 20, vi: 'Bay vượt qua hành tinh {n} lần', en: 'Skip a planet {n} times' },
  ];
  const questDef = (id) => QUESTS.find((q) => q.id === id);
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  let daily = null; // { day, ids: [3 id], prog: [3 số], got: [3 đã nhận?] }

  // Sang ngày mới thì chọn 3 nhiệm vụ theo ngày (ai cũng nhận cùng bộ trong cùng một ngày).
  function checkDay() {
    const day = today();
    if (daily && daily.day === day) return;
    let h = 0;
    for (const c of day) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
    const pool = QUESTS.map((q) => q.id), ids = [];
    while (ids.length < 3) {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      ids.push(pool.splice((h >>> 16) % pool.length, 1)[0]);
    }
    daily = { day, ids, prog: [0, 0, 0], got: [false, false, false] };
    save();
  }

  function quest(id, v = 1) {
    if (!daily) return;
    daily.ids.forEach((qid, i) => {
      if (qid !== id) return;
      const q = questDef(qid), was = daily.prog[i] >= q.n;
      daily.prog[i] = Math.min(q.n, q.max ? Math.max(daily.prog[i], v) : daily.prog[i] + v);
      if (!was && daily.prog[i] >= q.n) {
        popups.push({ x: pl.x, y: pl.y - 60, text: '✓ ' + T.questDone, life: 1.8 });
        tone(880, 0.25, 'triangle', 0.1, 1320);
      }
    });
  }

  const canClaim = (i) => !daily.got[i] && daily.prog[i] >= questDef(daily.ids[i]).n;

  function claim(i) {
    if (!canClaim(i)) return;
    const q = questDef(daily.ids[i]);
    daily.got[i] = true; wallet += q.reward;
    msg = { text: `+${q.reward} ${T.coins}`, life: 1.2, color: '#ffd34d' };
    [0, 4, 7, 12].forEach((n, k) => setTimeout(() => tone(midi(76 + n), 0.15, 'triangle', 0.08), k * 60));
    save();
  }

  // ---------- Lưu kỷ lục, xu, giao diện và nhiệm vụ ----------
  let best = 0, wallet = 0, owned = ['classic'], skin = 'classic', shieldStock = 0;
  // Bảng thành tích cá nhân: 10 ván điểm cao nhất { s: điểm, d: ngày 'YYYY-M-D' }.
  // Không có bảng xếp hạng chung: Playables cấm gọi máy chủ ngoài và cấm thu tên người chơi.
  let runs = [], lastRun = null;
  // loaded: đã đọc xong dữ liệu cũ. Chưa đọc được (vd. mạng lỗi) thì không ghi gì,
  // để không đè số 0 lên dữ liệu thật của người chơi.
  let loaded = false;
  const applySave = (s) => {
    const d = s ? JSON.parse(s) : {};
    best = d.best || 0; wallet = d.coins || 0;
    owned = d.owned || ['classic'];
    skin = owned.includes(d.skin) ? d.skin : 'classic';
    shieldStock = d.shieldStock || 0;
    runs = Array.isArray(d.runs) ? d.runs : [];
    daily = d.daily && d.daily.ids.every(questDef) ? d.daily : null;
    const st = d.settings || {};
    musicOn = st.music !== false; sfxOn = st.sfx !== false;
  };
  // Dữ liệu hỏng (không đọc được JSON) thì bắt đầu mới; còn lỗi khi tải thì giữ loaded = false.
  const applyOrFresh = (s) => {
    try { applySave(s); } catch (e) { applySave(null); }
    loaded = true;
  };
  const curSkin = () => SKINS.find((s) => s.id === skin) || SKINS[0];
  function loadSave() {
    if (YT) return YT.game.loadData().then(applyOrFresh).catch(() => {});
    let s = null;
    try { s = localStorage.getItem('orbitHop'); } catch (e) {}
    applyOrFresh(s);
    return Promise.resolve();
  }
  function save() {
    if (!loaded) return;
    const s = JSON.stringify({ best, coins: wallet, owned, skin, daily, shieldStock, runs, settings: { music: musicOn, sfx: sfxOn } });
    if (YT) return yt((y) => y.game.saveData(s).catch(() => {}));
    try { localStorage.setItem('orbitHop', s); } catch (e) {}
  }

  // ---------- Trạng thái game ----------
  let state = 'menu', paused = false, overAt = 0, time = 0;
  let planets, pl, score, combo, camY, shake, coins, runCoins, rockets, shields, waves = [];
  const ROCKET_WRAP = 300; // tên lửa bay trong |x| <= 300 rồi quay lại từ mép bên kia
  let particles = [], popups = [], trail = [], trailT = 0;

  const stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), z: rand(0.1, 0.6), s: rand(0.5, 1.8) }));

  // Tinh vân: vẽ sẵn một lần, gồm vài cụm mây màu chồng sáng lên nhau.
  // Mỗi đám vẽ thêm một bản ở trên và dưới để ảnh ghép dọc liền mạch khi cuộn.
  const NEB_W = 512, NEB_H = 1024;
  const NEBULA = (() => {
    const c = document.createElement('canvas');
    c.width = NEB_W; c.height = NEB_H;
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    for (const hue of [275, 320, 190, 230, 300]) {
      const cx = rand(0, NEB_W), cy = rand(0, NEB_H);
      for (let i = 0; i < 7; i++) {
        const x = cx + rand(-140, 140), y = cy + rand(-160, 160), r = rand(70, 220);
        const h = hue + rand(-20, 20), a = rand(0.08, 0.2);
        for (const oy of [-NEB_H, 0, NEB_H]) {
          const gr = g.createRadialGradient(x, y + oy, 0, x, y + oy, r);
          gr.addColorStop(0, `hsla(${h},85%,58%,${a})`);
          gr.addColorStop(1, `hsla(${h},85%,58%,0)`);
          g.fillStyle = gr;
          g.fillRect(x - r, y + oy - r, r * 2, r * 2);
        }
      }
    }
    return c;
  })();

  // ---------- Hành tinh: vẽ sẵn 8 kiểu vào canvas phụ một lần, mỗi khung hình chỉ drawImage ----------
  const PR = 72, PSIZE = Math.ceil(PR * 4.6); // bán kính gốc; khung đủ rộng cho vành đai và quầng sáng
  const PTYPES = [
    { hue: 30, paint: rocky },                 // đá xám nhiều hố
    { hue: 35, paint: venus },                 // mây xoáy cam
    { hue: 205, paint: earth },                // đại dương, lục địa, mây
    { hue: 12, paint: mars },                  // đỏ, chỏm băng
    { hue: 28, paint: jupiter },               // sọc nâu, vết đỏ lớn
    { hue: 45, paint: saturn, ring: true },    // vàng nhạt, vành đai
    { hue: 185, paint: uranus },               // xanh ngọc
    { hue: 220, paint: neptune },              // xanh đậm, vệt bão
  ];

  function fillAll(g, c) { g.fillStyle = c; g.fillRect(-PR, -PR, PR * 2, PR * 2); }
  function blobs(g, color, n, rmin, rmax) {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      g.beginPath(); g.arc(rand(-PR, PR), rand(-PR, PR), rand(rmin, rmax), 0, 6.283); g.fill();
    }
  }
  // Dải ngang có mép trên uốn sóng, vẽ từ trên xuống, dải sau đè lên phần dưới của dải trước.
  function bands(g, colors, wave, n) {
    const h = (2 * PR) / n;
    for (let i = 0; i < n; i++) {
      const y0 = -PR + i * h, ph = rand(0, 6.3);
      g.fillStyle = colors[i % colors.length];
      g.beginPath(); g.moveTo(-PR, PR);
      for (let x = -PR; x <= PR + 6; x += 6) g.lineTo(x, y0 + Math.sin(x * 0.08 + ph) * wave);
      g.lineTo(PR, PR); g.closePath(); g.fill();
    }
  }
  function streaks(g, color, n, width) {
    g.strokeStyle = color; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const y = rand(-PR, PR), x = rand(-PR, PR * 0.4), len = rand(25, 70);
      g.lineWidth = rand(width * 0.5, width);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + len / 2, y + rand(-8, 8), x + len, y + rand(-4, 4)); g.stroke();
    }
  }

  function rocky(g) {
    fillAll(g, '#8d8a86');
    blobs(g, 'rgba(70,66,62,0.35)', 7, 12, 30);
    for (let i = 0; i < 22; i++) {   // miệng hố: lõm tối + viền sáng lệch về phía nguồn sáng
      const x = rand(-PR, PR), y = rand(-PR, PR), r = rand(3, 11);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(x + 1, y + 1, r, 3.5, 5.8); g.stroke();
    }
  }
  function venus(g) {
    fillAll(g, '#e0a85a');
    g.globalAlpha = 0.85;
    bands(g, ['#e8b96b', '#d18f45', '#f0c987', '#c98242'], 10, 9);
    g.globalAlpha = 1;
    streaks(g, 'rgba(255,235,190,0.35)', 10, 8);
  }
  function earth(g) {
    fillAll(g, '#1f5fbf');
    blobs(g, '#2a74d0', 6, 15, 35);                 // vùng biển nông
    for (let k = 0; k < 4; k++) {                    // lục địa: cụm hình tròn chồng nhau
      const cx = rand(-PR * 0.8, PR * 0.8), cy = rand(-PR * 0.6, PR * 0.6);
      g.fillStyle = k % 2 ? '#4a9a3e' : '#3f8a37';
      for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(cx + rand(-20, 20), cy + rand(-14, 14), rand(6, 16), 0, 6.283); g.fill(); }
      g.fillStyle = '#a38b55';
      g.beginPath(); g.arc(cx + rand(-10, 10), cy + rand(-6, 6), rand(4, 8), 0, 6.283); g.fill();
    }
    g.fillStyle = '#f2f6ff';                         // băng hai cực
    g.beginPath(); g.ellipse(0, -PR, PR * 0.7, PR * 0.18, 0, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(0, PR, PR * 0.6, PR * 0.15, 0, 0, 6.283); g.fill();
    streaks(g, 'rgba(255,255,255,0.7)', 12, 7);      // mây
  }
  function mars(g) {
    fillAll(g, '#c1532f');
    blobs(g, 'rgba(120,40,20,0.45)', 9, 8, 26);
    blobs(g, 'rgba(230,130,80,0.35)', 6, 8, 20);
    g.fillStyle = '#fbeee6';
    g.beginPath(); g.ellipse(-8, -PR + 6, PR * 0.35, PR * 0.12, 0, 0, 6.283); g.fill();
  }
  function jupiter(g) {
    bands(g, ['#e9d6b3', '#c79a6b', '#f2e4c8', '#b07f55', '#e3c49a', '#a8704a'], 4, 12);
    g.fillStyle = '#c0583a';                         // vết đỏ lớn
    g.beginPath(); g.ellipse(PR * 0.3, PR * 0.35, 17, 10, 0, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(255,220,190,0.6)'; g.lineWidth = 2; g.stroke();
  }
  function saturn(g) {
    g.rotate(-0.35);                                 // sọc nghiêng theo vành đai
    bands(g, ['#e8d39c', '#d8bd7e', '#f0dfb0', '#cfae6c'], 2, 10);
  }
  function uranus(g) {
    fillAll(g, '#9fe3e6');
    bands(g, ['rgba(255,255,255,0.10)', 'rgba(0,90,110,0.07)'], 2, 8);
  }
  function neptune(g) {
    fillAll(g, '#2f5fd0');
    bands(g, ['#3a6fe0', '#2a52b8', '#4a7ff0', '#2d58c4'], 5, 7);
    g.fillStyle = '#1d3a8a';
    g.beginPath(); g.ellipse(-PR * 0.25, PR * 0.2, 14, 8, 0, 0, 6.283); g.fill();
    streaks(g, 'rgba(230,240,255,0.55)', 5, 4);
  }

  // Vành đai: nửa trên (phía sau) vẽ trước hành tinh, nửa dưới (phía trước) vẽ sau.
  function ring(g, a0, a1) {
    g.save(); g.rotate(-0.35); g.scale(1, 0.3);
    g.lineWidth = PR * 0.13;
    for (const [r, a] of [[1.35, 0.5], [1.5, 0.75], [1.63, 0.35], [1.76, 0.7], [1.92, 0.45], [2.05, 0.25]]) {
      g.strokeStyle = `rgba(225,205,160,${a})`;
      g.beginPath(); g.arc(0, 0, PR * r, a0, a1); g.stroke();
    }
    g.restore();
  }

  function buildSprite(t) {
    const c = document.createElement('canvas');
    c.width = c.height = PSIZE;
    const g = c.getContext('2d');
    g.translate(PSIZE / 2, PSIZE / 2);
    const glow = g.createRadialGradient(0, 0, PR * 0.9, 0, 0, PR * 1.4);   // quầng khí quyển
    glow.addColorStop(0, `hsla(${t.hue},80%,65%,0.35)`);
    glow.addColorStop(1, `hsla(${t.hue},80%,65%,0)`);
    g.fillStyle = glow; g.beginPath(); g.arc(0, 0, PR * 1.4, 0, 6.283); g.fill();
    if (t.ring) ring(g, Math.PI, 2 * Math.PI);
    g.save();
    g.beginPath(); g.arc(0, 0, PR, 0, 6.283); g.clip();
    g.save(); t.paint(g); g.restore();
    const shade = g.createRadialGradient(-PR * 0.45, -PR * 0.45, PR * 0.1, -PR * 0.2, -PR * 0.2, PR * 1.5);   // ánh sáng từ trên-trái
    shade.addColorStop(0, 'rgba(255,255,255,0.22)');
    shade.addColorStop(0.45, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.78)');
    fillAll(g, shade);
    g.restore();
    if (t.ring) ring(g, 0, Math.PI);
    return c;
  }
  const SPRITES = PTYPES.map(buildSprite);

  // Mặt trăng nguy hiểm (từ hành tinh thứ 12): quỹ đạo tròn bên ngoài quỹ đạo người chơi,
  // bay vào hoặc bay ra đều phải canh lúc nó đi qua. Từ hành tinh 25 có thể có 2 cái đối xứng.
  // Mặt trăng trang trí: 45% hành tinh có 1–2 cái, quỹ đạo nghiêng bên trong quỹ đạo người chơi, vô hại.
  function makeMoons(r, orbit, n) {
    if (n >= 12 && Math.random() < 0.35 + Math.min(n / 40, 1) * 0.3) {
      const two = n >= 25 && Math.random() < 0.4, ph = rand(0, 6.3), d = orbit + rand(16, 28);
      const w = rand(0.7, 1.2) * (Math.random() < 0.5 ? -1 : 1);
      return Array.from({ length: two ? 2 : 1 }, (_, i) => ({ hazard: true, d, mr: rand(6, 8), w, ph: ph + i * Math.PI, tilt: 0, type: 3 }));
    }
    if (Math.random() > 0.45) return [];
    return Array.from({ length: Math.random() < 0.3 ? 2 : 1 }, () => ({
      d: rand(r * 1.3, orbit * 0.85), mr: rand(4.5, 7.5),
      w: rand(0.6, 1.5) * (Math.random() < 0.5 ? -1 : 1),
      ph: rand(0, 6.3), tilt: rand(-0.5, 0.5),
      type: [0, 3, 6][Math.floor(rand(0, 3))],   // dùng lại hình đá xám, đỏ, xanh ngọc
    }));
  }

  // Vị trí mặt trăng so với tâm hành tinh (đơn vị thế giới).
  function moonPos(m, a) {
    const lx = Math.cos(a) * m.d, ly = Math.sin(a) * m.d * (m.hazard ? 1 : 0.35);
    return { x: lx * Math.cos(m.tilt) - ly * Math.sin(m.tilt), y: lx * Math.sin(m.tilt) + ly * Math.cos(m.tilt) };
  }

  function makePlanet(prev, n) {
    const d = Math.min(n / 40, 1); // độ khó 0..1
    const r = lerp(28, 16, d) + rand(-3, 3);
    const orbit = r + lerp(36, 24, d);
    const lim = HALF_FIELD - orbit;
    let x = rand(-lim, lim);
    if (Math.abs(x - prev.baseX) < 60) x = x > prev.baseX ? Math.min(lim, x + 80) : Math.max(-lim, x - 80);
    const amp = n >= 12 && Math.random() < 0.3 + d * 0.5 ? Math.min(rand(30, 70), lim - Math.abs(x)) : 0;
    const type = (prev.type + 1 + Math.floor(rand(0, PTYPES.length - 1))) % PTYPES.length; // khác kiểu hành tinh trước
    return {
      type, moons: makeMoons(r, orbit, n).filter((m) => m.hazard || type !== 5), // hành tinh vành đai: không có trăng trang trí
      x, baseX: x, y: prev.y - (lerp(190, 240, d) + rand(-15, 25)),
      r, orbit, amp, ph: rand(0, 6.3), ms: rand(0.8, 1.6),
      w: lerp(2.3, 3.5, d) * rand(0.92, 1.08), hue: PTYPES[type].hue,
    };
  }

  // Thêm hành tinh mới; 60% đoạn đường tới nó có 1–3 xu, lệch khỏi đường thẳng một chút.
  function addPlanet() {
    const prev = planets[planets.length - 1], p = makePlanet(prev, planets.length);
    planets.push(p);
    coins = coins.filter((c) => !c.taken && c.y < p.y + 1500); // bỏ xu đã nhặt hoặc đã ở xa phía dưới
    rockets = rockets.filter((r) => r.y < p.y + 1500);
    shields = shields.filter((s) => !s.taken && s.y < p.y + 1500);
    const n0 = planets.length - 1, d = Math.min(n0 / 40, 1);
    if (n0 >= 8 && Math.random() < 0.25 + d * 0.35) {   // đường bay của tên lửa ở khoảng giữa hai hành tinh
      rockets.push({ x: rand(-ROCKET_WRAP, ROCKET_WRAP), y: lerp(prev.y, p.y, rand(0.4, 0.6)), dir: Math.random() < 0.5 ? -1 : 1, v: rand(120, 190) + d * 60 });
    }
    const off = rand(-35, 35);
    if (n0 >= 6 && Math.random() < 0.07) {   // khiên thay cho xu ở đoạn này (hiếm)
      shields.push({ x: lerp(prev.baseX, p.baseX, 0.5) + off, y: lerp(prev.y, p.y, 0.5), taken: false });
      return;
    }
    const n = Math.random() < 0.6 ? Math.floor(rand(1, 4)) : 0;
    for (let i = 0; i < n; i++) {
      const t = 0.5 + (i - (n - 1) / 2) * 0.12;
      coins.push({ x: lerp(prev.baseX, p.baseX, t) + off, y: lerp(prev.y, p.y, t), taken: false });
    }
  }

  function reset() {
    planets = [{ type: 2, moons: [{ d: 44, mr: 6, w: 0.8, ph: 0, tilt: -0.3, type: 0 }], x: 0, baseX: 0, y: 0, r: 28, orbit: 64, amp: 0, ph: 0, ms: 0, w: 2.3, hue: PTYPES[2].hue }];
    coins = []; rockets = []; shields = [];
    while (planets.length < 6) addPlanet();
    // st/stv: độ giãn của quả cầu theo hướng chuyển động và vận tốc lò xo; inv: thời gian bất tử còn lại
    pl = { mode: 'orbit', pi: 0, angle: Math.PI, dir: 1, x: 0, y: 0, vx: 0, vy: 0, flyT: 0, st: 1, stv: 0, shield: false, inv: 0 };
    score = 0; combo = 0; runCoins = 0; camY = 0; shake = 0; trail = []; popups = []; waves = [];
    revived = false; canRevive = false; runEnded = false; doubled = false;
  }

  // Sóng xung kích: vòng tròn lan rộng rồi mờ dần.
  function wave(x, y, r, color) { waves.push({ x, y, r, color, life: 0.5 }); }

  // Va chạm chướng ngại vật: có khiên thì khiên vỡ và bất tử 1 giây; không thì thua.
  // Trả về true nếu đã thua.
  function hurt(why) {
    if (pl.inv > 0) return false;
    if (!pl.shield) { die(why); return true; }
    pl.shield = false; pl.inv = 1; shake = 0.25;
    wave(pl.x, pl.y, 70, '#5fd0ff');
    burst(pl.x, pl.y, '#5fd0ff', 24);
    popups.push({ x: pl.x, y: pl.y - 30, text: T.shieldBreak, life: 1.2 });
    tone(900, 0.3, 'sawtooth', 0.08, 200);
    return false;
  }

  function collectShield(s) {
    s.taken = true; pl.shield = true;
    wave(s.x, s.y, 50, '#5fd0ff');
    popups.push({ x: s.x, y: s.y - 24, text: T.shield, life: 1.2 });
    [0, 7, 12].forEach((n, i) => setTimeout(() => tone(midi(79 + n), 0.12, 'sine', 0.08), i * 50));
  }

  function start() {
    endRun(); checkDay(); reset(); state = 'play';
    tone(440, 0.12, 'triangle', 0.12, 660);
    if (shieldStock > 0) {   // dùng 1 khiên mua trong cửa hàng
      shieldStock--; pl.shield = true; save();
      popups.push({ x: pl.x, y: pl.y - 30, text: T.shield, life: 1.2 });
    }
  }

  function launch() {
    const p = planets[pl.pi];
    pl.mode = 'fly'; pl.flyT = 0;
    pl.vx = -Math.sin(pl.angle) * pl.dir * FLY_SPEED;
    pl.vy = Math.cos(pl.angle) * pl.dir * FLY_SPEED;
    tone(520, 0.1, 'square', 0.06, 880);
    burst(pl.x, pl.y, `hsl(${p.hue},90%,70%)`, 6);
    pl.st = 1.7; pl.stv = 0;   // kéo dài theo hướng bắn
    wave(pl.x, pl.y, 26, 'rgba(255,255,255,0.8)');
  }

  function capture(j) {
    const p = planets[j];
    const ux = pl.vx / FLY_SPEED, uy = pl.vy / FLY_SPEED;
    const rx = pl.x - p.x, ry = pl.y - p.y;
    const perp = Math.abs(ux * -ry - uy * -rx);           // khoảng cách đường bay tới tâm
    pl.dir = rx * uy - ry * ux >= 0 ? 1 : -1;               // quay tiếp theo chiều đang bay
    pl.angle = Math.atan2(ry, rx);
    const skipped = j - pl.pi - 1;
    let gain = 1 + skipped * 2;
    const perfect = perp < p.orbit * 0.35;
    combo = perfect ? combo + 1 : 0;
    if (perfect) gain += combo;
    quest('hop');
    if (perfect) { quest('perfect'); quest('combo', combo); }
    if (skipped > 0) quest('skip', skipped);
    const k0 = key();
    score += gain;
    pl.pi = j; pl.mode = 'orbit';
    while (planets.length < pl.pi + 6) addPlanet();
    popups.push({ x: p.x, y: p.y - p.orbit - 14, text: (perfect ? T.perfect + ' ' : '') + '+' + gain, life: 1 });
    if (key() > k0) {   // vừa qua mốc 10 điểm: báo lên tông bằng một hợp âm rải (chỉ âm thanh)
      [0, 4, 7, 12].forEach((s, i) => setTimeout(() => tone(midi(69 + key() + s), 0.2, 'triangle', 0.08), i * 70));
    }
    burst(pl.x, pl.y, `hsl(${p.hue},90%,70%)`, perfect ? 22 : 12);
    pl.st = 0.55; pl.stv = 0;   // bẹp lại khi bị hút vào quỹ đạo, lò xo sẽ nảy về
    wave(pl.x, pl.y, perfect ? 60 : 40, `hsl(${p.hue},90%,70%)`);
    tone(perfect ? 660 + combo * 60 : 500, 0.18, 'sine', 0.16, perfect ? 1320 : 750);
  }

  // ---------- Thua, hồi sinh bằng quảng cáo có thưởng ----------
  // Lần chết đầu tiên của ván: hiện nút xem quảng cáo trong REVIVE_TIME giây.
  // Ván chỉ thật sự kết thúc (gửi điểm, tính nhiệm vụ "chơi N ván") khi bỏ qua, hết giờ, hoặc chết lần hai.
  const REVIVE_TIME = 5;
  let overText = '', revived = false, canRevive = false, runEnded = false, adBusy = false;
  function die(why = T.over) {
    state = 'over'; overAt = time; shake = 0.4; overText = why;
    burst(pl.x, pl.y, '#ff6b6b', 30);
    tone(300, 0.45, 'sawtooth', 0.12, 60);
    best = Math.max(best, score);
    canRevive = !revived;
    if (canRevive) save(); else endRun();
  }

  function endRun() {
    if (state !== 'over' || runEnded) return;
    runEnded = true; canRevive = false;
    yt((y) => y.engagement.sendScore({ value: score }).catch(() => {}));
    quest('game');
    quest('score', score);
    if (score > 0) {   // ghi vào bảng thành tích, giữ 10 ván cao nhất
      lastRun = { s: score, d: today() };
      runs = [...runs, lastRun].sort((a, b) => b.s - a.s).slice(0, 10);
    }
    save();
  }

  // Quảng cáo có thưởng; chỉ gọi khi người chơi tự bấm nút. rewardId: mỗi loại thưởng một mã cố định.
  // Ngoài YouTube (chạy thử trên máy) thì giả lập xem xong sau 0,8 giây.
  async function watchAd(rewardId, onReward) {
    if (adBusy) return;
    adBusy = true;
    click();
    msg = { text: T.adLoading, life: 30, color: '#ccd' };
    let ok = false;
    try {
      ok = YT ? await YT.ads.requestRewardedAd(rewardId) : await new Promise((r) => setTimeout(() => r(true), 800));
    } catch (e) { ok = false; }
    adBusy = false;
    msg = null;
    if (ok && state === 'over') onReward();
    else msg = { text: T.adFail, life: 1.5, color: '#ff6b6b' };
  }

  // Nhân đôi xu nhặt được trong ván (một lần mỗi ván, sau khi ván đã kết thúc hẳn).
  let doubled = false;
  const canDouble = () => state === 'over' && runEnded && !doubled && runCoins > 0;
  function doubleCoins() {
    if (!canDouble()) return;
    doubled = true; wallet += runCoins;
    msg = { text: `+${runCoins} ${T.coins}`, life: 1.5, color: '#ffd34d' };
    runCoins *= 2;
    [0, 4, 7, 12, 16].forEach((n, i) => setTimeout(() => tone(midi(76 + n), 0.12, 'square', 0.05), i * 60));
    save();
  }
  const doubleBtn = () => ({ x: W / 2 - 130, y: H * 0.64 - 25, w: 260, h: 50 });

  // Sống lại trên hành tinh vừa đứng, giữ điểm, bất tử 2 giây để kịp định hướng.
  function revive() {
    revived = true; canRevive = false; state = 'play';
    pl.mode = 'orbit'; pl.inv = 2; pl.st = 0.55; pl.stv = 0;
    trail = []; shake = 0;
    const p = planets[pl.pi];
    wave(p.x, p.y, p.orbit * 1.6, '#5dff7a');
    popups.push({ x: p.x, y: p.y - p.orbit - 20, text: T.revived, life: 1.5 });
    [0, 4, 7, 12].forEach((n, i) => setTimeout(() => tone(midi(72 + n), 0.15, 'triangle', 0.09), i * 70));
  }
  const reviveBtn = () => ({ x: W / 2 - 130, y: H * 0.63 - 30, w: 260, h: 60 });
  const skipBtn = () => ({ x: W / 2 - 70, y: H * 0.63 + 44, w: 140, h: 40 });

  function collect(c) {
    c.taken = true; runCoins++; wallet++;
    quest('coin');
    burst(c.x, c.y, '#ffd34d', 8);
    tone(1320, 0.08, 'square', 0.05, 1760);
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.3), v = rand(60, 260);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.4, 0.9), color });
    }
  }

  // ---------- Cửa hàng và màn Nhiệm vụ ----------
  let msg = null; // dòng thông báo ngắn ở cuối màn (mua, nhận thưởng)
  // Vị trí nút và thẻ, dùng chung cho vẽ và bấm.
  const btnY = () => H * (state === 'menu' ? 0.7 : 0.74) - 25;
  const shopBtn = () => ({ x: W / 2 - 155, y: btnY(), w: 145, h: 50 });
  const questBtn = () => ({ x: W / 2 + 10, y: btnY(), w: 145, h: 50 });
  function questLayout() {
    const cw = Math.min(W - 32, 380), ch = 88, gap = 12, top = Math.max(110, H * 0.2);
    return {
      top,
      cards: [0, 1, 2].map((i) => ({ x: W / 2 - cw / 2, y: top + i * (ch + gap), w: cw, h: ch })),
      back: { x: W / 2 - 90, y: top + 3 * (ch + gap) + 40, w: 180, h: 46 },
    };
  }
  // Cửa hàng chia trang 6 mục (2 cột × 3 hàng); hàng dưới: ◀  Quay lại  ▶.
  let shopPage = 0;
  const pageItems = () => SHOP_ITEMS.slice(shopPage * PAGE_SIZE, (shopPage + 1) * PAGE_SIZE);
  function shopLayout() {
    const cw = Math.min(W * 0.42, 180), ch = cw * 0.8, gap = 14, top = Math.max(110, H * 0.2);
    const x0 = W / 2 - cw - gap / 2, by = top + 3 * (ch + gap) + 6;
    return {
      top,
      cards: pageItems().map((_, i) => ({ x: x0 + (i % 2) * (cw + gap), y: top + Math.floor(i / 2) * (ch + gap), w: cw, h: ch })),
      back: { x: W / 2 - 90, y: by, w: 180, h: 46 },
      prev: { x: W / 2 - 150, y: by, w: 50, h: 46 },
      next: { x: W / 2 + 100, y: by, w: 50, h: 46 },
    };
  }
  function turnPage(d) {
    shopPage = (shopPage + d + pageCount) % pageCount;
    click();
  }
  const gearBtn = () => ({ x: W - 58, y: 14, w: 44, h: 44 });
  const trophyBtn = () => ({ x: 14, y: 14, w: 44, h: 44 });
  const PAGES = ['shop', 'quests', 'settings', 'ranks'];   // các màn phụ có nút Quay lại
  function ranksLayout() {
    const cw = Math.min(W - 32, 380), top = Math.max(110, H * 0.2), rh = 38, gap = 4;
    return {
      top, cards: [],
      rows: Array.from({ length: 10 }, (_, i) => ({ x: W / 2 - cw / 2, y: top + i * (rh + gap), w: cw, h: rh })),
      back: { x: W / 2 - 90, y: top + 10 * (rh + gap) + 10, w: 180, h: 46 },
    };
  }
  // Thẻ 0: nhạc nền, 1: hiệu ứng âm thanh, 2: ngôn ngữ.
  function toggleSetting(i) {
    if (i === 0) { musicOn = !musicOn; if (musicGain) musicGain.gain.value = musicOn ? 0.7 : 0; }
    if (i === 1) sfxOn = !sfxOn;
    if (i === 2) setLang(lang === 'en' ? 'vi' : 'en');
    click();
    save();
  }
  function openPage(name) { endRun(); checkDay(); state = name; msg = null; click(); }
  function toMenu() { reset(); state = 'menu'; click(); }
  function buyItem(s) {
    const have = s.id !== 'shield' && owned.includes(s.id);   // khiên thì mua bao nhiêu cũng được
    if (!have && wallet < s.price) {
      msg = { text: T.poor, life: 1.2, color: '#ff6b6b' };
      tone(200, 0.2, 'square', 0.06, 150);
      return;
    }
    if (s.id === 'shield') {
      wallet -= s.price; shieldStock++;
      msg = { text: `${T.bought} (${T.stock}: ${shieldStock})`, life: 1.2, color: '#5fd0ff' };
      tone(880, 0.12, 'sine', 0.1, 1320);
    } else if (have) {
      skin = s.id;
      click();
    } else {
      wallet -= s.price; owned.push(s.id); skin = s.id;
      msg = { text: T.bought, life: 1.2, color: '#7ef9ff' };
      [0, 4, 7, 12].forEach((n, i) => setTimeout(() => tone(midi(72 + n), 0.15, 'triangle', 0.08), i * 60));
    }
    save();
  }

  // ---------- Điều khiển ----------
  // x, y: vị trí chạm; bàn phím gọi không có toạ độ (coi như chạm ra ngoài nút).
  // ready: đã thử tải dữ liệu xong. Trước đó bỏ qua mọi thao tác, để ván chơi
  // không bắt đầu với số 0 rồi bị dữ liệu thật ghi đè giữa chừng.
  let ready = false;
  function tap(x, y) {
    if (paused || !ready) return;
    ensureAudio(); // lần chạm đầu tiên bật nhạc nền
    const hit = (r) => x !== undefined && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const menuTap = () => (hit(gearBtn()) ? openPage('settings') : hit(trophyBtn()) ? openPage('ranks')
      : hit(shopBtn()) ? openPage('shop') : hit(questBtn()) ? openPage('quests') : start());
    if (PAGES.includes(state)) {
      // Màn Cài đặt dùng chung bố cục 3 thẻ + nút Quay lại với màn Nhiệm vụ; màn Thành tích chỉ có nút Quay lại.
      const L = state === 'shop' ? shopLayout() : state === 'ranks' ? ranksLayout() : questLayout(), i = L.cards.findIndex(hit);
      if (hit(L.back)) toMenu();
      else if (L.prev && hit(L.prev)) turnPage(-1);
      else if (L.next && hit(L.next)) turnPage(1);
      else if (i >= 0) state === 'shop' ? buyItem(pageItems()[i]) : state === 'quests' ? claim(i) : toggleSetting(i);
    } else if (state === 'menu') menuTap();
    else if (state === 'play' && pl.mode === 'orbit') launch();
    else if (state === 'over' && canRevive) {   // đang mời hồi sinh: chỉ 2 nút này nhận chạm, tránh lỡ tay bỏ qua
      if (hit(reviveBtn())) watchAd('revive-once-per-run', () => { if (canRevive) revive(); });
      else if (hit(skipBtn()) && !adBusy) { click(); endRun(); }
    }
    else if (state === 'over' && !adBusy && time - overAt > 0.6) {   // đang xem quảng cáo thì không cho rời màn
      if (canDouble() && hit(doubleBtn())) watchAd('double-coins', doubleCoins);
      else menuTap();
    }
  }
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(e.clientX, e.clientY); });
  window.addEventListener('keydown', (e) => {
    if (!ready) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) tap(); }
    if (e.code === 'Escape' && PAGES.includes(state)) toMenu();
    if (state === 'shop' && e.code === 'ArrowLeft') turnPage(-1);
    if (state === 'shop' && e.code === 'ArrowRight') turnPage(1);
    const atMenu = state === 'menu' || (state === 'over' && !canRevive && time - overAt > 0.6);
    if (atMenu && e.code === 'KeyS') openPage('shop');
    if (atMenu && e.code === 'KeyQ') openPage('quests');
  });

  // Tạm dừng khi YouTube yêu cầu HOẶC khi tab bị ẩn; chỉ chạy lại khi cả hai đều cho phép.
  // Lúc dừng thì lưu ngay: người chơi hay lướt đi giữa ván, không lưu là mất xu vừa nhặt.
  let ytPaused = false, tabHidden = false;
  function syncPause() {
    const p = ytPaused || tabHidden;
    if (p === paused) return;
    paused = p;
    if (p) { save(); if (audio) audio.suspend(); }
    else { last = performance.now(); if (audio) audio.resume(); }
  }
  yt((y) => {
    y.system.onPause(() => { ytPaused = true; syncPause(); });
    y.system.onResume(() => { ytPaused = false; syncPause(); });
  });
  document.addEventListener('visibilitychange', () => { tabHidden = document.hidden; syncPause(); });

  // ---------- Cập nhật ----------
  function update(dt) {
    time += dt;
    for (const p of planets) if (p.amp) p.x = p.baseX + Math.sin(time * p.ms + p.ph) * p.amp;
    for (const r of rockets) {
      r.x += r.dir * r.v * dt;
      if (Math.abs(r.x) > ROCKET_WRAP) r.x = -r.dir * ROCKET_WRAP;
    }

    if (pl.mode === 'orbit') {
      const p = planets[pl.pi];
      pl.angle += pl.dir * p.w * dt;
      pl.x = p.x + Math.cos(pl.angle) * p.orbit;
      pl.y = p.y + Math.sin(pl.angle) * p.orbit;
    } else if (state === 'play') {
      pl.flyT += dt;
      outer: for (let s = 0; s < 4; s++) {   // chia nhỏ bước để không bay xuyên qua quỹ đạo
        pl.x += pl.vx * dt / 4; pl.y += pl.vy * dt / 4;
        for (const c of coins) if (!c.taken && (pl.x - c.x) ** 2 + (pl.y - c.y) ** 2 < 22 ** 2) collect(c);
        for (const s of shields) if (!s.taken && (pl.x - s.x) ** 2 + (pl.y - s.y) ** 2 < 24 ** 2) collectShield(s);
        for (const r of rockets) {   // thân tên lửa ~ 3 hình tròn bán kính 6 dọc theo thân
          for (const k of [-10, 0, 10]) {
            if ((pl.x - r.x - k) ** 2 + (pl.y - r.y) ** 2 < 11 ** 2) {
              const wasShielded = pl.shield && pl.inv <= 0;
              if (hurt(T.rocket)) break outer;
              if (wasShielded) {   // khiên đỡ: tên lửa nổ, bay lại từ mép xa
                burst(r.x, r.y, '#ffb030', 26); wave(r.x, r.y, 50, '#ffb030');
                r.x = -r.dir * ROCKET_WRAP;
              }
              break;
            }
          }
        }
        for (let j = pl.pi; j < Math.min(planets.length, pl.pi + 4); j++) {   // đâm mặt trăng nguy hiểm
          for (const m of planets[j].moons) {
            if (!m.hazard) continue;
            const o = moonPos(m, m.ph + time * m.w);
            if ((pl.x - planets[j].x - o.x) ** 2 + (pl.y - planets[j].y - o.y) ** 2 < (m.mr + 5) ** 2 && hurt(T.crash)) break outer;
          }
        }
        for (let j = pl.pi + 1; j < Math.min(planets.length, pl.pi + 4); j++) {
          const p = planets[j];
          if ((pl.x - p.x) ** 2 + (pl.y - p.y) ** 2 <= p.orbit ** 2) { capture(j); break outer; }
        }
      }
      const sy = (pl.y - camY) * S + H * 0.68;
      if (state === 'play' && pl.mode === 'fly' && (Math.abs(pl.x) > HALF_FIELD + 120 || sy > H + 30 || pl.flyT > 1.6)) die();
    }

    // Đuôi: lấy mẫu 60 lần/giây để dài như nhau trên mọi máy.
    // Đang bay: dài tới 36 điểm (~0,6 giây); đang quay: co dần về 14 điểm.
    if (state !== 'over') {
      for (trailT += dt; trailT >= 1 / 60; trailT -= 1 / 60) trail.push({ x: pl.x, y: pl.y });
      const max = pl.mode === 'fly' ? 36 : 14, extra = trail.length - max;
      if (extra > 0) trail.splice(0, pl.mode === 'fly' ? extra : Math.min(extra, 3));
    }
    camY += (planets[pl.pi].y - camY) * Math.min(1, dt * 4);
    shake = Math.max(0, shake - dt);
    pl.inv = Math.max(0, pl.inv - dt);
    // Lò xo co giãn: bay thì hơi dài ra, đang quay thì "thở" nhẹ.
    const target = pl.mode === 'fly' ? 1.35 : 1 + 0.06 * Math.sin(time * 6);
    pl.stv += (target - pl.st) * 300 * dt;
    pl.stv *= Math.exp(-12 * dt);
    pl.st += pl.stv * dt;
    waves = waves.filter((w) => (w.life -= dt) > 0);
    particles = particles.filter((q) => (q.life -= dt) > 0);
    for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; }
    popups = popups.filter((q) => (q.life -= dt) > 0);
    for (const q of popups) q.y -= 40 * dt;
    if (msg && (msg.life -= dt) <= 0) msg = null;
    if (state === 'over' && canRevive && !adBusy && time - overAt > REVIVE_TIME) endRun();   // hết giờ mời hồi sinh
  }

  // ---------- Vẽ ----------
  const sx = (x) => x * S + W / 2;
  const sy = (y) => (y - camY) * S + H * 0.68;

  function text(str, x, y, size, color = '#fff', weight = 800, align = 'center') {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }

  // ---------- Đầu nhân vật tự vẽ (gốc tọa độ ở tâm, r = bán kính đầu) ----------
  function dot(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
  function oval(x, y, rx, ry, c, rot = 0) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 6.283); ctx.fill(); }
  function curve(x, y, r, a0, a1, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke(); }
  function line(x0, y0, x1, y1, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function tri(ax, ay, bx, by, cx, cy, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.fill(); }
  function yellowFace(r) {
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffe66b'); g.addColorStop(1, '#f5a623');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
  }
  const PI = Math.PI;
  function teeth(x, y, w, h, n) {   // hàng răng: nền trắng + vạch chia
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h);
    for (let i = 1; i < n; i++) line(x + (w * i) / n, y, x + (w * i) / n, y + h, '#999', 1);
  }
  const FACES = {
    astro(r) {   // mũ phi hành gia trắng, kính chắn tối có vệt phản chiếu
      ctx.fillStyle = '#c9ced8'; ctx.fillRect(-r * 1.05, -r * 0.25, r * 0.25, r * 0.5); ctx.fillRect(r * 0.8, -r * 0.25, r * 0.25, r * 0.5);
      dot(0, 0, r, '#f2f4f8');
      curve(0, 0, r * 0.95, 0, 2 * PI, '#aab2c0', r * 0.08);
      const g = ctx.createLinearGradient(0, -r * 0.6, 0, r * 0.5);
      g.addColorStop(0, '#2b4c8c'); g.addColorStop(1, '#0b1630');
      oval(0, -r * 0.02, r * 0.68, r * 0.5, g);
      oval(-r * 0.28, -r * 0.22, r * 0.18, r * 0.08, 'rgba(255,255,255,0.75)', -0.5);
      dot(r * 0.25, r * 0.2, r * 0.05, 'rgba(255,255,255,0.6)');
      dot(0, -r * 0.82, r * 0.08, Math.sin(time * 6) > 0 ? '#ff4d4d' : '#7a1010');
    },
    dino(r) {   // khủng long xanh: gai lưng, mắt to, cười lộ răng nhọn
      for (let i = -2; i <= 2; i++) {
        const bx = i * r * 0.34, by = -Math.sqrt(1 - (bx / r) ** 2) * r * 0.9;   // chân gai bám theo mép đầu
        tri(bx - r * 0.17, by, bx + r * 0.17, by, bx, by - r * 0.42, '#3c9a32');
      }
      dot(0, 0, r, '#6fdc5a');
      oval(0, r * 0.35, r * 0.7, r * 0.42, '#9bec82');
      dot(-r * 0.35, -r * 0.2, r * 0.24, '#fff'); dot(r * 0.35, -r * 0.2, r * 0.24, '#fff');
      dot(-r * 0.3, -r * 0.17, r * 0.12, '#111'); dot(r * 0.4, -r * 0.17, r * 0.12, '#111');
      dot(-r * 0.15, r * 0.12, r * 0.05, '#2a6a22'); dot(r * 0.15, r * 0.12, r * 0.05, '#2a6a22');
      curve(0, r * 0.15, r * 0.5, 0.15 * PI, 0.85 * PI, '#2a6a22', r * 0.08);
      for (const s of [-1, 1]) tri(s * r * 0.28, r * 0.6, s * r * 0.16, r * 0.6, s * r * 0.22, r * 0.45, '#fff');
    },
    vampire(r) {   // mặt tái, tóc chóp nhọn giữa trán, cổ áo đỏ dựng, mắt đỏ, hai răng nanh
      tri(-r * 1.2, r * 0.9, -r * 0.6, -r * 0.2, -r * 0.2, r * 0.9, '#8a0f20');
      tri(r * 1.2, r * 0.9, r * 0.6, -r * 0.2, r * 0.2, r * 0.9, '#8a0f20');
      dot(0, 0, r, '#e8e4f0');
      ctx.fillStyle = '#1a1020';
      ctx.beginPath(); ctx.arc(0, 0, r, PI, 2 * PI); ctx.lineTo(r * 0.75, -r * 0.35); ctx.lineTo(0, -r * 0.2); ctx.lineTo(-r * 0.75, -r * 0.35); ctx.closePath(); ctx.fill();
      dot(-r * 0.32, r * 0.05, r * 0.11, '#e0102a'); dot(r * 0.32, r * 0.05, r * 0.11, '#e0102a');
      line(-r * 0.5, -r * 0.12, -r * 0.18, -r * 0.05, '#1a1020', r * 0.07);
      line(r * 0.5, -r * 0.12, r * 0.18, -r * 0.05, '#1a1020', r * 0.07);
      line(-r * 0.3, r * 0.45, r * 0.3, r * 0.45, '#7a2030', r * 0.07);
      tri(-r * 0.2, r * 0.45, -r * 0.08, r * 0.45, -r * 0.14, r * 0.68, '#fff');
      tri(r * 0.2, r * 0.45, r * 0.08, r * 0.45, r * 0.14, r * 0.68, '#fff');
    },
    grin(r) {   // mặt chanh, nháy một mắt, nụ cười rộng lệch lộ răng
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#e9ff9a'); g.addColorStop(1, '#8cc63f');
      dot(0, 0, r, g);
      curve(-r * 0.35, -r * 0.15, r * 0.16, 1.15 * PI, 1.85 * PI, '#2d3a10', r * 0.09);   // mắt nháy
      dot(r * 0.35, -r * 0.18, r * 0.12, '#2d3a10');
      line(r * 0.12, -r * 0.48, r * 0.55, -r * 0.4, '#2d3a10', r * 0.08);
      line(-r * 0.6, -r * 0.42, -r * 0.18, -r * 0.5, '#2d3a10', r * 0.08);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.12); ctx.quadraticCurveTo(0, r * 0.95, r * 0.7, r * 0.02); ctx.quadraticCurveTo(0, r * 0.35, -r * 0.6, r * 0.12); ctx.closePath();
      ctx.fillStyle = '#3a1010'; ctx.fill(); ctx.clip();
      teeth(-r * 0.6, r * 0.1, r * 1.3, r * 0.2, 7);
      ctx.restore();
    },
    crycat(r) {   // mèo trắng, mắt to long lanh ngấn lệ, miệng mếu
      for (const s of [-1, 1]) {
        tri(s * r * 0.9, -r * 0.2, s * r * 0.75, -r * 1.05, s * r * 0.2, -r * 0.75, '#f4f4f6');
        tri(s * r * 0.72, -r * 0.4, s * r * 0.65, -r * 0.85, s * r * 0.35, -r * 0.65, '#ffc6cf');
      }
      dot(0, 0, r, '#f4f4f6');
      for (const s of [-1, 1]) {
        dot(s * r * 0.36, -r * 0.08, r * 0.26, '#1c1c28');
        dot(s * r * 0.36 - r * 0.08, -r * 0.16, r * 0.1, '#fff');
        dot(s * r * 0.36 + r * 0.08, -r * 0.0, r * 0.05, '#fff');
        oval(s * r * 0.36, r * 0.17, r * 0.24, r * 0.06, 'rgba(140,210,255,0.85)');            // ngấn lệ dưới mắt
        oval(s * r * 0.5, r * 0.4, r * 0.06, r * 0.14 + Math.sin(time * 3) * r * 0.03, 'rgba(140,210,255,0.85)');   // giọt chảy
        curve(s * r * 0.36, -r * 0.48, r * 0.2, s > 0 ? 1.2 * PI : 1.55 * PI, s > 0 ? 1.45 * PI : 1.8 * PI, '#b0b0b8', r * 0.05);
      }
      tri(-r * 0.08, r * 0.2, r * 0.08, r * 0.2, 0, r * 0.3, '#ff9fb0');
      curve(0, r * 0.55, r * 0.18, 1.15 * PI, 1.85 * PI, '#8a7a80', r * 0.05);
    },
    starecat(r) {   // mèo áp sát màn hình: đầu to, mắt nhỏ cách xa, mõm lớn, nhìn chằm chằm
      for (const s of [-1, 1]) tri(s * r * 1.0, -r * 0.1, s * r * 0.95, -r * 0.95, s * r * 0.45, -r * 0.7, '#a89780');
      const g = ctx.createRadialGradient(0, r * 0.1, r * 0.1, 0, 0, r * 1.05);
      g.addColorStop(0, '#d9cbb5'); g.addColorStop(1, '#8f7f68');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.95, 0, 0, 2 * PI); ctx.fill();
      oval(0, r * 0.38, r * 0.5, r * 0.35, '#ece2d2');
      dot(-r * 0.55, -r * 0.18, r * 0.13, '#15130f'); dot(r * 0.55, -r * 0.18, r * 0.13, '#15130f');
      dot(-r * 0.58, -r * 0.22, r * 0.04, '#fff'); dot(r * 0.52, -r * 0.22, r * 0.04, '#fff');
      for (const s of [-1, 0, 1]) line(s * r * 0.18, -r * 0.75, s * r * 0.12, -r * 0.45, 'rgba(110,90,70,0.6)', r * 0.08);   // vằn trán
      oval(0, r * 0.2, r * 0.13, r * 0.09, '#c98a7a');
      line(-r * 0.15, r * 0.48, r * 0.15, r * 0.48, '#6a5a48', r * 0.05);
    },
    cool(r) {   // kính râm đen bóng + nhếch mép
      yellowFace(r);
      oval(-r * 0.36, -r * 0.12, r * 0.32, r * 0.22, '#111');
      oval(r * 0.36, -r * 0.12, r * 0.32, r * 0.22, '#111');
      line(-r * 0.1, -r * 0.2, r * 0.1, -r * 0.2, '#111', r * 0.1);
      line(-r * 0.5, -r * 0.2, -r * 0.3, -r * 0.2, 'rgba(255,255,255,0.6)', r * 0.06);   // ánh kính
      curve(r * 0.1, r * 0.25, r * 0.3, 0.15 * PI, 0.75 * PI, '#7a3d00', r * 0.1);
    },
    laugh(r) {   // mắt nhắm cong, miệng há to, hai giọt nước mắt
      yellowFace(r);
      curve(-r * 0.35, -r * 0.15, r * 0.18, 1.1 * PI, 1.9 * PI, '#7a3d00', r * 0.1);
      curve(r * 0.35, -r * 0.15, r * 0.18, 1.1 * PI, 1.9 * PI, '#7a3d00', r * 0.1);
      ctx.fillStyle = '#7a1d1d'; ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.5, 0, PI); ctx.closePath(); ctx.fill();
      oval(0, r * 0.45, r * 0.22, r * 0.12, '#ff6b81');
      oval(-r * 0.78, r * 0.05, r * 0.14, r * 0.26, '#6fc8ff');
      oval(r * 0.78, r * 0.05, r * 0.14, r * 0.26, '#6fc8ff');
    },
    smug(r) {   // mắt lim dim, một bên lông mày nhướng, cười nhếch một bên
      yellowFace(r);
      ctx.fillStyle = '#4a2600';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.35, -r * 0.1, r * 0.13, 0, PI); ctx.fill(); }
      line(-r * 0.5, -r * 0.12, -r * 0.2, -r * 0.12, '#4a2600', r * 0.07);
      line(r * 0.2, -r * 0.12, r * 0.5, -r * 0.12, '#4a2600', r * 0.07);
      line(-r * 0.55, -r * 0.38, -r * 0.18, -r * 0.32, '#4a2600', r * 0.08);
      line(r * 0.18, -r * 0.45, r * 0.55, -r * 0.55, '#4a2600', r * 0.08);
      ctx.strokeStyle = '#7a3d00'; ctx.lineWidth = r * 0.1; ctx.beginPath();
      ctx.moveTo(-r * 0.3, r * 0.38); ctx.quadraticCurveTo(r * 0.2, r * 0.45, r * 0.45, r * 0.2); ctx.stroke();
    },
    cat(r) {   // mèo cam, mắt tròn to ngơ ngác, râu
      tri(-r * 0.9, -r * 0.2, -r * 0.7, -r * 1.05, -r * 0.2, -r * 0.75, '#f29b38');
      tri(r * 0.9, -r * 0.2, r * 0.7, -r * 1.05, r * 0.2, -r * 0.75, '#f29b38');
      tri(-r * 0.72, -r * 0.4, -r * 0.65, -r * 0.85, -r * 0.35, -r * 0.65, '#ffb3c1');
      tri(r * 0.72, -r * 0.4, r * 0.65, -r * 0.85, r * 0.35, -r * 0.65, '#ffb3c1');
      dot(0, 0, r, '#f29b38');
      oval(0, r * 0.35, r * 0.5, r * 0.35, '#fff1dd');
      dot(-r * 0.35, -r * 0.1, r * 0.27, '#fff'); dot(r * 0.35, -r * 0.1, r * 0.27, '#fff');
      dot(-r * 0.3, -r * 0.05, r * 0.15, '#111'); dot(r * 0.42, -r * 0.15, r * 0.15, '#111');   // nhìn hai hướng: ngơ
      tri(-r * 0.1, r * 0.18, r * 0.1, r * 0.18, 0, r * 0.3, '#ff7a94');
      for (const s of [-1, 1]) {
        line(s * r * 0.3, r * 0.3, s * r * 1.05, r * 0.2, '#5a3a1a', r * 0.04);
        line(s * r * 0.3, r * 0.4, s * r * 1.05, r * 0.45, '#5a3a1a', r * 0.04);
      }
    },
    shiba(r) {   // chó shiba: tai nhọn, má trắng, mắt nhỏ, mũi đen
      tri(-r * 0.85, -r * 0.3, -r * 0.6, -r * 1.05, -r * 0.15, -r * 0.7, '#e0943a');
      tri(r * 0.85, -r * 0.3, r * 0.6, -r * 1.05, r * 0.15, -r * 0.7, '#e0943a');
      tri(-r * 0.68, -r * 0.45, -r * 0.57, -r * 0.85, -r * 0.32, -r * 0.65, '#fff4e0');
      tri(r * 0.68, -r * 0.45, r * 0.57, -r * 0.85, r * 0.32, -r * 0.65, '#fff4e0');
      dot(0, 0, r, '#e0943a');
      oval(0, r * 0.35, r * 0.75, r * 0.55, '#fff4e0');
      dot(-r * 0.32, -r * 0.18, r * 0.1, '#1a1a1a'); dot(r * 0.32, -r * 0.18, r * 0.1, '#1a1a1a');
      dot(-r * 0.32, -r * 0.42, r * 0.07, '#fff4e0'); dot(r * 0.32, -r * 0.42, r * 0.07, '#fff4e0');   // chấm mày
      oval(0, r * 0.12, r * 0.15, r * 0.1, '#1a1a1a');
      curve(-r * 0.1, r * 0.25, r * 0.1, 0, PI, '#1a1a1a', r * 0.05);
      curve(r * 0.1, r * 0.25, r * 0.1, 0, PI, '#1a1a1a', r * 0.05);
    },
    ninja(r) {   // mũ trùm xanh, dải băng mắt, hai đuôi khăn bay
      line(r * 0.7, -r * 0.35, r * 1.35, -r * 0.6, '#2b5fd9', r * 0.18);
      line(r * 0.7, -r * 0.3, r * 1.3, -r * 0.1, '#2b5fd9', r * 0.18);
      dot(0, 0, r, '#2b5fd9');
      oval(0, -r * 0.1, r * 0.82, r * 0.26, '#f1c9a5');
      dot(-r * 0.32, -r * 0.08, r * 0.1, '#111'); dot(r * 0.32, -r * 0.08, r * 0.1, '#111');
      line(-r * 0.55, -r * 0.3, -r * 0.15, -r * 0.2, '#111', r * 0.07);
      line(r * 0.55, -r * 0.3, r * 0.15, -r * 0.2, '#111', r * 0.07);
      ctx.fillStyle = '#c0c8d8'; ctx.fillRect(-r * 0.25, -r * 0.72, r * 0.5, r * 0.22);   // miếng kim loại trên trán
    },
    redmask(r) {   // đầu đỏ, dải mặt nạ đen, mắt trắng xếch
      dot(0, 0, r, '#e23b3b');
      oval(0, -r * 0.15, r * 0.95, r * 0.33, '#1a1a1a');
      oval(-r * 0.38, -r * 0.17, r * 0.22, r * 0.11, '#fff', 0.3);
      oval(r * 0.38, -r * 0.17, r * 0.22, r * 0.11, '#fff', -0.3);
      curve(0, r * 0.25, r * 0.3, 0.2 * PI, 0.8 * PI, '#7a1010', r * 0.1);
      tri(-r * 0.12, -r * 0.95, r * 0.12, -r * 0.95, 0, -r * 0.7, '#ffd93b');   // huy hiệu tam giác vàng
    },
    robot(r) {   // đầu vuông vàng, ăng-ten đèn đỏ, mắt LED, lưới loa
      line(0, -r * 0.8, 0, -r * 1.15, '#888', r * 0.08);
      dot(0, -r * 1.2, r * 0.13, Math.sin(time * 8) > 0 ? '#ff3b3b' : '#7a1010');
      ctx.fillStyle = '#f5c542';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-r * 0.85, -r * 0.8, r * 1.7, r * 1.6, r * 0.3); else ctx.rect(-r * 0.85, -r * 0.8, r * 1.7, r * 1.6); ctx.fill();
      ctx.fillStyle = '#1b2433'; ctx.fillRect(-r * 0.65, -r * 0.45, r * 1.3, r * 0.45);
      ctx.fillStyle = '#5ff'; ctx.fillRect(-r * 0.5, -r * 0.33, r * 0.3, r * 0.2); ctx.fillRect(r * 0.2, -r * 0.33, r * 0.3, r * 0.2);
      for (let i = -2; i <= 2; i++) line(i * r * 0.16, r * 0.25, i * r * 0.16, r * 0.55, '#8a6d1a', r * 0.07);
    },
    helm(r) {   // mũ giáp bạc, khe nhìn hình chữ T phát sáng, đinh tán
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#eef2f7'); g.addColorStop(1, '#7c8696');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#1b2433';
      ctx.fillRect(-r * 0.72, -r * 0.25, r * 1.44, r * 0.22);
      ctx.fillRect(-r * 0.1, -r * 0.25, r * 0.2, r * 0.8);
      ctx.fillStyle = `rgba(95,240,255,${0.7 + 0.3 * Math.sin(time * 4)})`;
      ctx.fillRect(-r * 0.62, -r * 0.19, r * 1.24, r * 0.09);
      for (const s of [-1, 1]) dot(s * r * 0.6, r * 0.4, r * 0.07, '#4b5563');
    },
    knight(r) {   // mũ trùm tím, mắt vàng phát sáng, trăng khuyết trên trán
      dot(0, 0, r, '#3b2a6b');
      oval(0, r * 0.2, r * 0.6, r * 0.52, '#e8c3a0');
      oval(0, -r * 0.12, r * 0.7, r * 0.28, '#3b2a6b');
      dot(-r * 0.24, r * 0.08, r * 0.1, '#ffe14d'); dot(r * 0.24, r * 0.08, r * 0.1, '#ffe14d');
      dot(0, -r * 0.6, r * 0.2, '#ffe14d'); dot(r * 0.09, -r * 0.66, r * 0.17, '#3b2a6b');
      curve(0, r * 0.38, r * 0.15, 0.2 * PI, 0.8 * PI, '#5a3a2a', r * 0.06);
    },
  };

  // Vệ tinh + vệt sáng; pts là toạ độ màn hình, cũ nhất trước.
  // ang/along: hướng và độ giãn của quả cầu (along > 1 kéo dài, < 1 bẹp; chiều ngang bù lại cho đều khối).
  function drawSat(x, y, rad, pts, s, ang = 0, along = 1) {
    // Vệt liền: nối từng đoạn giữa hai điểm, càng về đuôi càng mảnh và mờ.
    ctx.lineCap = 'round';
    const all = pts.concat([{ x, y }]);
    for (let i = 1; i < all.length; i++) {
      const k = i / all.length;
      ctx.globalAlpha = k * 0.55;
      ctx.strokeStyle = s.trail(all.length - i, time);
      ctx.lineWidth = rad * 1.7 * k;
      ctx.beginPath(); ctx.moveTo(all[i - 1].x, all[i - 1].y); ctx.lineTo(all[i].x, all[i].y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (s.face) {   // đầu nhân vật: to hơn chấm tròn, luôn đứng thẳng, nghiêng nhẹ theo độ giãn
      const r = rad * 1.7;
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = s.trail(0, time); ctx.shadowBlur = 14;
      dot(0, 0, r * 0.85, s.trail(0, time));   // quầng sáng; mặt vẽ đè lên che phần lõi
      ctx.shadowBlur = 0;
      ctx.scale(Math.min(1.25, along), 1 / Math.sqrt(Math.min(1.25, along)));
      FACES[s.face](r);
      ctx.restore();
      return;
    }
    ctx.shadowColor = s.trail(0, time); ctx.shadowBlur = 16;
    ctx.fillStyle = s.core;
    ctx.beginPath(); ctx.ellipse(x, y, rad * along, rad / Math.sqrt(along), ang, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Nửa quỹ đạo phía sau (front = false) vẽ trước hành tinh và mờ hơn; nửa phía trước vẽ sau và to hơn chút.
  // Mặt trăng nguy hiểm luôn ở phía trước, quỹ đạo tròn phẳng (dùng chung moonPos với phần va chạm).
  function drawMoons(p, x, y, front) {
    for (const m of p.moons) {
      const a = m.ph + time * m.w, s = m.hazard ? 1 : Math.sin(a);
      if ((s >= 0) !== front) continue;
      const o = moonPos(m, a);
      const mx = x + o.x * S, my = y + o.y * S;
      const size = (PSIZE * m.mr * (m.hazard ? 1 : 1 + 0.15 * s) * S) / PR;
      ctx.globalAlpha = front ? 1 : 0.7;
      ctx.drawImage(SPRITES[m.type], mx - size / 2, my - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // Hình chiếc khiên: đỉnh phẳng, đáy nhọn; s = nửa chiều cao.
  function shieldIcon(x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.8, y - s * 0.8);
    ctx.lineTo(x + s * 0.8, y - s * 0.8);
    ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.4, x, y + s);
    ctx.quadraticCurveTo(x - s * 0.8, y + s * 0.4, x - s * 0.8, y - s * 0.8);
    ctx.fill();
  }

  // Tên lửa vẽ theo hướng bay (mũi về phía dir); đơn vị thế giới, dài ~36.
  function drawRocket(r) {
    const x = sx(r.x), y = sy(r.y);
    if (y < -30 || y > H + 30) return;
    if (x < -20 || x > W + 20) {   // còn ngoài màn hình: dấu "!" ở mép phía nó sắp bay vào
      const comingIn = (x < 0) === (r.dir > 0);
      if (comingIn && Math.abs(x - W / 2) - W / 2 < 140 * S) text('!', x < 0 ? 14 : W - 14, y, 22, `rgba(255,80,80,${0.5 + 0.5 * Math.sin(time * 12)})`, 900);
      return;
    }
    ctx.save();
    ctx.translate(x, y); ctx.scale(r.dir * S, S);
    const fl = 10 + Math.random() * 8;                       // lửa phụt nhấp nháy
    ctx.fillStyle = '#ffb030';
    ctx.beginPath(); ctx.moveTo(-16, -5); ctx.lineTo(-16 - fl, 0); ctx.lineTo(-16, 5); ctx.fill();
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath(); ctx.moveTo(-16, -2.5); ctx.lineTo(-16 - fl * 0.55, 0); ctx.lineTo(-16, 2.5); ctx.fill();
    ctx.fillStyle = '#e8463c';                                // cánh
    ctx.beginPath(); ctx.moveTo(-14, -5); ctx.lineTo(-20, -11); ctx.lineTo(-8, -5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-14, 5); ctx.lineTo(-20, 11); ctx.lineTo(-8, 5); ctx.fill();
    const body = ctx.createLinearGradient(0, -6, 0, 6);       // thân trắng có khối
    body.addColorStop(0, '#ffffff'); body.addColorStop(1, '#9aa3b5');
    ctx.fillStyle = body;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-16, -6, 26, 12, 4); else ctx.rect(-16, -6, 26, 12);
    ctx.fill();
    ctx.fillStyle = '#e8463c';                                // mũi
    ctx.beginPath(); ctx.moveTo(9, -6); ctx.quadraticCurveTo(20, -4, 22, 0); ctx.quadraticCurveTo(20, 4, 9, 6); ctx.fill();
    ctx.fillStyle = '#5fd0ff'; ctx.strokeStyle = '#2b3a55'; ctx.lineWidth = 1.5;   // cửa sổ
    ctx.beginPath(); ctx.arc(1, 0, 3, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function box(r, fill, stroke) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, 12); else ctx.rect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawShop() {
    const L = shopLayout(), u = Math.min(W, H);
    text(T.shop, W / 2, L.top * 0.38, u * 0.08, '#7ef9ff', 900);
    text(`${T.coins}: ${wallet}   ·   ${shopPage + 1}/${pageCount}`, W / 2, L.top * 0.72, u * 0.045, '#ffd34d');
    pageItems().forEach((s, i) => {
      const r = L.cards[i];
      if (s.id === 'shield') {
        box(r, 'rgba(95,208,255,0.12)', '#5fd0ff');
        shieldOrb(r.x + r.w / 2, r.y + r.h * 0.36, 16 + Math.sin(time * 3) * 1.5);
        text(`${T === TEXT.vi ? s.vi : s.en} (${T.stock}: ${shieldStock})`, r.x + r.w / 2, r.y + r.h * 0.66, 15, '#fff', 700);
        text(`${s.price} ${T.coins}`, r.x + r.w / 2, r.y + r.h * 0.85, 15, wallet >= s.price ? '#ffd34d' : '#887a55', 700);
        return;
      }
      const on = s.id === skin, own = owned.includes(s.id);
      box(r, on ? 'rgba(126,249,255,0.16)' : 'rgba(255,255,255,0.06)', on ? '#7ef9ff' : 'rgba(255,255,255,0.15)');
      const cx = r.x + r.w / 2, cy = r.y + r.h * 0.36;
      const pts = Array.from({ length: 12 }, (_, k) => ({ x: cx - (12 - k) * r.w * 0.035, y: cy + Math.sin(time * 3 + k * 0.5) * 5 }));
      drawSat(cx, cy + Math.sin(time * 3 + 6) * 5, 9, pts, s);
      text(T === TEXT.vi ? s.vi : s.en, cx, r.y + r.h * 0.66, 16, '#fff', 700);
      const label = on ? T.equipped : own ? T.select : `${s.price} ${T.coins}`;
      text(label, cx, r.y + r.h * 0.85, 15, on ? '#7ef9ff' : own ? '#ccd' : wallet >= s.price ? '#ffd34d' : '#887a55', 700);
    });
    for (const [b, label] of [[L.prev, '◀'], [L.next, '▶']]) {
      box(b, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.3)');
      text(label, b.x + b.w / 2, b.y + b.h / 2, 18, '#fff', 700);
    }
    drawBack(L.back);
  }

  // Quả cầu khiên (vật phẩm trên đường bay và thẻ trong cửa hàng).
  function shieldOrb(x, y, rr) {
    const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 1, x, y, rr);
    g.addColorStop(0, 'rgba(200,240,255,0.9)'); g.addColorStop(1, 'rgba(40,140,230,0.55)');
    ctx.shadowColor = '#5fd0ff'; ctx.shadowBlur = 14;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;
    shieldIcon(x, y, rr * 0.6, '#ffffff');
  }

  // Nút Quay lại + dòng thông báo bên dưới (dùng chung cho Cửa hàng và Nhiệm vụ).
  function drawBack(r) {
    box(r, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.3)');
    text('← ' + T.back, r.x + r.w / 2, r.y + r.h / 2, 18, '#fff', 700);
    if (msg) {
      ctx.globalAlpha = Math.min(1, msg.life * 2);
      text(msg.text, W / 2, r.y + r.h + 26, 18, msg.color);
      ctx.globalAlpha = 1;
    }
  }

  function drawQuests() {
    checkDay(); // qua 0 giờ khi đang mở màn này thì đổi nhiệm vụ ngay
    const L = questLayout(), u = Math.min(W, H);
    text(T.quests, W / 2, L.top * 0.38, u * 0.08, '#7ef9ff', 900);
    text(`${T.coins}: ${wallet}`, W / 2, L.top * 0.72, u * 0.045, '#ffd34d');
    daily.ids.forEach((id, i) => {
      const q = questDef(id), r = L.cards[i], p = Math.min(daily.prog[i], q.n), got = daily.got[i], ready = canClaim(i);
      box(r, ready ? 'rgba(255,211,77,0.16)' : 'rgba(255,255,255,0.06)', ready ? '#ffd34d' : 'rgba(255,255,255,0.15)');
      text((T === TEXT.vi ? q.vi : q.en).replace('{n}', q.n), r.x + 16, r.y + 22, 16, got ? '#889' : '#fff', 700, 'left');
      text(`+${q.reward} ${T.coins}`, r.x + r.w - 16, r.y + 22, 15, '#ffd34d', 700, 'right');
      const bw = r.w - 32;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(r.x + 16, r.y + 42, bw, 10);
      ctx.fillStyle = p >= q.n ? '#5dff7a' : '#7ef9ff'; ctx.fillRect(r.x + 16, r.y + 42, (bw * p) / q.n, 10);
      text(got ? '✓ ' + T.claimed : ready ? T.claim : `${p} / ${q.n}`, r.x + r.w / 2, r.y + 70, 14, ready ? '#ffd34d' : '#aab', 700);
    });
    const now = new Date(), left = Math.max(0, (new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now) / 1000 | 0);
    const hms = [left / 3600, (left / 60) % 60, left % 60].map((v) => String(v | 0).padStart(2, '0')).join(':');
    text(`${T.reset}: ${hms}`, W / 2, L.cards[2].y + L.cards[2].h + 22, 14, '#aab', 600);
    drawBack(L.back);
  }

  function drawSettings() {
    const L = questLayout(), u = Math.min(W, H);
    text(T.settings, W / 2, L.top * 0.5, u * 0.08, '#7ef9ff', 900);
    const rows = [
      [T.music, musicOn ? T.on : T.off, musicOn ? '#5dff7a' : '#ff6b6b'],
      [T.sfx, sfxOn ? T.on : T.off, sfxOn ? '#5dff7a' : '#ff6b6b'],
      [T.language, lang === 'vi' ? 'Tiếng Việt' : 'English', '#7ef9ff'],
    ];
    rows.forEach(([label, value, color], i) => {
      const r = L.cards[i], pill = { x: r.x + r.w - 136, y: r.y + r.h / 2 - 21, w: 120, h: 42 };
      box(r, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.15)');
      text(label, r.x + 18, r.y + r.h / 2, 17, '#fff', 700, 'left');
      box(pill, 'rgba(255,255,255,0.06)', color);
      text(value, pill.x + pill.w / 2, pill.y + pill.h / 2, 16, color, 800);
    });
    drawBack(L.back);
  }

  // Nút bánh răng: 8 răng quanh một vòng tròn có lỗ ở giữa.
  function drawGear() {
    const r = gearBtn(), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    box(r, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.3)');
    ctx.fillStyle = '#dfe6ff';
    for (let k = 0; k < 8; k++) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((k * PI) / 4); ctx.fillRect(-3, -14, 6, 7); ctx.restore();
    }
    dot(cx, cy, 10, '#dfe6ff');
    dot(cx, cy, 4.5, '#2a2f4a');
  }

  // Nút cúp: thân cúp, hai quai, chân đế.
  function drawTrophy() {
    const r = trophyBtn(), cx = r.x + r.w / 2, cy = r.y + r.h / 2 - 2;
    box(r, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.3)');
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.moveTo(cx - 10, cy - 10); ctx.lineTo(cx + 10, cy - 10);
    ctx.quadraticCurveTo(cx + 10, cy + 5, cx, cy + 6); ctx.quadraticCurveTo(cx - 10, cy + 5, cx - 10, cy - 10); ctx.fill();
    curve(cx - 10, cy - 4, 5, 0.5 * PI, 1.5 * PI, '#ffd34d', 2.5);
    curve(cx + 10, cy - 4, 5, -0.5 * PI, 0.5 * PI, '#ffd34d', 2.5);
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(cx - 2, cy + 6, 4, 5); ctx.fillRect(cx - 7, cy + 11, 14, 3);
  }

  function drawRanks() {
    const L = ranksLayout(), u = Math.min(W, H);
    text(T.ranks, W / 2, L.top * 0.5, u * 0.08, '#ffd34d', 900);
    if (!runs.length) text(T.noRuns, W / 2, L.top + 60, 16, '#aab', 700);
    runs.forEach((r, i) => {
      const b = L.rows[i], me = r === lastRun, medal = ['#ffd34d', '#d6dde8', '#e0a070'][i] || '#aab';   // vàng, bạc, đồng
      box(b, me ? 'rgba(126,249,255,0.16)' : 'rgba(255,255,255,0.05)', me ? '#7ef9ff' : 'rgba(255,255,255,0.12)');
      text(`#${i + 1}`, b.x + 16, b.y + b.h / 2, 16, medal, 800, 'left');
      text(r.s, b.x + b.w / 2, b.y + b.h / 2, 18, '#fff', 800);
      const [yy, mm, dd] = r.d.split('-');
      text(`${dd}/${mm}/${yy}`, b.x + b.w - 16, b.y + b.h / 2, 14, '#aab', 600, 'right');
    });
    drawBack(L.back);
  }

  function menuButtons() {
    drawGear();
    drawTrophy();
    const s = shopBtn(), q = questBtn();
    box(s, 'rgba(255,211,77,0.14)', '#ffd34d');
    text(T.shop, s.x + s.w / 2, s.y + s.h / 2, 19, '#ffd34d', 800);
    box(q, 'rgba(126,249,255,0.12)', '#7ef9ff');
    text(T.quests, q.x + q.w / 2, q.y + q.h / 2, 19, '#7ef9ff', 800);
    if (daily && [0, 1, 2].some(canClaim)) {   // chấm đỏ: có thưởng chưa nhận
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath(); ctx.arc(q.x + q.w - 6, q.y + 6, 7, 0, 6.283); ctx.fill();
    }
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1030'); g.addColorStop(1, '#1b0f2e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const nh = (W * NEB_H) / NEB_W;   // tinh vân trôi chậm nhất (xa nhất), lặp theo chiều dọc
    for (let ny = (((-camY * S * 0.08) % nh) + nh) % nh - nh; ny < H; ny += nh) ctx.drawImage(NEBULA, 0, ny, W, nh);

    for (const s of stars) {   // sao nền trôi chậm theo camera
      const y = (((s.y * H - camY * S * s.z * 0.3) % H) + H) % H;
      ctx.globalAlpha = 0.3 + s.z;
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x * W, y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    if (shake > 0) ctx.translate(rand(-6, 6) * shake * 2.5, rand(-6, 6) * shake * 2.5);

    for (let i = 0; i < planets.length; i++) {
      const p = planets[i], x = sx(p.x), y = sy(p.y);
      if (y < -p.orbit * S - 20 || y > H + p.orbit * S + 20) continue;
      const cur = i === pl.pi;
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = `hsla(${p.hue},90%,70%,${cur ? 0.7 : 0.3})`;
      ctx.lineWidth = cur ? 2 : 1.5;
      ctx.beginPath(); ctx.arc(x, y, p.orbit * S, 0, 6.283); ctx.stroke();
      const hz = p.moons.find((m) => m.hazard);
      if (hz) {   // đường bay của mặt trăng nguy hiểm: đỏ nhạt
        ctx.strokeStyle = 'rgba(255,90,90,0.28)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, hz.d * S, 0, 6.283); ctx.stroke();
      }
      ctx.setLineDash([]);
      const size = (PSIZE * p.r * S) / PR;
      drawMoons(p, x, y, false);
      ctx.drawImage(SPRITES[p.type], x - size / 2, y - size / 2, size, size);
      drawMoons(p, x, y, true);
    }

    const spin = 0.3 + 0.7 * Math.abs(Math.cos(time * 4));   // xu xoay: bóp chiều ngang
    for (const c of coins) {
      const x = sx(c.x), y = sy(c.y);
      if (c.taken || y < -20 || y > H + 20) continue;
      ctx.fillStyle = '#ffd34d';
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 9 * S * spin, 9 * S, 0, 0, 6.283); ctx.fill(); ctx.stroke();
    }

    for (const r of rockets) drawRocket(r);
    for (const s of shields) {   // vật phẩm khiên: quả cầu xanh bập bềnh
      const x = sx(s.x), y = sy(s.y) + Math.sin(time * 3 + s.x) * 4 * S;
      if (s.taken || y < -30 || y > H + 30) continue;
      shieldOrb(x, y, 13 * S);
    }

    if (state === 'play' && pl.mode === 'orbit') {   // vạch ngắm theo hướng sẽ bay
      const dx = -Math.sin(pl.angle) * pl.dir, dy = Math.cos(pl.angle) * pl.dir;
      ctx.setLineDash([3, 7]);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx(pl.x), sy(pl.y));
      ctx.lineTo(sx(pl.x + dx * 80), sy(pl.y + dy * 80));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const w of waves) {   // sóng xung kích
      const k = 1 - w.life / 0.5;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = w.color; ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(sx(w.x), sy(w.y), w.r * S * (0.2 + 0.8 * k), 0, 6.283); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (state !== 'over' && !(pl.inv > 0 && Math.floor(time * 20) % 2)) {   // bất tử: nhấp nháy
      const px = sx(pl.x), py = sy(pl.y);
      const ang = pl.mode === 'fly' ? Math.atan2(pl.vy, pl.vx) : pl.angle + pl.dir * Math.PI / 2;
      drawSat(px, py, 7 * S, trail.map((t) => ({ x: sx(t.x), y: sy(t.y) })), curSkin(), ang, pl.st);
      if (pl.shield) {   // bong bóng khiên: viền xanh lấp lánh
        const rr = 15 * S * (1 + 0.05 * Math.sin(time * 5));
        const bg = ctx.createRadialGradient(px, py, rr * 0.5, px, py, rr);
        bg.addColorStop(0, 'rgba(95,208,255,0)'); bg.addColorStop(1, 'rgba(95,208,255,0.35)');
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(px, py, rr, 0, 6.283); ctx.fill();
        ctx.strokeStyle = `rgba(160,230,255,${0.6 + 0.3 * Math.sin(time * 8)})`; ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    for (const q of particles) {
      ctx.globalAlpha = Math.min(1, q.life * 2);
      ctx.fillStyle = q.color;
      ctx.fillRect(sx(q.x) - 2, sy(q.y) - 2, 4, 4);
    }
    for (const q of popups) {
      ctx.globalAlpha = Math.min(1, q.life * 2);
      text(q.text, Math.min(W - 80, Math.max(80, sx(q.x))), sy(q.y), 18 * S + 6, '#ffe66d');   // không để chữ tràn mép
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    const u = Math.min(W, H);
    if (state === 'play') {
      text(score, W / 2, u * 0.09 + 10, u * 0.12);
      if (combo > 1) text('x' + combo, W / 2, u * 0.17 + 10, u * 0.045, '#ffe66d');
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.arc(26, 30, 10, 0, 6.283); ctx.fill();
      ctx.textAlign = 'left';
      ctx.font = '800 22px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(runCoins, 44, 31);
      if (pl.shield) shieldIcon(W - 28, 30, 12, '#5fd0ff');
    } else {
      ctx.fillStyle = state === 'menu' || state === 'over' ? 'rgba(5,8,25,0.55)' : 'rgba(5,8,25,0.85)';
      ctx.fillRect(0, 0, W, H);
      const blink = 0.55 + 0.45 * Math.sin(time * 4);
      if (state === 'shop') drawShop();
      else if (state === 'quests') drawQuests();
      else if (state === 'settings') drawSettings();
      else if (state === 'ranks') drawRanks();
      else if (state === 'menu') {
        text(T.title, W / 2, H * 0.32, u * 0.11, '#7ef9ff', 900);
        text(`${T.best}: ${best}`, W / 2, H * 0.42, u * 0.05, '#ccd');
        text(`${T.coins}: ${wallet}`, W / 2, H * 0.48, u * 0.045, '#ffd34d');
        text(T.tap, W / 2, H * 0.58, u * 0.06, `rgba(255,255,255,${blink})`, 700);
        menuButtons();
      } else {
        text(overText, W / 2, H * 0.28, u * 0.08, '#ff6b6b', 900);
        text(score, W / 2, H * 0.4, u * 0.16);
        text(`${T.best}: ${best}`, W / 2, H * 0.5, u * 0.05, '#ccd');
        text(`${T.coins}: ${wallet}  (+${runCoins})`, W / 2, H * 0.555, u * 0.045, '#ffd34d');
        if (canRevive) {   // nút hồi sinh: thanh xanh co dần theo thời gian còn lại
          const r = reviveBtn(), s = skipBtn(), left = Math.max(0, 1 - (time - overAt) / REVIVE_TIME);
          box(r, 'rgba(93,255,122,0.12)', '#5dff7a');
          ctx.fillStyle = 'rgba(93,255,122,0.28)'; ctx.fillRect(r.x + 2, r.y + 2, (r.w - 4) * left, r.h - 4);
          text('▶ ' + T.revive, r.x + r.w / 2, r.y + r.h / 2, 17, '#ffffff', 800);
          text(T.skip, s.x + s.w / 2, s.y + s.h / 2, 15, '#aab', 700);
        } else if (time - overAt > 0.6) {
          if (canDouble()) {   // nút nhân đôi xu chiếm chỗ dòng "chạm để chơi lại", dòng đó dời xuống dưới
            const d = doubleBtn();
            box(d, 'rgba(255,211,77,0.16)', '#ffd34d');
            text(`▶ ${T.double} (+${runCoins})`, d.x + d.w / 2, d.y + d.h / 2, 17, '#ffd34d', 800);
          }
          text(T.again, W / 2, H * (canDouble() ? 0.86 : 0.64), u * 0.06, `rgba(255,255,255,${blink})`, 700);
          menuButtons();
        }
        if (msg) text(msg.text, W / 2, H * 0.63 + 100, 15, msg.color, 700);
      }
    }
  }

  // ---------- Vòng lặp ----------
  let last = performance.now(), firstFrame = true;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) update(dt);
    draw();
    if (firstFrame) { firstFrame = false; yt((y) => y.game.firstFrameReady()); }
    requestAnimationFrame(frame);
  }

  reset();
  requestAnimationFrame(frame);
  loadSave().then(checkDay)
    .finally(() => { ready = true; yt((y) => y.game.gameReady()); });
})();
