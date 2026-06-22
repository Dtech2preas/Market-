export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1. GET /businesses (Get approved businesses)
      if (request.method === "GET" && path === "/businesses") {
        const metadata = await env.MARKET_KV.get('businesses_metadata', { type: "json" }) || [];
        const approved = metadata.filter(b => b.status === "approved");
        return new Response(JSON.stringify(approved), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 2. GET /business/:id (Get single business)
      if (request.method === "GET" && path.startsWith("/business/")) {
        const id = path.split("/")[2];
        if (!id) return new Response("ID required", { status: 400, headers: corsHeaders });

        const data = await env.MARKET_KV.get(id, { type: "json" });
        if (!data || data.status !== "approved") {
          return new Response("Business not found", { status: 404, headers: corsHeaders });
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 3. POST /register (Submit application)
      if (request.method === "POST" && path === "/register") {
        const data = await request.json();

        // Optional: proxy image uploads to ImgBB securely
        // Note: For a production app, the key must be stored in env.IMGBB_API_KEY
        let logoUrl = '';
        let galleryUrls = [];

        const IMGBB_API_KEY = env.IMGBB_API_KEY;

        async function uploadToImgBB(base64String) {
            if (!base64String || !IMGBB_API_KEY) return null;
            // Remove data:image/jpeg;base64, prefix
            const base64Data = base64String.split(',')[1];
            if(!base64Data) return null;

            const formData = new FormData();
            formData.append('image', base64Data);

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                return result.data.url;
            }
            return null;
        }

        if (data.logoBase64) {
            logoUrl = await uploadToImgBB(data.logoBase64) || '';
        }

        if (data.galleryBase64 && data.galleryBase64.length > 0) {
            for (let i = 0; i < data.galleryBase64.length; i++) {
                const url = await uploadToImgBB(data.galleryBase64[i]);
                if (url) galleryUrls.push(url);
            }
        }

        // Generate a URL-friendly ID from business name
        const baseId = data.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const id = `${baseId}-${Date.now().toString().slice(-4)}`;

        // Delete base64 strings so they don't bloat KV storage
        delete data.logoBase64;
        delete data.galleryBase64;

        const newBusiness = {
          id: id,
          ...data,
          logoUrl: logoUrl,
          galleryUrls: galleryUrls,
          status: "pending",
          timestamp: Date.now()
        };

        // Save detailed data under id
        await env.MARKET_KV.put(id, JSON.stringify(newBusiness));

        // Update metadata index
        const metadata = await env.MARKET_KV.get('businesses_metadata', { type: "json" }) || [];
        // Save only essential fields for index view to save space
        const { about, services, whatsapp, email, school, ...metaInfo } = newBusiness;
        metadata.push(metaInfo);
        await env.MARKET_KV.put('businesses_metadata', JSON.stringify(metadata));

        return new Response(JSON.stringify({ success: true, id: id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 4. GET /admin/businesses (Get all businesses for admin)
      if (request.method === "GET" && path === "/admin/businesses") {
        const metadata = await env.MARKET_KV.get('businesses_metadata', { type: "json" }) || [];
        return new Response(JSON.stringify(metadata), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 5. POST /admin/action (Approve/Reject/Disable)
      if (request.method === "POST" && path === "/admin/action") {
        // TODO: add authentication
        const { id, action } = await request.json(); // action: "approve", "reject", "disable"

        const data = await env.MARKET_KV.get(id, { type: "json" });
        if (!data) {
          return new Response("Not found", { status: 404, headers: corsHeaders });
        }

        if (action === "approve") {
          data.status = "approved";
        } else if (action === "reject" || action === "disable") {
          data.status = action;
        }

        // Update detailed record
        await env.MARKET_KV.put(id, JSON.stringify(data));

        // Update metadata index
        let metadata = await env.MARKET_KV.get('businesses_metadata', { type: "json" }) || [];
        const index = metadata.findIndex(m => m.id === id);
        if (index !== -1) {
            metadata[index].status = data.status;
            await env.MARKET_KV.put('businesses_metadata', JSON.stringify(metadata));
        }

        return new Response(JSON.stringify({ success: true, status: data.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 6. POST /admin/edit (Edit business information)
      if (request.method === "POST" && path === "/admin/edit") {
        const { id, updates } = await request.json();

        const data = await env.MARKET_KV.get(id, { type: "json" });
        if (!data) {
          return new Response("Not found", { status: 404, headers: corsHeaders });
        }

        const updatedData = { ...data, ...updates };
        await env.MARKET_KV.put(id, JSON.stringify(updatedData));

        let metadata = await env.MARKET_KV.get('businesses_metadata', { type: "json" }) || [];
        const index = metadata.findIndex(m => m.id === id);
        if (index !== -1) {
            metadata[index] = { ...metadata[index], ...updates };
            await env.MARKET_KV.put('businesses_metadata', JSON.stringify(metadata));
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
