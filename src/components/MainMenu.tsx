import { useState, useEffect } from 'react';
import { gameAudio } from './AudioEngine';
import { Volume2, VolumeX, Swords, Play, Trophy, HelpCircle } from 'lucide-react';
import HowToPlay from './HowToPlay';

interface MainMenuProps {
  onStartGame: () => void;
}

export default function MainMenu({ onStartGame }: MainMenuProps) {
  const [isMuted, setIsMuted] = useState<boolean>(gameAudio.getMutedState());
  const [highScore, setHighScore] = useState<number>(0);
  const [showHowTo, setShowHowTo] = useState<boolean>(false);

  useEffect(() => {
    // Read high-score from local storage dynamically
    const stored = localStorage.getItem('alleyway_gunfight_highscore');
    if (stored) {
      setHighScore(parseInt(stored));
    }
  }, []);

  const handleMuteToggle = () => {
    const nextMuted = gameAudio.toggleMute();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      // play instant click to confirm
      gameAudio.playPistol();
    }
  };

  const handleStartInfiltration = () => {
    // Click sound and start
    gameAudio.playWeaponBuy();
    onStartGame();
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl relative select-none">
      
      {/* Background neon visual noise effect strip */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12)_0%,transparent_70%)] pointer-events-none rounded-xl" />

      {/* Header Panel */}
      <div className="text-center z-10 mb-8 pt-6">
        <div className="flex items-center justify-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-widest font-bold mb-2">
          <Swords className="w-4 h-4 text-cyan-400 animate-pulse" /> TARGET: METROPOLIS DEEP GRID
        </div>
        
        {/* Title logo using our custom Orbitron and neon glows */}
        <h1 className="text-4xl md:text-6xl font-black font-display text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-100 to-indigo-400 uppercase tracking-tighter filter drop-shadow-[0_2px_10px_rgba(6,182,212,0.3)] select-none">
          ALLEYWAY GUNFIGHT
        </h1>
        
        <p className="font-display font-medium text-xs md:text-sm text-cyan-400 tracking-widest mt-3">
          横スクロール都市細道ガンファイト
        </p>
      </div>

      {/* Cyber Infiltration Context / Story */}
      <div className="w-full max-w-2xl bg-slate-950/80 border border-slate-800 p-5 rounded-lg mb-8 text-center text-xs md:text-sm text-gray-400 leading-relaxed font-sans z-10">
        <p>
          西暦2099年。ネオンが眩むメガシティの裏路地（細道）は、凶暴化したサイバーギャングと自動防衛ロボットの暗黒地帯と化していた。
        </p>
        <p className="mt-2 text-slate-300">
          あなたは最新のサイバネティック拡張を施された特別傭兵。
          障害物に身を隠し敵の弾幕を掻い潜りながら、細道の最深部で稼働する機動兵器ボスを破壊し、地区を制圧せよ！
        </p>
      </div>

      {/* Control Actions / High score row */}
      <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 z-10">
        
        {/* High Score Panel */}
        <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div className="text-left font-mono">
              <span className="text-[10px] text-gray-500 block">PERSONAL RECORD</span>
              <span className="text-lg font-bold text-slate-200">HIGH SCORE</span>
            </div>
          </div>
          <div className="font-mono text-xl font-black text-amber-400 neon-glow-green">
            {highScore}
          </div>
        </div>

        {/* Mute toggle pane */}
        <button
          onClick={handleMuteToggle}
          className="p-4 bg-slate-950/60 border border-slate-900 rounded-lg hover:border-slate-800 transition text-left flex items-center justify-between cursor-pointer w-full"
        >
          <div className="flex items-center gap-3">
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-gray-500 animate-pulse" />
            ) : (
              <Volume2 className="w-5 h-5 text-cyan-400" />
            )}
            <div className="font-mono">
              <span className="text-[10px] text-gray-500 block">SYNTHESIZER SOUND ENGINE</span>
              <span className="text-xs font-bold text-slate-300 uppercase">
                {isMuted ? 'Muted / 静音' : 'Active / 音声ON'}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-cyan-400/80 font-mono">TOGGLE</span>
        </button>

      </div>

      {/* Main Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 items-center mb-8 z-10">
        
        {/* Play Action */}
        <button
          onClick={handleStartInfiltration}
          className="flex items-center justify-center gap-3 w-56 px-8 py-4 bg-gradient-to-r from-cyan-500 via-cyan-600 to-indigo-600 hover:scale-[1.03] active:scale-[0.98] text-white font-display font-black tracking-widest text-sm rounded-lg shadow-xl shadow-cyan-950/40 border border-cyan-400/30 transition cursor-pointer"
        >
          <Play className="w-5 h-5 animate-bounce" /> INFILTRATE STREETS
        </button>

        {/* View instruction */}
        <button
          onClick={() => setShowHowTo(!showHowTo)}
          className="flex items-center justify-center gap-2 w-56 px-8 py-4 bg-slate-950/80 hover:bg-slate-950 text-slate-300 hover:text-cyan-400 border border-slate-800 hover:border-cyan-800/50 font-display font-bold text-xs tracking-widest rounded-lg transition cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" /> 
          {showHowTo ? 'HIDE COMBAT MANUAL' : 'HOW TO PLAY / 操作方法'}
        </button>

      </div>

      {/* Show guide conditionally */}
      {showHowTo && (
        <div className="w-full mt-2 animate-fade-in z-20">
          <HowToPlay />
        </div>
      )}

      {/* Footer system status */}
      <div className="text-[10px] font-mono text-gray-600 tracking-wider">
        SYSTEM REVISION: F-99 // PROTOCOL ACTIVE
      </div>

    </div>
  );
}
