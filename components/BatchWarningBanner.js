export default function BatchWarningBanner() {
  return (
    <div className="space-y-3 mb-6">
      {/* Warning 1 - Fake Website Alert */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-4 shadow-lg border-2 border-red-400">
        <div className="flex items-start gap-3">
          <div className="text-3xl flex-shrink-0 animate-pulse">🚨</div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg mb-2">⚠️ FAKE WEBSITE ALERT</h3>
            <p className="text-white/95 text-sm leading-relaxed mb-3">
              Agar aapko ye batch kisi aur ne send kiya hai, <span className="font-bold underline">turant leave karo!</span> 
              Ye fake website ho sakti hai jo aapka data chura sakti hai. Apna data safe rakho!
            </p>
            <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm">
              <p className="text-white font-semibold text-sm mb-2">✅ Official Website:</p>
              <a 
                href="https://pw-studyportalz.vercel.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block bg-white text-red-600 hover:bg-red-50 font-bold py-2 px-4 rounded-lg transition-all transform hover:scale-105 text-sm shadow-md"
              >
                🔗 pw-studyportalz.vercel.app/
              </a>
              <p className="text-white/90 text-xs mt-2">👆 Sahi website par jane ke liye click karo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning 2 - Join Telegram */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-4 shadow-lg border-2 border-blue-400">
        <div className="flex items-start gap-3">
          <div className="text-3xl flex-shrink-0">📢</div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg mb-2">📱 Study Portal Official Telegram</h3>
            <p className="text-white/95 text-sm leading-relaxed mb-3">
              Ye batches <span className="font-bold">Study Portal</span> ne provide kiye hain. 
              Latest updates, free batches aur important announcements ke liye official Telegram channel join karo!
            </p>
            <a
              href="https://t.me/Study_Portalz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-blue-600 hover:bg-blue-50 font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg text-sm"
            >
              <span className="text-lg">📢</span> Join t.me/Study_Portalz
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
