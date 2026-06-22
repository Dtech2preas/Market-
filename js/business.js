const WORKER_URL = 'https://late-frost-770c.nakiaklocko57.workers.dev';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    const loading = document.getElementById('loading');
    const profile = document.getElementById('business-profile');
    const errorMsg = document.getElementById('error-message');

    if (!id) {
        loading.style.display = 'none';
        errorMsg.textContent = 'No business ID provided.';
        errorMsg.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${WORKER_URL}/business/${id}`);

        if (!response.ok) {
            throw new Error('Business not found or not approved.');
        }

        const biz = await response.json();

        // Populate DOM elements
        document.title = `${biz.businessName} - DTECH Hub`;

        document.getElementById('biz-logo').src = biz.logoUrl || 'https://via.placeholder.com/150?text=No+Logo';
        document.getElementById('biz-name').textContent = biz.businessName;
        document.getElementById('biz-category').textContent = biz.category;
        document.getElementById('biz-province').textContent = biz.province;
        document.getElementById('biz-owner').textContent = biz.studentName;

        document.getElementById('biz-about').textContent = biz.about || biz.description;

        if (biz.school) {
            document.getElementById('biz-school').textContent = biz.school;
            document.getElementById('biz-school-container').style.display = 'block';
        }

        if (biz.listings && biz.listings.length > 0) {
            document.getElementById('biz-listings-container').style.display = 'block';

            // Set dynamic title based on category
            let title = "Offerings";
            switch(biz.category) {
                case 'Service':
                case 'Beauty':
                case 'Creative':
                    title = "Services & Pricing";
                    break;
                case 'Product':
                    title = "Products";
                    break;
                case 'Food':
                    title = "Menu";
                    break;
                case 'Tutoring':
                    title = "Tutoring Subjects";
                    break;
            }
            document.getElementById('biz-listings-title').textContent = title;

            const listingsGrid = document.getElementById('biz-listings');
            listingsGrid.innerHTML = '';

            biz.listings.forEach(item => {
                const card = document.createElement('div');
                card.className = 'listing-card';

                // Add image if available
                if (item.imageUrl) {
                    const img = document.createElement('img');
                    img.src = item.imageUrl;
                    img.alt = item.name;
                    img.className = 'listing-image';
                    card.appendChild(img);
                }

                const content = document.createElement('div');
                content.className = 'listing-content';

                const header = document.createElement('div');
                header.className = 'listing-header';

                const nameEl = document.createElement('h4');
                nameEl.className = 'listing-name';
                nameEl.textContent = item.name;

                const priceEl = document.createElement('span');
                priceEl.className = 'listing-price';
                priceEl.textContent = item.price;

                header.appendChild(nameEl);
                header.appendChild(priceEl);
                content.appendChild(header);

                if (item.description) {
                    const descEl = document.createElement('p');
                    descEl.className = 'listing-desc';
                    descEl.textContent = item.description;
                    content.appendChild(descEl);
                }

                if (item.extra || item.extra2) {
                    const meta = document.createElement('div');
                    meta.className = 'listing-meta';

                    if (item.extra) {
                        const tag = document.createElement('span');
                        tag.className = 'listing-tag';
                        tag.textContent = item.extra;
                        meta.appendChild(tag);
                    }
                    if (item.extra2) {
                        const tag2 = document.createElement('span');
                        tag2.className = 'listing-tag';
                        tag2.textContent = item.extra2;
                        meta.appendChild(tag2);
                    }
                    content.appendChild(meta);
                }

                card.appendChild(content);
                listingsGrid.appendChild(card);
            });
        } else if (biz.services) {
            // Fallback for legacy businesses
            document.getElementById('biz-services').textContent = biz.services;
            document.getElementById('biz-services-container').style.display = 'block';
        }

        if (biz.socialLinks) {
            document.getElementById('biz-social').textContent = biz.socialLinks;
            document.getElementById('biz-social-container').style.display = 'block';
        }

        if (biz.galleryUrls && biz.galleryUrls.length > 0) {
            const galleryContainer = document.getElementById('biz-gallery-container');
            const gallery = document.getElementById('biz-gallery');
            gallery.innerHTML = '';
            biz.galleryUrls.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'Gallery image';
                img.style.maxWidth = '200px';
                img.style.maxHeight = '200px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '8px';
                gallery.appendChild(img);
            });
            galleryContainer.style.display = 'block';
        }

        // Format WhatsApp link
        let waNumber = biz.whatsapp.replace(/[^0-9]/g, '');
        // If it starts with 0 (South African format), replace with 27
        if (waNumber.startsWith('0')) {
            waNumber = '27' + waNumber.substring(1);
        }
        const waText = encodeURIComponent(`Hi ${biz.studentName}, I found your business ${biz.businessName} on the DTECH Student Hub and I'm interested in your services.`);
        document.getElementById('biz-whatsapp').href = `https://wa.me/${waNumber}?text=${waText}`;

        // Hide loading, show profile
        loading.style.display = 'none';
        profile.style.display = 'block';

    } catch (error) {
        console.error('Error fetching business:', error);
        loading.style.display = 'none';
        errorMsg.textContent = error.message;
        errorMsg.style.display = 'block';
    }
});
