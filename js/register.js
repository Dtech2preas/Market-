const WORKER_URL = 'https://late-frost-770c.nakiaklocko57.workers.dev';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registration-form');

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

            // 2. Gather form data
            const businessData = {
                studentName: document.getElementById('student-name').value,
                businessName: document.getElementById('business-name').value,
                category: document.getElementById('category').value,
                province: document.getElementById('province').value,
                school: document.getElementById('school').value,
                description: document.getElementById('description').value,
                about: document.getElementById('about').value,
                services: document.getElementById('services').value,
                whatsapp: document.getElementById('whatsapp').value,
                email: document.getElementById('email').value,
                socialLinks: document.getElementById('social-links') ? document.getElementById('social-links').value : '',
                logoBase64: logoBase64,
                galleryBase64: galleryBase64
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
