export type GameStateType = 'MAIN_MENU' | 'PLAYING' | 'SHOP' | 'GAME_OVER' | 'VICTORY';

export type WeaponType = 'pistol' | 'shotgun' | 'rifle' | 'laser' | 'rpg' | 'katana' | 'shield';

export interface Weapon {
  id: string; // Change id from strict WeaponType to string to support flexibility if needed, but keep type as WeaponType
  name: string;
  type: WeaponType;
  damage: number;
  fireRate: number; // millisecond difference between shots
  ammoMax: number;
  currentAmmo: number;
  reloadTime: number; // ms
  isReloading: boolean;
  price: number;
  unlocked: boolean;
  color: string;
  projectilesPerShot: number;
  spread: number; // angle in radians
  recoil: number; // pushback force
  description: string;
}

export type UpgradeType = 'max_health' | 'speed' | 'damage_boost' | 'reload_speed' | 'ammo_efficiency';

export interface Upgrade {
  id: UpgradeType;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  cost: number;
  valueMultiplier: number;
}

export type PlayerState = 'idle' | 'running' | 'jumping' | 'crouching' | 'hurt';

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  speed: number;
  activeWeaponIndex: number;
  facingLeft: boolean;
  isGrounded: boolean;
  isCrouching: boolean;
  state: PlayerState;
  invulFrames: number;
  kills: number;
  cash: number;
  score: number;
  stagesCompleted: number;
}

export type EnemyType = 'punk' | 'drone' | 'enforcer' | 'boss';

export interface Enemy {
  id: string;
  type: EnemyType;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  speed: number;
  shootCooldown: number;
  color: string;
  facingLeft: boolean;
  isDead: boolean;
  scoreReward: number;
  cashReward: number;
  hurtFrames: number;
  equippedWeapon?: WeaponType; // e.g. 'katana', 'rifle', 'shotgun', 'pistol'
  hasShield?: boolean; // can deflect normal player bullets unless broken or shot from behind!
  shieldHealth?: number; // shields absorb some damage
  maxShieldHealth?: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  isPlayerOwned: boolean;
  color: string;
  size: number;
  rangeRemaining: number;
  trail: { x: number; y: number }[];
}

export type ParticleType = 'spark' | 'smoke' | 'blood' | 'shell' | 'debris' | 'explosion';

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number; // 0 to 1
  decay: number;
  type: ParticleType;
  gravity?: boolean;
}

export type CoverType = 'bin' | 'crate' | 'fence';

export interface CoverObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  type: CoverType;
}

export type LootType = 'health_pack' | 'cred_chip';

export interface LootItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: LootType;
  amount: number;
  vx: number;
  vy: number;
  isGrounded: boolean;
}

export interface ParallaxLayer {
  speedFactor: number;
  draw: (ctx: CanvasRenderingContext2D, scrollX: number, viewWidth: number, viewHeight: number) => void;
}
