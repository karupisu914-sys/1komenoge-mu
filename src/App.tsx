import { useState, useEffect } from 'react';
import { GameStateType, Player, Weapon, Upgrade } from './types';
import MainMenu from './components/MainMenu';
import GameCanvas from './components/GameCanvas';
import ShopMenu from './components/ShopMenu';
import HowToPlay from './components/HowToPlay';
import { gameAudio } from './components/AudioEngine';
import { 
  Heart, Shield, Swords, Star, Coins, Radio, RotateCcw, Home, Award, ArrowRight, Volume2, VolumeX, ShieldAlert 
} from 'lucide-react';

const INITIAL_PLAYER_STATS: Player = {
  x: 200,
  y: 0,
  vx: 0,
  vy: 0,
  width: 30,
  height: 48,
  health: 100,
  maxHealth: 100,
  speed: 4.5,
  activeWeaponIndex: 0,
  facingLeft: false,
  isGrounded: true,
  isCrouching: false,
  state: 'idle',
  invulFrames: 0,
  kills: 0,
  cash: 0,
  score: 0,
  stagesCompleted: 0,
};

const getInitialWeapons = (): Weapon[] => [
  {
    id: 'pistol',
    name: 'タクティカルピストル Z-1',
    type: 'pistol',
    damage: 15,
    fireRate: 400,
    ammoMax: 30,
    currentAmmo: 30,
    reloadTime: 1200,
    isReloading: false,
    price: 0,
    unlocked: true,
    color: '#cbd5e1', // white emitter
    projectilesPerShot: 1,
    spread: 0.05,
    recoil: 1.0,
    description: '標準的な高速弾ピストル。ブレの少ない抜群の信頼性を誇る。',
  },
  {
    id: 'shotgun',
    name: 'スイーパーショットガン M-4',
    type: 'shotgun',
    damage: 10,
    fireRate: 850,
    ammoMax: 10,
    currentAmmo: 10,
    reloadTime: 1800,
    isReloading: false,
    price: 0,
    unlocked: false,
    color: '#f59e0b', // warm orange
    projectilesPerShot: 5,
    spread: 0.22,
    recoil: 4.5,
    description: '強力な近接ショットガン。高衝撃の散弾を一度に5発放射する。',
  },
  {
    id: 'rifle',
    name: 'ハイペリオン自動ライフル',
    type: 'rifle',
    damage: 16,
    fireRate: 150,
    ammoMax: 10,
    currentAmmo: 10,
    reloadTime: 1400,
    isReloading: false,
    price: 0,
    unlocked: false,
    color: '#ef4444', // heavy red
    projectilesPerShot: 1,
    spread: 0.10,
    recoil: 2.2,
    description: '全自動式の近未来アサルトライフル。中距離戦闘を完全に支配する。',
  },
  {
    id: 'katana',
    name: '高周波振動ブレード「村雨」',
    type: 'katana',
    damage: 35,
    fireRate: 250,
    ammoMax: 10,
    currentAmmo: 10,
    reloadTime: 900,
    isReloading: false,
    price: 0,
    unlocked: false,
    color: '#a855f7', // violet
    projectilesPerShot: 1,
    spread: 0.35,
    recoil: -2.0, // Lunges player forward!
    description: '高電力で結合部を寸断する振動ブレード。前方へ踏み込み斬りつける。弾を防御する。',
  },
  {
    id: 'shield',
    name: '磁気フォース・シールド',
    type: 'shield',
    damage: 12,
    fireRate: 400,
    ammoMax: 10,
    currentAmmo: 10,
    reloadTime: 1100,
    isReloading: false,
    price: 0,
    unlocked: false,
    color: '#3b82f6', // electric blue
    projectilesPerShot: 1,
    spread: 0.08,
    recoil: 0.0,
    description: '展開型のアクティブ防護バリア。展開中は前面からの被ダメージを大幅に遮断する。',
  },
  {
    id: 'laser',
    name: 'プラズマビーム照射装置',
    type: 'laser',
    damage: 42,
    fireRate: 300,
    ammoMax: 10,
    currentAmmo: 10,
    reloadTime: 1700,
    isReloading: false,
    price: 0,
    unlocked: false,
    color: '#06b6d4', // electric cyan
    projectilesPerShot: 1,
    spread: 0.015,
    recoil: 0.5,
    description: '未来型プラズマビーム照射装置。敵の装甲を一瞬で貫通する。',
  },
  {
    id: 'rpg',
    name: 'デバスター RPG-9',
    type: 'rpg',
    damage: 120,
    fireRate: 1400,
    ammoMax: 10,
    currentAmmo: 10,
    reloadTime: 2500,
    isReloading: false,
    price: 0,
    unlocked: false,
    color: '#eab308', // pure brass yellow
    projectilesPerShot: 1,
    spread: 0.04,
    recoil: 7.0,
    description: '壊滅的な爆発スプラッシュダメージを与えるロケットランチャー。',
  },
];

