(() => {
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.substring(2), v);
      else if (v !== undefined && v !== null) node.setAttribute(k, v);
    });
    for (const child of children.flat()) {
      if (child == null) continue;
      node.append(child.nodeType ? child : document.createTextNode(child));
    }
    return node;
  };

  const state = {
    nextId: 1,
    groups: [] // {id, name, rarity(Number), images: [{id, name, url}]}
    ,modal: {
      items: [],
      index: 0,
      open: false,
      dir: "next", // track last navigation direction
    },
    inventory: new Map(),
    // Game state
    game: {
      phase: "idle", // idle | team-select | battle | victory | defeat
      playerTeam: [],  // [{id, title, url, hp, maxHp, attack, ability, groupName}]
      enemyTeam: [],
      currentPlayerIdx: 0,
      currentEnemyIdx: 0,
      log: [],
      turnCount: 0,
    },
  };

  const refs = {
    createForm: document.getElementById("createGroupForm"),
    nameInput: document.getElementById("groupName"),
    rarityInput: document.getElementById("groupRarity"),
    groupsList: document.getElementById("groupsList"),
    rollOneBtn: document.getElementById("rollOneBtn"),
    rollTenBtn: document.getElementById("rollTenBtn"),
    results: document.getElementById("results"),
    // Overlay refs (fix first-roll popup bug)
    overlay: document.getElementById("overlay"),
    particles: document.getElementById("particles"),
    skipBtn: document.getElementById("skipBtn"),
    // Modal refs...
    modal: document.getElementById("resultModal"),
    modalImage: document.getElementById("modalImage"),
    modalTitle: document.getElementById("modalTitle"),
    modalGroup: document.getElementById("modalGroup"),
    modalIndex: document.getElementById("modalIndex"),
    modalThumbs: document.getElementById("modalThumbs"),
    modalClose: document.getElementById("modalClose"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    burst: document.getElementById("burst"),
    inventoryResults: document.getElementById("inventoryResults"),
    // Removed: cutscene refs
    postRollCutscene: document.getElementById("postRollCutscene"),
    prSkip: document.getElementById("prSkip"),
    prSummary: document.getElementById("prSummary"),
    // Cinematic refs
    rollCinematic: document.getElementById("rollCinematic"),
    rcParticles: document.getElementById("rcParticles"),
    rcCards: document.getElementById("rcCards"),
    rcSkip: document.getElementById("rcSkip"),
    // Export/Import refs
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importInput: document.getElementById("importInput"),
    // Play section refs
    playScreen: document.getElementById("playScreen"),
    playBtn: document.getElementById("playBtn"),
  };

  // ==================== ABILITY SYSTEM ====================
  const ABILITIES = [
    // Stat modifiers
    { id: "atk_up_2", name: "Power Strike", desc: "+2 Attack", onBattleStart: (f) => { f.attack += 2; } },
    { id: "atk_up_5", name: "Berserker", desc: "+5 Attack", onBattleStart: (f) => { f.attack += 5; } },
    { id: "atk_up_10", name: "Rage", desc: "+10 Attack", onBattleStart: (f) => { f.attack += 10; } },
    { id: "hp_up_10", name: "Tough", desc: "+10 HP", onBattleStart: (f) => { f.hp += 10; f.maxHp += 10; } },
    { id: "hp_up_25", name: "Fortified", desc: "+25 HP", onBattleStart: (f) => { f.hp += 25; f.maxHp += 25; } },
    { id: "hp_up_50", name: "Juggernaut", desc: "+50 HP", onBattleStart: (f) => { f.hp += 50; f.maxHp += 50; } },
    { id: "atk_x1_5", name: "Empowered", desc: "x1.5 Attack", onBattleStart: (f) => { f.attack = Math.floor(f.attack * 1.5); } },
    { id: "atk_x2", name: "Double Strike", desc: "x2 Attack", onBattleStart: (f) => { f.attack *= 2; } },
    { id: "hp_x1_5", name: "Resilient", desc: "x1.5 HP", onBattleStart: (f) => { f.hp = Math.floor(f.hp * 1.5); f.maxHp = f.hp; } },
    { id: "hp_x2", name: "Titanic", desc: "x2 HP", onBattleStart: (f) => { f.hp *= 2; f.maxHp = f.hp; } },
    
    // Defensive abilities
    { id: "dodge_first", name: "Quick Reflexes", desc: "Dodge first attack", onBattleStart: (f) => { f.dodgeNext = true; } },
    { id: "dodge_25", name: "Evasive", desc: "25% dodge chance", onBeforeHit: (f, dmg) => Math.random() < 0.25 ? 0 : dmg },
    { id: "dodge_50", name: "Shadow Step", desc: "50% dodge chance", onBeforeHit: (f, dmg) => Math.random() < 0.5 ? 0 : dmg },
    { id: "armor_5", name: "Iron Skin", desc: "Reduce damage by 5", onBeforeHit: (f, dmg) => Math.max(1, dmg - 5) },
    { id: "armor_10", name: "Steel Plating", desc: "Reduce damage by 10", onBeforeHit: (f, dmg) => Math.max(1, dmg - 10) },
    { id: "armor_50p", name: "Hardened", desc: "Take 50% damage", onBeforeHit: (f, dmg) => Math.floor(dmg * 0.5) },
    { id: "shield_20", name: "Barrier", desc: "Start with 20 shield", onBattleStart: (f) => { f.shield = 20; } },
    { id: "shield_50", name: "Force Field", desc: "Start with 50 shield", onBattleStart: (f) => { f.shield = 50; } },
    { id: "thorns_5", name: "Thorns", desc: "Reflect 5 damage", onAfterHit: (f, attacker) => { attacker.hp -= 5; } },
    { id: "thorns_10", name: "Spike Armor", desc: "Reflect 10 damage", onAfterHit: (f, attacker) => { attacker.hp -= 10; } },
    
    // Offensive abilities
    { id: "crit_25", name: "Lucky", desc: "25% crit (x2 dmg)", onAttack: (f, dmg) => Math.random() < 0.25 ? dmg * 2 : dmg },
    { id: "crit_50", name: "Deadly", desc: "50% crit (x2 dmg)", onAttack: (f, dmg) => Math.random() < 0.5 ? dmg * 2 : dmg },
    { id: "lifesteal_25", name: "Vampiric", desc: "Heal 25% of damage", onAfterAttack: (f, dmg) => { f.hp = Math.min(f.maxHp, f.hp + Math.floor(dmg * 0.25)); } },
    { id: "lifesteal_50", name: "Soul Drain", desc: "Heal 50% of damage", onAfterAttack: (f, dmg) => { f.hp = Math.min(f.maxHp, f.hp + Math.floor(dmg * 0.5)); } },
    { id: "true_dmg_10", name: "Pierce", desc: "+10 true damage", onAttack: (f, dmg) => dmg + 10 },
    { id: "execute_20", name: "Executioner", desc: "x2 dmg if enemy <20% HP", onAttack: (f, dmg, enemy) => enemy.hp < enemy.maxHp * 0.2 ? dmg * 2 : dmg },
    { id: "first_blood", name: "First Blood", desc: "x3 dmg on first hit", onAttack: (f, dmg) => { if (!f.hasAttacked) { f.hasAttacked = true; return dmg * 3; } return dmg; } },
    
    // HP manipulation
    { id: "hp_half", name: "Glass Cannon", desc: "-50% HP, +100% Atk", onBattleStart: (f) => { f.hp = Math.floor(f.hp * 0.5); f.maxHp = f.hp; f.attack *= 2; } },
    { id: "sacrifice_25", name: "Blood Pact", desc: "-25% HP, +50% Atk", onBattleStart: (f) => { f.hp = Math.floor(f.hp * 0.75); f.maxHp = f.hp; f.attack = Math.floor(f.attack * 1.5); } },
    { id: "last_stand", name: "Last Stand", desc: "Survive fatal blow once", onBattleStart: (f) => { f.lastStand = true; } },
    { id: "undying", name: "Undying", desc: "Revive once with 25% HP", onBattleStart: (f) => { f.canRevive = true; } },
    { id: "regen_5", name: "Regeneration", desc: "Heal 5 HP per turn", onTurnStart: (f) => { f.hp = Math.min(f.maxHp, f.hp + 5); } },
    { id: "regen_10", name: "Fast Heal", desc: "Heal 10 HP per turn", onTurnStart: (f) => { f.hp = Math.min(f.maxHp, f.hp + 10); } },
    { id: "regen_p10", name: "Vitality", desc: "Heal 10% HP per turn", onTurnStart: (f) => { f.hp = Math.min(f.maxHp, f.hp + Math.floor(f.maxHp * 0.1)); } },
    
    // Turn manipulation
    { id: "slow", name: "Sluggish", desc: "Wait 1 extra turn", onBattleStart: (f) => { f.skipTurns = 1; } },
    { id: "very_slow", name: "Lethargic", desc: "Wait 2 extra turns", onBattleStart: (f) => { f.skipTurns = 2; } },
    { id: "quick", name: "Swift", desc: "Attack twice first turn", onBattleStart: (f) => { f.extraAttacks = 1; } },
    { id: "double_attack", name: "Flurry", desc: "Always attack twice", onBattleStart: (f) => { f.alwaysDouble = true; } },
    { id: "stun_25", name: "Stunning Blow", desc: "25% to stun enemy", onAfterAttack: (f, dmg, enemy) => { if (Math.random() < 0.25) enemy.stunned = true; } },
    { id: "stun_50", name: "Knockout", desc: "50% to stun enemy", onAfterAttack: (f, dmg, enemy) => { if (Math.random() < 0.5) enemy.stunned = true; } },
    
    // Poison/Burn
    { id: "poison_3", name: "Venomous", desc: "Poison: 3 dmg/turn", onAfterAttack: (f, dmg, enemy) => { enemy.poison = (enemy.poison || 0) + 3; } },
    { id: "poison_5", name: "Toxic", desc: "Poison: 5 dmg/turn", onAfterAttack: (f, dmg, enemy) => { enemy.poison = (enemy.poison || 0) + 5; } },
    { id: "burn_5", name: "Flame Touch", desc: "Burn: 5 dmg/turn", onAfterAttack: (f, dmg, enemy) => { enemy.burn = (enemy.burn || 0) + 5; } },
    { id: "burn_10", name: "Inferno", desc: "Burn: 10 dmg/turn", onAfterAttack: (f, dmg, enemy) => { enemy.burn = (enemy.burn || 0) + 10; } },
    { id: "bleed_3", name: "Serrated", desc: "Bleed: 3 dmg/turn", onAfterAttack: (f, dmg, enemy) => { enemy.bleed = (enemy.bleed || 0) + 3; } },
    { id: "bleed_5", name: "Lacerate", desc: "Bleed: 5 dmg/turn", onAfterAttack: (f, dmg, enemy) => { enemy.bleed = (enemy.bleed || 0) + 5; } },
    
    // Scaling abilities
    { id: "rampage", name: "Rampage", desc: "+3 Atk per kill", onKill: (f) => { f.attack += 3; } },
    { id: "bloodthirst", name: "Bloodthirst", desc: "+5 Atk per kill", onKill: (f) => { f.attack += 5; } },
    { id: "momentum", name: "Momentum", desc: "+2 Atk each turn", onTurnStart: (f) => { f.attack += 2; } },
    { id: "growing", name: "Growing", desc: "+5 HP each turn", onTurnStart: (f) => { f.hp += 5; f.maxHp += 5; } },
    { id: "enrage", name: "Enrage", desc: "+10 Atk when below 50% HP", onBattleStart: (f) => { f.enrage = true; } },
    { id: "desperate", name: "Desperate", desc: "x2 Atk when below 25% HP", onBattleStart: (f) => { f.desperate = true; } },
    
    // Random/Chaos abilities
    { id: "chaos_atk", name: "Chaos Strike", desc: "Random 1-50 attack", onAttack: () => Math.floor(Math.random() * 50) + 1 },
    { id: "gambler", name: "Gambler", desc: "50% double or nothing", onAttack: (f, dmg) => Math.random() < 0.5 ? dmg * 2 : 0 },
    { id: "wild_card", name: "Wild Card", desc: "Random ability each turn", onBattleStart: (f) => { f.wildCard = true; } },
    { id: "mirror", name: "Mirror", desc: "Copy enemy attack stat", onBattleStart: (f) => { f.mirror = true; } },
    { id: "swap", name: "Swap", desc: "Swap HP and Attack", onBattleStart: (f) => { const t = f.hp; f.hp = f.attack; f.maxHp = f.attack; f.attack = t; } },
    
    // Aura/Team effects (simplified for auto-battle)
    { id: "inspire_atk", name: "War Cry", desc: "+3 team Attack", isAura: true, onTeamBattleStart: (team) => team.forEach(f => f.attack += 3) },
    { id: "inspire_hp", name: "Rally", desc: "+10 team HP", isAura: true, onTeamBattleStart: (team) => team.forEach(f => { f.hp += 10; f.maxHp += 10; }) },
    { id: "demoralize", name: "Intimidate", desc: "-3 enemy Attack", isAura: true, onEnemyBattleStart: (team) => team.forEach(f => f.attack = Math.max(1, f.attack - 3)) },
    { id: "weaken", name: "Curse", desc: "-10 enemy HP", isAura: true, onEnemyBattleStart: (team) => team.forEach(f => { f.hp = Math.max(1, f.hp - 10); f.maxHp = f.hp; }) },
    
    // Unique mechanics
    { id: "absorb", name: "Absorb", desc: "Gain enemy Atk on kill", onKill: (f, enemy) => { f.attack += Math.floor(enemy.attack * 0.5); } },
    { id: "devour", name: "Devour", desc: "Gain enemy HP on kill", onKill: (f, enemy) => { f.hp += Math.floor(enemy.maxHp * 0.25); f.maxHp = f.hp; } },
    { id: "clone", name: "Clone", desc: "Split into 2 at 50% stats", onBattleStart: (f) => { f.canClone = true; } },
    { id: "berserk", name: "Berserk", desc: "Lose 5 HP, +5 Atk/turn", onTurnStart: (f) => { f.hp -= 5; f.attack += 5; } },
    { id: "meditate", name: "Meditate", desc: "Skip turn, heal 50%", onBattleStart: (f) => { f.meditate = true; } },
    { id: "counter", name: "Counter", desc: "100% counter-attack", onAfterHit: (f, attacker, dmg) => { attacker.hp -= f.attack; } },
    { id: "parry", name: "Parry", desc: "Block, then riposte", onBeforeHit: (f, dmg) => { f.riposte = true; return Math.floor(dmg * 0.5); } },
    
    // More stat variants
    { id: "atk_up_3", name: "Sharp", desc: "+3 Attack", onBattleStart: (f) => { f.attack += 3; } },
    { id: "atk_up_7", name: "Fierce", desc: "+7 Attack", onBattleStart: (f) => { f.attack += 7; } },
    { id: "atk_up_15", name: "Brutal", desc: "+15 Attack", onBattleStart: (f) => { f.attack += 15; } },
    { id: "hp_up_15", name: "Hardy", desc: "+15 HP", onBattleStart: (f) => { f.hp += 15; f.maxHp += 15; } },
    { id: "hp_up_35", name: "Bulky", desc: "+35 HP", onBattleStart: (f) => { f.hp += 35; f.maxHp += 35; } },
    { id: "balanced", name: "Balanced", desc: "+5 HP, +3 Atk", onBattleStart: (f) => { f.hp += 5; f.maxHp += 5; f.attack += 3; } },
    { id: "well_rounded", name: "Well-Rounded", desc: "+10 HP, +5 Atk", onBattleStart: (f) => { f.hp += 10; f.maxHp += 10; f.attack += 5; } },
    
    // More defensive
    { id: "dodge_10", name: "Nimble", desc: "10% dodge chance", onBeforeHit: (f, dmg) => Math.random() < 0.1 ? 0 : dmg },
    { id: "armor_3", name: "Padded", desc: "Reduce damage by 3", onBeforeHit: (f, dmg) => Math.max(1, dmg - 3) },
    { id: "armor_25p", name: "Resistant", desc: "Take 75% damage", onBeforeHit: (f, dmg) => Math.floor(dmg * 0.75) },
    { id: "shield_10", name: "Ward", desc: "Start with 10 shield", onBattleStart: (f) => { f.shield = 10; } },
    { id: "shield_35", name: "Aegis", desc: "Start with 35 shield", onBattleStart: (f) => { f.shield = 35; } },
    { id: "thorns_3", name: "Prickly", desc: "Reflect 3 damage", onAfterHit: (f, attacker) => { attacker.hp -= 3; } },
    
    // More offensive
    { id: "crit_10", name: "Sharp Eye", desc: "10% crit (x2 dmg)", onAttack: (f, dmg) => Math.random() < 0.1 ? dmg * 2 : dmg },
    { id: "lifesteal_10", name: "Leech", desc: "Heal 10% of damage", onAfterAttack: (f, dmg) => { f.hp = Math.min(f.maxHp, f.hp + Math.floor(dmg * 0.1)); } },
    { id: "true_dmg_5", name: "Puncture", desc: "+5 true damage", onAttack: (f, dmg) => dmg + 5 },
    { id: "true_dmg_20", name: "Impale", desc: "+20 true damage", onAttack: (f, dmg) => dmg + 20 },
    { id: "execute_30", name: "Mercy Kill", desc: "x2 dmg if enemy <30% HP", onAttack: (f, dmg, enemy) => enemy.hp < enemy.maxHp * 0.3 ? dmg * 2 : dmg },
    
    // More poison/status
    { id: "poison_10", name: "Plague", desc: "Poison: 10 dmg/turn", onAfterAttack: (f, dmg, enemy) => { enemy.poison = (enemy.poison || 0) + 10; } },
    { id: "burn_3", name: "Spark", desc: "Burn: 3 dmg/turn", onAfterAttack: (f, dmg, enemy) => { enemy.burn = (enemy.burn || 0) + 3; } },
    { id: "freeze", name: "Freeze", desc: "50% to freeze 1 turn", onAfterAttack: (f, dmg, enemy) => { if (Math.random() < 0.5) enemy.frozen = 1; } },
    { id: "weaken_hit", name: "Enfeeble", desc: "-2 enemy Atk on hit", onAfterAttack: (f, dmg, enemy) => { enemy.attack = Math.max(1, enemy.attack - 2); } },
    { id: "armor_break", name: "Sunder", desc: "Remove enemy armor", onAfterAttack: (f, dmg, enemy) => { enemy.shield = 0; } },
    
    // Survival
    { id: "second_wind", name: "Second Wind", desc: "Heal 20 HP at 25%", onTurnStart: (f) => { if (f.hp < f.maxHp * 0.25 && !f.usedSecondWind) { f.hp += 20; f.usedSecondWind = true; } } },
    { id: "adrenaline", name: "Adrenaline", desc: "+10 Atk at low HP", onTurnStart: (f) => { if (f.hp < f.maxHp * 0.3 && !f.adrenalineUsed) { f.attack += 10; f.adrenalineUsed = true; } } },
    { id: "phoenix", name: "Phoenix", desc: "Revive with 50% HP", onBattleStart: (f) => { f.phoenixRevive = true; } },
    { id: "immortal", name: "Immortal", desc: "Can't die first 2 turns", onBattleStart: (f) => { f.immortalTurns = 2; } },
    
    // More chaos
    { id: "lucky_7", name: "Lucky 7", desc: "7% insta-kill", onAttack: (f, dmg, enemy) => { if (Math.random() < 0.07) { return enemy.hp + 1000; } return dmg; } },
    { id: "coin_flip", name: "Coin Flip", desc: "Double or half damage", onAttack: (f, dmg) => Math.random() < 0.5 ? dmg * 2 : Math.floor(dmg / 2) },
    { id: "unstable", name: "Unstable", desc: "Random +/- 10 Atk", onTurnStart: (f) => { f.attack += Math.floor(Math.random() * 21) - 10; f.attack = Math.max(1, f.attack); } },
    { id: "chaos_hp", name: "Flux", desc: "Random HP 50-150%", onBattleStart: (f) => { const mult = 0.5 + Math.random(); f.hp = Math.floor(f.hp * mult); f.maxHp = f.hp; } },
    
    // None/simple
    { id: "none", name: "No Ability", desc: "No special effect" },
    { id: "none2", name: "Basic", desc: "No special effect" },
    { id: "none3", name: "Plain", desc: "No special effect" },
  ];

  // ==================== STAT CALCULATION ====================
  const calculateStats = (imgId, groupName) => {
    // Find the group for this image to get its rarity weight
    const group = state.groups.find(g => g.name === groupName || g.images.some(img => img.id === imgId));
    const rarity = group?.rarity || 50; // default to common
    
    // Calculate total weight to determine relative rarity
    const totalWeight = state.groups.reduce((sum, g) => sum + (g.rarity > 0 ? g.rarity : 0), 0) || 100;
    const relativeRarity = totalWeight > 0 ? (totalWeight / Math.max(rarity, 0.1)) : 1;
    
    // If this is the only valid group, make it weak
    const validGroups = state.groups.filter(g => g.images.length > 0 && g.rarity > 0);
    const isOnlyGroup = validGroups.length === 1 && validGroups[0].name === groupName;
    
    let rarityMultiplier = isOnlyGroup ? 0.5 : Math.min(relativeRarity, 10);
    
    // Base stats + rarity scaling
    const baseHp = 20 + Math.floor(Math.random() * 15);
    const baseAtk = 5 + Math.floor(Math.random() * 5);
    
    const hp = Math.floor(baseHp * (0.8 + rarityMultiplier * 0.3));
    const attack = Math.floor(baseAtk * (0.8 + rarityMultiplier * 0.25));
    
    // Random ability
    const ability = ABILITIES[Math.floor(Math.random() * ABILITIES.length)];
    
    return { hp, maxHp: hp, attack, ability };
  };

  // ==================== GAME UI ====================
  const renderGameUI = () => {
    if (!refs.playScreen) return;
    const { phase } = state.game;

    refs.playScreen.innerHTML = "";
    refs.playScreen.classList.toggle("active", phase !== "idle");

    switch (phase) {
      case "idle":
        refs.playScreen.innerHTML = `
          <div class="play-placeholder">
            <span class="play-icon">🎮</span>
            <p>Press Play to start the game</p>
          </div>
        `;
        break;
      case "team-select":
        renderTeamSelect();
        break;
      case "battle":
        renderBattle();
        break;
      case "victory":
      case "defeat":
        renderGameEnd();
        break;
    }
  };

  const renderTeamSelect = () => {
    const list = Array.from(state.inventory.values());
    if (!list.length) {
      refs.playScreen.innerHTML = `
        <div class="game-message">
          <h3>No Cards Available</h3>
          <p>Roll some gacha first to get cards for battle!</p>
          <button class="btn" onclick="window.gameBack()">Back</button>
        </div>
      `;
      return;
    }

    const selectedIds = state.game.playerTeam.map(f => f.id);
    
    refs.playScreen.innerHTML = `
      <div class="team-select">
        <h3>Select Your Team (max 4)</h3>
        <p class="muted">Selected: ${state.game.playerTeam.length}/4</p>
        <div class="card-grid">
          ${list.map(it => {
            const selected = selectedIds.includes(it.id);
            return `
              <div class="select-card ${selected ? "selected" : ""}" data-id="${it.id}">
                <img src="${it.url}" alt="${it.title}" />
                <div class="select-info">
                  <div class="name">${it.title}</div>
                  <div class="group">${it.groupName}</div>
                  ${it.count > 1 ? `<div class="count">${it.count}x</div>` : ""}
                </div>
                ${selected ? '<div class="check">✓</div>' : ""}
              </div>
            `;
          }).join("")}
        </div>
        <div class="team-actions">
          <button class="btn" id="gameBackBtn">Back</button>
          <button class="btn primary" id="startBattleBtn" ${state.game.playerTeam.length === 0 ? "disabled" : ""}>
            Start Battle (${state.game.playerTeam.length})
          </button>
        </div>
      </div>
    `;

    // Event listeners
    refs.playScreen.querySelectorAll(".select-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        toggleTeamMember(id);
      });
    });

    document.getElementById("gameBackBtn")?.addEventListener("click", () => {
      state.game.phase = "idle";
      state.game.playerTeam = [];
      renderGameUI();
    });

    document.getElementById("startBattleBtn")?.addEventListener("click", () => {
      if (state.game.playerTeam.length > 0) {
        initBattle();
      }
    });
  };

  const toggleTeamMember = (id) => {
    const idx = state.game.playerTeam.findIndex(f => f.id === id);
    if (idx !== -1) {
      state.game.playerTeam.splice(idx, 1);
    } else if (state.game.playerTeam.length < 4) {
      const inv = state.inventory.get(id);
      if (inv) {
        const stats = calculateStats(inv.id, inv.groupName);
        state.game.playerTeam.push({
          id: inv.id,
          title: inv.title,
          url: inv.url,
          groupName: inv.groupName,
          ...stats
        });
      }
    }
    renderGameUI();
  };

  const initBattle = () => {
    // Generate enemy team (1-4 enemies based on player team size)
    const enemyCount = Math.min(4, Math.max(1, state.game.playerTeam.length));
    state.game.enemyTeam = [];
    
    // Collect all images from all groups for enemy pool
    const allImages = [];
    state.groups.forEach(g => {
      if (g.rarity > 0) {
        g.images.forEach(img => {
          allImages.push({ ...img, groupName: g.name, groupRarity: g.rarity });
        });
      }
    });

    if (allImages.length === 0) {
      // Fallback: use player's inventory images for enemies
      Array.from(state.inventory.values()).forEach(inv => {
        allImages.push({ id: inv.id + "_enemy", title: inv.title, url: inv.url, groupName: inv.groupName });
      });
    }

    for (let i = 0; i < enemyCount; i++) {
      const pick = allImages[Math.floor(Math.random() * allImages.length)];
      const stats = calculateStats(pick.id, pick.groupName);
      state.game.enemyTeam.push({
        id: pick.id + "_e" + i,
        title: pick.title,
        url: pick.url,
        groupName: pick.groupName,
        ...stats
      });
    }

    // Apply aura abilities
    state.game.playerTeam.forEach(f => {
      if (f.ability?.onTeamBattleStart) {
        f.ability.onTeamBattleStart(state.game.playerTeam);
      }
      if (f.ability?.onEnemyBattleStart) {
        f.ability.onEnemyBattleStart(state.game.enemyTeam);
      }
    });
    state.game.enemyTeam.forEach(f => {
      if (f.ability?.onTeamBattleStart) {
        f.ability.onTeamBattleStart(state.game.enemyTeam);
      }
      if (f.ability?.onEnemyBattleStart) {
        f.ability.onEnemyBattleStart(state.game.playerTeam);
      }
    });

    // Apply individual battle start abilities
    [...state.game.playerTeam, ...state.game.enemyTeam].forEach(f => {
      if (f.ability?.onBattleStart) {
        f.ability.onBattleStart(f);
      }
    });

    state.game.currentPlayerIdx = 0;
    state.game.currentEnemyIdx = 0;
    state.game.turnCount = 0;
    state.game.log = ["⚔️ Battle begins!"];
    state.game.phase = "battle";
    
    renderGameUI();
    setTimeout(() => runBattleTurn(), 1000);
  };

  const renderBattle = () => {
    const { playerTeam, enemyTeam, currentPlayerIdx, currentEnemyIdx, log } = state.game;
    const player = playerTeam[currentPlayerIdx];
    const enemy = enemyTeam[currentEnemyIdx];

    refs.playScreen.innerHTML = `
      <div class="battle-arena">
        <div class="teams-status">
          <div class="team-row enemy-team">
            ${enemyTeam.map((e, i) => `
              <div class="mini-card ${i === currentEnemyIdx ? "active" : ""} ${e.hp <= 0 ? "defeated" : ""}">
                <img src="${e.url}" alt="${e.title}" />
                ${e.hp > 0 ? `<div class="mini-hp">${e.hp}</div>` : '<div class="mini-ko">KO</div>'}
              </div>
            `).join("")}
          </div>
          <div class="team-row player-team">
            ${playerTeam.map((p, i) => `
              <div class="mini-card ${i === currentPlayerIdx ? "active" : ""} ${p.hp <= 0 ? "defeated" : ""}">
                <img src="${p.url}" alt="${p.title}" />
                ${p.hp > 0 ? `<div class="mini-hp">${p.hp}</div>` : '<div class="mini-ko">KO</div>'}
              </div>
            `).join("")}
          </div>
        </div>
        
        <div class="battle-field">
          <div class="fighter enemy-side">
            ${enemy ? `
              <div class="fighter-card ${enemy.hp <= 0 ? "defeated" : ""}">
                <img src="${enemy.url}" alt="${enemy.title}" />
                <div class="fighter-info">
                  <div class="name">${enemy.title}</div>
                  <div class="hp-bar">
                    <div class="hp-fill" style="width: ${(enemy.hp / enemy.maxHp) * 100}%"></div>
                    <span>${enemy.hp}/${enemy.maxHp}</span>
                  </div>
                  <div class="stats">⚔️ ${enemy.attack}</div>
                  <div class="ability">${enemy.ability?.name || "No Ability"}</div>
                </div>
              </div>
            ` : '<div class="fighter-empty">All Defeated!</div>'}
          </div>
          
          <div class="vs">VS</div>
          
          <div class="fighter player-side">
            ${player ? `
              <div class="fighter-card ${player.hp <= 0 ? "defeated" : ""}">
                <img src="${player.url}" alt="${player.title}" />
                <div class="fighter-info">
                  <div class="name">${player.title}</div>
                  <div class="hp-bar">
                    <div class="hp-fill" style="width: ${(player.hp / player.maxHp) * 100}%"></div>
                    <span>${player.hp}/${player.maxHp}</span>
                  </div>
                  <div class="stats">⚔️ ${player.attack}</div>
                  <div class="ability">${player.ability?.name || "No Ability"}</div>
                </div>
              </div>
            ` : '<div class="fighter-empty">All Defeated!</div>'}
          </div>
        </div>
        
        <div class="battle-log">
          ${log.slice(-5).map(l => `<div class="log-entry">${l}</div>`).join("")}
        </div>
      </div>
    `;
  };

  const renderGameEnd = () => {
    const isVictory = state.game.phase === "victory";
    refs.playScreen.innerHTML = `
      <div class="game-end ${isVictory ? "victory" : "defeat"}">
        <div class="end-icon">${isVictory ? "🏆" : "💀"}</div>
        <h2>${isVictory ? "Victory!" : "Defeat!"}</h2>
        <p>${isVictory ? "You have conquered your enemies!" : "Your team has fallen..."}</p>
        <div class="end-actions">
          <button class="btn" id="playAgainBtn">Play Again</button>
        </div>
      </div>
    `;

    document.getElementById("playAgainBtn")?.addEventListener("click", () => {
      state.game.phase = "idle";
      state.game.playerTeam = [];
      state.game.enemyTeam = [];
      state.game.log = [];
      renderGameUI();
    });
  };

  // ==================== BATTLE LOGIC ====================
  const runBattleTurn = async () => {
    const { playerTeam, enemyTeam } = state.game;
    
    // Find next alive fighters
    while (state.game.currentPlayerIdx < playerTeam.length && playerTeam[state.game.currentPlayerIdx].hp <= 0) {
      state.game.currentPlayerIdx++;
    }
    while (state.game.currentEnemyIdx < enemyTeam.length && enemyTeam[state.game.currentEnemyIdx].hp <= 0) {
      state.game.currentEnemyIdx++;
    }

    const player = playerTeam[state.game.currentPlayerIdx];
    const enemy = enemyTeam[state.game.currentEnemyIdx];

    // Check win/lose conditions
    if (!player || state.game.currentPlayerIdx >= playerTeam.length) {
      state.game.phase = "defeat";
      renderGameUI();
      return;
    }
    if (!enemy || state.game.currentEnemyIdx >= enemyTeam.length) {
      state.game.phase = "victory";
      renderGameUI();
      return;
    }

    state.game.turnCount++;
    renderGameUI();

    // Process turn start effects
    [player, enemy].forEach(f => {
      // DoT effects
      if (f.poison) { f.hp -= f.poison; addLog(`${f.title} takes ${f.poison} poison damage!`); }
      if (f.burn) { f.hp -= f.burn; addLog(`${f.title} takes ${f.burn} burn damage!`); }
      if (f.bleed) { f.hp -= f.bleed; addLog(`${f.title} takes ${f.bleed} bleed damage!`); }
      
      // Turn start abilities
      if (f.ability?.onTurnStart) {
        f.ability.onTurnStart(f);
      }
      
      // Enrage check
      if (f.enrage && f.hp < f.maxHp * 0.5 && !f.enraged) {
        f.attack += 10;
        f.enraged = true;
        addLog(`${f.title} becomes enraged! +10 Attack`);
      }
      if (f.desperate && f.hp < f.maxHp * 0.25 && !f.isDesparate) {
        f.attack *= 2;
        f.isDesparate = true;
        addLog(`${f.title} is desperate! Attack doubled!`);
      }
    });

    await delay(600);
    renderGameUI();

    // Check for deaths from DoT
    if (player.hp <= 0 || enemy.hp <= 0) {
      handleDeaths();
      await delay(800);
      runBattleTurn();
      return;
    }

    // Skip turns check
    if (player.skipTurns > 0) {
      addLog(`${player.title} is preparing...`);
      player.skipTurns--;
      await delay(600);
    } else if (player.stunned) {
      addLog(`${player.title} is stunned!`);
      player.stunned = false;
      await delay(600);
    } else if (player.frozen > 0) {
      addLog(`${player.title} is frozen!`);
      player.frozen--;
      await delay(600);
    } else {
      // Player attacks
      await performAttack(player, enemy, "player");
    }

    renderGameUI();
    await delay(600);

    // Check enemy death
    if (enemy.hp <= 0) {
      handleDeaths();
      await delay(800);
      runBattleTurn();
      return;
    }

    // Enemy turn
    if (enemy.skipTurns > 0) {
      addLog(`${enemy.title} is preparing...`);
      enemy.skipTurns--;
    } else if (enemy.stunned) {
      addLog(`${enemy.title} is stunned!`);
      enemy.stunned = false;
    } else if (enemy.frozen > 0) {
      addLog(`${enemy.title} is frozen!`);
      enemy.frozen--;
    } else {
      await performAttack(enemy, player, "enemy");
    }

    renderGameUI();
    await delay(600);

    // Check player death
    if (player.hp <= 0) {
      handleDeaths();
      await delay(800);
    }

    // Continue battle
    setTimeout(() => runBattleTurn(), 800);
  };

  const performAttack = async (attacker, defender, side) => {
    // Mirror ability
    if (attacker.mirror && !attacker.mirrored) {
      attacker.attack = defender.attack;
      attacker.mirrored = true;
      addLog(`${attacker.title} mirrors ${defender.title}'s attack!`);
    }

    let damage = attacker.attack;

    // Apply attack modifiers
    if (attacker.ability?.onAttack) {
      damage = attacker.ability.onAttack(attacker, damage, defender);
    }

    // Dodge check
    if (defender.dodgeNext) {
      addLog(`${defender.title} dodges the attack!`);
      defender.dodgeNext = false;
      return;
    }

    // Defense modifiers
    if (defender.ability?.onBeforeHit) {
      damage = defender.ability.onBeforeHit(defender, damage);
    }

    if (damage === 0) {
      addLog(`${defender.title} evades!`);
      return;
    }

    // Shield absorption
    if (defender.shield > 0) {
      const shieldDmg = Math.min(defender.shield, damage);
      defender.shield -= shieldDmg;
      damage -= shieldDmg;
      addLog(`${defender.title}'s shield absorbs ${shieldDmg} damage!`);
    }

    // Immortal check
    if (defender.immortalTurns > 0) {
      defender.immortalTurns--;
      addLog(`${defender.title} is immortal! Takes no damage.`);
      return;
    }

    // Apply damage
    defender.hp -= damage;
    addLog(`${attacker.title} deals ${damage} damage to ${defender.title}!`);

    // Last stand
    if (defender.hp <= 0 && defender.lastStand) {
      defender.hp = 1;
      defender.lastStand = false;
      addLog(`${defender.title} survives with Last Stand!`);
    }

    // Phoenix revive
    if (defender.hp <= 0 && defender.phoenixRevive) {
      defender.hp = Math.floor(defender.maxHp * 0.5);
      defender.phoenixRevive = false;
      addLog(`${defender.title} rises like a Phoenix!`);
    }

    // Can revive (undying)
    if (defender.hp <= 0 && defender.canRevive) {
      defender.hp = Math.floor(defender.maxHp * 0.25);
      defender.canRevive = false;
      addLog(`${defender.title} refuses to die!`);
    }

    // After hit effects
    if (defender.ability?.onAfterHit) {
      defender.ability.onAfterHit(defender, attacker, damage);
    }

    // Riposte
    if (defender.riposte) {
      attacker.hp -= defender.attack;
      addLog(`${defender.title} ripostes for ${defender.attack} damage!`);
      defender.riposte = false;
    }

    // After attack effects
    if (attacker.ability?.onAfterAttack) {
      attacker.ability.onAfterAttack(attacker, damage, defender);
    }

    // Check kill
    if (defender.hp <= 0) {
      addLog(`${defender.title} is defeated!`);
      if (attacker.ability?.onKill) {
        attacker.ability.onKill(attacker, defender);
      }
    }

    // Extra attacks
    if (attacker.extraAttacks > 0) {
      attacker.extraAttacks--;
      addLog(`${attacker.title} attacks again!`);
      await delay(400);
      await performAttack(attacker, defender, side);
    }
    if (attacker.alwaysDouble && !attacker.secondAttackDone) {
      attacker.secondAttackDone = true;
      addLog(`${attacker.title} strikes twice!`);
      await delay(400);
      await performAttack(attacker, defender, side);
      attacker.secondAttackDone = false;
    }
  };

  const handleDeaths = () => {
    const { playerTeam, enemyTeam } = state.game;
    
    // Move to next alive fighter
    while (state.game.currentPlayerIdx < playerTeam.length && playerTeam[state.game.currentPlayerIdx].hp <= 0) {
      state.game.currentPlayerIdx++;
    }
    while (state.game.currentEnemyIdx < enemyTeam.length && enemyTeam[state.game.currentEnemyIdx].hp <= 0) {
      state.game.currentEnemyIdx++;
    }
  };

  const addLog = (msg) => {
    state.game.log.push(msg);
    if (state.game.log.length > 50) state.game.log.shift();
  };

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  // Global back function for inline onclick
  window.gameBack = () => {
    state.game.phase = "idle";
    state.game.playerTeam = [];
    renderGameUI();
  };

  // ==================== PLAY BUTTON ====================
  const startGame = () => {
    if (!refs.playScreen) return;
    state.game.phase = "team-select";
    state.game.playerTeam = [];
    renderGameUI();
  };

  refs.playBtn?.addEventListener("click", startGame);

  // Helpers
  const clampName = (val, fallback) => (val && val.trim().length ? val.trim() : fallback);
  const parseRarity = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const fileTitle = (filename = "") => {
    const base = filename.replace(/[#?].*$/, "");
    const last = base.lastIndexOf(".");
    const raw = last > 0 ? base.slice(0, last) : base;
    return raw.replace(/[_\-]+/g, " ").trim() || raw || "Untitled";
  };

  const revokeImages = (images) => images.forEach(img => { try { URL.revokeObjectURL(img.url); } catch {} });

  // Rendering
  const render = () => {
    refs.groupsList.innerHTML = "";
    state.groups.forEach(g => refs.groupsList.append(renderGroup(g)));
  };

  const renderGroup = (group) => {
    const nameInput = el("input", {
      class: "name-input",
      type: "text",
      value: group.name,
      placeholder: "Group name",
      required: "true",
      onblur: () => {
        const newName = clampName(nameInput.value, group.name);
        nameInput.value = newName;
        group.name = newName;
      }
    });
    const rarityInput = el("input", {
      class: "rarity-input",
      type: "number",
      min: "0", step: "0.01",
      value: String(group.rarity),
      onblur: () => {
        const newR = parseRarity(rarityInput.value, group.rarity);
        rarityInput.value = String(newR);
        group.rarity = newR;
      }
    });

    const uploadInput = el("input", {
      type: "file",
      accept: "image/*",
      multiple: "true",
      style: "display:none",
      onchange: (e) => handleFilesSelected(group.id, e.target.files),
    });

    const addBtn = el("button", {
      class: "btn small",
      type: "button",
      onclick: () => uploadInput.click()
    }, "Add images");

    const copyBtn = el("button", {
      class: "btn small",
      type: "button",
      onclick: () => duplicateGroup(group)
    }, "Copy");

    const deleteBtn = el("button", {
      class: "btn small danger",
      type: "button",
      onclick: (e) => {
        // Get the group id from the nearest card to avoid stale closures
        const card = e.currentTarget.closest(".group");
        const idStr = card?.dataset?.id;
        const id = Number(idStr);
        const idx = state.groups.findIndex(g => g.id === id);
        if (idx === -1) return;

        const g = state.groups[idx];
        if (!confirm(`Delete group "${g.name}" and its ${g.images.length} image(s)?`)) return;

        // Remove related inventory entries first
        g.images.forEach(img => removeInventoryByImageId(img.id));
        // Revoke blob URLs, remove from state, and re-render
        revokeImages(g.images);
        state.groups.splice(idx, 1);
        render();
      }
    }, "Delete");

    const dragUI = el("div", { class: "drag-hint" },
      el("span", { class: "drag-handle", title: "Drag to reorder" }),
      el("span", {}, "Drag to reorder")
    );

    const header = el("div", { class: "group-header" },
      nameInput,
      el("div", { class: "rarity-wrap" }, rarityInput, el("span", {}, "%")),
      el("div", { class: "group-actions" }, dragUI, addBtn, copyBtn, deleteBtn)
    );

    const thumbs = el("div", { class: "thumb-grid" }, group.images.map(img => renderThumb(group, img)));

    const groupCard = el("div", {
      class: "group",
      dataset: { id: group.id },
      tabindex: "0",
      onkeydown: (e) => {
        if (!e.altKey) return;
        const idx = state.groups.findIndex(g => g.id === group.id);
        if (idx === -1) return;
        if (e.key === "ArrowUp" && idx > 0) {
          moveGroupToIndex(group.id, idx - 1);
          e.preventDefault();
        } else if (e.key === "ArrowDown" && idx < state.groups.length - 1) {
          moveGroupToIndex(group.id, idx + 1);
          e.preventDefault();
        }
      }
    },
      header,
      el("div", { class: "row between" },
        el("small", { class: "muted" }, `${group.images.length} image(s)`),
        uploadInput
      ),
      thumbs
    );

    // Enable both native DnD and pointer sorting
    enableNativeDnD(groupCard);
    enablePointerSort(groupCard);

    return groupCard;
  };

  // Render a group thumbnail with click-to-rename
  const renderThumb = (group, img) => {
    const remove = () => {
      group.images = group.images.filter(i => i.id !== img.id);
      // Also remove from inventory
      removeInventoryByImageId(img.id);
      try { URL.revokeObjectURL(img.url); } catch {}
      render();
    };
    // Click on image to edit title; avoid clicks on remove button
    const onThumbClick = (e) => {
      if (e.target.closest(".remove")) return;
      const current = img.title || fileTitle(img.name);
      const next = prompt("Edit image display title:", current);
      if (next == null) return; // cancelled
      const newTitle = next.trim();
      if (!newTitle.length) return; // ignore empty
      img.title = newTitle;
      // Reflect rename in inventory if present
      updateInventoryTitle(img.id, newTitle);
      render();
    };
    return el("div", { class: "thumb", title: img.title || img.name, onclick: onThumbClick },
      el("img", { src: img.url, alt: img.title || img.name }),
      el("div", { class: "caption" }, img.title || img.name),
      el("button", { class: "remove", type: "button", onclick: remove }, "×")
    );
  };

  // File handling
  const handleFilesSelected = (groupId, fileList, thumbsContainer) => {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;
    const files = Array.from(fileList || []);
    files.forEach(file => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      group.images.push({
        id: crypto.randomUUID(),
        name: file.name,
        title: fileTitle(file.name),
        url
      });
    });
    render();
  };

  // Weighted random selection of groups with images
  const pickGroupByRarity = () => {
    const pool = state.groups.filter(g => g.images.length > 0 && g.rarity > 0);
    const total = pool.reduce((a, g) => a + g.rarity, 0);
    if (pool.length === 0 || total <= 0) return null;
    let r = Math.random() * total;
    for (const g of pool) {
      if ((r -= g.rarity) <= 0) return g;
    }
    return pool[pool.length - 1] || null;
  };

  // Animation overlay
  let animationActive = false;
  const clearParticles = () => { refs.particles.innerHTML = ""; };
  const spawnParticles = (count = 28) => {
    clearParticles();
    for (let i = 0; i < count; i++) {
      const p = document.createElement("i");
      p.className = "particle " + (Math.random() < 0.5 ? "star" : "diamond");
      const left = (Math.random() * 100).toFixed(2) + "%";
      const delay = (Math.random() * 1.2).toFixed(2) + "s";
      const dur = (2 + Math.random() * 2).toFixed(2) + "s";
      const scale = (0.6 + Math.random() * 0.9).toFixed(2);
      p.style.left = left;
      p.style.bottom = (-10 - Math.random() * 20) + "px";
      p.style.setProperty("--delay", delay);
      p.style.setProperty("--dur", dur);
      p.style.setProperty("--scale", scale);
      refs.particles.appendChild(p);
    }
  };
  const playRollAnimation = (ms = 1400) => {
    if (animationActive) return Promise.resolve(); // avoid stacking
    animationActive = true;
    refs.overlay.classList.remove("hidden");
    refs.overlay.setAttribute("aria-hidden", "false");
    spawnParticles();

    let done;
    const p = new Promise((resolve) => { done = resolve; });
    const timer = setTimeout(done, ms);
    const onSkip = () => done();

    const finish = () => {
      clearTimeout(timer);
      refs.skipBtn.removeEventListener("click", onSkip);
      refs.overlay.classList.add("hidden");
      refs.overlay.setAttribute("aria-hidden", "true");
      clearParticles();
      animationActive = false;
    };

    refs.skipBtn.addEventListener("click", onSkip, { once: true });
    return p.then(finish);
  };

  // Cinematic roll animation
  const playRollCinematic = (items) => {
    if (!refs.rollCinematic) return Promise.resolve();
    return new Promise(resolve => {
      let skipped = false;
      refs.rollCinematic.classList.remove("hidden");
      refs.rollCinematic.setAttribute("aria-hidden","false");
      refs.rcParticles.innerHTML = "";
      refs.rcCards.innerHTML = "";

      const cleanup = () => {
        refs.rcSkip.removeEventListener("click", onSkip);
        refs.rollCinematic.classList.add("hidden");
        refs.rollCinematic.setAttribute("aria-hidden","true");
        refs.rcParticles.innerHTML = "";
        refs.rcCards.innerHTML = "";
        resolve();
      };
      const onSkip = () => { skipped = true; cleanup(); };
      refs.rcSkip.addEventListener("click", onSkip, { once:true });

      // Spawn swirling icon particles
      const spawnParticles = (count = 36) => {
        for (let i=0;i<count;i++){
          const p = document.createElement("i");
          p.className="rc-particle";
          p.style.backgroundImage = Math.random()<0.55 ? "var(--icon-star)" : "var(--icon-diamond)";
          const ang = Math.random()*Math.PI*2;
          const dist = 150 + Math.random()*260;
          p.style.setProperty("--dx", Math.cos(ang)*dist + "px");
          p.style.setProperty("--dy", Math.sin(ang)*dist + "px");
          p.style.animationDelay = (Math.random()*0.8).toFixed(2)+"s";
          p.style.animationDuration = (2.6+Math.random()*1.4).toFixed(2)+"s";
          p.style.left = "50%";              // center emission
          p.style.top = "50%";
          refs.rcParticles.appendChild(p);
          p.addEventListener("animationend", ()=> p.remove());
        }
      };
      spawnParticles();

      let idx = 0;
      const interval = 520;

      const nextCard = () => {
        if (skipped) return;
        if (idx >= items.length) {
          setTimeout(()=> { if (!skipped) cleanup(); }, 700);
          return;
        }
        const { group, img } = items[idx];
        const card = document.createElement("div");
        card.className = "rc-card";
        card.style.zIndex = 5 + idx;
        card.innerHTML = `
          <img src="${img.url}" alt="${(img.title||img.name).replace(/"/g,"&quot;")}">
          <div class="rc-title">${group.name} • ${(img.title||img.name)}</div>
        `;
        refs.rcCards.appendChild(card);

        // Schedule flip and settle
        setTimeout(()=> {
          if (skipped) return;
          card.classList.add("reveal");
          // Minor particle burst per card
          spawnParticles(8);
          setTimeout(()=> {
            if (skipped) return;
            card.classList.add("final");
          },600);
        },300);

        idx++;
        setTimeout(nextCard, interval);
      };
      nextCard();
    });
  };

  // Modal: neon star burst emitting from image edges
  const burstStars = (count = 16) => {
    refs.burst.innerHTML = "";
    const imgEl = refs.modalImage;
    const canvasEl = refs.modalImage.closest(".canvas");
    if (!imgEl || !canvasEl) return;

    // Get bounding boxes relative to canvas to compute edges
    const canvasRect = canvasEl.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();

    // Calculate relative positions inside canvas
    const left = imgRect.left - canvasRect.left;
    const right = imgRect.right - canvasRect.left;
    const top = imgRect.top - canvasRect.top;
    const bottom = imgRect.bottom - canvasRect.top;

    // Edge samplers: top, bottom, left, right
    const edges = [
      { edge: "top", x0: left, x1: right, y: top, nx: 0, ny: -1 },
      { edge: "bottom", x0: left, x1: right, y: bottom, nx: 0, ny: 1 },
      { edge: "left", y0: top, y1: bottom, x: left, nx: -1, ny: 0 },
      { edge: "right", y0: top, y1: bottom, x: right, nx: 1, ny: 0 },
    ];

    const particles = Math.max(8, count);
    for (let i = 0; i < particles; i++) {
      const e = edges[i % edges.length];
      let px, py;

      if (e.edge === "top" || e.edge === "bottom") {
        const t = Math.random();
        px = e.x0 + t * (e.x1 - e.x0);
        py = e.y;
      } else {
        const t = Math.random();
        px = e.x;
        py = e.y0 + t * (e.y1 - e.y0);
      }

      // Randomize direction slightly outward from the edge normal
      const spread = (Math.random() - 0.5) * 0.8; // small angle variation
      const dirX = e.nx + (e.ny ? spread : 0);
      const dirY = e.ny + (e.nx ? spread : 0);

      const dist = 80 + Math.random() * 140; // travel distance in px
      const dx = dirX * dist;
      const dy = dirY * dist;

      const p = document.createElement("i");
      p.className = "particle star";
      // Position the particle origin inside the canvas coordinate system
      // burst container is positioned absolutely within canvas; use CSS vars with pixel offsets
      const centerX = px;
      const centerY = py;
      // Translate CSS vars relative to center of burst container
      // We anchor burst at center via CSS translate(-50%,-50%), so convert to dx/dy from center
      const canvasCenterX = canvasRect.width / 2;
      const canvasCenterY = canvasRect.height / 2;
      p.style.setProperty("--dx", (centerX - canvasCenterX + dx) + "px");
      p.style.setProperty("--dy", (centerY - canvasCenterY + dy) + "px");
      p.style.setProperty("--rot", (Math.random() * 360).toFixed(0) + "deg");
      refs.burst.appendChild(p);
      p.addEventListener("animationend", () => p.remove());
    }
  };

  // Modal viewer
  const openModal = (items, startIndex = 0, { preview = false } = {}) => {
    state.modal.items = items.slice();
    state.modal.index = Math.min(Math.max(0, startIndex), items.length - 1);
    state.modal.open = true;
    state.modal.dir = "next";
    refs.modal.classList.toggle("preview", preview);
    refs.modal.classList.remove("hidden");
    refs.modal.setAttribute("aria-hidden", "false");
    updateModal(preview);
    // Keyboard nav
    document.addEventListener("keydown", onKeyNav);
  };

  const closeModal = () => {
    if (!state.modal.open) return;
    state.modal.open = false;
    refs.modal.classList.add("hidden");
    refs.modal.setAttribute("aria-hidden", "true");
    refs.burst.innerHTML = "";
    refs.modal.classList.remove("preview");
    document.removeEventListener("keydown", onKeyNav);
  };

  const onKeyNav = (e) => {
    if (!state.modal.open) return;
    if (e.key === "Escape") { closeModal(); }
    else if (e.key === "ArrowRight") { nextModal(); }
    else if (e.key === "ArrowLeft") { prevModal(); }
  };

  const updateModal = (preview = refs.modal.classList.contains("preview")) => {
    const items = state.modal.items;
    const i = state.modal.index;
    if (!items.length) return;
    const { group, img } = items[i];
    const wasSrc = refs.modalImage.src;
    const willChange = !!wasSrc && wasSrc !== img.url;
    if (willChange) {
      refs.modalImage.classList.remove("slide-next","slide-prev","fade-in");
      refs.modalImage.classList.add("fade-out");
    }
    const applyNewImage = () => {
      refs.modalImage.src = img.url;
      refs.modalImage.alt = img.title || img.name;
      refs.modalTitle.textContent = img.title || fileTitle(img.name);
      refs.modalGroup.textContent = group.name;
      refs.modalIndex.textContent = `${i + 1} / ${items.length}`;
      refs.modalImage.classList.remove("slide-next","slide-prev","fade-out","fade-in");
      const dirClass = state.modal.dir === "prev" ? "slide-prev" : "slide-next";
      void refs.modalImage.offsetWidth;
      refs.modalImage.classList.add("fade-in", dirClass);
      refs.modalImage.addEventListener("animationend", () => {
        refs.modalImage.classList.remove("fade-in", dirClass);
      }, { once: true });
      refs.modalThumbs.innerHTML = "";
      if (!preview) burstStars(20); // suppress effects for inventory preview
    };
    if (willChange) {
      refs.modalImage.addEventListener("animationend", applyNewImage, { once: true });
    } else {
      applyNewImage();
    }
  };

  const nextModal = () => {
    if (!state.modal.open) return;
    const n = state.modal.index + 1;
    if (n < state.modal.items.length) {
      state.modal.dir = "next";
      state.modal.index = n;
      updateModal();
    }
  };
  const prevModal = () => {
    if (!state.modal.open) return;
    const n = state.modal.index - 1;
    if (n >= 0) {
      state.modal.dir = "prev";
      state.modal.index = n;
      updateModal();
    }
  };

  refs.modalClose.addEventListener("click", closeModal);
  refs.nextBtn.addEventListener("click", nextModal);
  refs.prevBtn.addEventListener("click", prevModal);
  refs.modal.addEventListener("click", (e) => {
    if (e.target === refs.modal) closeModal();
  });

  // Clone an image's blob URL into a new independent blob URL
  const cloneImageUrl = async (srcUrl) => {
    try {
      const res = await fetch(srcUrl);
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      return srcUrl; // fallback to original if fetch fails
    }
  };

  // Inventory aggregation
  const addToInventory = async (items) => {
    for (const { group, img } of items) {
      const key = img.id;
      const existing = state.inventory.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        // Clone the URL so inventory persists even if the original group/image is deleted
        const clonedUrl = await cloneImageUrl(img.url);
        state.inventory.set(key, {
          id: key,
          title: img.title || fileTitle(img.name),
          groupName: group.name,
          url: clonedUrl,
          count: 1
        });
      }
    }
  };

  // Inventory sync helpers
  const removeInventoryByImageId = (imgId) => {
    if (state.inventory.delete(imgId)) {
      renderInventory();
    }
  };
  const updateInventoryTitle = (imgId, newTitle) => {
    const it = state.inventory.get(imgId);
    if (it) {
      it.title = newTitle;
      renderInventory();
    }
  };

  const renderInventory = () => {
    if (!refs.inventoryResults) return;
    refs.inventoryResults.innerHTML = "";
    const list = Array.from(state.inventory.values());
    if (!list.length) {
      refs.inventoryResults.append(
        el("div", { class: "card" }, el("div", { class: "muted" }, "No items yet. Roll to fill your inventory."))
      );
      return;
    }
    let content;
    if (list.length === 1) {
      const it = list[0];
      content = el("div", { class: "result-card", onclick: () => openModal([{ group:{name: it.groupName}, img:{ url: it.url, name: it.title, title: it.title, id: it.id } }], 0, { preview: true }) },
        el("img", { src: it.url, alt: it.title }),
        el("div", { class: "count-badge" }, `${it.count}x`),
        el("div", { class: "meta" }, `${it.groupName} • ${it.title}`)
      );
    } else {
      content = el("div", { class: "grid" },
        list.map(it =>
          el("div", { class: "result-card", onclick: () => openModal([{ group:{name: it.groupName}, img:{ url: it.url, name: it.title, title: it.title, id: it.id } }], 0, { preview: true }) },
            el("img", { src: it.url, alt: it.title }),
            el("div", { class: "count-badge" }, `${it.count}x`),
            el("div", { class: "meta" }, `${it.groupName} • ${it.title}`)
          )
        )
      );
    }
    refs.inventoryResults.append(content);
  };

  const rollOnce = async () => {
    const group = pickGroupByRarity();
    if (!group) {
      showMessage("No eligible groups to roll. Add images and set rarity > 0.");
      return;
    }
    const img = group.images[Math.floor(Math.random() * group.images.length)];
    await playRollAnimation(1400);
    const items = [{ group, img }];
    showResults(items);
    await addToInventory(items);
    renderInventory();
    await playRollCinematic(items);
    openModal(items, 0);
  };

  const rollTen = async () => {
    const results = [];
    for (let i = 0; i < 10; i++) {
      const group = pickGroupByRarity();
      if (!group) break;
      const img = group.images[Math.floor(Math.random() * group.images.length)];
      results.push({ group, img });
    }
    if (!results.length) {
      showMessage("No eligible groups to roll. Add images and set rarity > 0.");
      return;
    }
    await playRollAnimation(1700);
    showResults(results);
    await addToInventory(results);
    renderInventory();
    await playRollCinematic(results);
    openModal(results, 0);
  };

  // Results rendering
  const showMessage = (text) => {
    refs.results.innerHTML = "";
    refs.results.append(
      el("div", { class: "card" }, el("div", { class: "muted" }, text))
    );
  };

  // Enhance results rendering: clicking a card opens modal at that index
  const showResults = (items) => {
    refs.results.innerHTML = "";
    if (items.length === 1) {
      const { group, img } = items[0];
      const card = el("div", { class: "result-card" },
        el("img", { src: img.url, alt: img.title || img.name }),
        el("div", { class: "meta" }, `${group.name} • ${img.title || fileTitle(img.name)}`)
      );
      card.addEventListener("click", () => openModal(items, 0));
      refs.results.append(card);
    } else {
      const grid = el("div", { class: "grid" }, items.map(({ group, img }, idx) => {
        const card = el("div", { class: "result-card" },
          el("img", { src: img.url, alt: img.title || img.name }),
          el("div", { class: "meta" }, `${group.name} • ${img.title || fileTitle(img.name)}`)
        );
        card.addEventListener("click", () => openModal(items, idx));
        return card;
      }));
      refs.results.append(grid);
    }
  };

  // Duplicate a group's data including images (with new URLs)
  const duplicateGroup = async (group) => {
    const newImages = [];
    for (const img of group.images) {
      const newUrl = await cloneImageUrl(img.url);
      newImages.push({
        id: crypto.randomUUID(),
        name: img.name,
        title: img.title,
        url: newUrl
      });
    }
    const copy = {
      id: state.nextId++,
      name: `${group.name} (Copy)`,
      rarity: group.rarity,
      images: newImages
    };
    state.groups.push(copy);
    render();
    queueMicrotask(() => { refs.groupsList.scrollTop = refs.groupsList.scrollHeight; });
  };

  // Reorder helpers
  const moveGroupToIndex = (id, newIdx) => {
    const curIdx = state.groups.findIndex(g => g.id === id);
    if (curIdx === -1 || newIdx === -1 || curIdx === newIdx) return;
    const [item] = state.groups.splice(curIdx, 1);
    state.groups.splice(newIdx, 0, item);
    render();
  };
  const indexFromCard = (card) => Number(card?.dataset?.id) ? state.groups.findIndex(g => g.id === Number(card.dataset.id)) : -1;

  // Pointer-driven sorting (mobile + desktop fallback)
  const enablePointerSort = (card) => {
    const handle = card.querySelector(".drag-handle");
    if (!handle) return;

    let draggingId = null;
    let placeholder = null;
    let startY = 0;

    const listEl = refs.groupsList;

    const onPointerMove = (e) => {
      if (!draggingId) return;
      const ptY = e.clientY;
      // Find closest group under pointer
      const cards = Array.from(listEl.children);
      let targetIdx = -1;
      for (let i = 0; i < cards.length; i++) {
        const r = cards[i].getBoundingClientRect();
        if (ptY >= r.top && ptY <= r.bottom) {
          // Decide before/after by midline
          targetIdx = ptY < (r.top + r.height / 2) ? i : i + 1;
          break;
        }
      }
      if (targetIdx === -1) {
        // Outside: auto-scroll if near edges
        const rect = listEl.getBoundingClientRect();
        if (ptY < rect.top + 40) listEl.scrollTop -= 20;
        else if (ptY > rect.bottom - 40) listEl.scrollTop += 20;
        return;
      }

      // Create/update placeholder
      if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.className = "group placeholder";
        placeholder.style.height = card.getBoundingClientRect().height + "px";
        listEl.insertBefore(placeholder, listEl.children[targetIdx] || null);
      } else {
        const currentIndex = Array.from(listEl.children).indexOf(placeholder);
        if (currentIndex !== targetIdx) {
          listEl.insertBefore(placeholder, listEl.children[targetIdx] || null);
        }
      }
    };

    const endDrag = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", endDrag);
      if (draggingId && placeholder) {
        const dropIdx = Array.from(listEl.children).indexOf(placeholder);
        placeholder.remove();
        placeholder = null;
        // Translate DOM index to state index (only count .group cards)
        const groupsDom = Array.from(listEl.children).filter(n => n.classList.contains("group"));
        const dropGroupCard = groupsDom[dropIdx] || null;
        const newStateIdx = dropGroupCard ? indexFromCard(dropGroupCard) : state.groups.length;
        moveGroupToIndex(draggingId, newStateIdx);
      }
      draggingId = null;
    };

    handle.addEventListener("pointerdown", (e) => {
      // Only left button / primary touch
      if (e.button !== undefined && e.button !== 0) return;
      draggingId = Number(card.dataset.id);
      startY = e.clientY;
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", endDrag);
      e.preventDefault();
    });
  };

  // Improve DnD consistency for mouse (HTML5)
  const enableNativeDnD = (card) => {
    card.setAttribute("draggable", "true");
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(card.dataset.id));
      try { e.dataTransfer.setDragImage(card, 10, 10); } catch {}
      card.classList.add("placeholder");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("placeholder");
      Array.from(refs.groupsList.children).forEach(c => c.classList.remove("drag-over"));
    });
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.currentTarget.classList.add("drag-over");
    });
    card.addEventListener("dragleave", (e) => {
      e.currentTarget.classList.remove("drag-over");
    });
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove("drag-over");
      const dragId = Number(e.dataTransfer.getData("text/plain"));
      const dropIdx = indexFromCard(e.currentTarget);
      if (dropIdx !== -1) {
        moveGroupToIndex(dragId, dropIdx);
      }
    });
  };

  // Form events
  refs.createForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = clampName(refs.nameInput.value, "");
    const rarity = parseRarity(refs.rarityInput.value, NaN);

    if (!name || !Number.isFinite(rarity)) {
      alert("Please provide both a group name and a valid rarity.");
      return;
    }

    const group = {
      id: state.nextId++,
      name,
      rarity,
      images: []
    };
    state.groups.push(group);
    refs.createForm.reset();
    render();

    // Scroll to bottom to reveal the newly added group
    queueMicrotask(() => { refs.groupsList.scrollTop = refs.groupsList.scrollHeight; });
  });

  refs.rollOneBtn.addEventListener("click", rollOnce);
  refs.rollTenBtn.addEventListener("click", rollTen);

  // Busy overlay helpers
  const busyEl = document.getElementById("busyOverlay");
  const busyTextEl = document.getElementById("busyText");
  const showBusy = (text = "Working...") => {
    if (!busyEl) return;
    busyTextEl && (busyTextEl.textContent = text);
    busyEl.classList.remove("hidden");
    busyEl.setAttribute("aria-hidden", "false");
  };
  const hideBusy = () => {
    if (!busyEl) return;
    busyEl.classList.add("hidden");
    busyEl.setAttribute("aria-hidden", "true");
  };

  // Export/Import refs
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importInput = document.getElementById("importInput");

  // Helpers for URL <-> dataURL
  const urlToDataUrl = async (url) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result); // data URL
        reader.readAsDataURL(blob);
      });
    } catch {
      return url; // fallback
    }
  };
  const dataUrlToBlobUrl = async (dataUrl) => {
    // Turn embedded data URL back into object URL (for img.src usage)
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      // Fallback: decode by atob
      const parts = dataUrl.split(",");
      const mime = (parts[0].match(/data:(.*?);/) || [])[1] || "application/octet-stream";
      const bstr = atob(parts[1] || "");
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8arr], { type: mime });
      return URL.createObjectURL(blob);
    }
  };

  // Compact export (schema v2)
  const exportData = async () => {
    const defaultName = `gacha-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}`;
    const result = prompt("Enter export file name (without extension):", defaultName);
    if (result === null) return; // user pressed Cancel -> do not export
    const name = (result.trim() || defaultName);

    showBusy("Exporting...");
    try {
      const imagesDict = {}; // id -> { d, n, t }
      const groupsOut = [];  // [{ id, n, r, i: [ids] }]

      // Collect images across all groups (dedupe)
      for (const g of state.groups) {
        const imgIds = [];
        for (const img of g.images) {
          imgIds.push(img.id);
          if (!imagesDict[img.id]) {
            imagesDict[img.id] = {
              d: await urlToDataUrl(img.url),      // data URL
              n: img.name,
              t: img.title || fileTitle(img.name),
            };
          }
        }
        groupsOut.push({ id: g.id, n: g.name, r: g.rarity, i: imgIds });
      }

      // Inventory as dictionary keyed by image id (compact keys)
      const inventoryOut = {};
      for (const it of state.inventory.values()) {
        inventoryOut[it.id] = { c: it.count, t: it.title, g: it.groupName };
      }

      const payload = {
        schema: "custom-gacha-maker/v2",
        nextId: state.nextId,
        images: imagesDict,
        groups: groupsOut,
        inventory: inventoryOut,
      };

      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      hideBusy();
    }
  };

  // Import for schema v2 (fallback to v1 support)
  const importData = async (file) => {
    showBusy("Importing...");
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const schema = payload?.schema;

      if (!schema || (schema !== "custom-gacha-maker/v2" && schema !== "custom-gacha-maker/v1")) {
        alert("Invalid or unsupported export file.");
        return;
      }

      // Clean existing
      state.groups.forEach(g => revokeImages(g.images));
      state.groups = [];
      state.inventory.clear();

      if (schema === "custom-gacha-maker/v2") {
        // Restore groups and images from compact dict
        const imagesDict = payload.images || {};
        const idToBlobUrl = {};

        // Pre-materialize blob URLs (retain IDs)
        for (const [imgId, meta] of Object.entries(imagesDict)) {
          idToBlobUrl[imgId] = await dataUrlToBlobUrl(meta.d);
        }

        for (const g of payload.groups || []) {
          const restoredImages = (g.i || []).map(id => ({
            id,
            name: imagesDict[id]?.n || "image",
            title: imagesDict[id]?.t || imagesDict[id]?.n || "image",
            url: idToBlobUrl[id]
          }));
          state.groups.push({ id: g.id, name: g.n, rarity: g.r, images: restoredImages });
        }

        state.nextId = Math.max(payload.nextId || 1, ...state.groups.map(g => g.id + 1), 1);

        // Inventory
        for (const [imgId, entry] of Object.entries(payload.inventory || {})) {
          // Find group name by id
          const owner = state.groups.find(g => g.images.some(img => img.id === imgId));
          const srcImg = owner?.images.find(img => img.id === imgId);
          if (!srcImg) continue;
          const clonedUrl = await cloneImageUrl(srcImg.url);
          state.inventory.set(imgId, {
            id: imgId,
            title: entry.t || srcImg.title,
            groupName: entry.g || owner?.name || "",
            url: clonedUrl,
            count: entry.c || 1
          });
        }
      } else {
        // Fallback: v1 (previous export format) - keep existing logic
        // Restore groups and images
        for (const g of payload.groups || []) {
          const restoredImages = [];
          for (const img of (g.images || [])) {
            const blobUrl = await dataUrlToBlobUrl(img.dataUrl);
            restoredImages.push({ id: img.id, name: img.name, title: img.title, url: blobUrl });
          }
          state.groups.push({ id: g.id, name: g.name, rarity: g.rarity, images: restoredImages });
        }
        state.nextId = Math.max(payload.nextId || 1, ...state.groups.map(g => g.id + 1), 1);
        for (const it of (payload.inventory || [])) {
          const imgOwner = state.groups.find(g => g.images.some(img => img.id === it.id));
          const srcImg = imgOwner?.images.find(img => img.id === it.id);
          if (!srcImg) continue;
          const clonedUrl = await cloneImageUrl(srcImg.url);
          state.inventory.set(it.id, {
            id: it.id,
            title: it.title,
            groupName: imgOwner?.name || it.groupName,
            url: clonedUrl,
            count: it.count || 1
          });
        }
      }

      render();
      renderInventory();
      alert("Import completed.");
    } catch (err) {
      console.error(err);
      alert("Failed to import file.");
    } finally {
      hideBusy();
    }
  };

  // Wire buttons
  exportBtn?.addEventListener("click", exportData);
  importBtn?.addEventListener("click", () => importInput?.click());
  importInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (file) await importData(file);
    e.target.value = ""; // reset for next import
  });

  // ==================== GAME LOGIC ====================
  // Initial render
  render();
  renderInventory();
})();
