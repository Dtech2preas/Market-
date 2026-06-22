const WORKER_URL = 'https://late-frost-770c.nakiaklocko57.workers.dev';

document.addEventListener('DOMContentLoaded', () => {
    fetchAdminBusinesses();

    document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const updates = {
            businessName: document.getElementById('edit-business-name').value,
            studentName: document.getElementById('edit-student-name').value,
            description: document.getElementById('edit-description').value
        };

        try {
            const response = await fetch(`${WORKER_URL}/admin/edit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, updates })
            });
            if (!response.ok) throw new Error('Failed to update');

            document.getElementById('edit-modal').style.display = 'none';
            fetchAdminBusinesses();
        } catch (error) {
            alert('Error updating business: ' + error.message);
        }
    });
});

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

async function fetchAdminBusinesses() {
    const pendingList = document.getElementById('pending-list');
    const approvedList = document.getElementById('approved-list');

    try {
        const response = await fetch(`${WORKER_URL}/admin/businesses`);
        if (!response.ok) throw new Error('Failed to fetch');

        const businesses = await response.json();

        pendingList.innerHTML = '';
        approvedList.innerHTML = '';

        let pendingCount = 0;
        let approvedCount = 0;

        document.getElementById('total-businesses').textContent = businesses.length;

        businesses.forEach(biz => {
            const item = document.createElement('div');
            item.className = 'admin-item';

            const date = new Date(biz.timestamp).toLocaleDateString();

            const content = `
                <div>
                    <strong>${escapeHTML(biz.businessName)}</strong> (${escapeHTML(biz.category)})<br>
                    <small>Owner: ${escapeHTML(biz.studentName)} | Date: ${escapeHTML(date)} | Status: <span class="badge" style="background:${biz.status==='approved'?'var(--success-color)':biz.status==='pending'?'#ffc107':'#dc3545'}">${escapeHTML(biz.status)}</span></small>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <a href="business.html?id=${encodeURIComponent(biz.id)}" target="_blank" class="btn btn-primary" style="padding: 5px 10px; font-size: 0.8rem; width:auto;">View</a>
                    <button onclick="openEditModal('${escapeHTML(biz.id)}', '${escapeHTML(biz.businessName).replace(/'/g, "\\'")}', '${escapeHTML(biz.studentName).replace(/'/g, "\\'")}', '${escapeHTML(biz.description).replace(/'/g, "\\'")}')" class="btn btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background:#6c757d; width:auto;">Edit</button>
                    ${biz.status === 'pending' ? `<button onclick="updateStatus('${escapeHTML(biz.id)}', 'approve')" class="btn btn-success" style="padding: 5px 10px; font-size: 0.8rem;">Approve</button>` : ''}
                    ${biz.status === 'pending' ? `<button onclick="updateStatus('${escapeHTML(biz.id)}', 'reject')" class="btn btn-danger" style="padding: 5px 10px; font-size: 0.8rem;">Reject</button>` : ''}
                    ${biz.status === 'approved' ? `<button onclick="updateStatus('${escapeHTML(biz.id)}', 'disable')" class="btn btn-danger" style="padding: 5px 10px; font-size: 0.8rem;">Disable</button>` : ''}
                    ${biz.status === 'disable' || biz.status === 'reject' ? `<button onclick="updateStatus('${escapeHTML(biz.id)}', 'approve')" class="btn btn-success" style="padding: 5px 10px; font-size: 0.8rem;">Re-Approve</button>` : ''}
                </div>
            `;

            item.innerHTML = content;

            if (biz.status === 'pending') {
                pendingList.appendChild(item);
                pendingCount++;
            } else {
                approvedList.appendChild(item);
                if (biz.status === 'approved') approvedCount++;
            }
        });

        document.getElementById('pending-count').textContent = pendingCount;
        document.getElementById('approved-count').textContent = approvedCount;

        if (pendingCount === 0) pendingList.innerHTML = '<p>No pending applications.</p>';
        if (approvedList.children.length === 0) approvedList.innerHTML = '<p>No approved/other businesses.</p>';

    } catch (error) {
        console.error('Error fetching admin businesses:', error);
        pendingList.innerHTML = '<p class="status-message error" style="display:block;">Error loading data.</p>';
        approvedList.innerHTML = '';
    }
}

function openEditModal(id, bizName, studentName, description) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-business-name').value = bizName;
    document.getElementById('edit-student-name').value = studentName;
    document.getElementById('edit-description').value = description;
    document.getElementById('edit-modal').style.display = 'block';
}

async function updateStatus(id, action) {
    if (!confirm(`Are you sure you want to ${action} this business?`)) return;

    try {
        const response = await fetch(`${WORKER_URL}/admin/action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id, action })
        });

        if (!response.ok) throw new Error('Failed to update status');

        // Refresh the list
        fetchAdminBusinesses();

    } catch (error) {
        alert('Error updating status: ' + error.message);
    }
}
