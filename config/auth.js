const API_BASE_URL = 'http://localhost:5000/api/auth';

// ================== TOKEN HELPERS ==================
function getToken() {
  return localStorage.getItem('token');
}

function saveToken(token) {
  localStorage.setItem('token', token);
}

function removeToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

// ================== CHECK TOKEN EXPIRATION ==================
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.exp * 1000) < Date.now();
  } catch (e) {
    return true;
  }
}

// ================== REFRESH TOKEN ==================
async function refreshToken() {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token found');

    const res = await fetch(`${API_BASE_URL}/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Refresh token expired');

    if (data.token) {
      saveToken(data.token);
      console.log('Token refreshed successfully');
      return data.token;
    } else {
      throw new Error('No new token received');
    }
  } catch (err) {
    console.warn('Refresh token failed:', err.message);
    logout();
    return null;
  }
}

// ================== GET VALID TOKEN ==================
async function getValidToken() {
  let token = getToken();
  console.log('Is token expired?', isTokenExpired(token));

  if (isTokenExpired(token)) {
    console.log('Token expired, trying to refresh...');
    token = await refreshToken();
  }
  return token;
}

// ================== MAIN API FETCH ==================
async function apiFetch(url, options = {}) {
  let token = getToken();
  if (!options.headers) options.headers = {};
  if (token) options.headers['Authorization'] = `Bearer ${token}`;

  let response = await fetch(url, options);

  if (response.status === 401) {
    console.log('Access token expired, attempting refresh...');
    token = await refreshToken();
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
      response = await fetch(url, options); // retry
    } else {
      logout();
    }
  }
  return response;
}

// ================== LOGOUT ==================
function logout() {
  removeToken();
  window.location.href = 'login.html';
}

  module.exports = {
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL_MS: 4 * 24 * 60 * 60 * 1000
};
