/**
 * Game module – Turn-based combat using inventory items
 */

const Game = (() => {
  let isRunning = false;
  let playScreen = null;
  let playBtn = null;

  // Game state
  let phase = 'idle'; // 'idle' | 'select' | 'battle' | 'result'
  let playerTeam = []; // selected cards (max 4)
  let enemyTeam = [];  // generated enemies (max 4)
  let battleLog = [];

  // Generate stats for a card
  const generateStats = (card) => ({
    ...card,
    maxHp: 50 + Math.floor(Math.random() * 50),
    hp: 0, // set after
    attack: 10 + Math.floor(Math.random() * 20),
    abilities: [], // blank for now
  });

  const initStats = (card) => {
    const stats = generateStats(card);
    stats.hp = stats.maxHp;
    return stats;
  };

  function init() {
    playScreen = document.getElementById('playScreen');
    playBtn = document.getElementById('playBtn');
    if (playBtn) {
      playBtn.addEventListener('click', handlePlayClick);
    }
  }

  function handlePlayClick() {
    if (phase === 'idle') {
      startSelection();
    } else if (phase === 'select') {
      if (playerTeam.length === 0) {
        alert('Select at least 1 card for your team!');
        return;
      }
      startBattle();
    } else if (phase === 'battle') {
      // Can't interrupt battle
    } else if (phase === 'result') {
      resetGame();
    }
  }

  function startSelection() {
    const inventory = window.GachaApp?.getInventory() || [];
    if (inventory.length === 0) {
      playScreen.innerHTML = '<p class="play-placeholder">No items in inventory. Roll some first!</p>';
      return;
    }

    phase = 'select';
    playerTeam = [];
    playBtn.textContent = '🔒 Lock Team';

    renderSelectionUI(inventory);
  }

  function renderSelectionUI(inventory) {
    playScreen.innerHTML = `
      <div class="game-select">
        <div class="select-header">
          <h3>Select Your Team (max 4)</h3>
          <span class="select-count">0 / 4 selected</span>
        </div>
        <div class="select-grid"></div>
      </div>
    `;

    const grid = playScreen.querySelector('.select-grid');
    const countEl = playScreen.querySelector('.select-count');

    inventory.forEach(item => {
      const card = document.createElement('div');
      card.className = 'select-card';
      card.dataset.id = item.id;
      card.innerHTML = `
        <img src="${item.url}" alt="${item.title}" />
        <div class="select-card-title">${item.title}</div>
        <div class="select-card-count">x${item.count}</div>
      `;
      card.addEventListener('click', () => {
        toggleSelection(item, card, countEl);
      });
      grid.appendChild(card);
    });
  }

  function toggleSelection(item, cardEl, countEl) {
    const idx = playerTeam.findIndex(c => c.id === item.id);
    if (idx !== -1) {
      playerTeam.splice(idx, 1);
      cardEl.classList.remove('selected');
    } else {
      if (playerTeam.length >= 4) {
        alert('Maximum 4 cards allowed!');
        return;
      }
      playerTeam.push({ ...item });
      cardEl.classList.add('selected');
    }
    countEl.textContent = `${playerTeam.length} / 4 selected`;
  }

  function startBattle() {
    phase = 'battle';
    playBtn.textContent = '⚔️ Battle in progress...';
    playBtn.disabled = true;

    // Initialize player team with stats
    playerTeam = playerTeam.map(initStats);

    // Generate enemy team (1-4 enemies based on player team size)
    const enemyCount = Math.min(4, Math.max(1, playerTeam.length));
    enemyTeam = [];
    for (let i = 0; i < enemyCount; i++) {
      enemyTeam.push(initStats({
        id: `enemy-${i}`,
        title: `Enemy ${i + 1}`,
        url: '', // no image for enemies
        groupName: 'Enemies',
      }));
    }

    battleLog = [];
    renderBattleUI();
    runBattle();
  }

  function renderBattleUI() {
    playScreen.innerHTML = `
      <div class="battle-arena">
        <div class="battle-main">
          <div class="fighter-slot enemy-fighter">
            <div class="fighter-card" id="activeEnemy"></div>
          </div>
          <div class="battle-vs">VS</div>
          <div class="fighter-slot player-fighter">
            <div class="fighter-card" id="activePlayer"></div>
          </div>
        </div>
        <div class="battle-teams">
          <div class="team-row enemy-team">
            <h4>Enemy Team</h4>
            <div class="team-cards" id="enemyTeamCards"></div>
          </div>
          <div class="team-row player-team">
            <h4>Your Team</h4>
            <div class="team-cards" id="playerTeamCards"></div>
          </div>
        </div>
      </div>
      <div class="battle-log" id="battleLog"></div>
    `;

    updateBattleCards();
  }

  function updateBattleCards() {
    const activeEnemyEl = document.getElementById('activeEnemy');
    const activePlayerEl = document.getElementById('activePlayer');
    const enemyTeamEl = document.getElementById('enemyTeamCards');
    const playerTeamEl = document.getElementById('playerTeamCards');
    
    if (!activeEnemyEl || !activePlayerEl) return;

    // Find active fighters
    const activeEnemy = enemyTeam.find(c => c.hp > 0);
    const activePlayer = playerTeam.find(c => c.hp > 0);

    // Render active fighters (large)
    activeEnemyEl.innerHTML = activeEnemy ? renderActiveFighter(activeEnemy, true) : '<div class="fighter-empty">Defeated</div>';
    activePlayerEl.innerHTML = activePlayer ? renderActiveFighter(activePlayer, false) : '<div class="fighter-empty">Defeated</div>';

    // Render team cards (small) - exclude active fighter
    if (enemyTeamEl) {
      enemyTeamEl.innerHTML = enemyTeam
        .map((c, i) => renderTeamCard(c, c === activeEnemy, true))
        .join('');
    }
    if (playerTeamEl) {
      playerTeamEl.innerHTML = playerTeam
        .map((c, i) => renderTeamCard(c, c === activePlayer, false))
        .join('');
    }
  }

  function renderActiveFighter(card, isEnemy) {
    const hpPercent = Math.max(0, (card.hp / card.maxHp) * 100);
    const sideClass = isEnemy ? 'enemy' : 'player';

    return `
      <div class="active-fighter ${sideClass}">
        <div class="fighter-image">
          ${card.url 
            ? `<img src="${card.url}" alt="${card.title}" />` 
            : `<div class="enemy-placeholder-lg">👹</div>`}
        </div>
        <div class="fighter-stats">
          <div class="fighter-name">${card.title}</div>
          <div class="fighter-hp">
            <div class="hp-bar-lg">
              <div class="hp-fill-lg" style="width: ${hpPercent}%"></div>
            </div>
            <span class="hp-text-lg">${Math.max(0, card.hp)} / ${card.maxHp}</span>
          </div>
          <div class="fighter-atk">⚔️ ATK: ${card.attack}</div>
        </div>
      </div>
    `;
  }

  function renderTeamCard(card, isActive, isEnemy) {
    const hpPercent = Math.max(0, (card.hp / card.maxHp) * 100);
    const isDead = card.hp <= 0;
    const activeClass = isActive ? 'active' : '';
    const deadClass = isDead ? 'dead' : '';
    const sideClass = isEnemy ? 'enemy' : 'player';

    return `
      <div class="team-card ${activeClass} ${deadClass} ${sideClass}">
        <div class="team-card-img">
          ${card.url ? `<img src="${card.url}" alt="${card.title}" />` : `<div class="enemy-placeholder-sm">👹</div>`}
        </div>
        <div class="team-card-hp">
          <div class="hp-bar-sm">
            <div class="hp-fill-sm" style="width: ${hpPercent}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  function addLog(message) {
    battleLog.push(message);
    const logEl = document.getElementById('battleLog');
    if (logEl) {
      logEl.innerHTML = battleLog.map(m => `<div class="log-entry">${m}</div>`).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  async function runBattle() {
    await delay(500);
    addLog('⚔️ Battle starts!');

    while (true) {
      // Get active fighters (first alive on each side)
      const playerFighter = playerTeam.find(c => c.hp > 0);
      const enemyFighter = enemyTeam.find(c => c.hp > 0);

      // Check win/lose conditions
      if (!playerFighter) {
        await delay(500);
        addLog('💀 Your team has been defeated!');
        endBattle(false);
        return;
      }
      if (!enemyFighter) {
        await delay(500);
        addLog('🎉 Victory! All enemies defeated!');
        endBattle(true);
        return;
      }

      updateBattleCards();

      // Player attacks first
      await delay(800);
      const playerDmg = playerFighter.attack + Math.floor(Math.random() * 10) - 5;
      const actualPlayerDmg = Math.max(1, playerDmg);
      enemyFighter.hp -= actualPlayerDmg;
      addLog(`${playerFighter.title} attacks ${enemyFighter.title} for ${actualPlayerDmg} damage!`);
      updateBattleCards();

      if (enemyFighter.hp <= 0) {
        await delay(500);
        addLog(`💥 ${enemyFighter.title} defeated!`);
        continue;
      }

      // Enemy attacks
      await delay(800);
      const enemyDmg = enemyFighter.attack + Math.floor(Math.random() * 10) - 5;
      const actualEnemyDmg = Math.max(1, enemyDmg);
      playerFighter.hp -= actualEnemyDmg;
      addLog(`${enemyFighter.title} attacks ${playerFighter.title} for ${actualEnemyDmg} damage!`);
      updateBattleCards();

      if (playerFighter.hp <= 0) {
        await delay(500);
        addLog(`💥 ${playerFighter.title} defeated!`);
      }
    }
  }

  function endBattle(won) {
    phase = 'result';
    playBtn.disabled = false;
    playBtn.textContent = '🔄 Play Again';

    const resultEl = document.createElement('div');
    resultEl.className = `battle-result ${won ? 'win' : 'lose'}`;
    resultEl.innerHTML = won ? '<h3>🏆 Victory!</h3>' : '<h3>💀 Defeat</h3>';
    playScreen.insertBefore(resultEl, playScreen.firstChild);
  }

  function resetGame() {
    phase = 'idle';
    playerTeam = [];
    enemyTeam = [];
    battleLog = [];
    playBtn.textContent = '▶ Play';
    playBtn.disabled = false;
    playScreen.innerHTML = '<p class="play-placeholder">Game area – press Play to start</p>';
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return { init };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Game.init();
});
