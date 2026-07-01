// ============================================================
//  Auth helpers — shared across all app pages
// ============================================================

const Auth = {
  async getSession() {
    const { data: { session } } = await db.auth.getSession();
    return session;
  },

  async getUser() {
    const session = await this.getSession();
    return session?.user ?? null;
  },

  async getProfile(userId) {
    const { data } = await db.from('profiles').select('*').eq('id', userId).single();
    return data;
  },

  // Call on protected pages — redirects to auth if not logged in
  async requireAuth() {
    const session = await this.getSession();
    if (!session) { window.location.href = 'auth.html'; return null; }
    return session;
  },

  // Call on auth page — redirects to dashboard if already logged in
  async requireGuest() {
    const session = await this.getSession();
    if (session) window.location.href = 'dashboard.html';
  },

  async signUp(email, password, username) {
    const { data, error } = await db.auth.signUp({
      email, password,
      options: { data: { username } }
    });
    return { data, error };
  },

  async signIn(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    return { data, error };
  },

  async signOut() {
    await db.auth.signOut();
    window.location.href = 'auth.html';
  }
};

// ============================================================
//  UI helpers
// ============================================================

function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.dataset.original = btn.dataset.original || btn.textContent;
  btn.textContent = loading ? 'Please wait…' : btn.dataset.original;
}

// Avatar initials helper
function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

