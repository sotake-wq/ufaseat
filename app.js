// ===== CONFIG =====
// Vercel env vars are injected at build time as window.__env__ via vercel.json rewrites,
// or read from import.meta.env. For plain HTML, we use a config file pattern.
const SUPABASE_URL  = window.__SUPABASE_URL__;
const SUPABASE_KEY  = window.__SUPABASE_ANON_KEY__;

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== SEAT LAYOUT =====
const LAYOUT = {
  A: { top: ['A1','A2','A3','A4'], bottom: ['A5','A6','A7','A8'] },
  B: { top: ['B1','B2','B3','B4'], bottom: ['B5','B6','B7','B8'] },
};

const STATUS_LABELS = {
  in_office: '🟢 着席中',
  away:      '🟡 離席中',
  meeting:   '🔴 会議中',
  telework:  '🔵 テレワーク',
};

// ===== STATE =====
let me = null;           // { id, email }
let myProfile = null;    // { user_id, display_name, avatar_config, status }
let mySeatId = null;     // 'A1' | null
let profiles = {};       // { [user_id]: profile }
let seats = {};          // { [seat_id]: user_id | null }

// ===== AVATAR =====
const ANIMAL_PRESETS = [
  { id: 'dog',    label: '犬',     emoji: '🐕', bg: '#FFF3E0' },
  { id: 'cat',    label: '猫',     emoji: '🐈', bg: '#E3F2FD' },
  { id: 'fox',    label: '狐',     emoji: '🦊', bg: '#FBE9E7' },
  { id: 'panda',  label: 'パンダ', emoji: '🐼', bg: '#F3E5F5' },
  { id: 'koala',  label: 'コアラ', emoji: '🐨', bg: '#E8F5E9' },
  { id: 'parrot', label: 'オウム', emoji: '🦜', bg: '#E8EAF6' },
];

function avatarUrl(cfg) {
  const animal = ANIMAL_PRESETS.find(a => a.id === (cfg && cfg.animal)) || ANIMAL_PRESETS[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="${animal.bg}"/><text x="100" y="145" font-size="110" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${animal.emoji}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const FALLBACK_AVATAR = avatarUrl(null);

// ===== SCREENS =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ===== AUTH =====
const authForm    = document.getElementById('auth-form');
const authError   = document.getElementById('auth-error');
const tabBtns     = document.querySelectorAll('.tab-btn');
const nameField   = document.getElementById('name-field');
const authSubmit  = document.getElementById('auth-submit');
let authMode = 'login';

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    authMode = btn.dataset.tab;
    if (authMode === 'register') {
      nameField.classList.remove('hidden');
      document.getElementById('email-hint').classList.remove('hidden');
      authSubmit.textContent = '新規登録';
    } else {
      nameField.classList.add('hidden');
      document.getElementById('email-hint').classList.add('hidden');
      authSubmit.textContent = 'ログイン';
    }
    authError.classList.add('hidden');
  });
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const name     = document.getElementById('display-name').value.trim();

  if (authMode === 'register') {
    if (!name) { showError('表示名を入力してください'); return; }
    if (!email.endsWith('@ufas.co.jp')) { showError('社内メールアドレス（@ufas.co.jp）でのみ登録できます'); return; }
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) { showError(error.message); return; }
    // Create profile
    await db.from('profiles').upsert({
      user_id: data.user.id,
      display_name: name,
      avatar_config: { animal: 'dog' },
      status: 'in_office',
    });
    me = data.user;
    await loadMyProfile();
    showAvatarSetup();
  } else {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) { showError(error.message); return; }
    me = data.user;
    await loadMyProfile();
    if (!myProfile || !myProfile.avatar_config) {
      showAvatarSetup();
    } else {
      startApp();
    }
  }
});

function showError(msg) {
  authError.textContent = translateAuthError(msg);
  authError.classList.remove('hidden');
}

function translateAuthError(msg) {
  if (msg.includes('Invalid login credentials'))  return 'メールアドレスまたはパスワードが正しくありません';
  if (msg.includes('Email not confirmed'))         return 'メールの確認が完了していません。登録時に届いた確認メールのリンクをクリックしてください';
  if (msg.includes('User already registered'))     return 'このメールアドレスはすでに登録されています';
  if (msg.includes('Password should be at least')) return 'パスワードは6文字以上で入力してください';
  if (msg.includes('rate limit'))                  return 'しばらく時間をおいてから再度お試しください';
  return msg;
}

// ===== PROFILE =====
async function loadMyProfile() {
  const { data } = await db.from('profiles').select('*').eq('user_id', me.id).single();
  myProfile = data;
}

// ===== AVATAR SETUP =====
let avatarCfg = { animal: 'dog' };

