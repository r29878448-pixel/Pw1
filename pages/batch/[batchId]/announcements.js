import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconBell = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
  </svg>
);

const IconCalendar = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
  </svg>
);

const IconExternalLink = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
  </svg>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = ({ className }) => <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;

// ─── Linkified text ───────────────────────────────────────────────────────────
function LinkText({ text }) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <p className="text-gray-700 whitespace-pre-wrap mb-3 leading-relaxed text-sm">
      {parts.map((part, i) =>
        part.match(urlRegex) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="text-indigo-600 hover:underline font-medium break-all inline-flex items-center gap-1">
            {part} <IconExternalLink />
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

// ─── Time ago ─────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN');
}

// ─── Announcement Card ────────────────────────────────────────────────────────
function AnnouncementCard({ item }) {
  const [imgHover, setImgHover] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="p-5">
        {/* Author row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-shrink-0">
            <img
              src="https://i.ibb.co/m53b0YKH/file-00000000d664720997f7f5165cbd5131.png"
              alt="Study Portal"
              width={44}
              height={44}
              className="rounded-full border-2 border-white shadow-sm"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5 flex-wrap">
              Study Portal Team
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Official</span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <IconCalendar /> {timeAgo(item.createdAt)}
            </p>
          </div>
        </div>

        {/* Heading */}
        {item.heading && (
          <h3 className="font-bold text-base text-gray-900 mb-2 hover:text-indigo-700 transition-colors">
            {item.heading}
          </h3>
        )}

        {/* Body text */}
        <LinkText text={item.announcement} />

        {/* Attachment image */}
        {item.attachment && (
          <div
            className="relative aspect-video w-full rounded-xl overflow-hidden bg-gray-100 mt-2"
            onMouseEnter={() => setImgHover(true)}
            onMouseLeave={() => setImgHover(false)}
          >
            <img
              src={`${item.attachment.baseUrl}${item.attachment.key}`}
              alt={item.heading || 'Attachment'}
              className={`absolute inset-0 w-full h-full object-contain transition-transform duration-500 ${imgHover ? 'scale-105' : 'scale-100'}`}
            />
            <div className={`absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent transition-opacity duration-300 ${imgHover ? 'opacity-100' : 'opacity-0'}`} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Announcements() {
  const router = useRouter();
  const { batchId, name } = router.query;

  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const batchName = name ? decodeURIComponent(name) : 'Batch';

  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    setError('');
    fetch(`/api/announcements?batchId=${batchId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success === false) throw new Error(d.error || 'Failed');
        setItems(d.data || d || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [batchId]);

  return (
    <>
      <Head><title>Announcements – {batchName}</title></Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="sticky top-0 z-50 text-white flex items-center h-14 px-4 gap-3 shadow-md" style={{ backgroundColor: '#5a4bda' }}>
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2 flex-1">
            <IconBell className="w-5 h-5" />
            <h1 className="font-bold text-base">Announcements</h1>
          </div>
          {!loading && items.length > 0 && (
            <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {items.length}
            </span>
          )}
        </header>

        <main className="max-w-2xl mx-auto p-4 space-y-4">
          {/* Loading */}
          {loading && [0, 1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Sk className="w-11 h-11 rounded-full flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <Sk className="h-4 w-32" />
                  <Sk className="h-3 w-24" />
                </div>
              </div>
              <Sk className="h-5 w-3/4" />
              <Sk className="h-4 w-full" />
              <Sk className="h-4 w-5/6" />
              <Sk className="aspect-video w-full rounded-xl" />
            </div>
          ))}

          {/* Error */}
          {!loading && error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <p className="text-red-600 font-semibold mb-1">Failed to load announcements</p>
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {/* List */}
          {!loading && !error && items.length > 0 && items.map(item => (
            <AnnouncementCard key={item._id} item={item} />
          ))}

          {/* Empty */}
          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-5 bg-indigo-50 rounded-full mb-4">
                <IconBell className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">No announcements yet</h3>
              <p className="text-gray-500 text-sm mt-1">Check back later for updates from the team</p>
            </div>
          )}
        </main>

        <div className="h-8" />
      </div>
    </>
  );
}
