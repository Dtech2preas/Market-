document.addEventListener('DOMContentLoaded', () => {
  const nextBtn = document.querySelector('.btn-primary');
  if (nextBtn && nextBtn.innerText === 'Next Step') {
    nextBtn.addEventListener('click', async () => {
      const form = document.querySelector('form');
      const inputs = form.querySelectorAll('input, select');

      const name = inputs[0].value;
      const slug = inputs[1].value;
      const category = inputs[2].value;
      const province = inputs[3].value;

      if(!name || !slug || !category || !province) {
        alert("Please fill all fields");
        return;
      }

      const token = localStorage.getItem('dtech_token');

      try {
        const res = await fetch('/api/dashboard/business', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name, slug, category, province, status: 'draft'
          })
        });

        const data = await res.json();
        if (data.error) {
          alert(data.error);
        } else {
          alert('Business draft saved successfully!');
          window.location.href = '/dashboard.html';
        }
      } catch (e) {
        alert("Network error");
      }
    });
  }
});
