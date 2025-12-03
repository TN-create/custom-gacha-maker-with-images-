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
    const enemyNames = ['Shadow Fiend', 'Dark Knight', 'Void Walker', 'Chaos Lord'];
    for (let i = 0; i < enemyCount; i++) {
      enemyTeam.push(initStats({
        id: `enemy-${i}`,
        title: enemyNames[i] || `Enemy ${i + 1}`,
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
        <!-- Team Bar at Top -->
        <div class="battle-teams-bar">
          <div class="team-bar-side player-side">
            <div class="team-bar-label">Your Team</div>
            <div class="team-bar-cards" id="playerBarCards"></div>
          </div>
          <div class="team-bar-side enemy-side">
            <div class="team-bar-label">Enemy Team</div>
            <div class="team-bar-cards" id="enemyBarCards"></div>
          </div>
        </div>
        
        <!-- Main Battle Stage -->
        <div class="battle-stage">
          <div class="fighter-stage-slot player-slot" id="playerFighterSlot"></div>
          
          <div class="battle-vs-divider">
            <div class="vs-lightning"></div>
            <div class="vs-orb">VS</div>
          </div>
          
          <div class="fighter-stage-slot enemy-slot" id="enemyFighterSlot"></div>
        </div>
        
        <!-- Log Toggle Button -->
        <button class="log-toggle-btn" id="logToggleBtn" type="button" aria-label="Toggle Battle Log">
          📜 Log
        </button>
        
        <!-- Slide-out Battle Log Panel -->
        <div class="battle-log-panel" id="battleLogPanel">
          <div class="log-panel-header">
            <span>Battle Log</span>
            <button class="log-close-btn" id="logCloseBtn" type="button" aria-label="Close Log">×</button>
          </div>
          <div class="battle-log" id="battleLog"></div>
        </div>
      </div>
    `;

    // Wire up log toggle
    const logToggleBtn = document.getElementById('logToggleBtn');
    const logPanel = document.getElementById('battleLogPanel');
    const logCloseBtn = document.getElementById('logCloseBtn');
    
    logToggleBtn?.addEventListener('click', () => {
      logPanel?.classList.toggle('open');
    });
    
    logCloseBtn?.addEventListener('click', () => {
      logPanel?.classList.remove('open');
    });

    updateBattleCards();
  }

  function updateBattleCards() {
    const enemySlot = document.getElementById('enemyFighterSlot');
    const playerSlot = document.getElementById('playerFighterSlot');
    const enemyBarEl = document.getElementById('enemyBarCards');
    const playerBarEl = document.getElementById('playerBarCards');
    
    if (!enemySlot || !playerSlot) return;

    // Find active fighters
    const activeEnemy = enemyTeam.find(c => c.hp > 0);
    const activePlayer = playerTeam.find(c => c.hp > 0);

    // Render active fighters (large)
    enemySlot.innerHTML = activeEnemy 
      ? renderActiveFighter(activeEnemy, true) 
      : '<div class="fighter-empty-slot">Defeated!</div>';
    
    playerSlot.innerHTML = activePlayer 
      ? renderActiveFighter(activePlayer, false) 
      : '<div class="fighter-empty-slot">Defeated!</div>';

    // Render team bar cards (small)
    if (enemyBarEl) {
      enemyBarEl.innerHTML = enemyTeam
        .map(c => renderMiniCard(c, c === activeEnemy, true))
        .join('');
    }
    if (playerBarEl) {
      playerBarEl.innerHTML = playerTeam
        .map(c => renderMiniCard(c, c === activePlayer, false))
        .join('');
    }
  }

  function renderActiveFighter(card, isEnemy) {
    const hpPercent = Math.max(0, (card.hp / card.maxHp) * 100);
    const sideClass = isEnemy ? 'enemy' : 'player';
    const isLowHp = hpPercent <= 25;

    return `
      <div class="active-fighter-card ${sideClass}" data-id="${card.id}">
        <div class="fighter-portrait">
          ${card.url 
            ? `<img src="${card.url}" alt="${card.title}" />` 
            : `<div class="enemy-portrait-placeholder">👹</div>`}
          <div class="portrait-overlay"></div>
          <div class="side-glow"></div>
        </div>
        <div class="fighter-info-panel">
          <div class="fighter-name-row">
            <div class="fighter-name-lg">${card.title}</div>
            <div class="fighter-atk-badge">
              <span class="atk-icon">⚔️</span>
              <span>${card.attack}</span>
            </div>
          </div>
          <div class="hp-container-lg">
            <div class="hp-bar-outer">
              <div class="hp-bar-inner ${isLowHp ? 'low' : ''}" style="width: ${hpPercent}%"></div>
            </div>
            <div class="hp-text-row">
              <span>HP</span>
              <span class="hp-numbers">${Math.max(0, card.hp)} / ${card.maxHp}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderMiniCard(card, isActive, isEnemy) {
    const hpPercent = Math.max(0, (card.hp / card.maxHp) * 100);
    const isDead = card.hp <= 0;
    const activeClass = isActive ? 'active' : '';
    const deadClass = isDead ? 'dead' : '';
    const sideClass = isEnemy ? 'enemy' : 'player';

    return `
      <div class="team-mini-card ${activeClass} ${deadClass} ${sideClass}">
        ${card.url 
          ? `<img src="${card.url}" alt="${card.title}" />` 
          : `<div class="enemy-placeholder-mini">👹</div>`}
        <div class="mini-hp">
          <div class="mini-hp-fill" style="width: ${hpPercent}%"></div>
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

  function showDamage(targetId, damage, isEnemy) {
    const card = document.querySelector(`.active-fighter-card[data-id="${targetId}"]`);
    if (!card) return;

    // Add hit animation
    card.classList.add('hit');
    setTimeout(() => card.classList.remove('hit'), 300);

    // Create damage popup
    const popup = document.createElement('div');
    popup.className = 'damage-popup';
    popup.textContent = `-${damage}`;
    popup.style.left = '50%';
    popup.style.top = '30%';
    popup.style.transform = 'translateX(-50%)';
    card.appendChild(popup);
    
    setTimeout(() => popup.remove(), 1000);
  }

  function showAttackAnimation(attackerId, isEnemy) {
    const card = document.querySelector(`.active-fighter-card[data-id="${attackerId}"]`);
    if (!card) return;
    
    card.classList.add('attacking');
    setTimeout(() => card.classList.remove('attacking'), 400);
  }

  async function runBattle() {
    await delay(500);
    addLog('⚔️ Battle begins!');

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
      showAttackAnimation(playerFighter.id, false);
      await delay(200);
      
      const playerDmg = playerFighter.attack + Math.floor(Math.random() * 10) - 5;
      const actualPlayerDmg = Math.max(1, playerDmg);
      enemyFighter.hp -= actualPlayerDmg;
      
      showDamage(enemyFighter.id, actualPlayerDmg, true);
      addLog(`⚔️ ${playerFighter.title} strikes ${enemyFighter.title} for <strong>${actualPlayerDmg}</strong> damage!`);
      updateBattleCards();

      if (enemyFighter.hp <= 0) {
        await delay(500);
        addLog(`💥 ${enemyFighter.title} has fallen!`);
        continue;
      }

      // Enemy attacks
      await delay(800);
      showAttackAnimation(enemyFighter.id, true);
      await delay(200);
      
      const enemyDmg = enemyFighter.attack + Math.floor(Math.random() * 10) - 5;
      const actualEnemyDmg = Math.max(1, enemyDmg);
      playerFighter.hp -= actualEnemyDmg;
      
      showDamage(playerFighter.id, actualEnemyDmg, false);
      addLog(`🔥 ${enemyFighter.title} attacks ${playerFighter.title} for <strong>${actualEnemyDmg}</strong> damage!`);
      updateBattleCards();

      if (playerFighter.hp <= 0) {
        await delay(500);
        addLog(`💥 ${playerFighter.title} has fallen!`);
      }
    }
  }

  function endBattle(won) {
    phase = 'result';
    playBtn.disabled = false;
    playBtn.textContent = '🔄 Play Again';

    const arena = playScreen.querySelector('.battle-arena');
    if (arena) {
      const resultOverlay = document.createElement('div');
      resultOverlay.className = 'battle-result-overlay';
      resultOverlay.innerHTML = `
        <div class="battle-result-box ${won ? 'win' : 'lose'}">
          <div class="battle-result-icon">${won ? '🏆' : '💀'}</div>
          <h3 class="battle-result-title">${won ? 'Victory!' : 'Defeat'}</h3>
          <p class="battle-result-sub">${won ? 'Your team conquered the battle!' : 'Better luck next time...'}</p>
        </div>
      `;
      arena.appendChild(resultOverlay);
    }
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
