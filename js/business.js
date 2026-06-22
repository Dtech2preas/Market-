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

        document.getElementById('biz-services').textContent = biz.services || 'Contact us for more details about our services and products.';

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
