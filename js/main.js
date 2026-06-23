// Basic logic for the marketplace UI
document.addEventListener('DOMContentLoaded', () => {
  const filterPills = document.querySelectorAll('.filter-pill:not(select)');

  filterPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      filterPills.forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      // Later: trigger fetch/filter logic here based on pill text
    });
  });

  // Example script to mock dynamic data insertion later
  console.log("DTECH Main JS Loaded");
});
