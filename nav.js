// Shared Navigation, Auth, and Security Helper for Campus Carpool
const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isLocal ? 'http://localhost:5001' : 'https://vit-carpool-backend.onrender.com';
const API_URL = BACKEND_URL + '/api';

const AUTH_KEY = 'carpool_auth_user';

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function setAuth(user, token) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ user, token }));
  // Also keep driverAuth in sync for backwards compatibility
  if (user && user.role === 'DRIVER') {
    localStorage.setItem('driverAuth', JSON.stringify({ driver: user, token }));
  }
  updateNav();
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem('driverAuth');
  localStorage.removeItem('carpool_member_tokens');
  updateNav();
}

function updateNav() {
  const container = document.getElementById('mainNavbar');
  if (!container) return;

  const auth = getAuth();
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';

  const navLinks = [
    { file: 'index.html', label: 'Find Rides' },
    { file: 'my-rides.html', label: 'My Bookings' },
    { file: 'driver.html', label: 'Driver Portal' },
    { file: 'admin.html', label: 'Admin Portal' },
    { file: 'privacy.html', label: 'Safety & Policy' }
  ];

  const linksHtml = navLinks.map(link => {
    const isActive = currentFile === link.file;
    return `
      <a href="${link.file}" class="nav-link ${isActive ? 'active' : ''}">
        ${link.label}
      </a>
    `;
  }).join('');

  let authStatusHtml = '';
  if (auth && auth.user) {
    const roleClass = auth.user.role === 'ADMIN' ? 'tag-brick' : auth.user.role === 'DRIVER' ? 'tag-sage' : 'tag-neutral';
    authStatusHtml = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="tag ${roleClass}" style="font-size:10.5px;">${auth.user.role}</span>
        <a href="profile.html" class="nav-link" style="font-weight:600; color:var(--ink);">
          ${auth.user.name}
        </a>
        <button onclick="logoutUser()" class="btn-outline" style="padding:4px 10px; font-size:11.5px;">Logout</button>
      </div>
    `;
  } else {
    authStatusHtml = `
      <a href="profile.html" class="btn btn-primary" style="padding:6px 14px; font-size:12.5px;">Sign In</a>
    `;
  }

  container.innerHTML = `
    <div class="wrap nav-inner">
      <a href="index.html" class="brand">
        <div class="brand-mark">C</div>
        <div class="brand-name">Campus Carpool</div>
      </a>
      <div class="nav-links">
        ${linksHtml}
        ${authStatusHtml}
      </div>
    </div>
  `;
}

function logoutUser() {
  clearAuth();
  showToast('Logged out successfully');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 400);
}

function showToast(message, isError = false) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' toast-error' : '');
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// Global Auth-Gate modal helper
function promptLoginModal(actionName = 'perform this action') {
  const old = document.getElementById('authGateModal');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'authGateModal';
  overlay.className = 'modal-overlay modal-show';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(28,28,30,.5); display:flex; align-items:center; justify-content:center; z-index:999;';

  overlay.innerHTML = `
    <div class="panel" style="max-width:440px; width:calc(100% - 40px); margin:0; box-shadow:0 8px 30px rgba(0,0,0,0.15);">
      <div class="eyebrow" style="color:var(--brick);">Authentication Required</div>
      <h2 style="margin:4px 0 10px;">Sign in to ${actionName}</h2>
      <p style="font-size:13.5px; color:var(--ink-soft); line-height:1.6; margin-bottom:20px;">
        To protect student travel privacy and prevent phone number harvesting, you must be signed in with your campus account.
      </p>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn btn-outline" id="gateCancelBtn">Cancel</button>
        <a href="profile.html" class="btn btn-primary">Sign In / Register &rarr;</a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('gateCancelBtn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

document.addEventListener('DOMContentLoaded', updateNav);
