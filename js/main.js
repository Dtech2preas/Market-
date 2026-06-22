const WORKER_URL = 'https://late-frost-770c.nakiaklocko57.workers.dev';
let allBusinesses = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchBusinesses();

    // Event listeners for filters
    document.getElementById('search-input').addEventListener('input', filterBusinesses);
    document.getElementById('category-filter').addEventListener('change', filterBusinesses);
    document.getElementById('province-filter').addEventListener('change', filterBusinesses);
});

async function fetchBusinesses() {
    const directory = document.getElementById('business-directory');
    try {
        const response = await fetch(`${WORKER_URL}/businesses`);
        if (!response.ok) throw new Error('Failed to fetch');

        allBusinesses = await response.json();

        // Apply daily rotation algorithm
        allBusinesses = rotateBusinesses(allBusinesses);

        renderBusinesses(allBusinesses);
    } catch (error) {
        console.error('Error fetching businesses:', error);
        directory.innerHTML = '<div class="status-message error" style="display:block;">Failed to load businesses. Please try again later.</div>';
    }
}

// Pseudo-random number generator based on a seed
function seededRandom(seed) {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

// Fisher-Yates shuffle using seeded random
function rotateBusinesses(businesses) {
    // Generate a seed based on the current date (YYYYMMDD)
    const today = new Date();
    // Use zero-padded string to avoid seed collision (e.g., Dec 1st vs Feb 11th)
    const seedString = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const seed = parseInt(seedString);

    let shuffled = [...businesses];

    for (let i = shuffled.length - 1; i > 0; i--) {
        // Use seeded random to get a deterministic shuffle for the day
        const j = Math.floor(seededRandom(seed + i) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function renderBusinesses(businesses) {
    const directory = document.getElementById('business-directory');
    directory.innerHTML = '';

    if (businesses.length === 0) {
        directory.innerHTML = '<div class="loading">No businesses found matching your criteria.</div>';
        return;
    }

    businesses.forEach(biz => {
        const card = document.createElement('div');
        card.className = 'card';

        card.innerHTML = `
            <div class="card-img-container">
                <img src="${escapeHTML(biz.logoUrl) || 'https://via.placeholder.com/300x180?text=No+Logo'}" alt="${escapeHTML(biz.businessName)} Logo" class="card-img">
            </div>
            <div class="card-content">
                <h3 class="card-title">${escapeHTML(biz.businessName)}</h3>
                <p class="card-meta">
                    <span class="badge">${escapeHTML(biz.category)}</span> | ${escapeHTML(biz.province)}
                </p>
                <p class="card-desc">${escapeHTML(biz.description)}</p>
                <a href="business.html?id=${encodeURIComponent(biz.id)}" class="btn btn-primary">View Business</a>
            </div>
        `;

        directory.appendChild(card);
    });
}

function filterBusinesses() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    const province = document.getElementById('province-filter').value;

    const filtered = allBusinesses.filter(biz => {
        const matchesSearch = biz.businessName.toLowerCase().includes(searchTerm) ||
                              biz.description.toLowerCase().includes(searchTerm);
        const matchesCategory = category === '' || biz.category === category;
        const matchesProvince = province === '' || biz.province === province;

        return matchesSearch && matchesCategory && matchesProvince;
    });

    renderBusinesses(filtered);
}