const getInitialUpgrades = (): Upgrade[] => [
  {
    id: 'max_health',
    name: 'ナノコア・アーマー',
    description: '防弾ナノ繊維が最大体力を +25 増加させ、耐久性を向上させます。',
    level: 0,
    maxLevel: 5,
    cost: 100,
    valueMultiplier: 1.2,
  },
  {
    id: 'speed',
    name: '油圧式レッグピストン',
    description: '膝部の駆動モーター補助具を装着し、通常走行速度を 15% 向上させます。',
    level: 0,
    maxLevel: 5,
    cost: 80,
    valueMultiplier: 1.15,
  },
  {
    id: 'damage_boost',
    name: '熱力学弾頭ブースター',
    description: '特殊な化学添加剤により弾薬を強化し、与える銃器ダメージを 15% 増加させます。',
    level: 0,
    maxLevel: 5,
    cost: 120,
    valueMultiplier: 1.15,
  },
  {
    id: 'reload_speed',
    name: 'クイックリロード磁気スリーブ',
    description: '特殊電磁リローダーを内蔵し、武器のリロードに要する時間を 15% 短縮します。',
    level: 0,
    maxLevel: 5,
    cost: 100,
    valueMultiplier: 0.85,
  },
];

export default function App() {
  const [gameState, setGameState] = useState<GameStateType>('MAIN_MENU');
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [playerStats, setPlayerStats] = useState<Player>({ ...INITIAL_PLAYER_STATS });
  const [weapons, setWeapons] = useState<Weapon[]>(getInitialWeapons());
  const [upgrades, setUpgrades] = useState<Upgrade[]>(getInitialUpgrades());
  
  // Mute audio synchronization
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(gameAudio.getMutedState());

  // Automatically unlock weapons based on kills
  useEffect(() => {
    setWeapons(prev => {
      const updated = prev.map(w => {
        let shouldUnlock = w.unlocked;
        if (w.id === 'pistol') shouldUnlock = true;
        if (w.id === 'shotgun' && playerStats.kills >= 5) shouldUnlock = true;
        if (w.id === 'rifle' && playerStats.kills >= 25) shouldUnlock = true;
        if (w.id === 'katana' && playerStats.kills >= 50) shouldUnlock = true;
        if (w.id === 'shield' && playerStats.kills >= 80) shouldUnlock = true;
        if (w.id === 'laser' && playerStats.kills >= 120) shouldUnlock = true;
        if (w.id === 'rpg' && playerStats.kills >= 180) shouldUnlock = true;

        if (shouldUnlock && !w.unlocked) {
          return { ...w, unlocked: true };
        }
        return w;
      });
      // Check if anything actually changed to avoid infinite loops
      const changed = updated.some((w, i) => w.unlocked !== prev[i].unlocked);
      return changed ? updated : prev;
    });
  }, [playerStats.kills]);

  // Set up volume check
  const handleToggleMuteGlobal = () => {
    const nextMuted = gameAudio.toggleMute();
    setIsAudioMuted(nextMuted);
  };

  const handleStartGame = () => {
    // Reset all parameters
    setPlayerStats({ ...INITIAL_PLAYER_STATS });
    setWeapons(getInitialWeapons());
    setUpgrades(getInitialUpgrades());
    setCurrentStage(1);
    setGameState('PLAYING');
  };

  const handleStageComplete = () => {
    // Stage cleared!
    const nextStage = currentStage + 1;
    setPlayerStats(prev => ({
      ...prev,
      stagesCompleted: prev.stagesCompleted + 1,
    }));

    gameAudio.playUpgrade();

    // Check final Victory condition (e.g. beat Stage 4 boss)
    if (currentStage >= 4) {
      handleSaveHighScore(playerStats.score + 3000); // bonus wins
      setGameState('VICTORY');
    } else {
      setGameState('SHOP');
    }
  };

  const handleNextStage = () => {
    // Progress stages
    setCurrentStage(prev => prev + 1);
    
    setGameState('PLAYING');
  };

  const handleGameOver = () => {
    // Dead
    gameAudio.playExplosion();
    handleSaveHighScore(playerStats.score);
    setGameState('GAME_OVER');
  };

  const handleSaveHighScore = (finalScore: number) => {
    const currentHigh = localStorage.getItem('alleyway_gunfight_highscore');
    if (!currentHigh || finalScore > parseInt(currentHigh)) {
      localStorage.setItem('alleyway_gunfight_highscore', finalScore.toString());
    }
  };

  const handleResetToMainMenu = () => {
    setGameState('MAIN_MENU');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-900 border-t-4 border-cyan-500 relative">
      
      {/* Top Header Grid */}
      <header className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-slate-800 py-3.5 px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center font-display font-black text-slate-950 text-sm shadow-md shadow-cyan-900/40 select-none">
            A
          </div>
          <div>
            <h1 className="font-display font-black text-sm tracking-tight text-white uppercase">
              Alleyway Gunfight
            </h1>
            <span className="text-[10px] font-mono text-cyan-400 font-bold block leading-none">
              GRID DISTRICT INFILTRATION
            </span>
          </div>
        </div>

        {/* Action strip */}
        <div className="flex items-center gap-4">
          
          {/* Mute toggle button */}
          <button
            onClick={handleToggleMuteGlobal}
            className="p-2 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-md transition text-slate-400 hover:text-white cursor-pointer"
            title="Toggle Audio Synthesizer"
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {gameState !== 'MAIN_MENU' && (
            <button
              onClick={handleResetToMainMenu}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 text-gray-400 hover:text-white border border-slate-800 hover:border-slate-700 rounded-md text-xs font-mono transition cursor-pointer select-none"
            >
              <Home className="w-3.5 h-3.5" /> MENU
            </button>
          )}
        </div>
      </header>

      {/* Main viewport region */}
      <section className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-6 py-6 flex flex-col justify-center items-center">
        
        {/* GAME CONTENT ROTATOR */}
        {gameState === 'MAIN_MENU' && (
          <div className="w-full animate-fade-in">
            <MainMenu onStartGame={handleStartGame} />
          </div>
        )}

        {gameState === 'PLAYING' && (
          <div className="w-full flex flex-col gap-5">
            {/* Top Stat Ribbon */}
            <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono text-xs text-white">
              
              {/* HP Bar */}
              <div className="flex items-center gap-3">
                <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                <div className="w-40 bg-slate-950 border border-slate-800 h-4 rounded-sm relative overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-red-600 to-rose-500 h-full transition-all duration-200"
                    style={{ width: `${(playerStats.health / playerStats.maxHealth) * 100}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center font-bold text-[10px] text-white">
                    {playerStats.health} / {playerStats.maxHealth}
                  </span>
                </div>
              </div>

              {/* Weapons inventory indicators */}
              <div className="hidden md:flex items-center gap-2">
                {weapons.map((w, idx) => {
                  const isActive = idx === playerStats.activeWeaponIndex;
                  return (
                    <div 
                      key={w.id}
                      className={`px-2.5 py-1.5 border rounded flex items-center gap-1.5 font-mono text-[10px] select-none ${
                        isActive 
                          ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200 font-bold' 
                          : w.unlocked 
                            ? 'border-slate-800 hover:border-slate-700 text-slate-400 cursor-pointer' 
                            : 'border-slate-950 bg-slate-950/40 text-slate-700'
                      }`}
                      onClick={() => {
                        if (w.unlocked) {
                          setPlayerStats(prev => ({ ...prev, activeWeaponIndex: idx }));
                          gameAudio.playPistol();
                        }
                      }}
                    >
                      <span className="text-[8px] text-gray-500">[{idx+1}]</span>
                      {w.name.split(' ')[0]}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 font-bold">${playerStats.cash}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-cyan-400 font-bold">{playerStats.kills} キル</span>
                </div>
              </div>

            </div>

            {/* Core Game Render Area */}
            <GameCanvas
              gameState={gameState}
              weapons={weapons}
              setWeapons={setWeapons}
              playerStats={playerStats}
              setPlayerStats={setPlayerStats}
              currentStage={currentStage}
              onGameOver={handleGameOver}
              onStageComplete={handleStageComplete}
            />

            {/* In-game quick manual tracker */}
            <div className="p-3.5 bg-slate-900 border border-slate-800 text-xs text-gray-400 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-cyan-400">
                <Radio className="w-4 h-4 text-cyan-500 animate-pulse" /> 
                <span>通信リンク接続中: <kbd className="px-1 bg-slate-950 text-white rounded">A D</kbd> / <kbd className="px-1 bg-slate-950 text-white rounded">← →</kbd> で移動、<kbd className="px-1 bg-slate-950 text-white rounded">W</kbd> / <kbd className="px-1 bg-slate-950 text-white rounded">↑</kbd> でジャンプ。マウスカーソルで狙って <kbd className="px-1 bg-slate-950 text-white rounded">左クリック</kbd> または <kbd className="px-1 bg-slate-950 text-white rounded">Space</kbd> キーで弾を撃ちます。</span>
              </span>
              <span className="text-[10px] font-mono text-gray-500">
                障害物の裏で <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded">S</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded">↓</kbd> を押すと被弾を 85% 防ぎます。
              </span>
            </div>
          </div>
        )}

        {gameState === 'SHOP' && (
          <div className="w-full animate-fade-in">
            <ShopMenu
              weapons={weapons}
              setWeapons={setWeapons}
              playerStats={playerStats}
              setPlayerStats={setPlayerStats}
              upgrades={upgrades}
              setUpgrades={setUpgrades}
              currentStage={currentStage + 1}
              onNextStage={handleNextStage}
            />
          </div>
        )}

        {gameState === 'GAME_OVER' && (
          <div className="w-full max-w-md bg-slate-900 border border-red-950 p-8 rounded-xl text-center shadow-2xl relative select-none">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-red-950 border border-red-500 flex items-center justify-center shadow-lg shadow-red-900/50">
              <ShieldAlert className="w-6 h-6 text-red-500 animate-bounce" />
            </div>

            <h2 className="text-2xl font-black font-display text-red-500 uppercase tracking-wide mt-3 neon-glow-red">
              作戦失敗: 特別傭兵ダウン
            </h2>
            <p className="text-gray-400 text-xs mt-2 leading-relaxed">
              メガシティの薄暗い細道で、敵サイボーグ部隊に無力化されました。カバー防御を活用して生存を目指しましょう。
            </p>

            {/* Scorecard */}
            <div className="my-6 p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">クリアしたステージ数:</span>
                <span className="text-slate-200 font-bold">{playerStats.stagesCompleted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">撃破した敵の数:</span>
                <span className="text-cyan-400 font-bold">{playerStats.kills}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 text-sm">
                <span className="text-gray-400 font-bold">最終獲得スコア:</span>
                <span className="text-amber-400 font-bold">{playerStats.score}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleStartGame}
                className="flex-1 flex items-center justify-center gap-1.5 px-5 py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-display font-medium rounded-lg text-xs transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> ミッション再挑戦
              </button>
              <button
                onClick={handleResetToMainMenu}
                className="flex-1 flex items-center justify-center gap-1.5 px-5 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-display font-medium rounded-lg text-xs transition cursor-pointer"
              >
                <Home className="w-4 h-4" /> メインメニューへ
              </button>
            </div>
          </div>
        )}

        {gameState === 'VICTORY' && (
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-920 p-8 rounded-xl text-center shadow-2xl relative select-none">
            
            {/* Glowing crown badge */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-emerald-950 border border-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-900/50">
              <Award className="w-7 h-7 text-emerald-400 animate-pulse" />
            </div>

            <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-mono font-bold mt-4">
              ミッション状況: パーフェクトクリア！
            </div>
            
            <h2 className="text-3xl font-black font-display text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 uppercase tracking-tighter filter drop-shadow-[0_2px_10px_rgba(34,197,94,0.3)] mt-2">
              細道を制圧せよ！クリア成功！
            </h2>
            
            <p className="text-gray-400 text-xs md:text-sm mt-3 leading-relaxed font-sans">
              おめでとうございます！あなたはメガシティ裏路地の最深部に封印されていた重装甲の迎撃メカを完全に無力化しました。
              細道に平和をもたらし、生還に成功しました！
            </p>

            {/* Scorecard */}
            <div className="my-6 p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">戦闘死亡回数:</span>
                <span className="text-green-400 font-bold">0回 (完全勝利)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">掃討した敵の数:</span>
                <span className="text-emerald-400 font-bold">{playerStats.kills} キル</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">クリアボーナス:</span>
                <span className="text-emerald-400 font-bold font-mono">+3,000 スコア</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 text-sm">
                <span className="text-gray-400 font-bold">栄光の最終スコア:</span>
                <span className="text-amber-400 font-extrabold">{playerStats.score + 3000}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleStartGame}
                className="flex-1 flex items-center justify-center gap-1.5 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:scale-[1.02] text-slate-950 font-display font-black text-xs tracking-wider rounded-lg transition shadow-lg cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 animate-spin" /> もう一度潜入する
              </button>
              <button
                onClick={handleResetToMainMenu}
                className="flex-1 flex items-center justify-center gap-1.5 px-6 py-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-display font-bold text-xs tracking-wider rounded-lg transition cursor-pointer"
              >
                <Home className="w-4 h-4" /> メインメニュー
              </button>
            </div>
          </div>
        )}

      </section>

      {/* Styled system footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-3 text-center text-[10px] font-mono text-gray-600 select-none">
        <div>
          ALLEYWAY GUNFIGHT // COGNITIVE AGENT MODULE // © {new Date().getFullYear()} NEON STREETS LTD.
        </div>
      </footer>

    </main>
  );
}
