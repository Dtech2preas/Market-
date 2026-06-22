const WORKER_URL = 'https://late-frost-770c.nakiaklocko57.workers.dev';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registration-form');
    const categorySelect = document.getElementById('category');
    const listingsSection = document.getElementById('listings-section');
    const listingsContainer = document.getElementById('listings-container');
    const addListingBtn = document.getElementById('add-listing-btn');

    let listingCount = 0;

    // Handle Category change to show/hide and customize listings
    categorySelect.addEventListener('change', (e) => {
        const type = e.target.value;
        if (type) {
            listingsSection.style.display = 'block';
            if (listingCount === 0) {
                // Add first listing automatically
                addListingFields(type);
            } else {
                // Update existing listings to match new type labels
                updateListingLabels(type);
            }
        } else {
            listingsSection.style.display = 'none';
        }
    });

    addListingBtn.addEventListener('click', () => {
        const type = categorySelect.value;
        if (type) addListingFields(type);
    });

    function getListingLabels(type) {
        switch(type) {
            case 'Service': return { name: 'Service Name', price: 'Price', desc: 'Description', extra: 'Duration (optional)' };
            case 'Product': return { name: 'Product Name', price: 'Price', desc: 'Description', img: 'Product Image' };
            case 'Food': return { name: 'Menu Item', price: 'Price', desc: 'Description', img: 'Food Image' };
            case 'Beauty': return { name: 'Service Name', price: 'Price', desc: 'Description', extra: 'Duration', img: 'Before/After Image' };
            case 'Tutoring': return { name: 'Subject', price: 'Price per Session', extra: 'Grade', extra2: 'Delivery Method (Online/In-Person)' };
            case 'Creative': return { name: 'Service Name', price: 'Starting Price', img: 'Portfolio Image' };
            default: return { name: 'Item Name', price: 'Price', desc: 'Description' };
        }
    }

    function addListingFields(type) {
        listingCount++;
        const id = listingCount;
        const labels = getListingLabels(type);

        const listingDiv = document.createElement('div');
        listingDiv.className = 'listing-item form-card';
        listingDiv.style.border = '1px solid #ddd';
        listingDiv.style.padding = '15px';
        listingDiv.style.marginBottom = '15px';
        listingDiv.style.position = 'relative';
        listingDiv.dataset.id = id;

        let html = `
            <button type="button" class="btn btn-remove-listing" style="position:absolute; top:10px; right:10px; background:#ff4444; color:white; border:none; padding:5px 10px; cursor:pointer;" onclick="this.parentElement.remove()">X</button>
            <div class="form-group">
                <label class="lbl-name">${labels.name}</label>
                <input type="text" class="listing-name" required>
            </div>
            <div class="form-group">
                <label class="lbl-price">${labels.price}</label>
                <input type="text" class="listing-price" required>
            </div>
        `;

        if (labels.desc) {
            html += `
            <div class="form-group desc-group">
                <label class="lbl-desc">${labels.desc}</label>
                <textarea class="listing-desc" rows="2"></textarea>
            </div>`;
        }

        if (labels.extra) {
            html += `
            <div class="form-group extra-group">
                <label class="lbl-extra">${labels.extra}</label>
                <input type="text" class="listing-extra">
            </div>`;
        }

        if (labels.extra2) {
            html += `
            <div class="form-group extra2-group">
                <label class="lbl-extra2">${labels.extra2}</label>
                <input type="text" class="listing-extra2">
            </div>`;
        }

        if (labels.img) {
            html += `
            <div class="form-group img-group">
                <label class="lbl-img">${labels.img}</label>
                <input type="file" class="listing-img" accept="image/*">
            </div>`;
        }

        listingDiv.innerHTML = html;
        listingsContainer.appendChild(listingDiv);
    }

    function updateListingLabels(type) {
        const labels = getListingLabels(type);
        const items = listingsContainer.querySelectorAll('.listing-item');
        items.forEach(item => {
            // This is a simplified update, for best UX it's better to just change the labels
            // if the fields exist, or clear and recreate if structure changes significantly.
            // For now we will just update existing text labels.
            const lblName = item.querySelector('.lbl-name');
            if (lblName) lblName.textContent = labels.name;

            const lblPrice = item.querySelector('.lbl-price');
            if (lblPrice) lblPrice.textContent = labels.price;
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('submit-btn');
        const statusDiv = document.getElementById('form-status');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading images...';
        statusDiv.style.display = 'none';
        statusDiv.className = 'status-message';

        try {
            // Read logo as base64 instead of direct upload
            const logoInput = document.getElementById('logo');
            const file = logoInput.files[0];
            let logoBase64 = '';

            if (file) {
                logoBase64 = await toBase64(file);
            }

            // Read gallery images
            const galleryInput = document.getElementById('gallery');
            let galleryBase64 = [];
            if (galleryInput && galleryInput.files) {
                for (let i = 0; i < galleryInput.files.length; i++) {
                    galleryBase64.push(await toBase64(galleryInput.files[i]));
                }
            }

            submitBtn.textContent = 'Submitting application...';

            // Gather listings
            const listings = [];
            const listingElements = document.querySelectorAll('.listing-item');
            for (let i = 0; i < listingElements.length; i++) {
                const item = listingElements[i];
                let imgBase64 = '';
                const imgInput = item.querySelector('.listing-img');
                if (imgInput && imgInput.files[0]) {
                    imgBase64 = await toBase64(imgInput.files[0]);
                }

                listings.push({
                    name: item.querySelector('.listing-name') ? item.querySelector('.listing-name').value : '',
                    price: item.querySelector('.listing-price') ? item.querySelector('.listing-price').value : '',
                    description: item.querySelector('.listing-desc') ? item.querySelector('.listing-desc').value : '',
                    extra: item.querySelector('.listing-extra') ? item.querySelector('.listing-extra').value : '',
                    extra2: item.querySelector('.listing-extra2') ? item.querySelector('.listing-extra2').value : '',
                    imageBase64: imgBase64
                });
            }

            // 2. Gather form data
            const businessData = {
                studentName: document.getElementById('student-name').value,
                businessName: document.getElementById('business-name').value,
                category: document.getElementById('category').value,
                province: document.getElementById('province').value,
                school: document.getElementById('school').value,
                description: document.getElementById('description').value,
                about: document.getElementById('about').value,
                whatsapp: document.getElementById('whatsapp').value,
                email: document.getElementById('email').value,
                socialLinks: document.getElementById('social-links') ? document.getElementById('social-links').value : '',
                logoBase64: logoBase64,
                galleryBase64: galleryBase64,
                listings: listings
            };

            // 3. Send to Cloudflare Worker
            const workerResponse = await fetch(`${WORKER_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(businessData)
            });

            if (!workerResponse.ok) {
                throw new Error('Failed to submit application to server');
            }

            // Success
            statusDiv.textContent = 'Application submitted successfully! It is now pending review.';
            statusDiv.classList.add('success');
            form.reset();

        } catch (error) {
            console.error('Registration error:', error);
            statusDiv.textContent = 'Error: ' + error.message;
            statusDiv.classList.add('error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Application';
        }
    });
});

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}
