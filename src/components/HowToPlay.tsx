import { Keyboard, MousePointer, ShieldAlert, ArrowRight } from 'lucide-react';

export default function HowToPlay() {
  return (
    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 select-none font-sans" id="combat_guide_container">
      <h3 className="text-sm font-bold font-display text-cyan-400 mb-4 tracking-wider flex items-center gap-2">
        <Keyboard className="w-4 h-4" /> 通信リンク確認: 戦闘操作マニュアル
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KEYBOARD CONTROLS */}
        <div className="p-3.5 bg-slate-950/60 border border-slate-900 rounded-lg flex flex-col justify-start">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-white uppercase tracking-wider font-mono">
            <span className="p-1 bg-cyan-950 text-cyan-400 rounded">キーボード</span> 移動操作
          </div>
          <ul className="space-y-1.5 text-xs text-gray-400 font-mono">
            <li>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-cyan-300">A</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-cyan-300">←</kbd>
               : 左に走る
            </li>
            <li>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-cyan-300">D</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-cyan-300">→</kbd>
               : 右に走る
            </li>
            <li>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-cyan-300">W</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-cyan-300">↑</kbd>
               : ジャンプ
            </li>
            <li>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-cyan-300">S</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-cyan-300">↓</kbd>
               : しゃがむ / 隠れる
            </li>
          </ul>
        </div>

        {/* WEAPON INTERACTION */}
        <div className="p-3.5 bg-slate-950/60 border border-slate-900 rounded-lg flex flex-col justify-start">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-white uppercase tracking-wider font-mono">
            <span className="p-1 bg-pink-950 text-pink-400 rounded">マウス & キー</span> 攻撃操作
          </div>
          <ul className="space-y-1.5 text-xs text-gray-400 font-mono">
            <li className="flex items-center gap-1">
              <MousePointer className="w-3.5 h-3.5 text-pink-400" /> カーソルで腕の照準を合わせる
            </li>
            <li>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-pink-300">左クリック</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-pink-300">Space</kbd> : 銃を撃つ
            </li>
            <li>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-pink-300">右クリック</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-pink-300">R</kbd> : 手動リロード
            </li>
            <li>
              <span className="text-amber-400 font-bold">撃破数解放</span> : 敵撃破数が5 / 15 / 30 / 50体に達すると自動で２つめ以降の強力な武器を解放！
            </li>
            <li>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-pink-300">1</kbd> - <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-pink-300">5</kbd> : 武器切り替え
            </li>
          </ul>
        </div>

        {/* COVER SHIELD TACTIC */}
        <div className="p-3.5 bg-slate-950/60 border border-slate-900 rounded-lg flex flex-col justify-start">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-white uppercase tracking-wider font-mono">
            <ShieldAlert className="w-4 h-4 text-amber-400" /> カバー防御（重要）
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            フィールド上の <strong className="text-slate-300 font-mono">木箱 (Crate)</strong> や <strong className="text-slate-300 font-mono">ゴミ箱 (Trash Bin)</strong> に密着し、<kbd className="px-1 bg-slate-800 text-amber-300 rounded">S</kbd> / <kbd className="px-1 bg-slate-800 text-amber-300 rounded">↓</kbd> を押してしゃがむとカバー状態になります。
            この状態では、敵からの弾丸ダメージを <span className="text-green-400 font-bold">85%</span> カットできます！
          </p>
        </div>

      </div>

      {/* Progression tip */}
      <div className="mt-4 flex items-center justify-between text-[11px] text-gray-500 font-mono border-t border-slate-800/65 pt-3">
        <span className="flex items-center gap-1">
          <ArrowRight className="w-3 h-3 text-cyan-400" /> 各ステージの最深部にいる重装甲ボスメカを撃破すると、脱出用ポータル（ヘリコプター）が解放され、クリアとなります。
        </span>
        <span className="hidden sm:inline bg-slate-950 px-2 py-0.5 rounded text-[10px]">VER_1.8</span>
      </div>
    </div>
  );
}
