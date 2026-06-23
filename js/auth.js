document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('input[type="email"]').value;
      const password = loginForm.querySelector('input[type="password"]').value;

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('dtech_token', data.token);
        window.location.href = '/dashboard.html';
      } else {
        alert(data.error || 'Login failed');
      }
    });
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputs = registerForm.querySelectorAll('input');
      const fullName = inputs[0].value;
      const email = inputs[1].value;
      const password = inputs[2].value;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password })
      });
      const data = await res.json();
      if (data.success) {
        alert('Account created! Please log in.');
        window.location.href = '/login.html';
      } else {
        alert(data.error || 'Registration failed');
      }
    });
  }
});
