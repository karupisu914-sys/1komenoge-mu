import React, { useEffect, useRef, useState } from 'react';
import { 
  Player, Enemy, Bullet, Particle, CoverObstacle, Weapon, GameStateType, LootItem, LootType 
} from '../types';
import { gameAudio } from './AudioEngine';

interface GameCanvasProps {
  gameState: GameStateType;
  weapons: Weapon[];
  setWeapons: React.Dispatch<React.SetStateAction<Weapon[]>>;
  playerStats: Player;
  setPlayerStats: React.Dispatch<React.SetStateAction<Player>>;
  currentStage: number;
  onGameOver: () => void;
  onStageComplete: () => void;
}

export default function GameCanvas({
  gameState,
  weapons,
  setWeapons,
  playerStats,
  setPlayerStats,
  currentStage,
  onGameOver,
  onStageComplete,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Gameplay configuration constants
  const VIEW_WIDTH = 900;
  const VIEW_HEIGHT = 500;
  const GROUND_Y = 420;
  const LEVEL_WIDTH = 4000;

  // React local states for HUD items we want to bind fast
  const [hudAmmo, setHudAmmo] = useState({ current: 0, max: 0, reloading: false });

  // Use refs for the active game variables so the requestAnimationFrame loop can access them at 60fps without lag or React re-render spikes
  const playerRef = useRef<Player>({ ...playerStats });
  const weaponsRef = useRef<Weapon[]>([...weapons]);
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const coversRef = useRef<CoverObstacle[]>([]);
  const lootItemsRef = useRef<LootItem[]>([]);
  const isHoldingFireRef = useRef<boolean>(false);
  const katanaSwingTicksRef = useRef<number>(0);

  // Controls monitoring
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef<{ x: number; y: number; isClicked: boolean }>({ x: 0, y: 0, isClicked: false });
  const lastSpacePressedRef = useRef<boolean>(false);

  // Camera scroll tracker
  const cameraXRef = useRef<number>(0);

  // Level spawn manager
  const bossSpawnedRef = useRef<boolean>(false);
  const bossDefeatedRef = useRef<boolean>(false);
  const gateXRef = useRef<number>(LEVEL_WIDTH - 200);

  // Loop references
  const requestIdRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);

  // Keep player stats ref and weapons ref updated whenever parent changes (e.g. upgrades)
  useEffect(() => {
    // Preserve dynamic gameplay physics properties (x, y, vx, vy, etc.), only synchronize stats
    const p = playerRef.current;
    p.health = playerStats.health;
    p.maxHealth = playerStats.maxHealth;
    p.speed = playerStats.speed;
    p.activeWeaponIndex = playerStats.activeWeaponIndex;
    p.kills = playerStats.kills;
    p.cash = playerStats.cash;
    p.score = playerStats.score;
    p.stagesCompleted = playerStats.stagesCompleted;
  }, [playerStats]);

  useEffect(() => {
    weaponsRef.current = [...weapons];
  }, [weapons]);

  // Synchronize initial setup when a level triggers
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    // Reset loop attributes
    bossSpawnedRef.current = false;
    bossDefeatedRef.current = false;
    bulletsRef.current = [];
    particlesRef.current = [];
    lootItemsRef.current = [];
    isHoldingFireRef.current = false;

    // Set initial player position
    playerRef.current.x = 200;
    playerRef.current.y = GROUND_Y - playerRef.current.height;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;
    playerRef.current.state = 'idle';

    // Initialize level obstacles (covers)
    const covers: CoverObstacle[] = [
      { id: 'c1', x: 500, y: GROUND_Y - 45, width: 45, height: 45, health: 180, maxHealth: 180, type: 'crate' },
      { id: 'c2', x: 950, y: GROUND_Y - 55, width: 35, height: 55, health: 120, maxHealth: 120, type: 'bin' },
      { id: 'c3', x: 1400, y: GROUND_Y - 45, width: 45, height: 45, health: 180, maxHealth: 180, type: 'crate' },
      { id: 'c4', x: 1800, y: GROUND_Y - 55, width: 35, height: 55, health: 120, maxHealth: 120, type: 'bin' },
      { id: 'c5', x: 2300, y: GROUND_Y - 45, width: 45, height: 45, health: 180, maxHealth: 180, type: 'crate' },
      { id: 'c6', x: 2750, y: GROUND_Y - 55, width: 35, height: 55, health: 120, maxHealth: 120, type: 'bin' },
      { id: 'c7', x: 3100, y: GROUND_Y - 45, width: 45, height: 45, health: 180, maxHealth: 180, type: 'crate' },
    ];
    coversRef.current = covers;

    // Spawn first Wave of Enemies
    spawnEnemies();

    // Start rendering frame loop
    startLoop();
    gameAudio.startBGM();

    return () => {
      stopLoop();
      gameAudio.stopBGM();
    };
  }, [gameState, currentStage]);

  // Handle auto scaling resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const scaleX = rect.width / VIEW_WIDTH;
      const scaleY = rect.height / VIEW_HEIGHT;
      const scale = Math.min(scaleX, scaleY, 1.5); // cap at 1.5x sharp ratio

      canvas.style.width = `${VIEW_WIDTH * scale}px`;
      canvas.style.height = `${VIEW_HEIGHT * scale}px`;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Set up listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = true;

      if (key === 'r') {
        triggerReload();
      }

      // Weapon selection shortcuts
      if (['1', '2', '3', '4', '5'].includes(key)) {
        const weaponIdx = parseInt(key) - 1;
        if (weaponIdx < weaponsRef.current.length && weaponsRef.current[weaponIdx].unlocked) {
          playerRef.current.activeWeaponIndex = weaponIdx;
          updateHUDAmmo();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const triggerReload = () => {
    const p = playerRef.current;
    const currentWeapon = weaponsRef.current[p.activeWeaponIndex];
    if (currentWeapon.currentAmmo === currentWeapon.ammoMax || currentWeapon.isReloading) return;

    currentWeapon.isReloading = true;
    gameAudio.playReload();

    // Trigger visual/state change callback or local delay
    setTimeout(() => {
      // Find weapon index again securely
      const matchingWeapon = weaponsRef.current.find(w => w.id === currentWeapon.id);
      if (matchingWeapon) {
        matchingWeapon.currentAmmo = matchingWeapon.ammoMax;
        matchingWeapon.isReloading = false;
        updateHUDAmmo();
      }
    }, currentWeapon.reloadTime);

    updateHUDAmmo();
  };

  const updateHUDAmmo = () => {
    const p = playerRef.current;
    const currentWeapon = weaponsRef.current[p.activeWeaponIndex];
    if (currentWeapon) {
      setHudAmmo({
        current: currentWeapon.currentAmmo,
        max: currentWeapon.ammoMax,
        reloading: currentWeapon.isReloading,
      });

      // Maintain sync back to top State when ammo drops
      setWeapons([...weaponsRef.current]);
    }
  };

  // Helper to spawn initial enemies across the 4000px level
  const spawnEnemies = () => {
    const list: Enemy[] = [];
    const baseHealthMul = 1 + (currentStage - 1) * 0.35;
    const baseRewardMul = 1 + (currentStage - 1) * 0.25;

    // --- RANDOMIZED POSITION SEED GENERATION ---
    // Instead of hardcoded arrays, we spawn randomized amounts and zones
    const totalPunks = 6 + Math.floor(Math.random() * 4) + (currentStage * 2);
    const totalDrones = 4 + Math.floor(Math.random() * 3) + currentStage;
    const totalEnforcers = 3 + Math.floor(Math.random() * 2) + currentStage;

    // Create randomized, sorted spawn zones to avoid clumping directly on top of the player's entry zone (0-350)
    const generateSpawns = (count: number, minX = 550, maxX = LEVEL_WIDTH - 250) => {
      const positions: number[] = [];
      for (let i = 0; i < count; i++) {
        positions.push(Math.floor(minX + Math.random() * (maxX - minX)));
      }
      return positions.sort((a, b) => a - b);
    };

    const punkPositions = generateSpawns(totalPunks);
    const dronePositions = generateSpawns(totalDrones);
    const enforcerPositions = generateSpawns(totalEnforcers);

    // Normal/Augmented punks
    punkPositions.forEach((pos, idx) => {
      // Determine equipment depending on Stage progression
      let eqWeapon: 'katana' | 'rifle' | undefined = undefined;
      if (currentStage === 2) {
        eqWeapon = Math.random() > 0.6 ? 'katana' : undefined;
      } else if (currentStage === 3) {
        eqWeapon = Math.random() > 0.5 ? 'katana' : 'rifle';
      }

      list.push({
        id: `punk_${idx}_s${currentStage}`,
        type: 'punk',
        name: eqWeapon === 'katana' ? 'A.I. Ninja Punk' : eqWeapon === 'rifle' ? 'Elite Commando' : 'Street Punk',
        x: pos,
        y: GROUND_Y - 48,
        vx: 0,
        vy: 0,
        width: 25,
        height: 48,
        health: Math.floor(40 * baseHealthMul * (eqWeapon === 'katana' ? 1.25 : 1)),
        maxHealth: Math.floor(40 * baseHealthMul * (eqWeapon === 'katana' ? 1.25 : 1)),
        speed: (1.5 + Math.random() * 0.8) * (eqWeapon === 'katana' ? 1.4 : 1),
        shootCooldown: 120 + Math.random() * 100,
        color: eqWeapon === 'katana' ? '#a855f7' : eqWeapon === 'rifle' ? '#f43f5e' : '#f43f5e',
        facingLeft: true,
        isDead: false,
        scoreReward: eqWeapon ? 220 : 150,
        cashReward: Math.floor((eqWeapon ? 22 : 15) * baseRewardMul),
        hurtFrames: 0,
        equippedWeapon: eqWeapon,
        hasShield: false,
      });
    });

    // Hover drones
    dronePositions.forEach((pos, idx) => {
      list.push({
        id: `drone_${idx}_s${currentStage}`,
        type: 'drone',
        name: currentStage === 3 ? 'Heavy Overlord Drone' : 'A.I. Scout Drone',
        x: pos,
        y: GROUND_Y - 140 - Math.random() * 50,
        vx: 0,
        vy: 0,
        width: 30,
        height: 25,
        health: Math.floor(25 * baseHealthMul),
        maxHealth: Math.floor(25 * baseHealthMul),
        speed: 2.2 + (currentStage * 0.25),
        shootCooldown: Math.max(40, (90 + Math.random() * 80) - (currentStage * 15)),
        color: '#06b6d4',
        facingLeft: true,
        isDead: false,
        scoreReward: 120,
        cashReward: Math.floor(10 * baseRewardMul),
        hurtFrames: 0,
      });
    });

    // Cyber Enforcers (Heavy guards with Shields on advanced stages!)
    enforcerPositions.forEach((pos, idx) => {
      // Shield equipment setups
      let hasS = false;
      let sHealth = 0;
      let eqWeapon: 'katana' | 'rifle' | undefined = undefined;

      if (currentStage === 2) {
        hasS = Math.random() > 0.4;
        sHealth = hasS ? 40 : 0;
        eqWeapon = 'rifle';
      } else if (currentStage === 3) {
        hasS = true;
        sHealth = 65;
        eqWeapon = Math.random() > 0.5 ? 'rifle' : 'katana';
      }

      list.push({
        id: `enforcer_${idx}_s${currentStage}`,
        type: 'enforcer',
        name: hasS ? 'Cyber Aegis Ward' : 'Neo Enforcer',
        x: pos,
        y: GROUND_Y - 52,
        vx: 0,
        vy: 0,
        width: 30,
        height: 52,
        health: Math.floor(80 * baseHealthMul),
        maxHealth: Math.floor(80 * baseHealthMul),
        speed: 1.0 + (hasS ? 0.2 : 0),
        shootCooldown: 140 + Math.random() * 100,
        color: hasS ? '#06b6d4' : '#8b5cf6',
        facingLeft: true,
        isDead: false,
        scoreReward: hasS ? 350 : 250,
        cashReward: Math.floor((hasS ? 40 : 30) * baseRewardMul),
        hurtFrames: 0,
        equippedWeapon: eqWeapon,
        hasShield: hasS,
        shieldHealth: sHealth,
        maxShieldHealth: sHealth,
      });
    });

    enemiesRef.current = list;
  };

  const spawnBoss = () => {
    if (bossSpawnedRef.current) return;
    bossSpawnedRef.current = true;

    // Display sound indication or alert
    gameAudio.playExplosion();

    const baseHealthMul = 1 + (currentStage - 1) * 0.45;
    const baseRewardMul = 1 + (currentStage - 1) * 0.3;

    const boss: Enemy = {
      id: 'stage_boss',
      type: 'boss',
      name: `KAI-Z8 Mech V${currentStage}`,
      x: LEVEL_WIDTH - 450,
      y: GROUND_Y - 95,
      vx: 0,
      vy: 0,
      width: 65,
      height: 95,
      health: Math.floor(400 * baseHealthMul),
      maxHealth: Math.floor(400 * baseHealthMul),
      speed: 1.2,
      shootCooldown: 60,
      color: '#fb7185',
      facingLeft: true,
      isDead: false,
      scoreReward: 2000,
      cashReward: Math.floor(250 * baseRewardMul),
      hurtFrames: 0,
    };

    enemiesRef.current.push(boss);

    // Spawn sparks
    createExplosionParticles(boss.x + boss.width / 2, boss.y + boss.height / 2, 20);
  };

  // Sound and particle generators
  const spawnBloodParticles = (x: number, y: number, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: Math.random().toString(),
        type: 'blood',
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 4 - 2,
        color: '#ef4444',
        size: 2 + Math.random() * 3,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        gravity: true,
      });
    }
  };

  const spawnSparkParticles = (x: number, y: number, count: number, customColor?: string) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: Math.random().toString(),
        type: 'spark',
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        color: customColor || '#fbbf24',
        size: 1.5 + Math.random() * 2,
        life: 1.0,
        decay: 0.04 + Math.random() * 0.04,
        gravity: false,
      });
    }
  };

  const spawnSmokeParticles = (x: number, y: number, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: Math.random().toString(),
        type: 'smoke',
        x,
        y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 1.0 - 0.5,
        color: 'rgba(156,163,175,0.3)',
        size: 6 + Math.random() * 10,
        life: 1.0,
        decay: 0.015 + Math.random() * 0.025,
        gravity: false,
      });
    }
  };

  const createExplosionParticles = (x: number, y: number, count: number) => {
    // Large explosion
    particlesRef.current.push({
      id: Math.random().toString(),
      type: 'explosion',
      x,
      y,
      vx: 0,
      vy: 0,
      color: '#f97316',
      size: 40,
      life: 1.0,
      decay: 0.05,
    });

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      particlesRef.current.push({
        id: Math.random().toString(),
        type: 'debris',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        color: Math.random() > 0.4 ? '#f97316' : '#cbd5e1',
        size: 3 + Math.random() * 4,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.02,
        gravity: true,
      });
    }
  };

  const spawnShellCasing = (x: number, y: number, dirLeft: boolean) => {
    particlesRef.current.push({
      id: Math.random().toString(),
      type: 'shell',
      x,
      y,
      vx: (dirLeft ? 1 : -1) * (1 + Math.random() * 1.5),
      vy: -2 - Math.random() * 2,
      color: '#eab308',
      size: 1.5,
      life: 1.0,
      decay: 0.02,
      gravity: true,
    });
  };

  // Main Loop logic
  const startLoop = () => {
    if (requestIdRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset loop
    frameCountRef.current = 0;

    const gameLoop = () => {
      updateGame();
      renderGame(ctx);
      frameCountRef.current++;
      requestIdRef.current = requestAnimationFrame(gameLoop);
    };

    updateHUDAmmo(); // ensure initial count match
    requestIdRef.current = requestAnimationFrame(gameLoop);
  };

  const stopLoop = () => {
    if (requestIdRef.current) {
      cancelAnimationFrame(requestIdRef.current);
      requestIdRef.current = null;
    }
  };

  // Game variable updaters
  const updateGame = () => {
    const p = playerRef.current;

    // 1. Invulnerability reduction
    if (p.invulFrames > 0) p.invulFrames--;
    if (katanaSwingTicksRef.current > 0) katanaSwingTicksRef.current--;

    // 2. Control Keys parsing
    const currentWeapon = weaponsRef.current[p.activeWeaponIndex];
    const horizontalAcceleration = 0.55;
    const friction = 0.85;

    // Crouching checker
    p.isCrouching = keysRef.current['s'] || keysRef.current['arrowdown'];
    if (p.isCrouching) {
      p.state = 'crouching';
      p.height = 30; // lower hit shape
    } else {
      p.height = 48; // restore normal size
    }

    // Horizontal Movement
    let isMoving = false;
    let targetVX = 0;

    if (keysRef.current['a'] || keysRef.current['arrowleft']) {
      targetVX = -p.speed * (p.isCrouching ? 0.45 : 1);
      p.facingLeft = true;
      isMoving = true;
    } else if (keysRef.current['d'] || keysRef.current['arrowright']) {
      targetVX = p.speed * (p.isCrouching ? 0.45 : 1);
      p.facingLeft = false;
      isMoving = true;
    }

    p.vx = p.vx * friction + targetVX * (1 - friction);
    if (Math.abs(p.vx) < 0.15) p.vx = 0;
    p.x += p.vx;

    // Jumping Mechanics
    const canJump = p.isGrounded && !p.isCrouching;
    if ((keysRef.current['w'] || keysRef.current['arrowup']) && canJump) {
      p.vy = -12;
      p.isGrounded = false;
      gameAudio.playJump();
    }

    // Gravity pull
    p.vy += 0.55; // simple gravity gravity pull
    p.y += p.vy;

    // Check bottom floor contact
    const adjustedGroundY = GROUND_Y - p.height;
    if (p.y >= adjustedGroundY) {
      p.y = adjustedGroundY;
      p.vy = 0;
      p.isGrounded = true;
    }

    if (!p.isGrounded) {
      p.state = 'jumping';
    } else if (isMoving) {
      p.state = 'running';
    } else if (!p.isCrouching) {
      p.state = 'idle';
    }

    // Border clamps
    if (p.x < 15) p.x = 15;
    if (p.x > LEVEL_WIDTH - 50) p.x = LEVEL_WIDTH - 50;

    // 3. Trigger Boss when crossing critical threshold
    if (p.x > LEVEL_WIDTH - 1200) {
      spawnBoss();
    }

    // 4. Manual firing detection (automatic vs single click)
    const canFireWeapon = currentWeapon && currentWeapon.currentAmmo > 0 && !currentWeapon.isReloading;
    
    const isSpacePressed = !!keysRef.current[' '];
    const spaceJustPressed = isSpacePressed && !lastSpacePressedRef.current;
    
    const isAutoWeapon = currentWeapon && (currentWeapon.type === 'rifle' || currentWeapon.type === 'laser');
    
    let isFiring = false;
    if (isAutoWeapon) {
      isFiring = mouseRef.current.isClicked || isSpacePressed;
    } else {
      isFiring = mouseRef.current.isClicked || spaceJustPressed;
    }

    if (isFiring) {
      if (!isHoldingFireRef.current) {
        // First bullet fired on click/press
        fireWeapon(currentWeapon);
        if (isAutoWeapon) {
          // Automatic rifles keep firing on hold
          isHoldingFireRef.current = true;
        } else {
          // Semi-automatics require separate clicks/presses
          mouseRef.current.isClicked = false;
        }
      } else {
        // Hold-firing sequence
        if (frameCountRef.current % Math.max(1, Math.floor(currentWeapon.fireRate / 16.66)) === 0) {
          fireWeapon(currentWeapon);
        }
      }
    } else {
      // Release trigger
      isHoldingFireRef.current = false;
    }

    // Update last space pressed state
    lastSpacePressedRef.current = isSpacePressed;

    // 5. Update game bullets
    const bullets = bulletsRef.current;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.rangeRemaining -= Math.sqrt(b.vx * b.vx + b.vy * b.vy);

      // Append trail
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 5) b.trail.shift();

      let shouldRemove = b.rangeRemaining <= 0 || b.x < 0 || b.x > LEVEL_WIDTH || b.y < 0 || b.y > GROUND_Y;

      if (!shouldRemove) {
        // Bullet collisions with Cover structures
        for (const cover of coversRef.current) {
          if (cover.health > 0) {
            if (b.x >= cover.x && b.x <= cover.x + cover.width &&
                b.y >= cover.y && b.y <= cover.y + cover.height) {
              shouldRemove = true;
              cover.health -= Math.floor(b.damage * (b.isPlayerOwned ? 0.35 : 0.8)); // player guns damage covers less to avoid self destruction
              spawnSparkParticles(b.x, b.y, 4, '#9ca3af');
              if (cover.health <= 0) {
                gameAudio.playExplosion();
                createExplosionParticles(cover.x + cover.width / 2, cover.y + cover.height / 2, 12);

                // Spawn items or ambushed enemies from the destroyed box!
                const isCrate = cover.type === 'crate';
                const prob = isCrate ? 0.70 : 0.40; // crates have higher drop chance than bins
                
                if (Math.random() < 0.15) {
                  // Trap enemy ambush (15% chance)
                  const baseHealthMul = 1 + (currentStage - 1) * 0.3;
                  const baseRewardMul = 1 + (currentStage - 1) * 0.2;
                  const trapId = `trap_enemy_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                  const isDrone = Math.random() < 0.5;

                  enemiesRef.current.push({
                    id: trapId,
                    type: isDrone ? 'drone' : 'punk',
                    name: isDrone ? 'トラップ・ドローン' : 'アンブッシュ・パンク',
                    x: cover.x + cover.width / 2 - 12,
                    y: cover.y - 20,
                    vx: (Math.random() * 2 - 1) * 2, // spring left or right
                    vy: -5.5, // spring up
                    width: isDrone ? 20 : 25,
                    height: isDrone ? 20 : 48,
                    health: Math.floor((isDrone ? 25 : 40) * baseHealthMul),
                    maxHealth: Math.floor((isDrone ? 25 : 40) * baseHealthMul),
                    speed: (isDrone ? 2.5 : 1.8) + Math.random() * 0.5,
                    shootCooldown: 90 + Math.random() * 100,
                    color: isDrone ? '#f97316' : '#e11d48',
                    facingLeft: Math.random() < 0.5,
                    isDead: false,
                    scoreReward: isDrone ? 100 : 150,
                    cashReward: Math.floor((isDrone ? 10 : 15) * baseRewardMul),
                    hurtFrames: 0,
                  });
                  
                  // particles to indicate ambush
                  spawnBloodParticles(cover.x + cover.width / 2, cover.y + cover.height / 2, 8);
                } else if (Math.random() < prob) {
                  // Normal item drop (HP or Cash credit)
                  const isHeal = Math.random() < 0.45; // 45% chance medical pack, 55% credit chip
                  const lootId = `loot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                  lootItemsRef.current.push({
                    id: lootId,
                    x: cover.x + cover.width / 2 - 10,
                    y: cover.y + cover.height / 2 - 10,
                    width: 20,
                    height: 20,
                    type: isHeal ? 'health_pack' : 'cred_chip',
                    amount: isHeal ? 25 : 40,
                    vx: (Math.random() * 2 - 1) * 1.5,
                    vy: -4.5, // bounce upward
                    isGrounded: false,
                  });
                }
              }
              break;
            }
          }
        }
      }

      if (!shouldRemove) {
        if (b.isPlayerOwned) {
          // Player bullet hitting enemies
          for (const enemy of enemiesRef.current) {
            if (!enemy.isDead && enemy.hurtFrames <= 0) {
              if (b.x >= enemy.x && b.x <= enemy.x + enemy.width &&
                  b.y >= enemy.y && b.y <= enemy.y + enemy.height) {
                
                // --- ENEMY SHIELD BLOCK CHECK ---
                if (enemy.hasShield && enemy.shieldHealth! > 0) {
                  const bvx = b.vx;
                  const isFrontalHit = (bvx > 0 && enemy.facingLeft) || (bvx < 0 && !enemy.facingLeft);
                  if (frontalCheckOverride() || isFrontalHit) {
                    // Shield absorbs the strike
                    enemy.shieldHealth! -= b.damage;
                    shouldRemove = true;
                    spawnSparkParticles(b.x, b.y, 8, '#22d3ee'); // bright blue shield spark
                    
                    if (enemy.shieldHealth! <= 0) {
                      enemy.shieldHealth = 0;
                      createExplosionParticles(enemy.x + enemy.width / 2, enemy.y + 15, 12);
                      gameAudio.playExplosion();
                    }
                    break; // Bullet spent, bypass body damage
                  }
                }

                function frontalCheckOverride() {
                  // RPG splash bypasses frontal shield checks due to heavy radial dynamics
                  return currentWeapon?.id === 'rpg';
                }
                
                // Deal damage & set hurt frame buffer
                enemy.health -= b.damage;
                enemy.hurtFrames = 8;
                shouldRemove = true;

                if (b.color === '#ef4444' || currentWeapon?.id === 'rpg') {
                  // Explosive or RPG round
                  createExplosionParticles(b.x, b.y, 10);
                  gameAudio.playExplosion();
                  // Squeeze splash damage on nearby enemies
                  enemiesRef.current.forEach(other => {
                    if (other.id !== enemy.id && !other.isDead) {
                      const dist = Math.abs(other.x - enemy.x);
                      if (dist < 100) {
                        other.health -= Math.floor(b.damage * 0.6);
                        spawnBloodParticles(other.x + other.width / 2, other.y + other.height / 2, 4);
                      }
                    }
                  });
                } else {
                  spawnBloodParticles(b.x, b.y, 5);
                }

                // Check fatal blow
                if (enemy.health <= 0) {
                  enemy.isDead = true;
                  p.kills += 1;
                  p.cash += enemy.cashReward;
                  p.score += enemy.scoreReward;
                  createExplosionParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 12);
                  gameAudio.playExplosion();

                  // State callback propagation to upper component
                  setPlayerStats(prev => ({
                    ...prev,
                    kills: prev.kills + 1,
                    cash: prev.cash + enemy.cashReward,
                    score: prev.score + enemy.scoreReward,
                  }));

                  if (enemy.type === 'boss') {
                    bossDefeatedRef.current = true;
                    // Defeating boss unlocks exit chopper
                    createExplosionParticles(enemy.x + enemy.width / 2, enemy.y - 50, 30);
                  }
                }
                break;
              }
            }
          }
        } else {
          // Enemy bullets hitting Player
          if (p.invulFrames <= 0) {
            if (b.x >= p.x && b.x <= p.x + p.width &&
                b.y >= p.y && b.y <= p.y + p.height) {
              
              // --- PLAYER SHIELD DEFLECTION CHECK ---
              const activeW = weaponsRef.current[p.activeWeaponIndex];
              const isHoldingShield = activeW?.id === 'shield' && activeW?.currentAmmo > 0 && (mouseRef.current.isClicked || keysRef.current[' ']);
              
              if (isHoldingShield) {
                const isFrontalHit = (b.vx < 0 && !p.facingLeft) || (b.vx > 0 && p.facingLeft);
                if (isFrontalHit) {
                  // Shield perfectly blocks the laser bullet!
                  shouldRemove = true;
                  activeW.currentAmmo = Math.max(0, activeW.currentAmmo - 1);
                  updateHUDAmmo();
                  spawnSparkParticles(b.x, b.y, 9, '#22d3ee'); // solid light blue blast
                  gameAudio.playUpgrade(); // sweet digital pulse
                  break; // Safe!
                }
              }

              shouldRemove = true;
              let finalDamage = b.damage;

              // Crouch-behind-cover shielding calculation
              const hasCover = coversRef.current.some(c => 
                c.health > 0 && Math.abs(c.x + c.width / 2 - (p.x + p.width / 2)) < 60
              );

              if (p.isCrouching && hasCover) {
                finalDamage = Math.floor(b.damage * 0.15); // Bullet blocked 85%!
                spawnSparkParticles(b.x, b.y, 5, '#cbd5e1');
              } else {
                spawnBloodParticles(b.x, b.y, 8);
                gameAudio.playPlayerHit();
              }

              p.health = Math.max(0, p.health - finalDamage);
              p.invulFrames = 40; // temporary immunity frames
              p.state = 'hurt';

              // sync state
              setPlayerStats(prev => ({ ...prev, health: p.health }));

              if (p.health <= 0) {
                onGameOver();
                stopLoop();
              }
            }
          }
        }
      }

      if (shouldRemove) {
        bullets.splice(i, 1);
      }
    }

    // 6. Update individual enemies
    const enemies = enemiesRef.current;
    const visibleLeft = cameraXRef.current - 120;
    const visibleRight = cameraXRef.current + VIEW_WIDTH + 120;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.isDead) {
        enemies.splice(i, 1);
        continue;
      }

      if (e.hurtFrames > 0) e.hurtFrames--;

      // Active AI behavior checks (Only move when close to player active viewport)
      if (e.x >= visibleLeft && e.x <= visibleRight) {
        // Direction updates
        e.facingLeft = e.x > p.x;

        // Path finding/movement logic
        if (e.type === 'punk') {
          const distance = Math.abs(e.x - p.x);
          
          if (e.equippedWeapon === 'katana') {
            // NINJA BLADE AGGRESSOR AI
            if (distance > 65) {
              e.x += e.facingLeft ? -e.speed : e.speed;
            }
            
            if (e.shootCooldown > 0) e.shootCooldown--;
            if (e.shootCooldown <= 0 && distance <= 90) {
              e.shootCooldown = 65 + Math.random() * 40;
              
              // Verify player front shield blocks
              const activeW = weaponsRef.current[p.activeWeaponIndex];
              const isBlockingObj = activeW?.id === 'shield' && activeW?.currentAmmo > 0 && (mouseRef.current.isClicked || keysRef.current[' ']);
              const isFrontal = (p.facingLeft && e.x < p.x) || (!p.facingLeft && e.x > p.x);
              
              if (isBlockingObj && isFrontal) {
                activeW.currentAmmo = Math.max(0, activeW.currentAmmo - 1);
                updateHUDAmmo();
                spawnSparkParticles(p.x, p.y + 15, 8, '#22d3ee');
                gameAudio.playUpgrade();
              } else {
                p.health = Math.max(0, p.health - 12);
                setPlayerStats(prev => ({ ...prev, health: p.health }));
                spawnBloodParticles(p.x + p.width/2, p.y + 15, 10);
                gameAudio.playPlayerHit();
                
                if (p.health <= 0) {
                  onGameOver();
                  stopLoop();
                }
              }
            }
          } else {
            // STANDARD PISTOL RUN-N-GUN AI
            if (distance > 200) {
              e.x += e.facingLeft ? -e.speed : e.speed;
            } else if (distance < 100) {
              e.x += e.facingLeft ? e.speed : -e.speed;
            }

            if (e.shootCooldown > 0) e.shootCooldown--;
            if (e.shootCooldown <= 0) {
              e.shootCooldown = 140 + Math.random() * 80;
              shootEnemyBullet(e, p.x, p.y + 15, 6, 8, '#f43f5e');
            }
          }
        } 
        else if (e.type === 'drone') {
          // Fly up/down floating motion, lock y position relative to player
          e.y += Math.sin(frameCountRef.current * 0.05) * 0.8;
          
          const distance = Math.abs(e.x - p.x);
          if (distance > 150) {
            e.x += e.facingLeft ? -e.speed : e.speed;
          }

          if (e.shootCooldown > 0) e.shootCooldown--;
          if (e.shootCooldown <= 0) {
            e.shootCooldown = 110 + Math.random() * 60;
            // Laser beam fire (cyan energy bullet)
            shootEnemyBullet(e, p.x, p.y + 15, 7, 5, '#22d3ee');
          }
        } 
        else if (e.type === 'enforcer') {
          const distance = Math.abs(e.x - p.x);
          
          if (e.equippedWeapon === 'katana') {
            // ARMORED SAMURAI CHARGE AI
            if (distance > 65) {
              e.x += e.facingLeft ? -e.speed : e.speed;
            }
            
            if (e.shootCooldown > 0) e.shootCooldown--;
            if (e.shootCooldown <= 0 && distance <= 90) {
              e.shootCooldown = 55 + Math.random() * 30;
              
              const activeW = weaponsRef.current[p.activeWeaponIndex];
              const isBlockingObj = activeW?.id === 'shield' && activeW?.currentAmmo > 0 && (mouseRef.current.isClicked || keysRef.current[' ']);
              const isFrontal = (p.facingLeft && e.x < p.x) || (!p.facingLeft && e.x > p.x);
              
              if (isBlockingObj && isFrontal) {
                activeW.currentAmmo = Math.max(0, activeW.currentAmmo - 2); // Heavy slash drains shield ammo faster
                updateHUDAmmo();
                spawnSparkParticles(p.x, p.y + 15, 14, '#22d3ee');
                gameAudio.playUpgrade();
              } else {
                p.health = Math.max(0, p.health - 22); // HEAVY SLASH
                setPlayerStats(prev => ({ ...prev, health: p.health }));
                spawnBloodParticles(p.x + p.width/2, p.y + 15, 12);
                gameAudio.playPlayerHit();
                
                if (p.health <= 0) {
                  onGameOver();
                  stopLoop();
                }
              }
            }
          } else if (e.equippedWeapon === 'rifle') {
            // RIFLE COMMANDO COMMANDS STREAM FIRE
            if (distance > 230) {
              e.x += e.facingLeft ? -e.speed : e.speed;
            }
            
            if (e.shootCooldown > 0) e.shootCooldown--;
            if (e.shootCooldown <= 0) {
              e.shootCooldown = 110 + Math.random() * 50;
              shootEnemyBullet(e, p.x - 12, p.y + 15, 9, 8, '#ef4444');
              shootEnemyBullet(e, p.x + 12, p.y + 15, 9, 8, '#ef4444');
              gameAudio.playPistol();
            }
          } else {
            // STANDARD BULK SHOTGUN SHAPE
            if (distance > 180) {
              e.x += e.facingLeft ? -e.speed : e.speed;
            }

            if (e.shootCooldown > 0) e.shootCooldown--;
            if (e.shootCooldown <= 0) {
              e.shootCooldown = 180 + Math.random() * 100;
              // Short range multi pellet burst (shotgun feeling)
              const weaponAngle = Math.atan2((p.y + p.height / 2) - e.y, (p.x + p.width / 2) - e.x);
              for (let k = -1; k <= 1; k++) {
                const spreadAngle = weaponAngle + k * 0.08;
                const bVx = Math.cos(spreadAngle) * 6;
                const bVy = Math.sin(spreadAngle) * 6;
                bulletsRef.current.push({
                  id: Math.random().toString(),
                  x: e.x + (e.facingLeft ? -10 : e.width + 10),
                  y: e.y + 20,
                  vx: bVx,
                  vy: bVy,
                  damage: 10,
                  isPlayerOwned: false,
                  color: '#a78bfa',
                  size: 3,
                  rangeRemaining: 300,
                  trail: [],
                });
              }
              gameAudio.playPistol();
            }
          }
        } 
        else if (e.type === 'boss') {
          // Boss stays mostly static or oscillates slowly
          const pathTargetX = LEVEL_WIDTH - 400 + Math.sin(frameCountRef.current * 0.02) * 100;
          e.x += (pathTargetX - e.x) * 0.05;

          if (e.shootCooldown > 0) e.shootCooldown--;
          if (e.shootCooldown <= 0) {
            // Alternate heavy RPG attack & dual laser barrage
            const act = Math.random();
            if (act > 0.6) {
              // Heavy orange RPG bullet
              e.shootCooldown = 130;
              shootEnemyBullet(e, p.x, p.y + 10, 5, 25, '#f97316', 7);
              gameAudio.playShotgun();
            } else {
              // Quick spread cyan lasers
              e.shootCooldown = 80;
              const px = p.x;
              const py = p.y + Math.random() * 40;
              shootEnemyBullet(e, px, py - 10, 8, 12, '#06b6d4', 4);
              shootEnemyBullet(e, px, py + 20, 8, 12, '#06b6d4', 4);
              gameAudio.playLaser();
            }
          }
        }
      }
    }

    // 7. Update active particle cells
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const pCell = particles[i];
      pCell.life -= pCell.decay;

      // Handle gravity components
      if (pCell.gravity) {
        pCell.vy += 0.16;
      }
      pCell.x += pCell.vx;
      pCell.y += pCell.vy;

      // Shell bounce off floor
      if (pCell.type === 'shell' && pCell.y >= GROUND_Y) {
        pCell.y = GROUND_Y;
        pCell.vy = -pCell.vy * 0.5; // bounce decay
        pCell.vx *= 0.6; // slow slide
      }

      if (pCell.life <= 0) {
        particles.splice(i, 1);
      }
    }

    // 7.5. Update Loot Items
    const lootItems = lootItemsRef.current;
    for (let i = lootItems.length - 1; i >= 0; i--) {
      const item = lootItems[i];
      
      // Gravity physics
      if (!item.isGrounded) {
        item.vy += 0.25;
        item.y += item.vy;
        item.x += item.vx;
        item.vx *= 0.95; // apply basic friction

        if (item.y >= GROUND_Y - item.height) {
          item.y = GROUND_Y - item.height;
          item.vy = 0;
          item.vx = 0;
          item.isGrounded = true;
        }
      }

      // Intersection / collision with player
      if (item.x + item.width >= p.x && item.x <= p.x + p.width &&
          item.y + item.height >= p.y && item.y <= p.y + p.height) {
        
        // Apply reward
        if (item.type === 'health_pack') {
          p.health = Math.min(p.maxHealth, p.health + item.amount);
          spawnSparkParticles(item.x + item.width / 2, item.y + item.height / 2, 15, '#10b981'); // green particles
          gameAudio.playUpgrade();
        } else if (item.type === 'cred_chip') {
          p.cash += item.amount;
          p.score += 200;
          spawnSparkParticles(item.x + item.width / 2, item.y + item.height / 2, 15, '#eab308'); // golden particles
          gameAudio.playWeaponBuy();
        }

        // Sync player stats back to container React state
        setPlayerStats(prev => ({
          ...prev,
          health: p.health,
          cash: p.cash,
          score: p.score,
        }));

        // Remove item
        lootItems.splice(i, 1);
      }
    }

    // 8. Track camera layout boundaries
    // Keep space centered
    const idealCamX = p.x - VIEW_WIDTH / 2;
    cameraXRef.current = Math.max(0, Math.min(LEVEL_WIDTH - VIEW_WIDTH, idealCamX));

    // 9. Stage Clearance gate trigger
    if (bossDefeatedRef.current) {
      // Touch portal at LEVEL_WIDTH - 200
      if (p.x >= gateXRef.current && p.x <= gateXRef.current + 80) {
        // Clean current frame before dispatching
        stopLoop();
        onStageComplete();
      }
    }
  };

  const fireWeapon = (w: Weapon) => {
    const p = playerRef.current;
    if (w.currentAmmo <= 0 || w.isReloading) {
      if (frameCountRef.current % 40 === 0) {
        // dry click noise
        gameAudio.playPistol();
      }
      return;
    }

    // Spend bullet
    w.currentAmmo--;
    updateHUDAmmo();

    // Weapon coordinate start point
    const originX = p.x + (p.facingLeft ? -5 : p.width + 5);
    const originY = p.y + (p.isCrouching ? 15 : 22);

    // Aim calculations based on mouse vs player screen coords
    const pScreenX = p.x - cameraXRef.current + (p.width / 2);
    const pScreenY = p.y + (p.height / 2);

    const angle = Math.atan2(mouseRef.current.y - pScreenY, mouseRef.current.x - pScreenX);

    // Spawn casing shell eject
    spawnShellCasing(p.x + p.width/2, p.y + 18, p.facingLeft);

    // Dynamic camera shake could be done but keep simple for now
    const ammoMulBoost = 1.0; 

    // Sound routing and customized weapon behaviors
    if (w.id === 'katana') {
      // Katana swift blade slash action!
      katanaSwingTicksRef.current = 12;
      gameAudio.playLaser(); // swift laser hum slice

      // Melee strike validation (Hits all active enemies in range)
      const enemies = enemiesRef.current;
      enemies.forEach(enemy => {
        if (enemy.isDead) return;
        const dx = (enemy.x + enemy.width / 2) - (p.x + p.width / 2);
        const dy = (enemy.y + enemy.height / 2) - (p.y + p.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 105) {
          // Check front face condition
          const isFront = p.facingLeft ? dx < 15 : dx > -15;
          if (isFront) {
            enemy.health -= w.damage;
            enemy.hurtFrames = 8;
            spawnBloodParticles(enemy.x + enemy.width / 2, eY(enemy) + 15, 12);
            spawnSparkParticles(enemy.x + enemy.width / 2, eY(enemy) + 15, 6, '#a855f7');

            // check fatal
            if (enemy.health <= 0) {
              enemy.isDead = true;
              p.kills++;
              p.cash += enemy.cashReward;
              p.score += enemy.scoreReward;
              createExplosionParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 12);
              gameAudio.playExplosion();

              // propagate
              setPlayerStats(prev => ({
                ...prev,
                kills: prev.kills + 1,
                cash: prev.cash + enemy.cashReward,
                score: prev.score + enemy.scoreReward,
              }));

              if (enemy.type === 'boss') {
                bossDefeatedRef.current = true;
                createExplosionParticles(enemy.x + enemy.width / 2, enemy.y - 50, 30);
              }
            }
          }
        }
      });

      // Enemy bullet parrying / deflecting back as player owned bullets!
      const bullets = bulletsRef.current;
      bullets.forEach(b => {
        if (b.isPlayerOwned) return;
        const bdx = b.x - (p.x + p.width / 2);
        const bdy = b.y - (p.y + p.height / 2);
        const bdist = Math.sqrt(bdx * bdx + bdy * bdy);

        if (bdist < 110) {
          const isFront = p.facingLeft ? bdx < 20 : bdx > -20;
          if (isFront) {
            // parry and flip polarity
            b.isPlayerOwned = true;
            b.vx = (p.facingLeft ? -1 : 1) * Math.max(12, Math.abs(b.vx) * 1.5);
            b.vy = (Math.random() - 0.5) * 4; // scatter slightly
            b.color = '#a855f7'; // purple parry hue
            b.damage = Math.floor(b.damage * 2.5); // double power!
            spawnSparkParticles(b.x, b.y, 8, '#f5f3ff');
          }
        }
      });

      // Special forward dash push due to sword lunge (negative recoil)
      p.vx += (p.facingLeft ? -1.8 : 1.8) * Math.abs(w.recoil);
      return; // Early exit, no standard bullet spawns
    } 
    
    // helper to extract relative enemy center Y coord
    function eY(enemy: Enemy) {
      return enemy.y + (enemy.height / 2) - 15;
    }

    if (w.id === 'shield') {
      // Just activate the force defense, no projectile needs to spawn
      gameAudio.playUpgrade(); // activate hum
      spawnSparkParticles(originX, originY, 4, '#22d3ee');
      // Recoil is neutral
      return; 
    }

    if (w.id === 'laser') {
      gameAudio.playLaser();
    } else if (w.id === 'shotgun') {
      gameAudio.playShotgun();
    } else if (w.id === 'rpg') {
      gameAudio.playShotgun();
    } else {
      gameAudio.playPistol();
    }

    // Fire pellets
    for (let k = 0; k < w.projectilesPerShot; k++) {
      const spreadAngle = angle + (Math.random() - 0.5) * w.spread;
      const bSpeed = w.id === 'laser' ? 14 : w.id === 'rpg' ? 8 : 11;
      const bVx = Math.cos(spreadAngle) * bSpeed;
      const bVy = Math.sin(spreadAngle) * bSpeed;

      bulletsRef.current.push({
        id: Math.random().toString(),
        x: originX,
        y: originY,
        vx: bVx,
        vy: bVy,
        damage: w.damage,
        isPlayerOwned: true,
        color: w.color,
        size: w.id === 'rpg' ? 8 : w.id === 'laser' ? 2 : 3,
        rangeRemaining: w.id === 'shotgun' ? 240 : 650,
        trail: [],
      });

      // Muzzle blow particles
      spawnSmokeParticles(originX, originY, 1);
    }

    // Push player back slightly due to recoil
    p.vx += (p.facingLeft ? 1 : -1) * w.recoil;
  };

  const shootEnemyBullet = (
    e: Enemy, 
    targetX: number, 
    targetY: number, 
    bulletSpeed: number, 
    damage: number, 
    bulletColor: string, 
    bulletSize: number = 3
  ) => {
    // Standard linear aiming toward center player coordinate
    const dx = targetX - e.x;
    const dy = targetY - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const vx = (dx / dist) * bulletSpeed;
    const vy = (dy / dist) * bulletSpeed;

    bulletsRef.current.push({
      id: Math.random().toString(),
      x: e.x + (e.facingLeft ? -12 : e.width + 12),
      y: e.y + 20,
      vx,
      vy,
      damage,
      isPlayerOwned: false,
      color: bulletColor,
      size: bulletSize,
      rangeRemaining: 750,
      trail: [],
    });

    gameAudio.playPistol();
  };

  // Rendering Helpers (Draws parallax neon streets)
  const renderGame = (ctx: CanvasRenderingContext2D) => {
    const camX = cameraXRef.current;

    // 1. Reset Board
    ctx.fillStyle = '#090a10'; // Deep dark cyber sky
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // 2. Parallax Layer 1: Distant skyscrapers & Stars
    ctx.save();
    ctx.translate(-camX * 0.15, 0);
    drawDistantBackground(ctx);
    ctx.restore();

    // 3. Parallax Layer 2: Mid-ground street silhouettes & wire hangings
    ctx.save();
    ctx.translate(-camX * 0.45, 0);
    drawMidgroundBackground(ctx);
    ctx.restore();

    // 4. Foreground Alley environment
    ctx.save();
    ctx.translate(-camX, 0);
    drawAlleyWallsAndStreet(ctx);

    // Draw Cover obstacles
    coversRef.current.forEach(c => {
      if (c.health <= 0) return;
      drawCoverObstacle(ctx, c);
    });

    // Draw Loot Items
    lootItemsRef.current.forEach(item => {
      drawLootItem(ctx, item);
    });

    // Draw Stage portal / landing site
    drawStagePortal(ctx);

    // Draw active enemies
    enemiesRef.current.forEach(e => {
      drawEnemy(ctx, e);
    });

    // Draw player character
    drawPlayer(ctx, playerRef.current);

    // Draw active ammo bullets
    bulletsRef.current.forEach(b => {
      drawBullet(ctx, b);
    });

    // Render active particles
    particlesRef.current.forEach(pt => {
      drawParticle(ctx, pt);
    });

    ctx.restore();

    // 5. Context Independent overlays, e.g. Crosshair
    drawPlayerAimCrosshair(ctx);
  };

  // Cyber street graphics drawing routines and stage themes
  const drawDistantBackground = (ctx: CanvasRenderingContext2D) => {
    // ----------------------------------------------
    // STAGE 3: DIGITAL FOREST
    // ----------------------------------------------
    if (currentStage === 3) {
      // Draw matrix digital rainfall of characters (binary code rain)
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)'; // Matrix green
      for (let i = 0; i < LEVEL_WIDTH * 0.25; i += 50) {
        const fallSpeed = (frameCountRef.current * (2 + (i % 3))) % 400;
        ctx.fillRect(i, fallSpeed, 1, 15);
      }

      // Digital forest high pine wireframe columns
      ctx.fillStyle = '#022c22'; // Very deep forest teal
      for (let x = 0; x < LEVEL_WIDTH * 0.5; x += 140) {
        const h = 280 + (Math.sin(x) * 100);
        const w = 40 + (Math.cos(x) * 15);
        ctx.fillRect(x, VIEW_HEIGHT - h, w, h);

        // Glowing virtual firefly nodes
        ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
        ctx.beginPath();
        const flashY = VIEW_HEIGHT - h + 50 + (Math.sin(frameCountRef.current * 0.04 + x) * 20);
        ctx.arc(x + w / 2, flashY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // ----------------------------------------------
    // STAGE 2: CYBER METROPOLIS TALL STREETS
    // ----------------------------------------------
    else if (currentStage === 2) {
      // Cyber sky grids
      ctx.fillStyle = 'rgba(168, 85, 247, 0.15)'; // Purple neon haze
      for (let i = 0; i < LEVEL_WIDTH * 0.2; i += 90) {
        ctx.fillRect(i, 40, 2, 2);
      }

      // Towering corporate structures
      ctx.fillStyle = '#0c0a1c'; // Deep obsidian purple
      for (let x = 0; x < LEVEL_WIDTH * 0.5; x += 110) {
        const h = 340 + (Math.sin(x * 123) * 110);
        const w = 80 + (Math.cos(x * 45) * 15);
        ctx.fillRect(x, VIEW_HEIGHT - h, w, h);

        // Tech antenna tip warnings flashing red
        ctx.fillStyle = frameCountRef.current % 40 < 20 ? '#ef4444' : '#1e1b4b';
        ctx.fillRect(x + w / 2 - 1, VIEW_HEIGHT - h - 15, 2, 15);

        // Rows of high-density neon server/office windows inside towers
        ctx.fillStyle = 'rgba(168, 85, 247, 0.251)'; // Violet cyber windows
        if (x % 3 === 0) ctx.fillStyle = 'rgba(6, 182, 212, 0.25)'; // Cyan variations
        
        for (let wy = VIEW_HEIGHT - h + 25; wy < VIEW_HEIGHT - 30; wy += 35) {
          for (let wx = x + 12; wx < x + w - 12; wx += 20) {
            ctx.fillRect(wx, wy, 3, 5);
          }
        }
      }
    }
    // ----------------------------------------------
    // STAGE 1: NEON BACKALLEY (UNDERGROUND)
    // ----------------------------------------------
    else {
      // Neon stars or tiny light clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < LEVEL_WIDTH * 0.2; i += 75) {
        const y = (Math.sin(i) * 50) + 70;
        ctx.fillRect(i, y, 1.5, 1.5);
      }

      // High rise corporate monoliths (dark structures)
      ctx.fillStyle = '#0f111e';
      for (let x = 0; x < LEVEL_WIDTH * 0.5; x += 120) {
        const h = 250 + (Math.sin(x) * 120);
        const w = 70 + (Math.cos(x) * 20);
        ctx.fillRect(x, VIEW_HEIGHT - h, w, h);

        // Distant light dots inside towers
        ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
        for (let wy = VIEW_HEIGHT - h + 20; wy < VIEW_HEIGHT - 30; wy += 40) {
          for (let wx = x + 10; wx < x + w - 10; wx += 25) {
            ctx.fillRect(wx, wy, 4, 6);
          }
        }
        ctx.fillStyle = '#0f111e'; // Restore
      }
    }
  };

  const drawMidgroundBackground = (ctx: CanvasRenderingContext2D) => {
    // ----------------------------------------------
    // STAGE 3: DIGITAL FOREST MED-GROUND
    // ----------------------------------------------
    if (currentStage === 3) {
      ctx.fillStyle = '#115e59'; // Teal forest tree shafts
      for (let x = 0; x < LEVEL_WIDTH; x += 180) {
        const h = 240 + (Math.cos(x * 2.5) * 40);
        const w = 18;
        // Tree trunks
        ctx.fillRect(x, GROUND_Y - h, w, h);
        
        // Digital neon glowing leaves (triangles)
        ctx.fillStyle = '#14b8a6';
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 25, GROUND_Y - h);
        ctx.lineTo(x + w / 2 + 25, GROUND_Y - h);
        ctx.lineTo(x + w / 2, GROUND_Y - h - 35);
        ctx.closePath();
        ctx.fill();
      }
    }
    // ----------------------------------------------
    // STAGE 2: METROPOLIS HIGHWAY / MONORAILS
    // ----------------------------------------------
    else if (currentStage === 2) {
      // Double monorail cross girders
      ctx.fillStyle = '#1e1b4b'; // dark violet
      for (let x = 0; x < LEVEL_WIDTH; x += 280) {
        // High bridge pillars
        ctx.fillRect(x + 50, GROUND_Y - 140, 20, 140);
      }

      // Parallax hyper-beams (flying cars representation track)
      ctx.strokeStyle = '#6b21a8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y - 140);
      ctx.lineTo(LEVEL_WIDTH, GROUND_Y - 140);
      ctx.stroke();

      // Golden speed lights on monorail
      ctx.fillStyle = '#eab308';
      for (let x = 0; x < LEVEL_WIDTH; x += 120) {
        const movingOffset = (frameCountRef.current * 4 + x) % LEVEL_WIDTH;
        ctx.fillRect(movingOffset, GROUND_Y - 139, 12, 1.8);
      }
    }
    // ----------------------------------------------
    // STAGE 1: BACKALLEY GRID WIRE PIPES
    // ----------------------------------------------
    else {
      ctx.fillStyle = '#181b30';
      for (let x = 0; x < LEVEL_WIDTH; x += 220) {
        const h = 180 + (Math.cos(x) * 60);
        const w = 110;
        ctx.fillRect(x, GROUND_Y - h, w, h);

        // Soft industrial glowing smoke pipes
        ctx.fillStyle = '#151726';
        ctx.fillRect(x + w - 25, GROUND_Y - h - 35, 12, 35);
        
        // glowing rim
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(x + w - 23, GROUND_Y - h - 40, 8, 5);

        ctx.fillStyle = '#181b30'; // Restore
      }

      // Utility Lines mapping
      ctx.strokeStyle = '#242744';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < LEVEL_WIDTH; x += 300) {
        ctx.moveTo(x, 150);
        ctx.bezierCurveTo(x + 150, 230, x + 150, 230, x + 300, 150);
      }
      ctx.stroke();
    }
  };

  const drawAlleyWallsAndStreet = (ctx: CanvasRenderingContext2D) => {
    // ----------------------------------------------
    // STAGE 3: FOREST FOREGROUND ROAD/MOSS
    // ----------------------------------------------
    if (currentStage === 3) {
      // Grass textured dark teal grid ground
      ctx.fillStyle = '#064e3b'; // moss/emerald dark
      ctx.fillRect(0, GROUND_Y, LEVEL_WIDTH, VIEW_HEIGHT - GROUND_Y);

      // Glowing soil mesh cells
      ctx.fillStyle = 'rgba(52, 211, 153, 0.2)';
      for (let x = 0; x < LEVEL_WIDTH; x += 100) {
        ctx.fillRect(x, GROUND_Y + 5, 4, 4);
        ctx.fillRect(x + 50, GROUND_Y + 40, 5, 5);
      }

      // Giant organic matrix barks inside playable area
      ctx.fillStyle = '#065f46'; // forest green
      for (let x = 0; x < LEVEL_WIDTH; x += 350) {
        ctx.fillRect(x, 0, 35, GROUND_Y);
        // glowing bark stripes
        ctx.fillStyle = '#34d399';
        ctx.fillRect(x + 15, Math.abs(Math.sin(x)) * 100 + 40, 3, 110);
        ctx.fillStyle = '#065f46';
      }

      // Spiritual glowing signs for Forest
      const forestGlyphs = [
        { x: 400, y: 70, label: 'GLYPH 01', color: '#10b981', sub: '生長' },
        { x: 1200, y: 50, label: 'ENERGY_CORE', color: '#22d3ee', sub: '源流' },
        { x: 2000, y: 80, label: 'NEXUS_MATRIX', color: '#a78bfa', sub: '接続' },
        { x: 2800, y: 60, label: 'GATE 03', color: '#34d399', sub: '森門' }
      ];

      forestGlyphs.forEach(s => {
        ctx.fillStyle = '#022c22';
        ctx.fillRect(s.x, s.y, 75, 110);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(s.x, s.y, 75, 110);

        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = s.color;
        
        ctx.font = '700 9px "Orbitron"';
        ctx.textAlign = 'center';
        ctx.fillText(s.label, s.x + 37.5, s.y + 35);

        ctx.font = '700 11px "Inter"';
        ctx.fillText(s.sub, s.x + 37.5, s.y + 70);

        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
      });
    }
    // ----------------------------------------------
    // STAGE 2: CITY METROPOLIS FRONT ROADS
    // ----------------------------------------------
    else if (currentStage === 2) {
      // High-Gloss Wet Metropolis asphalt
      ctx.fillStyle = '#0b0c16'; 
      ctx.fillRect(0, GROUND_Y, LEVEL_WIDTH, VIEW_HEIGHT - GROUND_Y);

      // Dual yellow high-speed dividers
      ctx.fillStyle = '#eab308';
      for (let x = 0; x < LEVEL_WIDTH; x += 110) {
        ctx.fillRect(x, GROUND_Y + 30, 45, 2.5);
        ctx.fillRect(x, GROUND_Y + 36, 45, 2.5);
      }

      // Standing neon light pillars (street lanterns)
      ctx.fillStyle = '#1e1b4b';
      for (let x = 0; x < LEVEL_WIDTH; x += 400) {
        ctx.fillRect(x + 10, 50, 6, GROUND_Y - 50); // post
        
        ctx.fillStyle = '#d946ef'; // bright neon magenta light dome
        ctx.beginPath();
        ctx.arc(x + 13, 50, 11, 0, Math.PI, true);
        ctx.fill();

        ctx.fillStyle = '#ffffff'; // core bulb lamp
        ctx.fillRect(x + 9, 46, 8, 8);
        ctx.fillStyle = '#1e1b4b';
      }

      // High-rise Metropolis billboards
      const citySigns = [
        { x: 300, y: 50, label: 'CYBER GIGS', color: '#f43f5e', sub: '東京' },
        { x: 1000, y: 70, label: 'DATA BANK', color: '#06b6d4', sub: '資本' },
        { x: 1700, y: 50, label: 'SHIELD TECH', color: '#d946ef', sub: '防衛' },
        { x: 2500, y: 60, label: 'GATE 02', color: '#f59e0b', sub: '都心' },
      ];

      citySigns.forEach(s => {
        ctx.fillStyle = '#11052c';
        ctx.fillRect(s.x, s.y, 75, 110);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(s.x, s.y, 75, 110);

        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = s.color;
        
        ctx.font = '700 9px "Orbitron"';
        ctx.textAlign = 'center';
        ctx.fillText(s.label, s.x + 37.5, s.y + 35);

        ctx.font = '700 11px "Inter"';
        ctx.fillText(s.sub, s.x + 37.5, s.y + 70);

        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
      });
    }
    // ----------------------------------------------
    // STAGE 1: UNDERGROUND HAUNTED ALLEY (ORIGINAL)
    // ----------------------------------------------
    else {
      // 1. Street road mesh
      ctx.fillStyle = '#111322'; // Wet asphalt black texture
      ctx.fillRect(0, GROUND_Y, LEVEL_WIDTH, VIEW_HEIGHT - GROUND_Y);

      // Yellow hazardous curb lines
      ctx.fillStyle = '#b45309';
      for (let x = 0; x < LEVEL_WIDTH; x += 80) {
        ctx.fillRect(x, GROUND_Y, 40, 3);
      }

      // 2. Main level environment alley walls (brick texture and glowing signs)
      ctx.fillStyle = '#171926';
      for (let x = 0; x < LEVEL_WIDTH; x += 400) {
        // Big structures in the playable area
        ctx.fillRect(x, 0, 180, GROUND_Y);
        
        // Draw details like windows, AC units
        ctx.fillStyle = '#10121d';
        ctx.fillRect(x + 25, 80, 50, 70);
        ctx.fillRect(x + 105, 80, 50, 70);
        ctx.fillRect(x + 25, 190, 50, 70);
        ctx.fillRect(x + 105, 190, 50, 70);

        // Window beams
        ctx.fillStyle = 'rgba(234, 179, 8, 0.45)'; // Neon-lit windows
        if ((x / 400) % 2 === 0) {
          ctx.fillRect(x + 35, 95, 30, 4);
          ctx.fillRect(x + 115, 205, 30, 4);
        }

        // Air-con blocks
        ctx.fillStyle = '#374151';
        ctx.fillRect(x + 40, 280, 40, 25);
        
        // AC fan blades rotating
        ctx.strokeStyle = '#111827';
        ctx.beginPath();
        const acCenterX = x + 60;
        const acCenterY = 292;
        const r = 8;
        const _angle = frameCountRef.current * 0.15;
        ctx.moveTo(acCenterX - Math.cos(_angle) * r, acCenterY - Math.sin(_angle) * r);
        ctx.lineTo(acCenterX + Math.cos(_angle) * r, acCenterY + Math.sin(_angle) * r);
        ctx.stroke();

        ctx.fillStyle = '#171926'; // Restore brick baseline
      }

      // 3. Cyberpunk Neon Signs hanging from the walls!
      const signs = [
        { x: 300, y: 50, label: 'RAMEN', color: '#f43f5e', sub: 'ラーメン' },
        { x: 900, y: 70, label: 'GUNS', color: '#06b6d4', sub: '武器屋' },
        { x: 1500, y: 60, label: 'BAR', color: '#a78bfa', sub: '酒場' },
        { x: 2100, y: 50, label: 'HOSTEL', color: '#10b981', sub: 'カプセル' },
        { x: 2700, y: 70, label: 'HOTEL', color: '#ec4899', sub: 'ホテル' },
        { x: 3400, y: 40, label: 'GATE 07', color: '#eab308', sub: '出口' },
      ];

      signs.forEach(s => {
        ctx.fillStyle = '#0b0c13';
        ctx.fillRect(s.x, s.y, 75, 120);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(s.x, s.y, 75, 120);

        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = s.color;
        
        ctx.font = '700 11px "Orbitron"';
        ctx.textAlign = 'center';
        ctx.fillText(s.label, s.x + 37.5, s.y + 40);

        ctx.font = '700 10px "Inter"';
        ctx.fillText(s.sub, s.x + 37.5, s.y + 80);

        ctx.fillRect(s.x + 10, s.y + 100, 55, 3);

        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
      });
    }

    // Distant warning lanterns
    for (let x = 150; x < LEVEL_WIDTH; x += 600) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.beginPath();
      ctx.arc(x, 150, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawLootItem = (ctx: CanvasRenderingContext2D, item: LootItem) => {
    const floatY = Math.sin((frameCountRef.current * 0.1) + item.x) * 3.5;
    const drawY = item.y + floatY;

    ctx.save();
    
    // Add glowing neons (shadowBlur)
    ctx.shadowBlur = 8;

    if (item.type === 'health_pack') {
      // Draw green medical health kit
      ctx.shadowColor = '#10b981';
      ctx.fillStyle = '#064e3b';
      
      // Draw container body shape
      ctx.fillRect(item.x, drawY, item.width, item.height);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(item.x, drawY, item.width, item.height);
      
      // Draw a white cross inside
      ctx.fillStyle = '#10b981';
      // horizontal bar
      ctx.fillRect(item.x + 3, drawY + item.height / 2 - 2, item.width - 6, 4);
      // vertical bar
      ctx.fillRect(item.x + item.width / 2 - 2, drawY + 3, 4, item.height - 6);
    } else {
      // Draw golden cred_chip
      ctx.shadowColor = '#eab308';
      ctx.fillStyle = '#78350f';
      
      // Diamond chip shape
      ctx.beginPath();
      ctx.moveTo(item.x + item.width / 2, drawY);
      ctx.lineTo(item.x + item.width, drawY + item.height / 2);
      ctx.lineTo(item.x + item.width / 2, drawY + item.height);
      ctx.lineTo(item.x, drawY + item.height / 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Write '$' symbol in center
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', item.x + item.width / 2, drawY + item.height / 2);
    }

    ctx.restore();
  };

  const drawCoverObstacle = (ctx: CanvasRenderingContext2D, c: CoverObstacle) => {
    const isDamaged = c.health < c.maxHealth * 0.4;
    
    if (c.type === 'crate') {
      // Wood/Tech container
      ctx.fillStyle = isDamaged ? '#573d28' : '#78350f';
      ctx.fillRect(c.x, c.y, c.width, c.height);

      // Border bounds
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.width, c.height);

      // Diagonal cross
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + c.width, c.y + c.height);
      ctx.moveTo(c.x + c.width, c.y);
      ctx.lineTo(c.x, c.y + c.height);
      ctx.stroke();

      // Industrial tech labels
      ctx.fillStyle = '#fbbf24';
      ctx.font = '8px "JetBrains Mono"';
      ctx.fillText('CRATE_Z7', c.x + 4, c.y + 12);
    } 
    else if (c.type === 'bin') {
      // Metallic green dumpster / waste container
      ctx.fillStyle = isDamaged ? '#1e3a1e' : '#064e3b';
      ctx.fillRect(c.x, c.y, c.width, c.height);

      // Rim top bar
      ctx.fillStyle = '#374151';
      ctx.fillRect(c.x - 3, c.y, c.width + 6, 8);

      // Striped warning bars
      ctx.fillStyle = '#27272a';
      for (let sy = c.y + 16; sy < c.y + c.height - 8; sy += 12) {
        ctx.fillRect(c.x + 5, sy, c.width - 10, 4);
      }
    }

    // HP indicator for cover
    const ratio = c.health / c.maxHealth;
    if (ratio < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(c.x, c.y - 10, c.width, 4);

      ctx.fillStyle = ratio > 0.5 ? '#10b981' : ratio > 0.2 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(c.x, c.y - 10, c.width * ratio, 4);
    }
  };

  const drawStagePortal = (ctx: CanvasRenderingContext2D) => {
    // Escape transporter beacon visible once boss dead
    if (!bossDefeatedRef.current) return;

    const x = gateXRef.current;
    const y = GROUND_Y - 120;

    // Glowing column of light
    const gradient = ctx.createLinearGradient(x, y, x + 80, y);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.05)');
    gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.4)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.05)');

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, 80, 120);

    // Neon glow borders
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x, y);
    ctx.moveTo(x + 80, GROUND_Y);
    ctx.lineTo(x + 80, y);
    ctx.stroke();

    // Portal sign
    ctx.fillStyle = '#06b6d4';
    ctx.font = '700 13px "Orbitron"';
    ctx.textAlign = 'center';
    ctx.fillText('EVAC PORTAL', x + 40, y - 20);
    ctx.font = '500 10px "Inter"';
    ctx.fillText('TOUCH TO ENTER', x + 40, y - 6);
    ctx.textAlign = 'left';

    // Particle emissions
    if (frameCountRef.current % 15 === 0) {
      particlesRef.current.push({
        id: Math.random().toString(),
        type: 'spark',
        x: x + Math.random() * 80,
        y: GROUND_Y - 5,
        vx: 0,
        vy: -1.5 - Math.random() * 2,
        color: '#22d3ee',
        size: 2,
        life: 1.0,
        decay: 0.02,
      });
    }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, p: Player) => {
    const isHurt = p.state === 'hurt' || p.invulFrames > 0;
    
    // Flickering indicator if bullet struck player
    if (isHurt && frameCountRef.current % 6 < 3) {
      // Skip framing to produce blink
      return;
    }

    ctx.save();
    ctx.translate(p.x, p.y);

    const isFlipped = p.facingLeft;

    // Set origin to middle player width for flipping
    ctx.translate(p.width / 2, p.height / 2);
    if (isFlipped) {
      ctx.scale(-1, 1);
    }

    // 1. Leg animation offsets
    const runAnim = p.state === 'running' ? Math.sin(frameCountRef.current * 0.2) * 8 : 0;
    const legOffsetLeft = p.isCrouching ? 6 : 14;
    const legOffsetRight = p.isCrouching ? -6 : -14;

    // Crouching drawing layout adjusts
    const h = p.isCrouching ? 30 : 48;
    const bodyY = p.isCrouching ? -10 : -24;

    // Draw cyber boots
    ctx.fillStyle = '#374151';
    // Back leg
    ctx.fillRect(legOffsetLeft - 3, h/2 - 8 + (p.state === 'running' ? -runAnim : 0), 6, 8);
    // Front leg
    ctx.fillRect(legOffsetRight - 3, h/2 - 8 + (p.state === 'running' ? runAnim : 0), 6, 8);

    // 2. High-Tech tactical armor torso
    ctx.fillStyle = '#1e293b'; // Slate dark blue tactical fiber
    ctx.fillRect(-12, bodyY, 24, p.isCrouching ? 16 : 28);

    // Glowing energy strip on breastplate
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(-2, bodyY + 6, 4, p.isCrouching ? 6 : 12);

    // 3. Cyber head gears & visor
    ctx.fillStyle = '#475569';
    const headY = bodyY - 12;
    ctx.beginPath();
    ctx.arc(0, headY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Cyan glowing visual visor (facing direction)
    // visor is drawn pointing right since we handle flip scale above
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(2, headY - 4, 7, 3);

    // Visor edge shine dots
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(6, headY - 4, 2, 3);

    // 4. Combat shoulder protector pads
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-14, bodyY, 4, 8);

    // 5. Dynamic Weapon Gun Arm holding
    // Find direction towards mouse from gun pivot
    const pScreenX = p.x - cameraXRef.current + (p.width / 2);
    const pScreenY = p.y + (p.height / 2);
    let angle = Math.atan2(mouseRef.current.y - pScreenY, mouseRef.current.x - pScreenX);

    // If flipped, adjust relative rotating angle
    if (isFlipped) {
      angle = Math.PI - angle;
    }

    ctx.save();
    ctx.translate(0, bodyY + 10);
    ctx.rotate(angle);

    // Gun representation
    const selectedW = weaponsRef.current[p.activeWeaponIndex];
    const weaponColor = selectedW ? selectedW.color : '#cbd5e1';

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, -3, 14, 6); // arm

    ctx.fillStyle = weaponColor;
    if (selectedW?.id === 'katana') {
      // Draw high-frequency Katana
      ctx.fillStyle = '#312e81'; // dark handle
      ctx.fillRect(8, -1.5, 6, 3);
      
      // Radiant energy blade
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#c084fc'; // neon violet core
      
      if (katanaSwingTicksRef.current > 0) {
        // Active swooshing sweep arc pointing outward
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 36, -Math.PI / 4, Math.PI / 4);
        ctx.stroke();

        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(10, -4, 28, 8);
      } else {
        // Idle futuristic blade extending forwards
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(14, -1.5, 26, 3);
        ctx.fillStyle = '#f3e8ff';
        ctx.fillRect(16, -1, 20, 1.5);
      }
      ctx.shadowBlur = 0;
    } else if (selectedW?.id === 'shield') {
      // Draw Shield emitter handle
      ctx.fillStyle = '#475569';
      ctx.fillRect(8, -3, 4, 6);
      
      const isProjecting = (mouseRef.current.isClicked || keysRef.current[' ']) && selectedW.currentAmmo > 0;
      if (isProjecting) {
        // Beautiful vibrant protective electric field shield arc
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.arc(18, 0, 28, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.beginPath();
        ctx.arc(18, 0, 28, -Math.PI / 3, Math.PI / 3);
        ctx.lineTo(18, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // Folded shield holster
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(11, -8, 2.5, 16);
      }
    } else if (selectedW?.id === 'laser') {
      ctx.fillRect(10, -5, 16, 6); // sleeker futuristic emitter barrel
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(18, -3, 10, 2);
    } else if (selectedW?.id === 'shotgun') {
      ctx.fillRect(10, -5, 14, 9); // bulky dual barrel shotgun design
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(12, 1, 8, 4);
    } else if (selectedW?.id === 'rpg') {
      ctx.fillRect(8, -8, 22, 11); // giant rocket launcher shape
      ctx.fillStyle = '#3f3f46';
      ctx.beginPath();
      ctx.moveTo(30, -10);
      ctx.lineTo(34, -13);
      ctx.lineTo(34, 6);
      ctx.lineTo(30, 3);
      ctx.closePath();
      ctx.fill();
    } else {
      // standard hand gun
      ctx.fillRect(10, -3, 8, 4);
    }

    ctx.restore();

    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: Enemy) => {
    ctx.save();
    ctx.translate(e.x, e.y);

    const isFlipped = e.facingLeft;
    ctx.translate(e.width / 2, e.height / 2);
    if (isFlipped) {
      ctx.scale(-1, 1);
    }

    const legMove = Math.sin(frameCountRef.current * 0.18 + e.x) * 6;
    const bodyPulse = Math.sin(frameCountRef.current * 0.08 + e.x) * 1.5;

    // Flickering color if damaged
    const isStruck = e.hurtFrames > 0;
    if (isStruck) {
      ctx.fillStyle = '#ef4444';
    }

    if (e.type === 'punk') {
      // Leg lines
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(-7 + (isStruck ? 0 : -legMove), e.height / 2);
      ctx.moveTo(5, 0);
      ctx.lineTo(6 + (isStruck ? 0 : legMove), e.height / 2);
      ctx.stroke();

      // Body (Punk neon leather jacket)
      ctx.fillStyle = isStruck ? '#f43f5e' : '#1f2937';
      ctx.fillRect(-10, -(e.height / 2) + 12, 20, 24);

      // Pink Mohawks head representation
      ctx.fillStyle = '#ffe4e6';
      ctx.beginPath();
      ctx.arc(0, -(e.height / 2) + 6, 7, 0, Math.PI * 2);
      ctx.fill();

      // mohawk spikes
      ctx.fillStyle = '#f43f5e'; // Punk bright pink
      ctx.beginPath();
      ctx.moveTo(-3, -(e.height / 2) - 1);
      ctx.lineTo(0, -(e.height / 2) - 9);
      ctx.lineTo(3, -(e.height / 2) - 1);
      ctx.closePath();
      ctx.fill();

      // Gun
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(6, 0, 10, 4);
    } 
    else if (e.type === 'drone') {
      // Floating Drone mechanism
      // Glowing lens cybernetic eye
      ctx.fillStyle = isStruck ? '#f43f5e' : '#1e293b';
      ctx.beginPath();
      ctx.arc(0, bodyPulse, 10, 0, Math.PI * 2);
      ctx.fill();

      // lens
      ctx.fillStyle = isStruck ? '#f43f5e' : '#22d3ee';
      ctx.beginPath();
      ctx.arc(3, bodyPulse, 4, 0, Math.PI * 2);
      ctx.fill();

      // Top rotor bar details
      ctx.fillStyle = '#374151';
      ctx.fillRect(-15, bodyPulse - 10, 30, 3);
      ctx.fillRect(-14, bodyPulse - 13, 2, 4);
      ctx.fillRect(12, bodyPulse - 13, 2, 4);

      // rotating rotor lines
      ctx.strokeStyle = 'rgba(156,163,175,0.7)';
      ctx.lineWidth = 1;
      const swing = Math.sin(frameCountRef.current * 0.9) * 12;
      ctx.beginPath();
      ctx.moveTo(-13 - swing, bodyPulse - 13);
      ctx.lineTo(-13 + swing, bodyPulse - 13);
      ctx.moveTo(13 - swing, bodyPulse - 13);
      ctx.lineTo(13 + swing, bodyPulse - 13);
      ctx.stroke();
    } 
    else if (e.type === 'enforcer') {
      // Armored bulky mercenary enforcer
      ctx.fillStyle = '#374151';
      // Heavy shield legs
      ctx.fillRect(-10, 0, 8, e.height / 2);
      ctx.fillRect(2, 0, 8, e.height / 2);

      // Heavy body armor plate
      ctx.fillStyle = isStruck ? '#fda4af' : '#1e1b4b'; // deep indigo heavy armor
      ctx.fillRect(-13, -(e.height / 2) + 10, 26, 28);

      // Yellow shield symbol
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(0, -(e.height / 2) + 14);
      ctx.lineTo(4, -(e.height / 2) + 18);
      ctx.lineTo(0, -(e.height / 2) + 24);
      ctx.lineTo(-4, -(e.height / 2) + 18);
      ctx.closePath();
      ctx.fill();

      // Head guard
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, -(e.height / 2) + 5, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-2, -(e.height / 2) + 2, 8, 3); // heavy blast visor

      // Heavy shotty barrel pointing forward
      ctx.fillStyle = '#020617';
      ctx.fillRect(10, 4, 12, 6);
    } 
    else if (e.type === 'boss') {
      // Giant Mech robot boss
      ctx.fillStyle = '#1e293b';
      
      // Floating neon engines or walking robotic heavy pistons
      const leftPistonY = e.height / 2 - 25 + Math.sin(frameCountRef.current * 0.1) * 8;
      const rightPistonY = e.height / 2 - 25 - Math.sin(frameCountRef.current * 0.1) * 8;
      ctx.fillRect(-25, leftPistonY, 12, 25);
      ctx.fillRect(13, rightPistonY, 12, 25);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(-25, leftPistonY + 20, 12, 5);
      ctx.fillRect(13, rightPistonY + 20, 12, 5);

      // Heavy torso chassis
      ctx.fillStyle = isStruck ? '#f43f5e' : '#0f172a';
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-30, - e.height / 2 + 20, 60, 50, 8);
      ctx.fill();
      ctx.stroke();

      // Rotating radar or heavy turret head
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(0, -e.height / 2 + 10, 16, 0, Math.PI, true);
      ctx.fill();

      // Glowing red multi mechanical eyes (monsters)
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(-8, -e.height / 2 + 4, 3, 0, Math.PI * 2);
      ctx.arc(0, -e.height / 2 + 2, 4, 0, Math.PI * 2);
      ctx.arc(8, -e.height / 2 + 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Shoulder attachments (Dual rocket tubes)
      ctx.fillStyle = '#312e81';
      ctx.fillRect(-35, -e.height / 2 + 15, 14, 18);
      
      // Heavy firing rockets tube
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(21, -e.height / 2 + 20, 18, 14);
    }

    // --- ENEMY EQUIPPED WEAPON & SHIELD DRAW OVERLAY ---
    if (e.equippedWeapon === 'katana') {
      // Draw a glowing thermal plasma blade in their front hand
      ctx.fillStyle = '#111827'; // Dark hilt
      ctx.fillRect(8, -2, 5, 3);
      
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#fda4af'; // neon hot pink / soft red blade
      ctx.fillRect(13, -3.5, 20, 5);
      ctx.shadowBlur = 0;
    } else if (e.equippedWeapon === 'rifle') {
      // Draw heavy automatic carbine rifle
      ctx.fillStyle = '#374151'; // chassis
      ctx.fillRect(6, -3, 16, 6);
      ctx.fillStyle = '#ef4444'; // laser sight
      ctx.fillRect(11, -5, 4, 2);
      ctx.fillStyle = '#9ca3af'; // shiny metallic long barrel
      ctx.fillRect(22, -1.5, 8, 2.5);
    }

    if (e.hasShield && e.shieldHealth! > 0) {
      // Draw a curved electric front shield dome in front of the enemy
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      // Draw curve protecting the front hemisphere
      ctx.arc(16, 0, 22, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();

      ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
      ctx.beginPath();
      ctx.arc(16, 0, 22, -Math.PI / 3, Math.PI / 3);
      ctx.lineTo(16, 0);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // Red color health bar above enemy
    const ratio = e.health / e.maxHealth;
    if (ratio >= 0 && ratio < 1.0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x + (e.width/2) - 20, e.y - 12, 40, 4);

      ctx.fillStyle = '#ef4444';
      ctx.fillRect(e.x + (e.width/2) - 20, e.y - 12, 40 * ratio, 4);

      // Small boss name badge
      if (e.type === 'boss') {
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 9px "Orbitron"';
        ctx.fillText(e.name, e.x + (e.width/2) - 25, e.y - 18);
      }
    }
  };

  const drawBullet = (ctx: CanvasRenderingContext2D, b: Bullet) => {
    ctx.save();

    // Visual trails
    if (b.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(b.trail[0].x, b.trail[0].y);
      for (let idx = 1; idx < b.trail.length; idx++) {
        ctx.lineTo(b.trail[idx].x, b.trail[idx].y);
      }
      ctx.strokeStyle = b.color + '44'; // semi transparent trail
      ctx.lineWidth = b.size;
      ctx.stroke();
    }

    // Glowing bullet center
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; // White hot tip
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 6;
    ctx.fill();

    // Border glowing circle
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  };

  const drawParticle = (ctx: CanvasRenderingContext2D, p: Particle) => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;

    if (p.type === 'explosion') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - p.life), 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();
    } 
    else if (p.type === 'smoke') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (2 - p.life * 1.2), 0, Math.PI * 2);
      ctx.fill();
    } 
    else if (p.type === 'shell') {
      // Draw shell rotation
      ctx.fillStyle = '#eab308';
      ctx.translate(p.x, p.y);
      ctx.rotate(frameCountRef.current * 0.15);
      ctx.fillRect(-2, -0.7, 4, 1.4);
    } 
    else {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    
    ctx.restore();
  };

  const drawPlayerAimCrosshair = (ctx: CanvasRenderingContext2D) => {
    // Crosshair drawn at precise mouse location (which is screen relative)
    const m = mouseRef.current;
    
    ctx.save();
    ctx.strokeStyle = '#22d3ee'; // beautiful light blue crosshair
    ctx.lineWidth = 1;

    // Outer circle
    ctx.beginPath();
    ctx.arc(m.x, m.y, 7, 0, Math.PI * 2);
    ctx.stroke();

    // Tiny target light center dot
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // cross ticks
    ctx.beginPath();
    ctx.moveTo(m.x - 11, m.y);
    ctx.lineTo(m.x - 6, m.y);
    ctx.moveTo(m.x + 6, m.y);
    ctx.lineTo(m.x + 11, m.y);
    ctx.moveTo(m.x, m.y - 11);
    ctx.lineTo(m.x, m.y - 6);
    ctx.moveTo(m.x, m.y + 6);
    ctx.lineTo(m.x, m.y + 11);
    ctx.stroke();

    ctx.restore();
  };

  // Manage mouse motion and triggers inside canvas element
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Compute normalized coordinates based on scaling style sizing
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_HEIGHT;

    mouseRef.current.x = x;
    mouseRef.current.y = y;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      triggerReload();
      return;
    }
    mouseRef.current.isClicked = true;
  };

  const handleMouseUp = () => {
    mouseRef.current.isClicked = false;
    isHoldingFireRef.current = false;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div 
      className="relative flex items-center justify-center w-full h-[500px] overflow-hidden bg-slate-950 neon-border-cyan rounded-lg select-none"
      ref={containerRef}
    >
      <canvas
        id="canvas_shootout"
        ref={canvasRef}
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        className="block cursor-none bg-slate-950"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      />

      {/* Dynamic Small HUD indicators anchored absolute to canvas container */}
      <div className="absolute top-4 left-4 p-3 bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-md flex items-center gap-6 select-none font-mono text-white text-xs z-20">
        <div>
          <span className="text-gray-400">ステージ:</span> <span className="text-cyan-400 font-bold">{currentStage}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">残弾数:</span>
          {hudAmmo.reloading ? (
            <span className="text-red-400 font-bold animate-pulse">リロード中...</span>
          ) : (
            <span className="text-white-400 font-bold">
              {hudAmmo.current} / <span className="text-gray-500">{hudAmmo.max}</span>
            </span>
          )}
          <span className="text-[10px] text-gray-500">[右クリック]でリロード</span>
        </div>
      </div>

      <div className="absolute top-4 right-4 p-3 bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-md flex items-center gap-5 select-none font-mono text-white text-xs z-20">
        <div>
          <span className="text-gray-400">所持金:</span> <span className="text-amber-400 font-bold">${playerStats.cash}</span>
        </div>
        <div>
          <span className="text-gray-400">スコア:</span> <span className="text-green-400 font-bold">{playerStats.score}</span>
        </div>
      </div>
      
      {/* Cover shield activation warning when crouching */}
      {playerRef.current.isCrouching && (
        <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 px-4 py-1.5 bg-cyan-950/90 border border-cyan-500/50 text-cyan-400 font-mono text-[10px] tracking-wider rounded animate-pulse shadow-md select-none z-20">
          カバーシステム作動中（障害物の裏で被ダメージ 85% 軽減）
        </div>
      )}
    </div>
  );
}
