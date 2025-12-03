/**
 * Abilities System - 100+ unique abilities for gacha items
 */

const Abilities = (() => {
  // Ability definitions
  // Each ability has: id, name, description, type, trigger, effect function
  const ABILITY_LIST = [
    // === OFFENSIVE ABILITIES (1-25) ===
    { id: 1, name: "Power Strike", desc: "Deal 25% extra damage on first attack", type: "offensive", trigger: "firstAttack", modifier: { damageBonus: 0.25, uses: 1 } },
    { id: 2, name: "Critical Eye", desc: "20% chance to deal double damage", type: "offensive", trigger: "onAttack", modifier: { critChance: 0.2, critMulti: 2 } },
    { id: 3, name: "Fury", desc: "+5 attack permanently", type: "offensive", trigger: "passive", modifier: { attackFlat: 5 } },
    { id: 4, name: "Berserk", desc: "+50% attack when HP below 30%", type: "offensive", trigger: "lowHp", modifier: { attackPercent: 0.5, threshold: 0.3 } },
    { id: 5, name: "Combo Master", desc: "Each consecutive hit deals +3 more damage", type: "offensive", trigger: "onAttack", modifier: { stackingDamage: 3 } },
    { id: 6, name: "Armor Pierce", desc: "Attacks ignore 30% of enemy defense", type: "offensive", trigger: "onAttack", modifier: { armorPierce: 0.3 } },
    { id: 7, name: "Savage Blow", desc: "25% chance to deal 1.5x damage", type: "offensive", trigger: "onAttack", modifier: { savageChance: 0.25, savageMulti: 1.5 } },
    { id: 8, name: "Execute", desc: "Deal 2x damage to enemies below 25% HP", type: "offensive", trigger: "onAttack", modifier: { executeThreshold: 0.25, executeMulti: 2 } },
    { id: 9, name: "First Blood", desc: "Deal 40% extra damage on battle start", type: "offensive", trigger: "battleStart", modifier: { damageBonus: 0.4, turns: 1 } },
    { id: 10, name: "Relentless", desc: "+2 attack each turn", type: "offensive", trigger: "onTurn", modifier: { attackGain: 2 } },
    { id: 11, name: "Double Strike", desc: "15% chance to attack twice", type: "offensive", trigger: "onAttack", modifier: { doubleChance: 0.15 } },
    { id: 12, name: "Vengeance", desc: "Deal +20% damage after taking damage", type: "offensive", trigger: "afterHit", modifier: { damageBonus: 0.2, duration: 1 } },
    { id: 13, name: "Hunter's Mark", desc: "Attacks deal +10 flat damage", type: "offensive", trigger: "onAttack", modifier: { flatDamage: 10 } },
    { id: 14, name: "Bloodlust", desc: "+3 attack for each enemy defeated", type: "offensive", trigger: "onKill", modifier: { attackGain: 3 } },
    { id: 15, name: "Precision", desc: "Minimum damage dealt is 80% of attack", type: "offensive", trigger: "onAttack", modifier: { minDamagePercent: 0.8 } },
    { id: 16, name: "Overwhelm", desc: "+30% damage vs full HP enemies", type: "offensive", trigger: "onAttack", modifier: { fullHpBonus: 0.3 } },
    { id: 17, name: "Chain Lightning", desc: "10% chance to hit all enemies", type: "offensive", trigger: "onAttack", modifier: { aoeChance: 0.1 } },
    { id: 18, name: "Assassinate", desc: "First attack has +50% crit chance", type: "offensive", trigger: "firstAttack", modifier: { critBonus: 0.5 } },
    { id: 19, name: "Rampage", desc: "Gain +1 attack per attack made", type: "offensive", trigger: "onAttack", modifier: { attackStack: 1 } },
    { id: 20, name: "True Damage", desc: "25% of damage ignores all modifiers", type: "offensive", trigger: "onAttack", modifier: { trueDamage: 0.25 } },
    { id: 21, name: "Exploit Weakness", desc: "+40% damage vs debuffed enemies", type: "offensive", trigger: "onAttack", modifier: { debuffBonus: 0.4 } },
    { id: 22, name: "Finishing Blow", desc: "+100% damage if it would kill", type: "offensive", trigger: "onAttack", modifier: { finisherBonus: 1.0 } },
    { id: 23, name: "Rage", desc: "Lose 5 HP per attack, gain +15 damage", type: "offensive", trigger: "onAttack", modifier: { selfDamage: 5, damageGain: 15 } },
    { id: 24, name: "Lucky Strike", desc: "10% chance for 3x damage", type: "offensive", trigger: "onAttack", modifier: { luckyChance: 0.1, luckyMulti: 3 } },
    { id: 25, name: "Sharpened Blade", desc: "+20% attack", type: "offensive", trigger: "passive", modifier: { attackPercent: 0.2 } },

    // === DEFENSIVE ABILITIES (26-50) ===
    { id: 26, name: "Iron Skin", desc: "Take 15% less damage", type: "defensive", trigger: "onHit", modifier: { damageReduce: 0.15 } },
    { id: 27, name: "Dodge", desc: "20% chance to avoid attacks", type: "defensive", trigger: "onHit", modifier: { dodgeChance: 0.2 } },
    { id: 28, name: "First Shield", desc: "Block the first attack completely", type: "defensive", trigger: "firstHit", modifier: { blockFirst: true } },
    { id: 29, name: "Fortitude", desc: "+30 max HP", type: "defensive", trigger: "passive", modifier: { hpFlat: 30 } },
    { id: 30, name: "Thick Hide", desc: "Reduce all damage by 5", type: "defensive", trigger: "onHit", modifier: { flatReduction: 5 } },
    { id: 31, name: "Last Stand", desc: "Cannot die from above 1 HP once", type: "defensive", trigger: "onFatalHit", modifier: { surviveOnce: true } },
    { id: 32, name: "Regeneration", desc: "Heal 5 HP at start of each turn", type: "defensive", trigger: "onTurn", modifier: { healPerTurn: 5 } },
    { id: 33, name: "Thorns", desc: "Reflect 20% of damage taken", type: "defensive", trigger: "onHit", modifier: { thornsDamage: 0.2 } },
    { id: 34, name: "Resilience", desc: "+50% HP", type: "defensive", trigger: "passive", modifier: { hpPercent: 0.5 } },
    { id: 35, name: "Second Wind", desc: "Heal 25% HP when below 20% HP once", type: "defensive", trigger: "lowHp", modifier: { healPercent: 0.25, uses: 1 } },
    { id: 36, name: "Stone Wall", desc: "Take 25% less damage from first 3 hits", type: "defensive", trigger: "onHit", modifier: { damageReduce: 0.25, uses: 3 } },
    { id: 37, name: "Evasion Master", desc: "+10% dodge chance", type: "defensive", trigger: "passive", modifier: { dodgeFlat: 0.1 } },
    { id: 38, name: "Undying Will", desc: "Survive fatal damage with 1 HP (once)", type: "defensive", trigger: "onFatalHit", modifier: { undying: true } },
    { id: 39, name: "Shield Wall", desc: "Block 30 damage from first hit", type: "defensive", trigger: "firstHit", modifier: { shieldAmount: 30 } },
    { id: 40, name: "Adaptive Armor", desc: "Gain +5% damage reduction per hit taken", type: "defensive", trigger: "onHit", modifier: { armorStack: 0.05 } },
    { id: 41, name: "Healing Factor", desc: "Heal 3 HP after dealing damage", type: "defensive", trigger: "onAttack", modifier: { lifeOnHit: 3 } },
    { id: 42, name: "Guardian Angel", desc: "Once per battle, negate a fatal hit", type: "defensive", trigger: "onFatalHit", modifier: { guardian: true } },
    { id: 43, name: "Tough", desc: "+20 max HP", type: "defensive", trigger: "passive", modifier: { hpFlat: 20 } },
    { id: 44, name: "Mirror Shield", desc: "30% chance to reflect attacks", type: "defensive", trigger: "onHit", modifier: { reflectChance: 0.3 } },
    { id: 45, name: "Barrier", desc: "Start battle with 20 HP shield", type: "defensive", trigger: "battleStart", modifier: { shield: 20 } },
    { id: 46, name: "Parry", desc: "25% chance to reduce damage by 50%", type: "defensive", trigger: "onHit", modifier: { parryChance: 0.25, parryReduce: 0.5 } },
    { id: 47, name: "Endurance", desc: "Cannot take more than 30% max HP per hit", type: "defensive", trigger: "onHit", modifier: { damageCap: 0.3 } },
    { id: 48, name: "Life Steal", desc: "Heal for 15% of damage dealt", type: "defensive", trigger: "onAttack", modifier: { lifeSteal: 0.15 } },
    { id: 49, name: "Blessed", desc: "Heal 10% HP at battle start", type: "defensive", trigger: "battleStart", modifier: { healPercent: 0.1 } },
    { id: 50, name: "Indomitable", desc: "Reduce damage by 10% per active ally", type: "defensive", trigger: "onHit", modifier: { allyReduction: 0.1 } },

    // === UTILITY ABILITIES (51-75) ===
    { id: 51, name: "Quick Draw", desc: "Always attack first", type: "utility", trigger: "turnOrder", modifier: { priority: 100 } },
    { id: 52, name: "Slow Start", desc: "Skip first turn, +50% stats after", type: "utility", trigger: "battleStart", modifier: { skipTurn: 1, statBoost: 0.5 } },
    { id: 53, name: "Focus", desc: "+30% damage after not attacking", type: "utility", trigger: "afterWait", modifier: { damageBonus: 0.3 } },
    { id: 54, name: "Swift", desc: "10% chance for extra turn", type: "utility", trigger: "onTurn", modifier: { extraTurnChance: 0.1 } },
    { id: 55, name: "Preparation", desc: "First attack is delayed but deals 2x", type: "utility", trigger: "firstAttack", modifier: { delayTurns: 1, damageMulti: 2 } },
    { id: 56, name: "Momentum", desc: "Each turn increases damage by 5%", type: "utility", trigger: "onTurn", modifier: { damageStack: 0.05 } },
    { id: 57, name: "Ambush", desc: "Deal +50% damage if attacking first", type: "utility", trigger: "firstAttack", modifier: { ambushBonus: 0.5 } },
    { id: 58, name: "Taunt", desc: "Enemies focus this fighter", type: "utility", trigger: "passive", modifier: { taunt: true } },
    { id: 59, name: "Stealth", desc: "Cannot be targeted for first 2 turns", type: "utility", trigger: "battleStart", modifier: { stealthTurns: 2 } },
    { id: 60, name: "Counter", desc: "30% chance to counter-attack", type: "utility", trigger: "onHit", modifier: { counterChance: 0.3 } },
    { id: 61, name: "Team Spirit", desc: "Allies gain +5 attack", type: "utility", trigger: "passive", modifier: { allyAttackBuff: 5 } },
    { id: 62, name: "Sacrifice", desc: "Die to fully heal an ally", type: "utility", trigger: "active", modifier: { sacrificeHeal: true } },
    { id: 63, name: "Inspire", desc: "On death, allies gain +20% attack", type: "utility", trigger: "onDeath", modifier: { deathBuff: 0.2 } },
    { id: 64, name: "Last Words", desc: "Deal 50% HP as damage on death", type: "utility", trigger: "onDeath", modifier: { deathDamage: 0.5 } },
    { id: 65, name: "Charge Up", desc: "Every 3rd attack deals double damage", type: "utility", trigger: "onAttack", modifier: { chargeEvery: 3, chargeMulti: 2 } },
    { id: 66, name: "Patience", desc: "+10% damage per turn passed", type: "utility", trigger: "onTurn", modifier: { patienceStack: 0.1 } },
    { id: 67, name: "Desperation", desc: "+1% attack per 1% HP missing", type: "utility", trigger: "passive", modifier: { desperationScale: 0.01 } },
    { id: 68, name: "Clean Slate", desc: "Remove all debuffs at battle start", type: "utility", trigger: "battleStart", modifier: { cleanse: true } },
    { id: 69, name: "Stubborn", desc: "Cannot be debuffed", type: "utility", trigger: "passive", modifier: { debuffImmune: true } },
    { id: 70, name: "Copycat", desc: "Copy enemy's ability at battle start", type: "utility", trigger: "battleStart", modifier: { copyAbility: true } },
    { id: 71, name: "Gambler", desc: "50% chance: double damage or miss", type: "utility", trigger: "onAttack", modifier: { gambleChance: 0.5 } },
    { id: 72, name: "Calm Mind", desc: "Immune to critical hits", type: "utility", trigger: "passive", modifier: { critImmune: true } },
    { id: 73, name: "Aura of Power", desc: "Allies deal +10% damage", type: "utility", trigger: "passive", modifier: { allyDamageAura: 0.1 } },
    { id: 74, name: "Aura of Protection", desc: "Allies take -10% damage", type: "utility", trigger: "passive", modifier: { allyDefenseAura: 0.1 } },
    { id: 75, name: "Time Warp", desc: "First enemy attack is skipped", type: "utility", trigger: "battleStart", modifier: { skipEnemyTurn: 1 } },

    // === DEBUFF ABILITIES (76-90) ===
    { id: 76, name: "Poison Strike", desc: "Attacks poison for 5 damage/turn", type: "debuff", trigger: "onAttack", modifier: { poisonDamage: 5, poisonDuration: 3 } },
    { id: 77, name: "Weaken", desc: "Reduce enemy attack by 20%", type: "debuff", trigger: "onAttack", modifier: { weakenPercent: 0.2, duration: 2 } },
    { id: 78, name: "Slow", desc: "Enemy attacks second", type: "debuff", trigger: "onAttack", modifier: { slow: true } },
    { id: 79, name: "Curse", desc: "Enemy takes 10% more damage", type: "debuff", trigger: "onAttack", modifier: { curseVulnerable: 0.1 } },
    { id: 80, name: "Bleed", desc: "Attacks cause 3 damage/turn bleed", type: "debuff", trigger: "onAttack", modifier: { bleedDamage: 3, bleedDuration: 5 } },
    { id: 81, name: "Stun", desc: "15% chance to stun for 1 turn", type: "debuff", trigger: "onAttack", modifier: { stunChance: 0.15 } },
    { id: 82, name: "Burn", desc: "Attacks burn for 8 damage/turn", type: "debuff", trigger: "onAttack", modifier: { burnDamage: 8, burnDuration: 2 } },
    { id: 83, name: "Freeze", desc: "10% chance to freeze enemy (skip turn)", type: "debuff", trigger: "onAttack", modifier: { freezeChance: 0.1 } },
    { id: 84, name: "Cripple", desc: "Reduce enemy attack by 5 permanently", type: "debuff", trigger: "onAttack", modifier: { crippleFlat: 5 } },
    { id: 85, name: "Expose", desc: "Enemy takes +30% crit damage", type: "debuff", trigger: "onAttack", modifier: { exposeCrit: 0.3 } },
    { id: 86, name: "Drain", desc: "Steal 5% of enemy max HP", type: "debuff", trigger: "onAttack", modifier: { drainPercent: 0.05 } },
    { id: 87, name: "Shatter", desc: "Remove 10 HP from enemy max HP", type: "debuff", trigger: "onAttack", modifier: { shatterHp: 10 } },
    { id: 88, name: "Silence", desc: "Disable enemy ability for 2 turns", type: "debuff", trigger: "onAttack", modifier: { silenceTurns: 2 } },
    { id: 89, name: "Fear", desc: "25% chance enemy misses", type: "debuff", trigger: "passive", modifier: { fearMiss: 0.25 } },
    { id: 90, name: "Doom", desc: "Enemy dies after 5 turns", type: "debuff", trigger: "onAttack", modifier: { doomTurns: 5 } },

    // === SPECIAL/UNIQUE ABILITIES (91-110) ===
    { id: 91, name: "Phoenix", desc: "Revive once with 30% HP", type: "special", trigger: "onDeath", modifier: { revivePercent: 0.3 } },
    { id: 92, name: "Vampire", desc: "Heal for 25% of damage dealt", type: "special", trigger: "onAttack", modifier: { vampireHeal: 0.25 } },
    { id: 93, name: "Glass Cannon", desc: "-50% HP, +100% attack", type: "special", trigger: "passive", modifier: { hpMod: -0.5, attackMod: 1.0 } },
    { id: 94, name: "Tank", desc: "+100% HP, -30% attack", type: "special", trigger: "passive", modifier: { hpMod: 1.0, attackMod: -0.3 } },
    { id: 95, name: "Berserker Rage", desc: "At 10% HP, gain +200% attack", type: "special", trigger: "lowHp", modifier: { rageThreshold: 0.1, rageMod: 2.0 } },
    { id: 96, name: "One Punch", desc: "First attack deals 500% damage, then 50%", type: "special", trigger: "firstAttack", modifier: { punchMulti: 5, afterMulti: 0.5 } },
    { id: 97, name: "Mirror Match", desc: "Copy enemy stats at battle start", type: "special", trigger: "battleStart", modifier: { mirrorStats: true } },
    { id: 98, name: "Lucky Star", desc: "All chances are doubled", type: "special", trigger: "passive", modifier: { luckMulti: 2 } },
    { id: 99, name: "Unlucky", desc: "-25% all stats, gain 2 abilities", type: "special", trigger: "passive", modifier: { statPenalty: -0.25, bonusAbility: true } },
    { id: 100, name: "Equilibrium", desc: "Set HP and Attack to their average", type: "special", trigger: "battleStart", modifier: { equilibrium: true } },
    { id: 101, name: "Chaos", desc: "Random stat changes each turn", type: "special", trigger: "onTurn", modifier: { chaosRange: 0.2 } },
    { id: 102, name: "Perfect Form", desc: "+10% to all stats", type: "special", trigger: "passive", modifier: { allStats: 0.1 } },
    { id: 103, name: "Underdog", desc: "+5% damage per enemy HP advantage", type: "special", trigger: "passive", modifier: { underdogScale: 0.05 } },
    { id: 104, name: "Overkill", desc: "Excess damage heals self", type: "special", trigger: "onKill", modifier: { overkillHeal: true } },
    { id: 105, name: "Soul Link", desc: "Share damage with random ally", type: "special", trigger: "onHit", modifier: { soulLink: 0.5 } },
    { id: 106, name: "Duel", desc: "+50% damage in 1v1 situations", type: "special", trigger: "passive", modifier: { duelBonus: 0.5 } },
    { id: 107, name: "Final Form", desc: "When last alive, +100% all stats", type: "special", trigger: "passive", modifier: { finalFormBonus: 1.0 } },
    { id: 108, name: "Time Stop", desc: "Get 2 free attacks at battle start", type: "special", trigger: "battleStart", modifier: { freeAttacks: 2 } },
    { id: 109, name: "Dimension Shift", desc: "Swap HP with enemy once", type: "special", trigger: "active", modifier: { hpSwap: true } },
    { id: 110, name: "Absolute Zero", desc: "Freeze all enemies for 1 turn", type: "special", trigger: "battleStart", modifier: { massFreeze: 1 } },

    // === TURN MANIPULATION ABILITIES (111-125) ===
    { id: 111, name: "Heavy Hitter", desc: "Attack every 2 turns, but deal 2.5x damage", type: "utility", trigger: "turnManipulation", modifier: { attackEveryNTurns: 2, damageMultiplier: 2.5 } },
    { id: 112, name: "Flurry", desc: "50% chance to gain an extra turn after attacking", type: "utility", trigger: "turnManipulation", modifier: { extraTurnChance: 0.5 } },
    { id: 113, name: "Haste", desc: "Always get an extra turn on first round", type: "utility", trigger: "turnManipulation", modifier: { extraTurnFirstRound: true } },
    { id: 114, name: "Slow Starter", desc: "Skip first 2 turns, then attack twice per turn", type: "utility", trigger: "turnManipulation", modifier: { skipTurns: 2, doubleAttackAfter: true } },
    { id: 115, name: "Charging Strike", desc: "Every 3rd turn, attack 3 times", type: "utility", trigger: "turnManipulation", modifier: { chargeEveryN: 3, multiAttack: 3 } },
    { id: 116, name: "Quick Reflexes", desc: "30% chance to attack again immediately", type: "utility", trigger: "turnManipulation", modifier: { instantReattackChance: 0.3 } },
    { id: 117, name: "Temporal Shield", desc: "Skip every other turn, take 50% less damage", type: "utility", trigger: "turnManipulation", modifier: { skipEveryOther: true, damageReduction: 0.5 } },
    { id: 118, name: "Bide", desc: "Skip 3 turns, then deal 5x damage on next attack", type: "utility", trigger: "turnManipulation", modifier: { bideSkipTurns: 3, bideDamageMulti: 5 } },
    { id: 119, name: "Endless Assault", desc: "Each consecutive attack has 25% chance for another", type: "utility", trigger: "turnManipulation", modifier: { chainAttackChance: 0.25 } },
    { id: 120, name: "Meditation", desc: "Every 4th turn is skipped but heal 20% HP", type: "utility", trigger: "turnManipulation", modifier: { skipEveryN: 4, healOnSkip: 0.2 } },
    { id: 121, name: "Overcharge", desc: "Attack 3 times, then skip 2 turns", type: "utility", trigger: "turnManipulation", modifier: { burstAttacks: 3, burstCooldown: 2 } },
    { id: 122, name: "Time Thief", desc: "20% chance to steal enemy's next turn", type: "utility", trigger: "turnManipulation", modifier: { stealTurnChance: 0.2 } },
    { id: 123, name: "Delayed Blast", desc: "Store attacks for 2 turns, release all at once (3x)", type: "utility", trigger: "turnManipulation", modifier: { storeAttacks: 2, releaseMulti: 3 } },
    { id: 124, name: "Rhythm", desc: "Alternate between 0 and 2 attacks each turn", type: "utility", trigger: "turnManipulation", modifier: { rhythmPattern: [0, 2] } },
    { id: 125, name: "Perpetual Motion", desc: "After 5 turns, always attack twice", type: "utility", trigger: "turnManipulation", modifier: { perpetualAfter: 5, perpetualAttacks: 2 } },
  ];

  // Get a random ability
  function getRandomAbility() {
    const index = Math.floor(Math.random() * ABILITY_LIST.length);
    return { ...ABILITY_LIST[index] };
  }

  // Get ability by ID
  function getAbilityById(id) {
    return ABILITY_LIST.find(a => a.id === id) || null;
  }

  // Get ability display info
  function getAbilityDisplay(ability) {
    if (!ability) return { name: "None", desc: "No ability", color: "#666" };
    
    const colors = {
      offensive: "#ff6b6b",
      defensive: "#4ecdc4",
      utility: "#ffe66d",
      debuff: "#a855f7",
      special: "#f97316",
    };
    
    return {
      name: ability.name,
      desc: ability.desc,
      color: colors[ability.type] || "#888",
      icon: getAbilityIcon(ability.type),
    };
  }

  function getAbilityIcon(type) {
    const icons = {
      offensive: "⚔️",
      defensive: "🛡️",
      utility: "⚡",
      debuff: "💀",
      special: "✨",
    };
    return icons[type] || "❓";
  }

  // Apply passive ability modifiers to stats
  function applyPassiveModifiers(card) {
    const ability = card.ability;
    if (!ability || !ability.modifier) return;
    
    const mod = ability.modifier;
    
    // HP modifiers
    if (mod.hpFlat) card.maxHp += mod.hpFlat;
    if (mod.hpPercent) card.maxHp = Math.floor(card.maxHp * (1 + mod.hpPercent));
    if (mod.hpMod) card.maxHp = Math.floor(card.maxHp * (1 + mod.hpMod));
    
    // Attack modifiers
    if (mod.attackFlat) card.attack += mod.attackFlat;
    if (mod.attackPercent) card.attack = Math.floor(card.attack * (1 + mod.attackPercent));
    if (mod.attackMod) card.attack = Math.floor(card.attack * (1 + mod.attackMod));
    
    // All stats modifier
    if (mod.allStats) {
      card.maxHp = Math.floor(card.maxHp * (1 + mod.allStats));
      card.attack = Math.floor(card.attack * (1 + mod.allStats));
    }
    
    // Dodge base
    if (mod.dodgeFlat) card.dodgeChance = (card.dodgeChance || 0) + mod.dodgeFlat;
    
    // Make sure HP is set to maxHp
    card.hp = card.maxHp;
  }

  // Calculate damage with ability modifiers
  function calculateDamage(attacker, defender, baseDamage, battleState) {
    let damage = baseDamage;
    let effects = [];
    const aAbility = attacker.ability;
    const dAbility = defender.ability;
    
    if (aAbility?.modifier) {
      const mod = aAbility.modifier;
      
      // Flat damage bonuses
      if (mod.flatDamage) damage += mod.flatDamage;
      
      // Percentage damage bonuses
      if (mod.damageBonus && (!mod.uses || (attacker.abilityUses?.damageBonus || 0) < mod.uses)) {
        damage = Math.floor(damage * (1 + mod.damageBonus));
        if (mod.uses) attacker.abilityUses = { ...attacker.abilityUses, damageBonus: (attacker.abilityUses?.damageBonus || 0) + 1 };
        effects.push(`${aAbility.name}!`);
      }
      
      // Critical hit
      if (mod.critChance && Math.random() < mod.critChance) {
        damage = Math.floor(damage * (mod.critMulti || 2));
        effects.push("Critical!");
      }
      
      // Execute
      if (mod.executeThreshold && (defender.hp / defender.maxHp) <= mod.executeThreshold) {
        damage = Math.floor(damage * mod.executeMulti);
        effects.push("Execute!");
      }
      
      // Double strike
      if (mod.doubleChance && Math.random() < mod.doubleChance) {
        damage *= 2;
        effects.push("Double Strike!");
      }
      
      // Lucky strike
      if (mod.luckyChance && Math.random() < mod.luckyChance) {
        damage = Math.floor(damage * mod.luckyMulti);
        effects.push("Lucky!");
      }
      
      // Gambler
      if (mod.gambleChance) {
        if (Math.random() < mod.gambleChance) {
          damage *= 2;
          effects.push("Gamble Win!");
        } else {
          damage = 0;
          effects.push("Gamble Miss!");
        }
      }
      
      // Life steal
      if (mod.lifeSteal) {
        const heal = Math.floor(damage * mod.lifeSteal);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        effects.push(`Heal ${heal}`);
      }
      
      // Vampire heal
      if (mod.vampireHeal) {
        const heal = Math.floor(damage * mod.vampireHeal);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        effects.push(`Drain ${heal}`);
      }
      
      // Self damage (rage)
      if (mod.selfDamage) {
        attacker.hp -= mod.selfDamage;
        damage += mod.damageGain || 0;
      }
    }
    
    // Defender abilities
    if (dAbility?.modifier) {
      const mod = dAbility.modifier;
      
      // Dodge
      if (mod.dodgeChance && Math.random() < mod.dodgeChance) {
        return { damage: 0, dodged: true, effects: ["Dodged!"] };
      }
      
      // Block first hit
      if (mod.blockFirst && !defender.abilityUses?.blockUsed) {
        defender.abilityUses = { ...defender.abilityUses, blockUsed: true };
        return { damage: 0, blocked: true, effects: ["Blocked!"] };
      }
      
      // Damage reduction
      if (mod.damageReduce) {
        const uses = defender.abilityUses?.damageReduceUses || 0;
        if (!mod.uses || uses < mod.uses) {
          damage = Math.floor(damage * (1 - mod.damageReduce));
          if (mod.uses) defender.abilityUses = { ...defender.abilityUses, damageReduceUses: uses + 1 };
          effects.push(`Reduced!`);
        }
      }
      
      // Flat reduction
      if (mod.flatReduction) {
        damage = Math.max(1, damage - mod.flatReduction);
      }
      
      // Damage cap
      if (mod.damageCap) {
        const maxDamage = Math.floor(defender.maxHp * mod.damageCap);
        if (damage > maxDamage) {
          damage = maxDamage;
          effects.push("Capped!");
        }
      }
      
      // Parry
      if (mod.parryChance && Math.random() < mod.parryChance) {
        damage = Math.floor(damage * (1 - mod.parryReduce));
        effects.push("Parry!");
      }
      
      // Thorns
      if (mod.thornsDamage) {
        const thornDmg = Math.floor(damage * mod.thornsDamage);
        attacker.hp -= thornDmg;
        effects.push(`Thorns ${thornDmg}`);
      }
    }
    
    return { damage: Math.max(1, Math.floor(damage)), effects };
  }

  // Process turn-based effects
  function processTurnEffects(card, battleState) {
    const ability = card.ability;
    const effects = [];
    
    if (!ability?.modifier) return effects;
    const mod = ability.modifier;
    
    // Regeneration
    if (mod.healPerTurn && card.hp > 0) {
      card.hp = Math.min(card.maxHp, card.hp + mod.healPerTurn);
      effects.push(`Regen +${mod.healPerTurn}`);
    }
    
    // Attack gain per turn
    if (mod.attackGain) {
      card.attack += mod.attackGain;
      effects.push(`+${mod.attackGain} ATK`);
    }
    
    // Damage stacking
    if (mod.damageStack) {
      card.damageMultiplier = (card.damageMultiplier || 1) + mod.damageStack;
    }
    
    // Patience stacking
    if (mod.patienceStack) {
      card.damageMultiplier = (card.damageMultiplier || 1) + mod.patienceStack;
    }
    
    return effects;
  }

  // Check for survival abilities on fatal damage
  function checkFatalDamage(card, damage) {
    const ability = card.ability;
    if (!ability?.modifier) return { survives: false };
    
    const mod = ability.modifier;
    
    // Undying will
    if ((mod.undying || mod.surviveOnce || mod.guardian) && !card.abilityUses?.surviveUsed) {
      card.abilityUses = { ...card.abilityUses, surviveUsed: true };
      return { survives: true, newHp: 1, effect: "Survived!" };
    }
    
    return { survives: false };
  }

  // Check for revival abilities
  function checkRevival(card) {
    const ability = card.ability;
    if (!ability?.modifier) return null;
    
    const mod = ability.modifier;
    
    if (mod.revivePercent && !card.abilityUses?.revived) {
      card.abilityUses = { ...card.abilityUses, revived: true };
      return {
        revive: true,
        hp: Math.floor(card.maxHp * mod.revivePercent),
        effect: `${ability.name}!`
      };
    }
    
    return null;
  }

  // Get all abilities list
  function getAllAbilities() {
    return [...ABILITY_LIST];
  }

  return {
    getRandomAbility,
    getAbilityById,
    getAbilityDisplay,
    applyPassiveModifiers,
    calculateDamage,
    processTurnEffects,
    checkFatalDamage,
    checkRevival,
    getAllAbilities,
    ABILITY_LIST,
  };
})();

// Export for other modules
window.Abilities = Abilities;
