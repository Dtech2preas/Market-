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

      // If not an API route and not a static asset, try resolving a slug
      if (!path.startsWith('/api/') && !path.startsWith('/css/') && !path.startsWith('/js/') && !path.includes('.')) {

        // Handle root
        if (path === '/') {
          // Typically we'd fetch index.html from CF Pages/KV, but here we'll assume CF Pages serves it.
          // In this specific mock environment, we might just let it pass through or return a mock if needed.
          // For now, we will return a 404 to let static asset handler catch it if possible.
          return new Response("Use static hosting for root", { status: 404 });
        }

        const possibleSlug = path.substring(1); // remove leading slash

        // Don't intercept known dashboard/admin paths
        if (!['dashboard', 'admin', 'search', 'category', 'login', 'register'].includes(possibleSlug.split('/')[0])) {

           const businessId = await env.MARKET_KV.get(`slug:${possibleSlug}`);

           if (businessId) {
              // It's a valid business slug! Return the dynamic HTML shell.
              // The frontend JS inside business-dynamic.html will fetch the data via API.
              // In a real setup, we'd read business-dynamic.html from KV or Pages.

              const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dynamic Business - DTECH Hub</title>
  <link rel="stylesheet" href="/css/main.css">
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

  <header class="b-hero" id="hero-section">
    <div class="container b-hero-content">
      <div class="b-logo" id="logo-img"></div>
      <h1 id="business-name">Loading...</h1>
      <p style="font-size: 1.2rem; opacity: 0.9;" id="business-category"></p>
    </div>
  </header>

  <main class="container">
    <section class="b-section">
       <h2>About</h2>
       <p id="business-desc">Details loading...</p>
    </section>
  </main>

  <script>
     // Fetch actual data
     fetch('/api/business/${possibleSlug}')
       .then(r => r.json())
       .then(data => {
          if(data.error) { document.body.innerHTML = '<h1>Not Found</h1>'; return; }
          document.getElementById('business-name').innerText = data.name;
          document.getElementById('business-category').innerText = data.category;
          if (data.content && data.content.hero && data.content.hero.coverImage) {
              document.getElementById('hero-section').style.backgroundImage = \`url('\${data.content.hero.coverImage}')\`;
          }
       });
  </script>
</body>
</html>`;
              return new Response(htmlContent, { headers: { "Content-Type": "text/html" } });
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

      if (request.method === "GET" && path === "/api/marketplace") {
        const indexStr = await env.MARKET_KV.get("marketplace:index") || "[]";
        let index = JSON.parse(indexStr);

        const published = index.filter(b => b.status === "published" || b.status === "approved" || b.status === "verified");
        return jsonResponse(published);
      }

      if (request.method === "GET" && path.startsWith("/api/business/")) {
        const slug = path.split("/")[3];
        if (!slug) return errorResponse("Slug required");

        const businessId = await env.MARKET_KV.get(`slug:${slug}`);
        if (!businessId) return errorResponse("Business not found", 404);

        const businessStr = await env.MARKET_KV.get(businessId);
        if (!businessStr) return errorResponse("Data error", 500);

        return jsonResponse(JSON.parse(businessStr));
      }

      // --- DASHBOARD API (Requires Auth) ---

      if (request.method === "POST" && path === "/api/dashboard/business") {
        const authPayload = await getAuthUser(request);
        if (!authPayload) return errorResponse("Unauthorized", 401);

        const data = await getBody(request);
        const { name, slug, category, province } = data;
        if (!name || !slug) return errorResponse("Name and slug required");

        const existingSlugId = await env.MARKET_KV.get(`slug:${slug}`);
        let businessId = data.id;

        if (!businessId) {
          if (existingSlugId) return errorResponse("Slug already taken", 400);
          businessId = `business:${Date.now().toString(36)}`;
        } else {
          // Update Mode: Ensure the user actually owns this business
          const existingBizStr = await env.MARKET_KV.get(businessId);
          if (!existingBizStr) return errorResponse("Business not found", 404);

          const existingBiz = JSON.parse(existingBizStr);
          if (existingBiz.ownerId !== authPayload.userId) {
             return errorResponse("Forbidden: You do not own this business", 403);
          }

          if (existingSlugId && existingSlugId !== businessId) {
            return errorResponse("Slug already taken by another business", 400);
          }
        }

        const businessData = {
          id: businessId,
          ownerId: authPayload.userId,
          name,
          slug,
          category,
          province,
          status: data.status || "draft",
          content: data.content || { hero: {}, sections: [] },
          listings: data.listings || [],
          updatedAt: Date.now()
        };

        await env.MARKET_KV.put(businessId, JSON.stringify(businessData));
        await env.MARKET_KV.put(`slug:${slug}`, businessId);

        if (["published", "approved", "verified"].includes(businessData.status)) {
           let indexStr = await env.MARKET_KV.get("marketplace:index") || "[]";
           let index = JSON.parse(indexStr);

           const indexEntry = {
             id: businessId,
             slug,
             name,
             category,
             province,
             status: businessData.status,
             coverImage: businessData.content?.hero?.coverImage || null
           };

           const existingIdx = index.findIndex(b => b.id === businessId);
           if (existingIdx >= 0) index[existingIdx] = indexEntry;
           else index.push(indexEntry);

           await env.MARKET_KV.put("marketplace:index", JSON.stringify(index));
        }

        return jsonResponse({ success: true, businessId });
      }

      // If we reach here, and it's an API route that wasn't found
      if (path.startsWith('/api/')) {
        return errorResponse("API Route Not Found", 404);
      }

      // Since this is a worker designed to handle both api AND static routing in this mock,
      // and we just started a local http-server for static files instead of Miniflare/Pages,
      // we'll just mock a 404 for any unhandled path that isn't a slug.
      return new Response("Not Found", { status: 404 });

    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }
};