function showAvatarSetup() {
  avatarCfg = { animal: myProfile?.avatar_config?.animal || 'dog' };
  renderAnimalGrid();
  showScreen('avatar-screen');
}

function renderAnimalGrid() {
  const grid = document.getElementById('preset-grid');
  grid.innerHTML = '';
  ANIMAL_PRESETS.forEach(a => {
    const tile = document.createElement('div');
    tile.className = 'preset-tile' + (avatarCfg.animal === a.id ? ' active' : '');
    tile.innerHTML = `<img src="${avatarUrl({ animal: a.id })}" alt="${a.label}" /><span>${a.label}</span>`;
    tile.onclick = () => {
      document.querySelectorAll('.preset-tile').forEach(t => t.classList.remove('active'));
      tile.classList.add('active');
      avatarCfg.animal = a.id;
    };
    grid.appendChild(tile);
  });
}

document.getElementById('save-avatar').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = '保存中...';
  try {
    await db.from('profiles').upsert({
      user_id: me.id,
      display_name: myProfile?.display_name || 'ユーザー',
      avatar_config: avatarCfg,
      status: myProfile?.status || 'in_office',
    });
    await loadMyProfile();
    startApp();
  } catch (err) {
    console.warn('Save avatar error', err);
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// ===== MAIN APP =====
async function startApp() {
  showScreen('app-screen');
  buildSeatMap();
  await loadAll();
  renderAll();
  subscribeRealtime();

  // Header
  document.getElementById('me-name').textContent = myProfile.display_name;
  document.getElementById('me-avatar').src = avatarUrl(myProfile.avatar_config);

  // Restore my status button
  setActiveStatusBtn(myProfile.status);
}

async function loadAll() {
  const [profRes, seatRes] = await Promise.all([
    db.from('profiles').select('*'),
    db.from('seats').select('*'),
  ]);
  profiles = {};
  (profRes.data || []).forEach(p => { profiles[p.user_id] = p; });
  seats = {};
  (seatRes.data || []).forEach(s => {
    seats[s.seat_id] = s.occupied_by;
    if (s.occupied_by === me.id) mySeatId = s.seat_id;
  });
}

// ===== SEAT MAP BUILD =====
function buildSeatMap() {
  for (const [island, rows] of Object.entries(LAYOUT)) {
    for (const [dir, seatIds] of Object.entries(rows)) {
      const rowEl = document.getElementById(`row-${island}-${dir}`);
      rowEl.innerHTML = '';
      seatIds.forEach(seatId => {
        const el = document.createElement('div');
        el.className = 'seat';
        el.id = `seat-${seatId}`;
        el.innerHTML = `
          <div class="seat-label">${seatId}</div>
          <span class="seat-empty-icon">💺</span>
        `;
        el.addEventListener('click', () => onSeatClick(seatId));
        rowEl.appendChild(el);
      });
    }
  }
}

// ===== RENDER ALL =====
function renderAll() {
  renderSeats();
  renderMemberList();
}

function renderSeats() {
  // Reset all seats to empty first
  document.querySelectorAll('.seat').forEach(el => {
    const seatId = el.id.replace('seat-', '');
    el.className = 'seat';
    el.innerHTML = `
      <div class="seat-label">${seatId}</div>
      <span class="seat-empty-icon">💺</span>
    `;
  });

  // Fill occupied seats
  Object.entries(seats).forEach(([seatId, userId]) => {
    if (!userId) return;
    const el = document.getElementById(`seat-${seatId}`);
    if (!el) return;
    const prof = profiles[userId];
    const isMe = userId === me.id;
    const status = prof?.status || 'in_office';
    const name = prof?.display_name || '?';
    const imgSrc = avatarUrl(prof?.avatar_config);

    el.className = 'seat' + (isMe ? ' seat-mine' : ' seat-occupied-other');
    el.innerHTML = `
      <div class="seat-label">${seatId}</div>
      <img class="seat-avatar-img" src="${imgSrc}" alt="${name}" onerror="this.onerror=null;this.src='${FALLBACK_AVATAR}'" />
      <div class="seat-user-name">${name}</div>
      <div class="status-badge ${status}"></div>
    `;
  });

  // If telework, disable all empty seats for me
  if (myProfile?.status === 'telework') {
    document.querySelectorAll('.seat:not(.seat-mine):not(.seat-occupied-other)').forEach(el => {
      el.classList.add('seat-telework-locked');
    });
  }
}

function renderMemberList() {
  const list = document.getElementById('member-list');
  list.innerHTML = '';
  // ステータス順（着席中→離席中→会議中→テレワーク）でソート
  const statusOrder = { in_office: 0, away: 1, meeting: 2, telework: 3 };
  const sorted = Object.values(profiles).sort((a, b) => {
    const oa = statusOrder[a.status] ?? 99;
    const ob = statusOrder[b.status] ?? 99;
    if (oa !== ob) return oa - ob;
    return (a.display_name || '').localeCompare(b.display_name || '', 'ja');
  });
  sorted.forEach(prof => {
    const mySeat = Object.entries(seats).find(([, uid]) => uid === prof.user_id)?.[0];
    const item = document.createElement('div');
    item.className = 'member-item';
    item.innerHTML = `
      <div class="member-avatar">
        <img src="${avatarUrl(prof.avatar_config)}" alt="${prof.display_name}" onerror="this.onerror=null;this.src='${FALLBACK_AVATAR}'" />
        <div class="member-badge ${prof.status || 'in_office'}"></div>
      </div>
      <div class="member-info">
        <div class="member-name">${prof.display_name}</div>
        <div class="member-status-text">${STATUS_LABELS[prof.status] || ''}</div>
        ${mySeat ? `<div class="member-seat">${mySeat}</div>` : ''}
      </div>
    `;
    list.appendChild(item);
  });
}

// ===== SEAT CLICK =====
async function onSeatClick(seatId) {
  if (myProfile?.status === 'telework') return;
  const occupiedBy = seats[seatId];

  if (occupiedBy && occupiedBy !== me.id) return; // other person

  if (occupiedBy === me.id) {
    // Leave seat
    await db.from('seats').update({ occupied_by: null, updated_at: new Date().toISOString() }).eq('seat_id', seatId);
    seats[seatId] = null;
    mySeatId = null;
    renderAll();
  } else {
    // Leave current seat first
    if (mySeatId) {
      await db.from('seats').update({ occupied_by: null, updated_at: new Date().toISOString() }).eq('seat_id', mySeatId);
      seats[mySeatId] = null;
      mySeatId = null;
    }
    // Sit down (only if still empty — conflict guard)
    const { data, error } = await db.from('seats')
      .update({ occupied_by: me.id, updated_at: new Date().toISOString() })
      .eq('seat_id', seatId)
      .is('occupied_by', null)
      .select();
    if (error) { console.warn('Seat update error', error); return; }
    if (!data || data.length === 0) {
      // 0行更新 = 座席が取られたかDBに行がない → リロードして反映
      await loadAll();
      renderAll();
      return;
    }
    seats[seatId] = me.id;
    mySeatId = seatId;
    renderAll();
  }
}

// ===== STATUS CHANGE =====
document.getElementById('status-selector').addEventListener('click', async (e) => {
  const btn = e.target.closest('.status-btn');
  if (!btn) return;
  const newStatus = btn.dataset.status;

  if (newStatus === 'telework' && mySeatId) {
    // Leave seat on telework
    await db.from('seats').update({ occupied_by: null, updated_at: new Date().toISOString() }).eq('seat_id', mySeatId);
    mySeatId = null;
  }

  await db.from('profiles')
    .update({ status: newStatus })
    .eq('user_id', me.id);

  myProfile.status = newStatus;
  setActiveStatusBtn(newStatus);
});

function setActiveStatusBtn(status) {
  document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.status-btn[data-status="${status}"]`);
  if (btn) btn.classList.add('active');
}

// ===== REALTIME =====
function subscribeRealtime() {
  db.channel('app-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'seats' }, async (payload) => {
      const s = payload.new || payload.old;
      if (s?.seat_id) seats[s.seat_id] = payload.new?.occupied_by ?? null;
      // Update mySeatId if affected
      if (payload.new?.occupied_by === me.id) mySeatId = s.seat_id;
      if (payload.old?.occupied_by === me.id && !payload.new?.occupied_by) {
        if (mySeatId === s.seat_id) mySeatId = null;
      }
      renderAll();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async (payload) => {
      const p = payload.new;
      if (p) {
        profiles[p.user_id] = p;
        if (p.user_id === me.id) {
          myProfile = p;
          document.getElementById('me-avatar').src = avatarUrl(p.avatar_config);
          document.getElementById('me-name').textContent = p.display_name;
          setActiveStatusBtn(p.status);
        }
      }
      renderAll();
    })
    .subscribe();
}

// ===== LOGOUT =====
document.getElementById('logout-btn').addEventListener('click', async () => {
  if (mySeatId) {
    await db.from('seats').update({ occupied_by: null, updated_at: new Date().toISOString() }).eq('seat_id', mySeatId);
  }
  await db.auth.signOut();
  location.reload();
});

// ===== EDIT AVATAR =====
document.getElementById('edit-avatar-btn').addEventListener('click', () => {
  showAvatarSetup();
});

// ===== INIT =====
(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    me = session.user;
    await loadMyProfile();
    if (!myProfile?.avatar_config) {
      showAvatarSetup();
    } else {
      startApp();
    }
  } else {
    showScreen('auth-screen');
  }
})();
