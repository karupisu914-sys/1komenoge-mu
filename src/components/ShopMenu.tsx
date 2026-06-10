import React from 'react';
import { Weapon, Upgrade, Player } from '../types';
import { gameAudio } from './AudioEngine';
import { Shield, Zap, Sparkles, Flame, Swords, ShieldCheck, ShoppingCart, Play, Gift, HelpCircle, Dices } from 'lucide-react';

interface ShopMenuProps {
  weapons: Weapon[];
  setWeapons: React.Dispatch<React.SetStateAction<Weapon[]>>;
  playerStats: Player;
  setPlayerStats: React.Dispatch<React.SetStateAction<Player>>;
  upgrades: Upgrade[];
  setUpgrades: React.Dispatch<React.SetStateAction<Upgrade[]>>;
  currentStage: number;
  onNextStage: () => void;
}

export default function ShopMenu({
  weapons,
  setWeapons,
  playerStats,
  setPlayerStats,
  upgrades,
  setUpgrades,
  currentStage,
  onNextStage,
}: ShopMenuProps) {

  const [isRollingGacha, setIsRollingGacha] = React.useState(false);
  const [gachaResult, setGachaResult] = React.useState<string | null>(null);
  const [gachaTier, setGachaTier] = React.useState<'legendary' | 'epic' | 'rare' | 'common' | null>(null);

  const handleGachaSpin = () => {
    if (playerStats.cash < 100 || isRollingGacha) return;

    gameAudio.playUpgrade();
    setIsRollingGacha(true);
    setGachaResult(null);
    setGachaTier(null);

    setTimeout(() => {
      setIsRollingGacha(false);
      gameAudio.playWeaponBuy();

      const rand = Math.random();
      let roll: { tier: 'legendary' | 'epic' | 'rare' | 'common', name: string, effect: () => void };

      // Outcome distribution
      if (rand < 0.12) {
        // Legendary: Unlock a random locked weapon!
        const lockedWeapons = weapons.filter(w => !w.unlocked);
        if (lockedWeapons.length > 0) {
          const selectedW = lockedWeapons[Math.floor(Math.random() * lockedWeapons.length)];
          roll = {
            tier: 'legendary',
            name: `🌟レジェンダリー特賞!! 武器解放: 【${selectedW.name}】!!`,
            effect: () => {
              setWeapons(prev => prev.map(w => w.id === selectedW.id ? { ...w, unlocked: true } : w));
            }
          };
        } else {
          // Fallback if passenger already unlocked everything
          roll = {
            tier: 'legendary',
            name: `🌟レジェンダリー!! 全武器攻撃力 +35% 超強化!!`,
            effect: () => {
              setWeapons(prev => prev.map(w => ({ ...w, damage: Math.floor(w.damage * 1.35) })));
            }
          };
        }
      } else if (rand < 0.35) {
        // Epic
        const epicRand = Math.random();
        if (epicRand < 0.5) {
          roll = {
            tier: 'epic',
            name: '🔥エピック特賞!! ナノコア装甲拡張: 最大体力 +40 増加!',
            effect: () => {
              setPlayerStats(prev => {
                const nextMax = prev.maxHealth + 40;
                return { ...prev, maxHealth: nextMax, health: Math.min(prev.health + 40, nextMax) };
              });
            }
          };
        } else {
          roll = {
            tier: 'epic',
            name: '🔥エピック特賞!! 電磁チャージ弾薬: 全銃器攻撃力 +25% 急上昇!',
            effect: () => {
              setWeapons(prev => prev.map(w => ({ ...w, damage: Math.floor(w.damage * 1.25) })));
            }
          };
        }
      } else if (rand < 0.70) {
        // Rare
        const rareRand = Math.random();
        if (rareRand < 0.5) {
          roll = {
            tier: 'rare',
            name: '💎レア!! クイック磁気リペラー: 全武器のリロード速度 +20% 高速化!',
            effect: () => {
              setWeapons(prev => prev.map(w => ({ ...w, reloadTime: Math.floor(w.reloadTime * 0.8) })));
            }
          };
        } else {
          roll = {
            tier: 'rare',
            name: '💎レア!! マネーハッキング配当: クレジット +200 キャッシュキャッシュバック!',
            effect: () => {
              setPlayerStats(prev => ({ ...prev, cash: prev.cash + 200 }));
            }
          };
        }
      } else {
        // Common
        roll = {
          tier: 'common',
          name: '⚙️コモン!! ナノ医療チャージ: 体力が +45 回復!',
          effect: () => {
            setPlayerStats(prev => ({ ...prev, health: Math.min(prev.maxHealth, prev.health + 45) }));
          }
        };
      }

      // Deduct the cost and apply effect
      setPlayerStats(prev => ({ ...prev, cash: prev.cash - 100 }));
      roll.effect();
      setGachaResult(roll.name);
      setGachaTier(roll.tier);
    }, 1200);
  };

  const getKillsRequired = (id: string): number => {
    switch (id) {
      case 'shotgun': return 5;
      case 'rifle': return 25;
      case 'katana': return 50;
      case 'shield': return 80;
      case 'laser': return 120;
      case 'rpg': return 180;
      default: return 0;
    }
  };

  const handleUpgradePurchase = (upgradeId: string) => {
    const targetU = upgrades.find(u => u.id === upgradeId);
    if (!targetU) return;

    if (playerStats.cash >= targetU.cost && targetU.level < targetU.maxLevel) {
      gameAudio.playUpgrade();

      // deduct cash
      const newCash = playerStats.cash - targetU.cost;

      // upgrade item level and cost
      const updatedUpgrades = upgrades.map(u => {
        if (u.id === upgradeId) {
          const nextLevel = u.level + 1;
          const nextCost = Math.floor(u.cost * 1.5);
          return { ...u, level: nextLevel, cost: nextCost };
        }
        return u;
      });

      setUpgrades(updatedUpgrades);

      // apply upgrades back to player stats
      setPlayerStats(prev => {
        let maxHealth = prev.maxHealth;
        let speed = prev.speed;

        if (upgradeId === 'max_health') {
          maxHealth = maxHealth + 25;
        } else if (upgradeId === 'speed') {
          speed = speed + 0.6;
        }

        return {
          ...prev,
          cash: newCash,
          maxHealth,
          health: Math.min(prev.health + 25, maxHealth), // heal slightly on buy
          speed,
        };
      });

      // apply upgrades to weapon statistics if damage_boost or reload_speed selected
      if (upgradeId === 'damage_boost') {
        setWeapons(prev => 
          prev.map(w => ({ ...w, damage: Math.floor(w.damage * 1.15) }))
        );
      } else if (upgradeId === 'reload_speed') {
        setWeapons(prev => 
          prev.map(w => ({ ...w, reloadTime: Math.floor(w.reloadTime * 0.85) }))
        );
      }
    }
  };

  const getUpgradeIcon = (id: string) => {
    switch (id) {
      case 'max_health':
        return <Shield className="w-5 h-5 text-emerald-400" />;
      case 'speed':
        return <Zap className="w-5 h-5 text-amber-400" />;
      case 'damage_boost':
        return <Swords className="w-5 h-5 text-rose-500" />;
      case 'reload_speed':
        return <Sparkles className="w-5 h-5 text-cyan-400" />;
      default:
        return <Flame className="w-5 h-5 text-indigo-400" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl relative select-none" id="shop_terminal_shell">
      
      {/* Top stage progression banner */}
      <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-800 pb-5 mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-mono font-bold">
            ステージ {currentStage - 1} クリア
          </div>
          <h1 className="text-2xl font-bold font-display text-white mt-1">
            兵器ターミナル ＆ 身体強化ショップ
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            獲得したクレジットを消費して、より強力な武器の購入やバイオテクノロジーによる肉体改造を行うことができます。
          </p>
        </div>

        {/* Current Balances */}
        <div className="flex items-center gap-6 mt-4 md:mt-0 px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg">
          <div className="font-mono text-center">
            <span className="text-[10px] text-gray-500 block">所持クレジット</span>
            <span className="text-xl font-bold text-amber-400">${playerStats.cash}</span>
          </div>
          <div className="w-[1px] h-8 bg-slate-800" />
          <div className="font-mono text-center">
            <span className="text-[10px] text-gray-500 block">撃破した敵</span>
            <span className="text-xl font-bold text-cyan-400">{playerStats.kills}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* WEAPONS SHOP */}
        <div>
          <h2 className="text-sm font-bold font-display text-cyan-400 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> 武器・ガンライブラリ
          </h2>
          <div className="space-y-4">
            {weapons.map(w => {
              const reqKills = getKillsRequired(w.id);
              return (
                <div 
                  key={w.id} 
                  className={`p-4 bg-slate-950/80 border rounded-lg transition duration-250 flex items-center justify-between ${
                    w.unlocked ? 'border-emerald-800/40 bg-emerald-950/5' : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="max-w-[70%]">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ backgroundColor: w.color }} 
                      />
                      <h3 className="text-sm font-bold text-white font-mono">{w.name}</h3>
                      {w.unlocked ? (
                        <span className="px-1.5 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 font-mono text-[9px] rounded uppercase">
                          解放済
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-rose-950/80 text-rose-400 border border-rose-800/40 font-mono text-[9px] rounded uppercase">
                          ロック中
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{w.description}</p>
                    
                    {/* Weapon Specs */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] font-mono text-gray-500 font-sans">
                      <div>威力: <span className="text-slate-300">{w.damage}</span></div>
                      <div>装弾数: <span className="text-slate-300">{w.ammoMax}</span></div>
                      <div>リロード: <span className="text-slate-300">{(w.reloadTime / 1000).toFixed(1)}秒</span></div>
                      {w.projectilesPerShot > 1 && (
                        <div>同時発射: <span className="text-slate-300">x{w.projectilesPerShot}</span></div>
                      )}
                    </div>

                    {/* Kill Requirement details */}
                    {w.id !== 'pistol' && (
                      <div className="mt-1.5 text-[10px] text-cyan-400 font-mono">
                        解放条件: 敵を <span className="font-bold text-amber-400 font-sans">{reqKills}</span> 体撃破 (現在: <span className="font-bold font-sans">{playerStats.kills}</span>/{reqKills} 撃破)
                      </div>
                    )}
                  </div>

                  <div>
                    {w.unlocked ? (
                      <span className="text-xs text-emerald-400 font-mono flex items-center gap-1 bg-emerald-950/20 px-2 py-1 rounded">
                        <ShieldCheck className="w-3.5 h-3.5" /> 使用可能
                      </span>
                    ) : (
                      <div className="text-[10px] sm:text-xs text-rose-400 font-mono text-center bg-rose-950/20 px-3 py-1.5 rounded border border-rose-950/30">
                        未到達 ({playerStats.kills}/{reqKills})
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BIO STRENGTH AUGMENTATION SHOP */}
        <div>
          <h2 className="text-sm font-bold font-display text-pink-400 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> 身体能力アップグレード
          </h2>
          <div className="space-y-4">
            {upgrades.map(u => {
              const maxed = u.level >= u.maxLevel;
              const affordable = playerStats.cash >= u.cost;
              return (
                <div 
                  key={u.id}
                  className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between"
                >
                  <div className="max-w-[70%]">
                    <div className="flex items-center gap-2.5">
                      {getUpgradeIcon(u.id)}
                      <h3 className="text-sm font-bold text-white font-mono">{u.name}</h3>
                      <span className="text-xs text-slate-400 font-mono">
                        LVL {u.level}/{u.maxLevel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{u.description}</p>
                    
                    {/* Level step indicators */}
                    <div className="flex gap-1.5 mt-2.5">
                      {Array.from({ length: u.maxLevel }).map((_, idx) => (
                        <div 
                          key={idx} 
                          className={`h-1.5 w-6 rounded-sm ${
                            idx < u.level ? 'bg-cyan-400' : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    {maxed ? (
                      <span className="text-xs text-cyan-400 font-mono flex items-center gap-1 bg-cyan-950/20 px-2 py-1 rounded">
                        強化限界
                      </span>
                    ) : (
                      <button
                        onClick={() => handleUpgradePurchase(u.id)}
                        disabled={!affordable}
                        className={`px-4 py-2 text-xs font-mono font-bold rounded transition w-28 text-center ${
                          affordable 
                            ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md cursor-pointer' 
                            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        }`}
                      >
                        ${u.cost} 強化
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* CYBERNETIC COIN GACHA TERMINAL */}
      <div className="mt-8 p-5 bg-slate-950/90 border border-indigo-500/30 rounded-xl relative overflow-hidden shadow-lg shadow-indigo-950/20" id="cyber_gacha_terminal">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-5 relative z-10">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs uppercase font-bold">
              <Dices className="w-4 h-4 text-indigo-400" /> Cyber Coin Gacha Terminal
            </div>
            <h3 className="text-lg font-bold text-white mt-1">電磁コイン・ガチャ機「LUCKY SPIN」</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              1回 <span className="text-amber-400 font-bold font-mono">$100</span> クレジットを消費して、運命のホイールを回します。
              レア仕様パーツや<span className="text-rose-400 font-bold font-sans">最大体力の限界突破</span>、さらに特選として、通常では解除できない強力武器を段階無視して特例アンロックする可能性も秘めています！
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-2">
            <button
              onClick={handleGachaSpin}
              disabled={playerStats.cash < 100 || isRollingGacha}
              className={`relative overflow-hidden px-8 py-3.5 font-bold font-display rounded-lg transition-all shadow-lg select-none w-56 flex items-center justify-center gap-2 ${
                playerStats.cash >= 100 && !isRollingGacha
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white cursor-pointer hover:shadow-indigo-500/20 scale-100 hover:scale-[1.02]'
                  : isRollingGacha
                    ? 'bg-indigo-950 border border-indigo-700/50 text-indigo-400 cursor-not-allowed animate-pulse'
                    : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
              }`}
            >
              {isRollingGacha ? (
                <>
                  <Dices className="w-4 h-4 animate-spin" />
                  高速展開中...
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  $100 ガチャを引く
                </>
              )}
            </button>
            <div className="text-[10px] text-slate-500 font-mono">
              ハッキング勝率: レジェンダリー：12% / エピック：23% / レア：35% / コモン：30%
            </div>
          </div>
        </div>

        {/* Gacha spinning reel visual cue / result indicator */}
        {(isRollingGacha || gachaResult) && (
          <div className={`mt-4 p-4 border rounded-lg transition bg-slate-950 select-none flex items-center gap-3.5 ${
            isRollingGacha 
              ? 'border-indigo-500/50 animate-pulse' 
              : gachaTier === 'legendary'
                ? 'border-amber-400/60 shadow-[0_0_15px_rgba(234,179,8,0.15)] text-amber-300'
                : gachaTier === 'epic'
                  ? 'border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.15)] text-purple-300'
                  : gachaTier === 'rare'
                    ? 'border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.15)] text-cyan-300'
                    : 'border-slate-800 text-slate-300'
          }`}>
            {isRollingGacha ? (
              <>
                <div className="w-5 h-5 rounded-full border-t-2 border-indigo-400 border-r-2 animate-spin" />
                <span className="text-xs font-mono text-indigo-300 font-bold animate-pulse">電磁乱数計算機をハッキング中... 磁気スロット展開開始!</span>
              </>
            ) : (
              <div className="flex items-center gap-2.5 w-full">
                <div className={`p-1.5 rounded-full ${
                  gachaTier === 'legendary' ? 'bg-amber-950/40 text-amber-400 border border-amber-800/20' :
                  gachaTier === 'epic' ? 'bg-purple-950/40 text-purple-400 border border-purple-800/20' :
                  gachaTier === 'rare' ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-800/20' :
                  'bg-slate-900 border border-slate-800 text-slate-400'
                }`}>
                  {gachaTier === 'legendary' ? <Sparkles className="w-4 h-4 animate-bounce text-amber-400" /> :
                   gachaTier === 'epic' ? <Flame className="w-4 h-4 text-purple-400" /> :
                   gachaTier === 'rare' ? <Zap className="w-4 h-4 text-cyan-400" /> :
                   <HelpCircle className="w-4 h-4 text-slate-400" />}
                </div>
                <div className="flex-1">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    ガチャ排出結果 (Gacha Dispatch Succeeded)
                  </div>
                  <div className="text-sm font-bold font-display mt-0.5">{gachaResult}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Start Stage Action */}
      <div className="mt-8 pt-5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-gray-500">
          次のバトルフィールドに進む前に、武器が正しくアップグレードされているか確認してください。
        </div>
        <button
          onClick={onNextStage}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-display font-medium rounded-lg text-sm transition cursor-pointer select-none shadow-lg shadow-cyan-900/40"
        >
          <Play className="w-4 h-4" /> 第 {currentStage} ステージへ潜入開始
        </button>
      </div>

    </div>
  );
}
