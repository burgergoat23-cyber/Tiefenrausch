// Alle Balancing-Werte an einem Ort. Die Zahlen sind Startwerte und dürfen angepasst werden.
// Zeiten in Sekunden, Strecken in Welteinheiten, Winkel in Grad (wo nicht anders vermerkt).

export const CONFIG = {
  title: 'NEON ARENA',

  loop: {
    step: 1 / 60,          // fester Logik-Zeitschritt
    maxFrame: 0.1,         // längste Bildzeit, die verarbeitet wird
    maxStepsPerFrame: 8,   // Schutz gegen "Todesspirale" auf sehr langsamen Geräten
  },

  view: {
    visibleLongSide: 1200, // so viele Welteinheiten passen auf die lange Bildschirmseite
    dprMax: 2,             // Obergrenze für devicePixelRatio
  },

  arena: {
    width: 2400,
    height: 1600,
    safeRadius: 300,       // um den Start bleibt dieser Radius frei
    gridSize: 80,          // Abstand der Bodengitter-Linien
    burnFade: 20,          // Brandflecken verblassen in dieser Zeit
  },

  player: {
    maxHp: 100,
    maxSpeed: 320,
    accel: 2400,
    stopTime: 0.12,        // Reibung: aus voller Fahrt in dieser Zeit stehen
    radius: 14,            // Hitbox (kleiner als die Grafik)
    drawRadius: 19,
    invulnAfterHit: 0.8,
    hitKnockback: 260,     // Schubs beim Treffer
    lowHpFraction: 0.25,
    stretch: 0.12,         // Streckung beim Laufen
  },

  dash: {
    duration: 0.15,
    distance: 180,
    cooldown: 1.5,
    grace: 0.06,           // kurze Nach-Unverwundbarkeit nach dem Dash
    afterimages: 5,
  },

  camera: {
    follow: 0.1,           // Lerp-Faktor pro Logikschritt
    lookAhead: 0.15,       // Anteil Vorausschau in Zielrichtung
    bossPanTime: 1.0,
    bossPanBlend: 0.25,    // Übergangszeit hin und zurück
  },

  shake: {
    decay: 1.6,            // Trauma pro Sekunde
    maxOffset: 26,         // Welteinheiten bei Trauma 1
    maxAngle: 0.035,       // Radiant bei Trauma 1
    frequency: 18,         // Rauschfrequenz
    levels: { off: 0, low: 0.45, normal: 1 },
  },

  // Trauma-Werte der Ereignisse (0..1)
  trauma: {
    shot: 0.02, shotgun: 0.14, rocket: 0.08, rail: 0.22,
    explosion: 0.32, bigExplosion: 0.55, playerHit: 0.38, stomp: 0.28,
    bossAttack: 0.18, bossRoar: 0.6, bossDeath: 0.9, playerDeath: 0.8,
  },

  juice: {
    hitStopBigKill: 0.05,  // Hit-Stop bei Kills großer Gegner (40-60 ms)
    hitStopBoss: 0.12,
    hitStopPlayerHit: 0.04,
    flashTime: 0.08,       // weißes Aufblitzen bei Treffer
    squash: 0.28,          // Stauchung bei Treffer
    deathSlowmo: 0.2,
    deathSlowmoTime: 1.0,  // echte Sekunden
  },

  weapons: {
    order: ['pistol', 'shotgun', 'mg', 'rocket', 'rail'],
    pistol: {
      name: 'Pistole', damage: 12, rate: 5, spread: 2, speed: 900, life: 1.0, ammo: Infinity,
      pellets: 1, radius: 4, knockback: 70, recoil: 30, trauma: 'shot', pitch: 1,
    },
    shotgun: {
      name: 'Schrotflinte', damage: 8, rate: 1.3, spread: 28, speed: 750, speedJitter: 0.18, life: 0.35,
      ammo: 40, pellets: 7, radius: 4, knockback: 120, recoil: 340, trauma: 'shotgun',
    },
    mg: {
      name: 'Maschinengewehr', damage: 7, rate: 14, spread: 7, spreadMax: 12, spreadGrow: 0.45,
      spreadRecover: 14, speed: 1000, life: 0.85, ammo: 200, pellets: 1, radius: 3.5,
      knockback: 35, recoil: 22, trauma: 'shot',
    },
    rocket: {
      name: 'Raketenwerfer', damage: 60, splash: 40, splashRadius: 130, rate: 1, spread: 0, speed: 500,
      accel: 1100, maxSpeed: 1250, life: 2.0, ammo: 12, pellets: 1, radius: 7, knockback: 320,
      recoil: 160, trauma: 'rocket',
    },
    rail: {
      name: 'Railgun', damage: 90, rate: 0.8, charge: 0.4, range: 1800, beamWidth: 9, ammo: 15,
      pellets: 1, knockback: 170, recoil: 240, trauma: 'rail',
    },
    multiShotAngle: 12,    // Mehrfachschuss: seitliche Schüsse um diesen Winkel
    assistAngle: 6,        // Zielhilfe: höchstens so viel Grad Korrektur
    assistCone: 16,        // nur Gegner innerhalb dieses Kegels
    assistRange: 900,
    ammoCapFactor: 2,      // Munition höchstens doppelte Startmenge
  },

  enemyBullet: { color: '#ff3b6b' },

  enemies: {
    runner: {
      name: 'Läufer', shape: 'triangle', color: '#ff4848', hp: 30, speed: 110, damage: 10, points: 10,
      unlock: 1, cost: 1, weight: 3, radius: 16, accel: 900,
    },
    sprinter: {
      name: 'Sprinter', shape: 'arrow', color: '#ffe23f', hp: 15, speed: 240, damage: 8, points: 15,
      unlock: 2, cost: 1, weight: 2.4, radius: 12, accel: 1600,
      zigInterval: 0.32, zigAngle: 42, zigMin: 1.1, zigMax: 2.0, sprintRange: 280,
      pauseTime: 0.45, sprintTime: 0.6, sprintMult: 1.7, recoverTime: 0.35,
    },
    shooter: {
      name: 'Schütze', shape: 'square', color: '#b65cff', hp: 40, speed: 90, damage: 12, points: 25,
      unlock: 3, cost: 3, weight: 1.6, radius: 18, accel: 700,
      minDist: 350, maxDist: 500, fireEvery: 2, telegraph: 0.4, fireRange: 950,
      bulletSpeed: 270, bulletRadius: 9, bulletLife: 4.5,
    },
    bomber: {
      name: 'Bomber', shape: 'bomb', color: '#ff8a1f', hp: 25, speed: 150, damage: 35, points: 20,
      unlock: 4, cost: 2, weight: 1.8, radius: 17, accel: 1000,
      triggerDist: 80, fuse: 1, blastRadius: 100, deathBlastDamage: 35,
    },
    tank: {
      name: 'Panzer', shape: 'hexagon', color: '#7dff3a', hp: 220, speed: 60, damage: 25, points: 50,
      unlock: 6, cost: 6, weight: 0.8, radius: 32, accel: 500, knockResist: 0.8, dropChance: 0.3,
      stompEvery: 4, stompWindup: 0.7, stompRange: 450, waveSpeed: 330, waveMaxRadius: 260, waveThickness: 16,
      waveDamage: 15,
      big: true,
    },
    splitter: {
      name: 'Teiler', shape: 'pentagon', color: '#22e8b8', hp: 60, speed: 100, damage: 10, points: 30,
      unlock: 7, cost: 4, weight: 1.2, radius: 22, accel: 800, splitInto: 3, big: true,
    },
    mini: {
      name: 'Mini-Teiler', shape: 'pentagon', color: '#22e8b8', hp: 15, speed: 150, damage: 6, points: 5,
      radius: 11, accel: 1000,
    },
    shield: {
      name: 'Schildträger', shape: 'shield', color: '#4a86ff', hp: 70, speed: 80, damage: 12, points: 40,
      unlock: 9, cost: 4, weight: 1.2, radius: 20, accel: 600, turnRate: 0.8, shieldArc: 110,
      knockResist: 0.35, big: true,
    },
    egg: {
      name: 'Ei', shape: 'egg', color: '#c9ff5a', hp: 20, speed: 0, damage: 0, points: 5,
      radius: 13, accel: 0, hatchTime: 3, hatchInto: 'sprinter', hatchCount: 1, knockResist: 1,
    },
  },

  bosses: {
    hpGrowth: 0.4,         // +40 % Leben bei jedem neuen Auftauchen (multiplikativ)
    dualHpFactor: 0.75,    // wenn beide gleichzeitig kommen
    phases: [0.66, 0.33],
    phaseSpeedup: 1.22,    // pro Phase schneller
    introTime: 1.5,        // Erscheinen (unverwundbar, inaktiv)
    roarTime: 0.9,         // Brüllen beim Phasenwechsel
    drops: 3,
    points: 500,
    guardian: {
      name: 'DER WÄCHTER', hp: 1500, radius: 62, color: '#ff3b3b', speed: 70, damage: 30,
      keepDist: 330, turnSpeed: 0.5,
      salvoEvery: 2.6, salvoTelegraph: 0.6, salvoCount: 16, salvoGap: 3, salvoSpeed: 225,
      salvoRings2: 2, salvoRingDelay: 0.35, bulletRadius: 11, bulletDamage: 15,
      chargeEvery: 5.5, chargeWarn: 1, chargeSpeed: 920, chargeTime: 1.25, chargeStun: 0.6, chargeBounces: 2,
      summonEvery: 6, summonCount: 4, summonType: 'runner',
      spiralArms: 3, spiralInterval: 0.12, spiralTurn: 1.5, spiralTime: 2.8, spiralPause: 1.6,
      spiralSpeed: 210,
    },
    brood: {
      name: 'DIE BRUT', hp: 2500, radius: 70, color: '#7dff5a', color2: '#c05cff', speed: 46, damage: 20,
      eggEvery: 4, eggCount: 2, maxEggs: 6,
      acidEvery: 3.8, acidCount: 3, acidFlight: 1, acidRadius: 70, acidLife: 4, acidDamage: 8,
      acidTick: 0.5, acidSpread: 110,
      splitHp: 0.3, childRadius: 48, childSpeed: 1.45, childRate: 1.35,
    },
  },

  waves: {
    budgetBase: 10, budgetLinear: 7, budgetQuad: 0.3,
    hpPerWave: 0.06,       // linear: +6 % pro Welle
    speedPerWave: 0.01, speedMax: 0.3,
    maxAlive: 45,
    groupMin: 3, groupMax: 8,
    durationMin: 20, durationMax: 40, durationPerWave: 1.25,
    introTime: 2,
    breakTime: 6, breakHeal: 10,
    upgradeDelay: 1.2,     // Sekunden nach Wellenende bis zur Kartenwahl
    bossEvery: 5,
    markLast: 3,
    newTypeShare: 0.35,    // Anteil des Budgets für neu freigeschaltete Typen
    spawnWarn: 1,
    spawnMinDist: 350,
    spawnHoldDist: 150,    // steht der Spieler so nah am Warnkreis, wartet der Spawn
    groupSpread: 80,
    coverChance: 0.3,      // Anteil Spawns hinter Hindernissen
    fastForward: 1.5,      // Arena leer: nächste Gruppe spätestens nach dieser Zeit
    specialFirst: 8,       // erste Spezialwelle (siehe NOTES.md)
    specialEvery: 4,
    specials: ['sprinters', 'bomberRain', 'darkness', 'shooterRing'],
    darknessRadius: 270,
    ringRadius: 460,
    upgradeWaves: [3, 5, 8, 10],
    upgradeEveryAfter: 5,
  },

  drops: {
    chance: 0.1,
    split: { heal: 0.35, weapon: 0.25, power: 0.4 },
    weaponWeights: { shotgun: 3, mg: 3, rocket: 2, rail: 2 },
    powerWeights: { shield: 1, rapid: 1, multi: 1, slow: 1, magnet: 0.7 },
    life: 12, weaponLife: 15, blinkTime: 3,
    attractRange: 60, attractSpeed: 520, magnetSpeed: 900,
    pickupRadius: 18,
  },

  powerups: {
    heal:   { name: 'Heilung', amount: 25, color: '#3dff7a' },
    shield: { name: 'Schild', amount: 50, duration: 12, color: '#3f9bff' },
    rapid:  { name: 'Schnellfeuer', rateBonus: 0.6, duration: 8, color: '#ffe23f' },
    multi:  { name: 'Mehrfachschuss', duration: 8, color: '#ff9a2f' },
    slow:   { name: 'Zeitlupe', factor: 0.5, duration: 5, color: '#c05cff' },
    magnet: { name: 'Magnet', color: '#ffffff' },
    extendCap: 2,          // Dauer höchstens doppelte Grunddauer
  },

  upgrades: [
    { id: 'tough',  name: 'Zähigkeit',        icon: 'heart',  max: 5, desc: '+20 max. Leben und volle Heilung', value: 20 },
    { id: 'swift',  name: 'Flinke Füße',      icon: 'boot',   max: 3, desc: '+10 % Tempo', value: 0.1 },
    { id: 'sharp',  name: 'Scharfschütze',    icon: 'cross',  max: 5, desc: '+15 % Schaden', value: 0.15 },
    { id: 'trigger', name: 'Abzugsfinger',    icon: 'bolt',   max: 5, desc: '+10 % Feuerrate', value: 0.1 },
    { id: 'pierce', name: 'Durchschlag',      icon: 'pierce', max: 2, desc: 'Projektile treffen 1 Gegner mehr', value: 1 },
    { id: 'bounce', name: 'Abpraller',        icon: 'bounce', max: 2, desc: 'Projektile prallen 1× von Wänden ab', value: 1 },
    { id: 'vamp',   name: 'Vampir',           icon: 'drop',   max: 3, desc: '2 % des Schadens heilt dich', value: 0.02 },
    { id: 'dash2',  name: 'Doppel-Dash',      icon: 'dash2',  max: 1, desc: '2 Dash-Ladungen', value: 1 },
    { id: 'dashBoom', name: 'Dash-Explosion', icon: 'boom',   max: 1, desc: 'Explosion am Ende des Dashes', value: 1, radius: 80, damage: 30 },
    { id: 'luck',   name: 'Glückspilz',       icon: 'clover', max: 3, desc: '+30 % Drop-Chance', value: 0.3 },
    { id: 'ammo',   name: 'Munitionsgürtel',  icon: 'ammo',   max: 2, desc: '+50 % Munition für alle Waffen', value: 0.5 },
    { id: 'crit',   name: 'Kritische Treffer', icon: 'star',  max: 3, desc: '10 % Chance auf doppelten Schaden', value: 0.1 },
  ],
  upgradeChoices: 3,
  upgradeConfirmLock: 0.45, // so lange nach dem Öffnen keine Auswahl (gegen Versehen)

  combo: {
    window: 2.5,
    tiers: [
      { at: 0, mult: 1 },
      { at: 10, mult: 1.5 },
      { at: 25, mult: 2 },
      { at: 50, mult: 3 },
      { at: 100, mult: 4 },
    ],
    hitKeep: 0.5,          // bei Treffer bleibt dieser Anteil
  },

  scoring: {
    noHitBonus: 500,       // × Wellennummer
    bossBonus: 5000,       // × Boss-Nummer
    highscoreCount: 10,
  },

  colors: {
    background: '#07070f',
    grid: '#13204a',
    gridBright: '#2a4aa0',
    wall: '#3ff3ff',
    obstacle: '#5b6cff',
    player: '#3ff3ff',
    playerBullet: '#b8ffff',
    enemyBullet: '#ff3b6b',
    warning: '#ff2e4d',
    hud: '#e8f6ff',
    hudDim: '#7f93b8',
    hp: '#3dff7a',
    hpLow: '#ff3b5b',
    shield: '#3f9bff',
    combo: '#ffe23f',
  },

  particles: {
    max: 1200,
    quality: { low: 0.4, normal: 1, high: 1.7 },
    damageNumbers: 80,
    casingStay: 1.6,
  },

  touch: {
    stickRadius: 60,       // CSS-Pixel, höchstens
    deadzone: 0.1,
    fireThreshold: 0.3,
    buttonSize: 64,
  },

  perf: {
    lowFps: 50,
    lowFpsTime: 3,
  },

  audio: {
    maxVoices: 12,
    minRepeat: 0.03,
    bpm: 120,
    bossBpm: 140,
    musicVolume: 0.6,
    sfxVolume: 0.8,
  },

  debug: {
    enabled: true,         // F3 erlaubt
  },
};

// Hilfsfunktion: Liste der Wellen mit Upgrade-Auswahl
export function isUpgradeWave(wave, cfg = CONFIG.waves) {
  if (cfg.upgradeWaves.includes(wave)) return true;
  const last = cfg.upgradeWaves[cfg.upgradeWaves.length - 1];
  return wave > last && (wave - last) % cfg.upgradeEveryAfter === 0;
}
