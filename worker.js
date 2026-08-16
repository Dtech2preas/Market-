import * as bcrypt from 'bcryptjs';
import * as jose from 'jose';

// Helper: Async hashing to avoid blocking the event loop as much as possible,
// though in workers true background threads aren't available this way.
// We'll use lower salt rounds (8) to stay within worker CPU limits.
const hashPassword = (password) => {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, 8, (err, hash) => {
      if (err) reject(err);
      else resolve(hash);
    });
  });
};

const comparePassword = (password, hash) => {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, hash, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- Helper Functions ---
    const escapeHTML = (str) => {
      if (typeof str !== 'string') return '';
      return str.replace(/[&<>"']/g, function(match) {
        switch (match) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&#39;';
          default: return match;
        }
      });
    };

    const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

    const errorResponse = (msg, status = 400) => jsonResponse({ error: msg }, status);

    const getAuthUser = async (req) => {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
      const token = authHeader.split(' ')[1];
      try {
        // We use env.JWT_SECRET which MUST be set in Cloudflare dash
        const secret = new TextEncoder().encode(env.JWT_SECRET || 'fallback-secret-for-dev-only');
        const { payload } = await jose.jwtVerify(token, secret);
        return payload; // { userId, role }
      } catch (e) {
        return null;
      }
    };

    const getBody = async (req) => {
      try { return await req.json(); } catch(e) { return {}; }
    };

    try {
      // --- ROUTING LAYER (Slug Routing) ---

      // 301 Redirect for old URLs
      if (path === '/business-profile.html' || path === '/business-dynamic.html') {
        let slug = url.searchParams.get('slug');
        if (!slug) {
          // Check if the whole query string is the slug (e.g. ?sammy)
          const search = url.search.substring(1); // remove ?
          if (search && !search.includes('=')) {
            slug = search;
          }
        }
        if (slug) {
          return Response.redirect(`https://business.dtech-services.co.za/${slug}`, 301);
        }
      }

      // Clean Slug Routing
      if (!path.startsWith('/api/') && !path.startsWith('/admin/') && !path.includes('.')) {
        const possibleSlug = path.slice(1).split('/')[0].toLowerCase();

        if (possibleSlug && !['www', 'api', 'admin', 'dashboard', 'hub'].includes(possibleSlug)) {
           const businessId = await env.MARKET_KV.get(`slug:${possibleSlug}`);

           if (businessId) {
              const businessStr = await env.MARKET_KV.get(businessId);
              if (businessStr) {
                const businessData = JSON.parse(businessStr);
                const pub = businessData.publishedVersion || businessData.draftVersion;
                if (pub) {
                  const bName = escapeHTML(pub.basic.name || '');
                  const bDesc = escapeHTML(pub.basic.description || '');
                  let bCat = escapeHTML(pub.basic.category || '');
                  if (pub.basic.type) bCat += " - " + escapeHTML(pub.basic.type);
                  const bCover = escapeHTML(pub.branding?.cover || '');
                  const bLogo = escapeHTML(pub.branding?.logo || '');

                  // Generate CTA Button server-side
                  let ctaBtn = '';
                  const waNumber = (pub.contact && pub.contact.whatsapp) ? pub.contact.whatsapp.replace(/[^0-9]/g, '') : '';
                  const ctaType = pub.cta ? escapeHTML(pub.cta.primary) : 'WhatsApp Us';

                  if (waNumber) {
                     const waMsg = encodeURIComponent(`Hi, I am interested in your business ${pub.basic.name} listed on DTECH Student Business Hub.`);
                     const waLink = `https://wa.me/${waNumber}?text=${waMsg}`;
                     ctaBtn = `<a href="${waLink}" class="btn btn-whatsapp" style="margin-top:20px;">${ctaType}</a>`;
                  }

                  let aboutHtml = `<p>${bDesc}</p>`;
                  if (pub.basic.ownerName) aboutHtml += `<p><strong>Owner:</strong> ${escapeHTML(pub.basic.ownerName)}</p>`;
                  if (pub.contact && pub.contact.address) aboutHtml += `<p><strong>Address:</strong> ${escapeHTML(pub.contact.address)}</p>`;

                  const canonicalUrl = `https://business.dtech-services.co.za/${escapeHTML(possibleSlug)}`;

                  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${bName} - DTECH Hub</title>
  <meta name="description" content="${bDesc}">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- Open Graph -->
  <meta property="og:title" content="${bName} - DTECH Hub">
  <meta property="og:description" content="${bDesc}">
  <meta property="og:image" content="${bCover || bLogo}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${bName} - DTECH Hub">
  <meta name="twitter:description" content="${bDesc}">
  <meta name="twitter:image" content="${bCover || bLogo}">

  <!-- JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "${bName}",
    "image": "${bLogo || bCover}",
    "description": "${bDesc}",
    "url": "${canonicalUrl}"
  }
  <\/script>
  <style>
:root {
  --primary: #0056b3;
  --secondary: #f8f9fa;
  --text: #333;
  --text-light: #6c757d;
  --bg: #ffffff;
  --bg-offset: #f4f6f8;
  --border: #e9ecef;
  --success: #28a745;
  --warning: #ffc107;
  --danger: #dc3545;
  --radius: 8px;
  --shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  --font: 'Inter', system-ui, -apple-system, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font);
  color: var(--text);
  background-color: var(--bg-offset);
  line-height: 1.5;
}

a {
  text-decoration: none;
  color: var(--primary);
}

/* Typography */
h1, h2, h3, h4 {
  font-weight: 600;
  color: #111;
}

/* Layout */
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

/* Header */
.navbar {
  background-color: var(--bg);
  padding: 16px 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}
.navbar .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.navbar-brand {
  font-size: 1.25rem;
  font-weight: bold;
  color: var(--primary);
}
.nav-links {
  display: flex;
  gap: 16px;
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 8px 16px;
  border-radius: var(--radius);
  font-weight: 500;
  text-align: center;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.btn-primary {
  background-color: var(--primary);
  color: white;
}
.btn-primary:hover {
  background-color: #004494;
}
.btn-outline {
  border-color: var(--primary);
  color: var(--primary);
  background: transparent;
}
.btn-outline:hover {
  background-color: var(--primary);
  color: white;
}

/* Forms */
.form-group {
  margin-bottom: 16px;
}
.form-label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}
.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-family: var(--font);
}
.form-control:focus {
  outline: none;
  border-color: var(--primary);
}

/* Cards */
.card {
  background: var(--bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  transition: transform 0.2s;
}
.card:hover {
  transform: translateY(-2px);
}

/* Marketplace Grid */
.marketplace-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  padding: 32px 0;
}

/* Business Card Specific */
.business-card .cover {
  height: 140px;
  background-color: #ddd;
  background-size: cover;
  background-position: center;
}
.business-card .content {
  padding: 16px;
  position: relative;
}
.business-card .logo {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 3px solid white;
  position: absolute;
  top: -32px;
  background-color: white;
  background-size: cover;
}
.business-card .title {
  margin-top: 32px;
  font-size: 1.1rem;
}
.business-card .category {
  font-size: 0.85rem;
  color: var(--text-light);
  margin-bottom: 12px;
}
.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: bold;
}
.badge-verified {
  background-color: #e6f4ea;
  color: var(--success);
}

/* Filter Bar */
.filter-bar {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 16px 0;
  scrollbar-width: none; /* Firefox */
}
.filter-bar::-webkit-scrollbar {
  display: none; /* Safari and Chrome */
}
.filter-pill {
  padding: 8px 16px;
  border-radius: 20px;
  background: var(--bg);
  border: 1px solid var(--border);
  white-space: nowrap;
  cursor: pointer;
}
.filter-pill.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* Auth Screens */
.auth-container {
  max-width: 400px;
  margin: 64px auto;
  padding: 32px;
  background: var(--bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

/* Dashboard Layout */
.dashboard-layout {
  display: flex;
  min-height: calc(100vh - 60px);
}
.sidebar {
  width: 250px;
  background: var(--bg);
  border-right: 1px solid var(--border);
  padding: 24px 16px;
}
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sidebar-link {
  padding: 10px 16px;
  border-radius: var(--radius);
  color: var(--text);
  font-weight: 500;
}
.sidebar-link:hover, .sidebar-link.active {
  background: var(--bg-offset);
  color: var(--primary);
}
.dashboard-content {
  flex: 1;
  padding: 32px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .dashboard-layout {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 16px;
  }
  .sidebar-nav {
    flex-direction: row;
    overflow-x: auto;
  }
  .dashboard-content {
    padding: 16px;
  }
}
:root {
    --primary-color: #0056b3;
    --secondary-color: #f8f9fa;
    --text-color: #333;
    --light-text: #666;
    --border-color: #ddd;
    --success-color: #28a745;
    --danger-color: #dc3545;
    --whatsapp-color: #25d366;
    --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: var(--font-family);
    line-height: 1.6;
    color: var(--text-color);
    background-color: #f4f7f6;
}

.container {
    width: 90%;
    max-width: 1000px;
    margin: 0 auto;
}

header {
    background: var(--primary-color);
    color: #fff;
    padding: 1rem 0;
}

header .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}

@media (min-width: 600px) {
    header .container {
        flex-direction: row;
        justify-content: space-between;
    }
}

nav a {
    color: #fff;
    text-decoration: none;
    margin-left: 15px;
    font-weight: bold;
}

nav a:hover {
    text-decoration: underline;
}

.hero {
    text-align: center;
    padding: 2rem 0;
}

.search-filters {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 20px;
}

@media (min-width: 600px) {
    .search-filters {
        flex-direction: row;
        justify-content: center;
    }
}

input[type="text"], input[type="tel"], input[type="email"], select, textarea {
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 1rem;
    width: 100%;
}

.grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 20px 0;
}

@media (min-width: 600px) {
    .grid {
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    }
}

.card {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.card-img-container {
    width: 100%;
    height: 180px;
    background: #eee;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.card-content {
    padding: 15px;
    flex-grow: 1;
}

.card-title {
    font-size: 1.2rem;
    margin-bottom: 5px;
}

.card-meta {
    font-size: 0.85rem;
    color: var(--light-text);
    margin-bottom: 10px;
}

.card-desc {
    font-size: 0.95rem;
    margin-bottom: 15px;
}

.badge {
    background: var(--primary-color);
    color: white;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
}

.btn {
    display: inline-block;
    padding: 10px 15px;
    text-align: center;
    text-decoration: none;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-weight: bold;
    width: 100%;
}

.btn-primary {
    background: var(--primary-color);
    color: #fff;
}

.btn-whatsapp {
    background: var(--whatsapp-color);
    color: #fff;
}

.btn-success { background: var(--success-color); color: #fff; width: auto;}
.btn-danger { background: var(--danger-color); color: #fff; width: auto;}

/* Forms */
.form-card {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    margin-bottom: 40px;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
}

.status-message {
    margin-top: 15px;
    padding: 10px;
    border-radius: 4px;
    display: none;
}
.status-message.success { background: #d4edda; color: #155724; display: block; }
.status-message.error { background: #f8d7da; color: #721c24; display: block; }

.loading {
    text-align: center;
    padding: 40px;
    color: var(--light-text);
    font-style: italic;
}

/* Profile Page */
.profile-container {
    background: #fff;
    border-radius: 8px;
    padding: 20px;
    margin-top: 20px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.profile-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 20px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 20px;
    margin-bottom: 20px;
}

@media (min-width: 600px) {
    .profile-header {
        flex-direction: row;
        text-align: left;
    }
}

.profile-logo {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--primary-color);
}

.profile-actions {
    margin-bottom: 20px;
}

.profile-section {
    margin-bottom: 25px;
}

.profile-section h3 {
    margin-bottom: 10px;
    color: var(--primary-color);
}

/* Listings Grid for Profiles */
.listings-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 15px;
    margin-top: 15px;
}

@media (min-width: 600px) {
    .listings-grid {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    }
}

.listing-card {
    background: #fff;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.listing-image {
    width: 100%;
    height: 150px;
    object-fit: cover;
    background: #f8f9fa;
}

.listing-content {
    padding: 15px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
}

.listing-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
    gap: 10px;
}

.listing-name {
    font-size: 1.1rem;
    color: var(--text-color);
    margin: 0;
}

.listing-price {
    font-weight: bold;
    color: var(--primary-color);
    white-space: nowrap;
}

.listing-desc {
    font-size: 0.9rem;
    color: var(--light-text);
    margin-bottom: 10px;
    flex-grow: 1;
}

.listing-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: auto;
}

.listing-tag {
    background: #e9ecef;
    color: #495057;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
}

/* Admin */
.admin-item {
    background: #fff;
    padding: 15px;
    border: 1px solid var(--border-color);
    margin-bottom: 10px;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
@media (min-width: 600px) {
    .admin-item {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }
}

footer {
    text-align: center;
    padding: 20px 0;
    margin-top: 40px;
    color: var(--light-text);
    font-size: 0.9rem;
}

</style>
  <style>
    .b-hero { position: relative; background-color: var(--primary); color: white; text-align: center; padding: 80px 16px; background-size: cover; background-position: center; }
    .b-hero::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); }
    .b-hero-content { position: relative; z-index: 1; }
    .b-logo { width: 100px; height: 100px; border-radius: 50%; border: 4px solid white; margin: 0 auto 16px; background: white; background-size: cover; }
    .b-section { padding: 48px 0; }
  </style>
</head>
<body>
  <nav class="navbar" style="position: static;">
    <div class="container">
      <a href="/" style="color: var(--text-light); font-weight: 500;">← Back to Marketplace</a>
    </div>
  </nav>

  <header class="b-hero" id="hero-section" style="${bCover ? 'background-image: url(' + bCover + ');' : ''}">
    <div class="container b-hero-content">
      <div class="b-logo" id="logo-img" style="${bLogo ? 'background-image: url(' + bLogo + ');' : ''}"></div>
      <h1 id="business-name">${bName}</h1>
      <p style="font-size: 1.2rem; opacity: 0.9;" id="business-category">${bCat}</p>
      ${ctaBtn}
    </div>
  </header>

  <main class="container">
    <section class="b-section">
       <h2>About</h2>
       <div id="business-desc">${aboutHtml}</div>
    </section>
  </main>

  <script>
     document.addEventListener('DOMContentLoaded', () => {
          const pub = ${JSON.stringify(pub).replace(/</g, '\\u003c')};
          if (!pub) return;

          const waNumber = (pub.contact && pub.contact.whatsapp) ? pub.contact.whatsapp.replace(/[^0-9]/g, '') : '';
          const ctaType = pub.cta && pub.cta.primary ? pub.cta.primary : 'WhatsApp Us';

          // Listings
          if (pub.listings && pub.listings.length > 0) {
             let listingsHtml = '\<section class="b-section container" id="listings-section"\>\<h2\>Products & Services\</h2\>\<div class="grid"\>';
             pub.listings.forEach(item => {
                let priceDisplay = '';
                if (item.priceType === 'Free Quote') priceDisplay = 'Free Quote';
                else if (item.priceType === 'From') priceDisplay = 'From R' + item.price + ' - R' + item.priceMax;
                else if (item.priceType === 'Hourly') priceDisplay = 'R' + item.price + ' / hour';
                else priceDisplay = 'R' + item.price;

                let itemImg = item.image ? '\<div class="card-img-container"\>\<img src="' + item.image + '" class="card-img"\>\</div\>' : '';
                let itemCat = item.category ? '\<span class="badge"\>' + item.category + '\</span\>' : '';

                let itemWaMsg = encodeURIComponent('Hi, I am interested in ' + item.name + ' (' + priceDisplay + ') listed on your DTECH profile.');
                let itemWaLink = waNumber ? 'https://wa.me/' + waNumber + '?text=' + itemWaMsg : '#';

                listingsHtml += '\<div class="card"\>' +
                   itemImg +
                   '\<div class="card-content"\>' +
                      itemCat +
                      '\<h3 class="card-title" style="margin-top:8px;"\>' + item.name + '\</h3\>' +
                      '\<p class="card-desc"\>' + item.desc + '\</p\>' +
                      '\<p class="card-meta"\>\<strong\>' + priceDisplay + '\</strong\>\</p\>' +
                      '\<a href="' + itemWaLink + '" class="btn btn-outline" style="margin-top:10px; display:block; text-align:center;"\>' + ctaType + '\</a\>' +
                   '\</div\>' +
                '\</div\>';
             });
             listingsHtml += '\</div\>\</section\>';
             document.querySelector('main').innerHTML += listingsHtml;
          }

          // Gallery
          if (pub.branding && pub.branding.gallery && pub.branding.gallery.length > 0) {
             let galleryHtml = '\<section class="b-section container" id="gallery-section"\>\<h2\>Gallery\</h2\>\<div class="grid"\>';
             pub.branding.gallery.filter(Boolean).forEach(img => {
                 galleryHtml += '\<div class="card-img-container" style="border-radius:8px;"\>\<img src="' + img + '" class="card-img"\>\</div\>';
             });
             galleryHtml += '\</div\>\</section\>';
             document.querySelector('main').innerHTML += galleryHtml;
          }
       });
  <\/script>
</body>
</html>`;
                  return new Response(htmlContent, { headers: { ...corsHeaders, "Content-Type": "text/html", "Cache-Control": "public, max-age=3600" } });
                }
              }
           }
        }
      }

      // --- AUTHENTICATION API ---

      if (request.method === "POST" && path === "/api/auth/register") {
        const { fullName, email, password } = await getBody(request);
        if (!email || !password || !fullName) return errorResponse("Missing fields");

        const userId = `user:${Date.now().toString(36)}`;

        const existing = await env.MARKET_KV.get(`email:${email}`);
        if (existing) return errorResponse("Email already in use");

        const passwordHash = await hashPassword(password);

        const userData = {
          id: userId,
          email,
          fullName,
          passwordHash,
          role: "student",
          createdAt: Date.now()
        };

        await env.MARKET_KV.put(userId, JSON.stringify(userData));
        await env.MARKET_KV.put(`email:${email}`, userId);

        return jsonResponse({ success: true, message: "User created" });
      }

      if (request.method === "POST" && path === "/api/auth/login") {
        const { email, password } = await getBody(request);
        if (!email || !password) return errorResponse("Missing fields");

        const userId = await env.MARKET_KV.get(`email:${email}`);
        if (!userId) return errorResponse("Invalid credentials", 401);

        const userStr = await env.MARKET_KV.get(userId);
        if (!userStr) return errorResponse("User not found", 404);

        const user = JSON.parse(userStr);

        const isValid = await comparePassword(password, user.passwordHash);
        if (!isValid) {
          return errorResponse("Invalid credentials", 401);
        }

        const secret = new TextEncoder().encode(env.JWT_SECRET || 'fallback-secret-for-dev-only');
        const token = await new jose.SignJWT({ userId: user.id, role: user.role })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('24h')
          .sign(secret);

        return jsonResponse({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
      }

      if (request.method === "GET" && path === "/api/auth/me") {
        const authPayload = await getAuthUser(request);
        if (!authPayload) return errorResponse("Unauthorized", 401);

        const userStr = await env.MARKET_KV.get(authPayload.userId);
        if (!userStr) return errorResponse("User not found", 404);

        const user = JSON.parse(userStr);
        delete user.passwordHash;

        return jsonResponse({ user });
      }

      // --- MARKETPLACE API ---

      // --- SEO SITEMAP ---
      if (request.method === "GET" && path === "/sitemap.xml") {
        const indexStr = await env.MARKET_KV.get("marketplace:index") || "[]";
        let index = JSON.parse(indexStr);
        const published = index.filter(b => ["published", "approved", "verified"].includes(b.status));

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        // Main marketplace page
        xml += `  <url>\n    <loc>https://business.dtech-services.co.za/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

        // Business profiles
        published.forEach(b => {
            // Encode slug to ensure valid XML
            const safeSlug = encodeURIComponent(b.slug || '');
            xml += `  <url>\n    <loc>https://business.dtech-services.co.za/${safeSlug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
        });

        xml += `</urlset>`;

        return new Response(xml, {
          headers: { ...corsHeaders, "Content-Type": "application/xml" }
        });
      }

      // --- MARKETPLACE API ---

      if (request.method === "GET" && path === "/api/business/check-slug") {
        const rawSlug = url.searchParams.get("slug");
        if (!rawSlug) return errorResponse("Slug required", 400);
        const slug = rawSlug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-');

        const businessId = await env.MARKET_KV.get(`slug:${slug}`);
        if (businessId) {
          // If the user checking is the owner, it's fine.
          const authPayload = await getAuthUser(request);
          if (authPayload) {
             const userBizId = await env.MARKET_KV.get(`user_business:${authPayload.userId}`);
             if (userBizId === businessId) {
                 return jsonResponse({ available: true, message: "Slug is yours" });
             }
          }
          return jsonResponse({ available: false, error: "Slug already taken" });
        }
        return jsonResponse({ available: true });
      }

      if (request.method === "GET" && path === "/api/marketplace") {
        const indexStr = await env.MARKET_KV.get("marketplace:index") || "[]";
        let index = JSON.parse(indexStr);

        const published = index.filter(b => b.status === "published" || b.status === "approved" || b.status === "verified");
        return jsonResponse(published);
      }

      if (request.method === "GET" && path.startsWith("/api/business/")) {
        const rawSlug = path.split("/")[3];
        if (!rawSlug) return errorResponse("Slug required");
        const slug = rawSlug.toLowerCase();

        const businessId = await env.MARKET_KV.get(`slug:${slug}`);
        if (!businessId) return errorResponse("Business not found", 404);

        const businessStr = await env.MARKET_KV.get(businessId);
        if (!businessStr) return errorResponse("Data error", 500);

        return jsonResponse(JSON.parse(businessStr));
      }


      // --- UPLOAD API ---
      if (request.method === "POST" && path === "/api/upload") {
        try {
          const authPayload = await getAuthUser(request);
          if (!authPayload) return errorResponse("Unauthorized", 401);

          const formData = await request.formData();
          const image = formData.get('image');
          if (!image) return errorResponse("No image provided", 400);

          const imgbbKey = env.IMGBB_API_KEY;
          if (!imgbbKey) {
            // Mock upload if no key (for local dev/testing)
            return jsonResponse({ success: true, url: 'https://via.placeholder.com/300?text=Mock+Upload' });
          }

          const imgbbFormData = new FormData();
          imgbbFormData.append('image', image);

          const uploadRes = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
            method: 'POST',
            body: imgbbFormData
          });
          const uploadData = await uploadRes.json();

          if (uploadData.success) {
            return jsonResponse({ success: true, url: uploadData.data.url });
          } else {
            return errorResponse("Upload failed", 500);
          }
        } catch(e) {
          return errorResponse("Upload error: " + e.message, 500);
        }
      }

      // --- DASHBOARD API (Requires Auth) ---

      if (request.method === "GET" && path === "/api/dashboard/my-business") {
        const authPayload = await getAuthUser(request);
        if (!authPayload) return errorResponse("Unauthorized", 401);

        const businessId = await env.MARKET_KV.get(`user_business:${authPayload.userId}`);
        if (!businessId) return errorResponse("Business not found", 404);

        const businessStr = await env.MARKET_KV.get(businessId);
        if (!businessStr) return errorResponse("Business not found", 404);

        return jsonResponse(JSON.parse(businessStr));
      }

      if (request.method === "POST" && path === "/api/dashboard/business") {
        const authPayload = await getAuthUser(request);
        if (!authPayload) return errorResponse("Unauthorized", 401);

        const data = await getBody(request);
        // Support nested structure or old structure
        const name = data.basic?.name || data.name;
        const rawSlug = data.basic?.slug || data.slug;
        const slug = rawSlug ? rawSlug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-') : null;
        const category = data.basic?.category || data.category;
        const province = data.contact?.province || data.province;

        if (!name || !slug) return errorResponse("Name and slug required");

        const existingSlugId = await env.MARKET_KV.get(`slug:${slug}`);
        let businessId = data.id;
        let existingBiz = null;

        if (!businessId) {
          if (existingSlugId) return errorResponse("Slug already taken", 400);
          businessId = `business:${Date.now().toString(36)}`;
        } else {
          // Update Mode: Ensure the user actually owns this business
          const existingBizStr = await env.MARKET_KV.get(businessId);
          if (!existingBizStr) return errorResponse("Business not found", 404);

          existingBiz = JSON.parse(existingBizStr);
          if (existingBiz.ownerId !== authPayload.userId) {
             return errorResponse("Forbidden: You do not own this business", 403);
          }

          if (existingSlugId && existingSlugId !== businessId) {
            return errorResponse("Slug already taken by another business", 400);
          }
        }

        const draftData = {
          basic: data.basic || existingBiz?.draftVersion?.basic || { name, slug, category, province, tagline: "", description: "", city: "", type: "", ownerName: "" },
          contact: data.contact || existingBiz?.draftVersion?.contact || { phone: "", whatsapp: "", email: "", address: "", socials: {} },
          branding: data.branding || existingBiz?.draftVersion?.branding || { logo: "", cover: "", gallery: [] },
          design: data.design || existingBiz?.draftVersion?.design || { color: "#3b82f6", cardStyle: "default", pattern: "solid", font: "sans", hover: "lift" },
          listings: data.listings || existingBiz?.draftVersion?.listings || [],
          sections: data.sections || existingBiz?.draftVersion?.sections || { hero: true, about: true, listings: true, gallery: false, contact: true },
          cta: data.cta || existingBiz?.draftVersion?.cta || { primary: "WhatsApp Us" }
        };

        const businessData = {
          id: businessId,
          ownerId: authPayload.userId,
          slug: draftData.basic.slug,
          status: data.status || existingBiz?.status || "draft",
          draftVersion: draftData,
          publishedVersion: existingBiz?.publishedVersion || null, // Only updated on publish
          updatedAt: Date.now()
        };

        await env.MARKET_KV.put(businessId, JSON.stringify(businessData));
        await env.MARKET_KV.put(`slug:${slug}`, businessId);
        await env.MARKET_KV.put(`user_business:${authPayload.userId}`, businessId);

        if (["published", "approved", "verified"].includes(businessData.status)) {
           let indexStr = await env.MARKET_KV.get("marketplace:index") || "[]";
           let index = JSON.parse(indexStr);

           const indexEntry = {
             id: businessId,
             slug: businessData.slug,
             name: businessData.publishedVersion?.basic?.name || businessData.draftVersion?.basic?.name,
             category: businessData.publishedVersion?.basic?.category || businessData.draftVersion?.basic?.category,
             province: businessData.publishedVersion?.contact?.province || businessData.draftVersion?.contact?.province,
             status: businessData.status,
             coverImage: businessData.publishedVersion?.branding?.cover || businessData.draftVersion?.branding?.cover || null,
             logo: businessData.publishedVersion?.branding?.logo || businessData.draftVersion?.branding?.logo || null,
             tagline: businessData.publishedVersion?.basic?.tagline || businessData.draftVersion?.basic?.tagline || "",
             description: businessData.publishedVersion?.basic?.description || businessData.draftVersion?.basic?.description || "",
             design: businessData.publishedVersion?.design || businessData.draftVersion?.design || null
           };

           const existingIdx = index.findIndex(b => b.id === businessId);
           if (existingIdx >= 0) index[existingIdx] = indexEntry;
           else index.push(indexEntry);

           await env.MARKET_KV.put("marketplace:index", JSON.stringify(index));
        }

        return jsonResponse({ success: true, businessId });
      }


      if (request.method === "POST" && path === "/api/dashboard/publish") {
        const authPayload = await getAuthUser(request);
        if (!authPayload) return errorResponse("Unauthorized", 401);

        const data = await getBody(request);
        const { id } = data;
        if (!id) return errorResponse("Business ID required");

        const existingBizStr = await env.MARKET_KV.get(id);
        if (!existingBizStr) return errorResponse("Business not found", 404);

        const existingBiz = JSON.parse(existingBizStr);
        if (existingBiz.ownerId !== authPayload.userId) {
             return errorResponse("Forbidden: You do not own this business", 403);
        }

        // Only allow publish if approved or verified
        if (!["approved", "verified"].includes(existingBiz.status)) {
            return errorResponse("Business must be approved before publishing changes", 400);
        }

        existingBiz.publishedVersion = JSON.parse(JSON.stringify(existingBiz.draftVersion));
        existingBiz.updatedAt = Date.now();

        await env.MARKET_KV.put(id, JSON.stringify(existingBiz));

        // Update index
        let indexStr = await env.MARKET_KV.get("marketplace:index") || "[]";
        let index = JSON.parse(indexStr);
        const idx = index.findIndex(b => b.id === id);

        const entry = {
             id: existingBiz.id,
             slug: existingBiz.slug,
             name: existingBiz.publishedVersion.basic.name,
             category: existingBiz.publishedVersion.basic.category,
             province: existingBiz.publishedVersion.contact.province,
             status: existingBiz.status,
             coverImage: existingBiz.publishedVersion.branding.cover || null,
             logo: existingBiz.publishedVersion.branding.logo || null,
             tagline: existingBiz.publishedVersion.basic.tagline || "",
             description: existingBiz.publishedVersion.basic.description || "",
             design: existingBiz.publishedVersion.design || null
        };

        if (idx >= 0) index[idx] = entry;
        else index.push(entry);

        await env.MARKET_KV.put("marketplace:index", JSON.stringify(index));

        return jsonResponse({ success: true });
      }

      // --- ADMIN API ---

      if (request.method === "GET" && path === "/admin/businesses") {
        try {
          const listRes = await env.MARKET_KV.list({ prefix: "business:" });
          const businesses = [];
          for (const key of listRes.keys) {
            const bizStr = await env.MARKET_KV.get(key.name);
            if (bizStr) {
              const b = JSON.parse(bizStr);
              businesses.push({
                id: b.id,
                businessName: b.draftVersion?.basic?.name || b.name,
                studentName: b.ownerId,
                category: b.draftVersion?.basic?.category || b.category,
                status: b.status,
                description: b.draftVersion?.basic?.description || "",
                timestamp: b.updatedAt || Date.now(),
                contact: b.draftVersion?.contact || {},
                branding: b.draftVersion?.branding || {},
                listings: b.draftVersion?.listings || [],
                sections: b.draftVersion?.sections || {},
                seoPropagated: b.seoPropagated || false,
                slug: b.slug
              });
            }
          }
          return jsonResponse(businesses);
        } catch (e) {
          return jsonResponse([]);
        }
      }

      if (request.method === "POST" && path === "/admin/edit") {
        const data = await getBody(request);
        const { id, updates } = data;
        if (!id || !updates) return errorResponse("Missing fields");

        const existingBizStr = await env.MARKET_KV.get(id);
        if (!existingBizStr) return errorResponse("Business not found", 404);

        const existingBiz = JSON.parse(existingBizStr);
        existingBiz.name = updates.businessName || existingBiz.name;
        // In a real app, we'd probably update the marketplace index as well here

        await env.MARKET_KV.put(id, JSON.stringify(existingBiz));
        return jsonResponse({ success: true });
      }

      if (request.method === "POST" && path === "/admin/action") {
        const data = await getBody(request);
        const { id, action } = data;
        if (!id || !action) return errorResponse("Missing fields");

        const existingBizStr = await env.MARKET_KV.get(id);
        if (!existingBizStr) return errorResponse("Business not found", 404);

        const existingBiz = JSON.parse(existingBizStr);

        if (action === "approve") {
          existingBiz.status = "approved";
          existingBiz.publishedVersion = JSON.parse(JSON.stringify(existingBiz.draftVersion)); // Auto-publish on first approval
        } else if (action === "request_changes") {
          existingBiz.status = "request_changes";
          existingBiz.adminReason = data.reason || "";
        } else if (action === "decline") {
          existingBiz.status = "declined";
          existingBiz.adminReason = data.reason || "";
        } else if (action === "disable") {
          existingBiz.status = "suspended";
        } else if (action === "propagate_seo") {
          existingBiz.seoPropagated = true;
        }

        await env.MARKET_KV.put(id, JSON.stringify(existingBiz));

        // Also update index just in case


        // Update marketplace index
        let indexStr = await env.MARKET_KV.get("marketplace:index") || "[]";
        let index = JSON.parse(indexStr);
        const idx = index.findIndex(b => b.id === id);

        if (existingBiz.status === "approved" || existingBiz.status === "verified") {
            const entry = {
                id: existingBiz.id,
                slug: existingBiz.slug,
                name: existingBiz.publishedVersion?.basic?.name || existingBiz.draftVersion?.basic?.name,
                category: existingBiz.publishedVersion?.basic?.category || existingBiz.draftVersion?.basic?.category,
                province: existingBiz.publishedVersion?.contact?.province || existingBiz.draftVersion?.contact?.province,
                status: existingBiz.status,
                coverImage: existingBiz.publishedVersion?.branding?.cover || existingBiz.draftVersion?.branding?.cover || null,
                logo: existingBiz.publishedVersion?.branding?.logo || existingBiz.draftVersion?.branding?.logo || null,
                tagline: existingBiz.publishedVersion?.basic?.tagline || existingBiz.draftVersion?.basic?.tagline || "",
                description: existingBiz.publishedVersion?.basic?.description || existingBiz.draftVersion?.basic?.description || "",
                design: existingBiz.publishedVersion?.design || existingBiz.draftVersion?.design || null
            };
            if (idx >= 0) index[idx] = entry;
            else index.push(entry);
        } else {
            if (idx >= 0) index.splice(idx, 1);
        }
        await env.MARKET_KV.put("marketplace:index", JSON.stringify(index));

        return jsonResponse({ success: true, status: existingBiz.status });
      }

      // If we reach here, and it's an API route that wasn't found
      if (path.startsWith('/api/') || path.startsWith('/admin/')) {
        return errorResponse("API Route Not Found", 404);
      }

      // Since this is a worker designed to handle both api AND static routing in this mock,
      // and we just started a local http-server for static files instead of Miniflare/Pages,
      // we'll just mock a 404 for any unhandled path that isn't a slug.
      return new Response("Not Found", { status: 404, headers: corsHeaders });

    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }
};
