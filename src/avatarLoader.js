fetch('./avatars.json')
  .then(response => response.json())
  .then(avatars => {
    document.querySelectorAll('.vignette').forEach(element => {
      const type = element.dataset.type;
      const avatarUrl = avatars[type];
			const fallbackUrl = 'assets/default-avatar.jpg';
      const avatarUrl = avatars[type] || fallbackUrl;


      if (avatarUrl) {
        element.style.setProperty('--avatar-url', `url('${avatarUrl}')`);
      } else {
        console.warn(`Avatar type "${type}" not found.`);
      }
    });
  })
  .catch(error => console.error('Error loading avatar configuration:', error));
