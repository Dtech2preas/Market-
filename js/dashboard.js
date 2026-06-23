// Common JS for Dashboard logic (Draft/Publish, Edit, etc)
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('dtech_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Load User Data
  fetch('/api/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json()).then(data => {
    if(data.error) {
      localStorage.removeItem('dtech_token');
      window.location.href = '/login.html';
    } else {
      console.log('Logged in as:', data.user);
    }
  });

  const logoutBtn = document.querySelector('a.btn-outline[href="#"]');
  if (logoutBtn && logoutBtn.innerText === 'Logout') {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('dtech_token');
      window.location.href = '/login.html';
    });
  }
});

// Admin logic mock (if admin page)
if(window.location.pathname.includes('admin')) {
    // Admin features will be wired here
    console.log("Admin module loaded");
}
