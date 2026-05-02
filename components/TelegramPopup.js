import { useState, useEffect } from 'react';

export default function TelegramPopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show popup after 2 seconds
    const timer = setTimeout(() => {
      const hasSeenPopup = localStorage.getItem('telegram_popup_seen');
      if (!hasSeenPopup) {
        setShow(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setShow(false);
    localStorage.setItem('telegram_popup_seen', 'true');
  };

  const handleJoin = () => {
    window.open('https://t.me/missiontopper_freebatches', '_blank');
    handleClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn flex flex-col max-h-[90vh]">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 px-4 py-4 sm:p-6 text-center flex-shrink-0">
          <div className="text-4xl sm:text-6xl mb-2 sm:mb-3 animate-bounce">📢</div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">⚠️ URGENT NOTICE ⚠️</h2>
          <p className="text-white/90 text-xs sm:text-sm font-medium">Mission Topper Official</p>
        </div>

        {/* Content — scrollable on small screens */}
        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto">
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 sm:p-4">
            <p className="text-red-700 font-bold text-center text-base sm:text-lg mb-1 sm:mb-2">
              🚨 FAKE WEBSITE ALERT 🚨
            </p>
            <p className="text-red-600 text-xs sm:text-sm text-center leading-relaxed">
              Agar aapko ye batch kisi aur ne send kiya hai, turant leave karo! 
              Ye fake website ho sakti hai jo aapka data chura sakti hai.
            </p>
          </div>

          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-3 sm:p-4">
            <p className="text-green-700 font-bold text-center mb-1 sm:mb-2 text-sm sm:text-base">
              ✅ OFFICIAL WEBSITE
            </p>
            <a 
              href="https://pw-missiontopper.vercel.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-center text-blue-600 hover:text-blue-700 font-semibold underline text-xs sm:text-sm break-all"
            >
              pw-missiontopper.vercel.app
            </a>
            <p className="text-green-600 text-xs text-center mt-1 sm:mt-2">
              👆 Sahi website par jane ke liye click karo
            </p>
          </div>

          <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3 sm:p-4">
            <p className="text-blue-700 font-bold text-center mb-2 sm:mb-3 text-sm sm:text-base">
              📱 Join Official Telegram Channel
            </p>
            <button
              onClick={handleJoin}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg text-sm sm:text-base"
            >
              <span className="text-base sm:text-lg">📢</span> Join t.me/missiontopper_freebatches
            </button>
            <p className="text-blue-600 text-xs text-center mt-1 sm:mt-2">
              Latest updates aur free batches ke liye join karo
            </p>
          </div>

          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-2.5 sm:p-3">
            <p className="text-yellow-700 text-xs text-center font-medium">
              ⚠️ Apna data safe rakho! Fake websites se door raho!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex justify-center flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-xl transition-all text-sm sm:text-base"
          >
            Samajh Gaya
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
