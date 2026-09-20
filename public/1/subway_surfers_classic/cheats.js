function createLockObject() {
      // Create and style the tab container
    const tabContainer = document.createElement('div');
    tabContainer.style.position = 'fixed';
    tabContainer.style.top = '50%';
    tabContainer.style.right = '0';
    tabContainer.style.transform = 'translateY(-50%)';
    tabContainer.style.zIndex = '9999';

    // Create and style the tab
    const tab = document.createElement('div');
    tab.style.backgroundColor = '#135dd4';
    tab.style.padding = '10px';
    tab.style.cursor = 'pointer';
    tab.style.borderRadius = '5px 0 0 5px';
    tab.style.marginBottom = '5px';
    tab.style.boxShadow = '-2px 2px 5px rgba(0,0,0,0.2)';

    // Add the lock image
    const lockImg = document.createElement('img');
    lockImg.src = '/games/games/subway_surfers_classic/lock.png';
    lockImg.style.width = '30px';
    lockImg.style.height = '30px';
    tab.appendChild(lockImg);

    // Create and style the content panel
    const contentPanel = document.createElement('div');
    contentPanel.style.display = 'none';
    contentPanel.style.backgroundColor = '#f0f0f0';
    contentPanel.style.padding = '15px';
    contentPanel.style.borderRadius = '5px 0 0 5px';
    contentPanel.style.boxShadow = '-2px 2px 5px rgba(0,0,0,0.2)';

    // Add the title
    const title = document.createElement('h3');
    title.innerHTML = '<strong>Cheats</strong>';
    title.style.fontFamily = 'Arial, sans-serif';
    title.style.margin = '0 0 5px 0';
    contentPanel.appendChild(title);

    // Add the subtitle
    const subtitle = document.createElement('p');
    subtitle.textContent = '(Reload for changes to take effect)';
    subtitle.style.fontFamily = 'Arial, sans-serif';
    subtitle.style.fontSize = '12px';
    subtitle.style.margin = '0 0 10px 0';
    subtitle.style.color = '#666';
    contentPanel.appendChild(subtitle);

    const title2 = document.createElement('h4');
    title2.innerHTML = '<strong>Change Highscore</strong>';
    title2.style.fontFamily = 'Arial, sans-serif';
    title2.style.margin = '0 0 5px 0';

    // Create and style the infinite coins button
    const coinsButton = document.createElement('button');
    coinsButton.textContent = 'Infinite Coins';
    coinsButton.style.padding = '8px 15px';
    coinsButton.style.backgroundColor = '#4CAF50';
    coinsButton.style.color = 'white';
    coinsButton.style.border = 'none';
    coinsButton.style.borderRadius = '3px';
    coinsButton.style.cursor = 'pointer';
    coinsButton.style.width = '100%';
    coinsButton.style.marginBottom = '10px';

    const keysButton = document.createElement('button');
    keysButton.textContent = 'Infinite Keys';
    keysButton.style.padding = '8px 15px';
    keysButton.style.backgroundColor = '#4CAF50';
    keysButton.style.color = 'white';
    keysButton.style.border = 'none';
    keysButton.style.borderRadius = '3px';
    keysButton.style.cursor = 'pointer';
    keysButton.style.width = '100%';
    keysButton.style.marginBottom = '10px';

    const boardButton = document.createElement('button');
    boardButton.textContent = 'Infinite Boards';
    boardButton.style.padding = '8px 15px';
    boardButton.style.backgroundColor = '#4CAF50';
    boardButton.style.color = 'white';
    boardButton.style.border = 'none';
    boardButton.style.borderRadius = '3px';
    boardButton.style.cursor = 'pointer';
    boardButton.style.width = '100%';
    boardButton.style.marginBottom = '10px';

    // Add hover effect
    coinsButton.onmouseover = () => coinsButton.style.backgroundColor = '#45a049';
    coinsButton.onmouseout = () => coinsButton.style.backgroundColor = '#4CAF50';
    keysButton.onmouseover = () => keysButton.style.backgroundColor = '#45a049';
    keysButton.onmouseout = () => keysButton.style.backgroundColor = '#4CAF50';
    boardButton.onmouseover = () => boardButton.style.backgroundColor = '#45a049';
    boardButton.onmouseout = () => boardButton.style.backgroundColor = '#4CAF50';

    // Add the infinite coins functionality
    coinsButton.onclick = () => {
        let storedData = localStorage.getItem('GameSettings');
        if (storedData) {
            let parsedData = JSON.parse(storedData);  
            parsedData.currencies.coins = 10000000000;
            localStorage.setItem('GameSettings', JSON.stringify(parsedData));
            location.reload();
        } else {
            alert('No saved data found. Play the game first!');
        }
    };

    keysButton.onclick = () => {
        let storedData = localStorage.getItem('GameSettings');
        if (storedData) {
            let parsedData = JSON.parse(storedData);  
            parsedData.currencies.keys = 10000000000;
            localStorage.setItem('GameSettings', JSON.stringify(parsedData));
            location.reload();
        } else {
            alert('No saved data found. Play the game first!');
        }
    };

    boardButton.onclick = () => {
        let storedData = localStorage.getItem('ShopSettings');
        if (storedData) {
            let parsedData = JSON.parse(storedData);  
            parsedData.purchased.boosts.consumables.hoverboard = 10000000000;
            localStorage.setItem('ShopSettings', JSON.stringify(parsedData));
            location.reload();
        } else {
            alert('No saved data found. Play the game first!');
        }
    };

    contentPanel.appendChild(coinsButton);
    contentPanel.appendChild(keysButton);
    contentPanel.appendChild(boardButton);
    contentPanel.appendChild(title2);

    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'highscoreInput';
    input.placeholder = 'Enter Desired Highscore';
    input.style.padding = '8px';
    input.style.width = '100%';
    input.style.marginBottom = '10px';
    input.style.boxSizing = 'border-box';
    contentPanel.appendChild(input);

    const setButton = document.createElement('button');
    setButton.textContent = 'Set Score';
    setButton.style.padding = '8px 15px';
    setButton.style.backgroundColor = '#4CAF50';
    setButton.style.color = 'white';
    setButton.style.border = 'none';
    setButton.style.borderRadius = '3px';
    setButton.style.cursor = 'pointer';
    setButton.style.width = '100%';
    setButton.style.marginBottom = '10px';

    setButton.onclick = () => {
        const scoreValue = parseInt(document.getElementById('highscoreInput').value, 10);
        let storedData = localStorage.getItem('GameSettings');
        if (storedData) {
            let parsedData = JSON.parse(storedData);  
            parsedData.highscore = scoreValue;
            localStorage.setItem('GameSettings', JSON.stringify(parsedData));
            location.reload();
        } else {
            alert('No saved data found. Play the game first!');
        }
    };

    contentPanel.appendChild(setButton);

    // Add toggle functionality
    let isOpen = false;
    tab.onclick = () => {
        isOpen = !isOpen;
        contentPanel.style.display = isOpen ? 'block' : 'none';
    };

    // Add elements to the container
    tabContainer.appendChild(tab);
    tabContainer.appendChild(contentPanel);

    // Add the container to the document
    document.body.appendChild(tabContainer);
};

(function () {
  const konamiCode = [
    'ArrowUp', 'ArrowUp',
    'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight',
    'ArrowLeft', 'ArrowRight',
    'b', 'a'
  ];

  let inputSequence = [];

  window.addEventListener('keydown', (event) => {
    const key = event.key;
    console.log(`Key pressed: ${key}`); // Debug log

    inputSequence.push(key);

    // Keep only the last N keys
    if (inputSequence.length > konamiCode.length) {
      inputSequence.shift();
    }

    // Check for match
    if (inputSequence.join(',') === konamiCode.join(',')) {
        console.log('Konami code activated!');
        inputSequence = [];
        createLockObject();
        }
  });
})();
