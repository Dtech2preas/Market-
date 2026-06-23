document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('marketplace-container');
  if (!container) return;

  try {
    const res = await fetch('/api/marketplace');
    const businesses = await res.json();

    if (businesses.length === 0) {
      container.innerHTML = '<p>No businesses found yet.</p>';
      return;
    }

    container.innerHTML = businesses.map(b => `
      <div class="card business-card">
        <div class="cover" style="background-image: url('${b.coverImage || 'https://placehold.co/400x200'}')"></div>
        <div class="content">
          <div class="logo" style="background-image: url('https://placehold.co/100x100')"></div>
          <h3 class="title">${b.name}</h3>
          <div class="category">${b.category} • ${b.province}</div>
          ${b.status === 'verified' ? '<span class="badge badge-verified">✓ Verified Student</span>' : ''}
          <a href="/${b.slug}" class="btn btn-outline" style="width: 100%; margin-top: 16px;">View Profile</a>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p>Error loading marketplace.</p>';
  }
});
