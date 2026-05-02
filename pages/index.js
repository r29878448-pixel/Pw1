import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { getApiUrl, getBatchWithEdits } from '../lib/apiConfig';
import { decryptData } from '@/lib/decryptBrowser';
import TelegramPopup from '../components/TelegramPopup';
import BatchWarningBanner from '../components/BatchWarningBanner';

// ─── API ──────────────────────────────────────────────────────────────────────
// API calls through Vercel routes (handles CORS properly)
const api = async (endpoint) => {
  console.log('🌐 API Call:', endpoint);
  
  const r = await fetch(endpoint);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADIENTS = [
  'from-violet-500 to-purple-700', 'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600', 'from-orange-500 to-red-600',
  'from-pink-500 to-rose-600', 'from-yellow-500 to-amber-600',
  'from-indigo-500 to-blue-700', 'from-teal-500 to-green-600',
  'from-red-500 to-pink-600', 'from-cyan-500 to-blue-500',
];

const TABS = [
  { key: 'videos', label: '🎥 Lectures', ac: 'bg-blue-500 text-white', bd: 'bg-blue-100 text-blue-600', ic: 'bg-blue-50 text-blue-500' },
  { key: 'notes', label: '📄 Notes', ac: 'bg-emerald-500 text-white', bd: 'bg-emerald-100 text-emerald-600', ic: 'bg-emerald-50 text-emerald-500' },
  { key: 'dpp', label: '📝 DPP', ac: 'bg-purple-500 text-white', bd: 'bg-purple-100 text-purple-600', ic: 'bg-purple-50 text-purple-500' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractPdfs(item) {
  const pdfs = [];
  for (const hw of item.homeworkIds || []) {
    for (const att of hw.attachmentIds || []) {
      if (!att.key) continue;
      pdfs.push({
        url: (att.baseUrl || 'https://static.pw.live/') + att.key,
        name: att.name || hw.topic || 'document.pdf',
        topic: hw.topic || item.topic || 'Document',
        note: hw.note || '',
      });
    }
  }
  if (pdfs.length === 0 && (item.url || item.pdfUrl)) {
    pdfs.push({ url: item.url || item.pdfUrl, name: (item.topic || 'doc') + '.pdf', topic: item.topic || 'Document', note: '' });
  }
  return pdfs;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

const Spin = () => (
  <div className="flex justify-center py-16">
    <div className="w-10 h-10 rounded-full border-[3px] border-orange-200 border-t-orange-500 animate-spin" />
  </div>
);

const Err = ({ msg, retry }) => (
  <div className="text-center py-12">
    <div className="text-5xl mb-3">😵</div>
    <p className="text-red-500 text-sm mb-4">{msg}</p>
    {retry && <button onClick={retry} className="px-5 py-2 bg-orange-500 text-white rounded-xl text-sm hover:bg-orange-600 transition">Retry</button>}
  </div>
);

const Empty = ({ t }) => (
  <div className="text-center py-16 text-gray-400">
    <div className="text-5xl mb-3">📭</div>
    <p>{t}</p>
  </div>
);

const Crumb = ({ trail }) => (
  <div className="flex flex-wrap items-center gap-1.5 text-xs mb-5">
    {trail.map((x, i) => (
      <span key={i} className="flex items-center gap-1.5">
        {i > 0 && <span className="text-gray-300">›</span>}
        {x.fn
          ? <button onClick={x.fn} className="text-orange-500 hover:text-orange-600 font-medium">{x.label}</button>
          : <span className="text-gray-800 font-semibold">{x.label}</span>}
      </span>
    ))}
  </div>
);

// ─── PDF Modal ────────────────────────────────────────────────────────────────

function PdfModal({ pdf, onClose }) {
  const { url, name, topic } = pdf;
  const fname = encodeURIComponent(name || 'document.pdf');
  const viewUrl = `/api/pdfproxy?url=${encodeURIComponent(url)}&filename=${fname}`;
  const dlUrl = `/api/pdfproxy?url=${encodeURIComponent(url)}&filename=${fname}&dl=1`;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span>📄</span>
            <p className="font-semibold text-gray-800 text-sm truncate">{topic || name}</p>
          </div>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            <a href={dlUrl} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-lg font-medium transition">⬇ Download</a>
            <a href={url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg font-medium transition">🔗 Open</a>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg text-2xl leading-none transition-colors">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <iframe src={viewUrl} className="w-full h-full border-0" title={topic} />
        </div>
      </div>
    </div>
  );
}

// ─── Note Item ────────────────────────────────────────────────────────────────

function AutoOpen({ onMount }) {
  useEffect(() => { onMount(); }, [onMount]);
  return null;
}

function NoteItem({ item, batchId, subjectId, tabColor }) {
  const [pdfs, setPdfs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selPdf, setSelPdf] = useState(null);

  const staticPdfs = extractPdfs(item);

  const fetchPdfs = async () => {
    if (pdfs !== null || loading) return;
    setLoading(true);
    try {
      const r = await api(`/api/pdfurl?batchId=${batchId}&subjectId=${encodeURIComponent(subjectId)}&scheduleId=${item._id}`);
      setPdfs(r.pdfs || []);
    } catch (_) {
      setPdfs([]);
    } finally {
      setLoading(false);
    }
  };

  const allPdfs = staticPdfs.length > 0 ? staticPdfs : (pdfs || []);
  const title = item.topic || item.homeworkIds?.[0]?.topic || 'Document';
  const date = item.date ? new Date(item.date).toLocaleDateString('en-IN') : '';

  return (
    <>
      <div
        onClick={staticPdfs.length > 0 ? () => setSelPdf(staticPdfs[0]) : fetchPdfs}
        className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md cursor-pointer transition-all group"
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${tabColor.ic}`}>
          {loading ? <span className="w-4 h-4 rounded-full border-2 border-emerald-300 border-t-emerald-600 animate-spin" /> : '📄'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate group-hover:text-emerald-600 transition-colors">{title}</p>
          <div className="flex gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
            {date && <span>📅 {date}</span>}
            {pdfs !== null && pdfs.length === 0 && <span className="text-red-400">PDF unavailable</span>}
            {allPdfs.length > 1 && <span className="text-emerald-500">{allPdfs.length} files</span>}
          </div>
        </div>
        {allPdfs.length > 0 && (
          <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 font-medium ${tabColor.bd}`}>👁 View</span>
        )}
      </div>

      {pdfs !== null && pdfs.length > 1 && (
        <div className="ml-4 space-y-1 mt-1">
          {pdfs.map((pdf, i) => (
            <div key={i} onClick={() => setSelPdf(pdf)}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-emerald-50 cursor-pointer transition-all group">
              <span className="text-sm">📄</span>
              <p className="text-xs text-gray-700 truncate group-hover:text-emerald-600 flex-1">{pdf.topic || pdf.name}</p>
              <span className="text-xs text-emerald-500">View</span>
            </div>
          ))}
        </div>
      )}

      {pdfs !== null && pdfs.length === 1 && !selPdf && (
        <AutoOpen onMount={() => setSelPdf(pdfs[0])} />
      )}

      {selPdf && <PdfModal pdf={selPdf} onClose={() => setSelPdf(null)} />}
    </>
  );
}

// ─── Content View ─────────────────────────────────────────────────────────────

function ContentView({ batchId, subjectSlug, subjectId, topic, trail }) {
  const router = useRouter();
  const [tab, setTab] = useState('videos');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const topicSlug = topic.slug || topic._id || '';
  const isAllContent = topicSlug === '__all__';

  const load = useCallback(async (t) => {
    setLoading(true); setErr(''); setItems([]);
    try {
      let list = [];
      if (isAllContent) {
        const td = await api(`/api/topics?batchId=${batchId}&subjectSlug=${encodeURIComponent(subjectSlug)}`);
        const allTopics = td?.data || td?.topics || td || [];
        const results = await Promise.allSettled(
          allTopics.slice(0, 20).map(tp =>
            api(`/api/content?batchId=${batchId}&subjectSlug=${encodeURIComponent(subjectSlug)}&topicSlug=${encodeURIComponent(tp.slug || tp._id)}&contentType=${t}`)
              .then(d => {
                const items = d?.data || d?.content || d?.items || d || [];
                return Array.isArray(items) ? items.map(item => ({ ...item, _actualTopicSlug: tp.slug || tp._id })) : [];
              })
              .catch(() => [])
          )
        );
        list = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      } else {
        const d = await api(`/api/content?batchId=${batchId}&subjectSlug=${encodeURIComponent(subjectSlug)}&topicSlug=${encodeURIComponent(topicSlug)}&contentType=${t}`);
        list = d?.data || d?.content || d?.items || d || [];
      }
      setItems(Array.isArray(list) ? list : []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [batchId, subjectSlug, topicSlug, isAllContent]);

  useEffect(() => { load(tab); }, [tab, load]);

  const cur = TABS.find(t => t.key === tab);
  const isVideo = tab === 'videos';

  return (
    <div>
      <Crumb trail={[...trail, { label: topic.name || topic.title }]} />

      <div className="flex items-start gap-3 mb-5 p-4 bg-orange-50 rounded-2xl border border-orange-100">
        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0">📖</div>
        <div>
          <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide">Chapter</p>
          <p className="font-bold text-gray-800">{topic.name || topic.title}</p>
          <div className="flex gap-3 mt-1 flex-wrap text-xs text-gray-400">
            {topic.lectureVideos > 0 && <span>🎥 {topic.lectureVideos} lectures</span>}
            {topic.notes > 0 && <span>📄 {topic.notes} notes</span>}
            {topic.exercises > 0 && <span>📝 {topic.exercises} DPP</span>}
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? t.ac + ' shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <Spin />}
      {err && <Err msg={err} retry={() => load(tab)} />}

      {!loading && !err && isVideo && (
        items.length === 0
          ? <Empty t="Is chapter mein videos nahi hain" />
          : <div className="space-y-2">
            {items.map((item, idx) => {
              const vd = item.videoDetails || {};
              const title = item.topic || vd.name || `Video ${idx + 1}`;
              const thumb = vd.image || item.thumbnail;
              const duration = vd.duration || item.duration;
              const date = item.date ? new Date(item.date).toLocaleDateString('en-IN') : '';
              const findKey = vd.findKey || item._id || '';
              const scheduleId = item._id || findKey;
              const actualTopicSlug = item._actualTopicSlug || topicSlug;
              const playerUrl = `/player?video_id=${findKey}&subject_slug=${encodeURIComponent(subjectSlug)}&batch_id=${batchId}&schedule_id=${scheduleId}&subject_id=${encodeURIComponent(subjectId || '')}&topicSlug=${encodeURIComponent(actualTopicSlug)}&title=${encodeURIComponent(title)}`;

              return (
                <div key={item._id || idx}
                  onClick={() => router.push(playerUrl)}
                  className="bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all overflow-hidden cursor-pointer">
                  <div className="flex items-center gap-3 p-3 group">
                    {thumb ? (
                      <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        <img src={thumb} alt={title} loading="lazy" className="w-full h-full object-cover"
                          onError={e => { e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-xl bg-blue-50">🎥</div>'; }} />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 bg-blue-50 text-blue-500">🎥</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600 transition-colors">{title}</p>
                      <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                        {duration && <span>⏱ {duration}</span>}
                        {date && <span>📅 {date}</span>}
                        {item.isFree && <span className="text-green-500 font-medium">FREE</span>}
                      </div>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full flex-shrink-0 font-medium bg-blue-100 text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">▶ Watch</span>
                  </div>
                </div>
              );
            })}
          </div>
      )}

      {!loading && !err && !isVideo && (
        items.length === 0
          ? <Empty t={`Is chapter mein ${tab} nahi hain`} />
          : <div className="space-y-2">
            {items.map((item, idx) => (
              <NoteItem
                key={item._id || idx}
                item={item}
                batchId={batchId}
                subjectId={subjectSlug}
                tabColor={cur}
              />
            ))}
          </div>
      )}
    </div>
  );
}

// ─── Topics View ──────────────────────────────────────────────────────────────

function TopicsView({ batchId, subject, trail }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const [search, setSearch] = useState('');

  const subjectSlug = subject.slug || subject.subjectSlug;

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const d = await api(`/api/topics?batchId=${batchId}&subjectSlug=${encodeURIComponent(subjectSlug)}`);
      const list = d?.data || d?.topics || d || [];
      setTopics(Array.isArray(list) ? list : []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [batchId, subjectSlug]);

  useEffect(() => { load(); }, [load]);

  if (sel) {
    return (
      <ContentView
        batchId={batchId}
        subjectSlug={subjectSlug}
        subjectId={subject._id || subject.subjectId || subjectSlug}
        topic={sel}
        trail={[...trail, { label: subject.subject || subject.name, fn: () => setSel(null) }]}
      />
    );
  }

  const filtered = topics.filter(t => (t.name || '').toLowerCase().includes(search.toLowerCase()));
  const ALL_TOPIC = { _id: '__all__', name: '📋 All Content', slug: '__all__', displayOrder: 0, lectureVideos: '∞', notes: '∞' };

  return (
    <div>
      <Crumb trail={[...trail, { label: subject.subject || subject.name }]} />

      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 shadow-md bg-gray-100">
          {subject.icon
            ? <img src={subject.icon} alt={subject.subject} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
            : <div className="w-full h-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-2xl">📚</div>
          }
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Subject</p>
          <h2 className="text-xl font-bold text-gray-900">{subject.subject || subject.name}</h2>
          {subject.lectureCount > 0 && <p className="text-xs text-gray-400">{subject.lectureCount} lectures</p>}
        </div>
      </div>

      {topics.length > 5 && (
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Chapter search karo..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-gray-50" />
        </div>
      )}

      {loading && <Spin />}
      {err && <Err msg={err} retry={load} />}
      {!loading && !err && filtered.length === 0 && <Empty t="Koi chapter nahi mila" />}

      {!loading && !err && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div onClick={() => setSel(ALL_TOPIC)}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl text-white cursor-pointer hover:shadow-lg transition-all col-span-full">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              📋
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-snug">All Content</p>
              <p className="text-xs text-white/70 mt-0.5">Saare topics ka content ek jagah</p>
            </div>
            <span className="text-white/70 text-xl">›</span>
          </div>

          {filtered.map((topic, idx) => (
            <div key={topic._id || idx} onClick={() => setSel(topic)}
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-orange-300 hover:shadow-md cursor-pointer transition-all group">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                {topic.displayOrder || idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 group-hover:text-orange-600 transition-colors leading-snug">{topic.name}</p>
                <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                  {topic.lectureVideos > 0 && <span>🎥 {topic.lectureVideos}</span>}
                  {topic.notes > 0 && <span>📄 {topic.notes}</span>}
                  {topic.exercises > 0 && <span>📝 {topic.exercises}</span>}
                </div>
              </div>
              <span className="text-gray-300 group-hover:text-orange-400 transition-colors text-xl">›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Live Classes Section (with tabs) ────────────────────────────────────────

const STATUS_CONFIG = {
  live:      { bg: 'bg-red-50 border-red-200',   labelCls: 'bg-red-500 text-white',          label: '🔴 LIVE',      dot: 'bg-red-500 animate-pulse' },
  upcoming:  { bg: 'bg-blue-50 border-blue-200', labelCls: 'bg-blue-500 text-white',          label: '⏰ UPCOMING',  dot: 'bg-blue-400' },
  ended:     { bg: 'bg-gray-50 border-gray-200', labelCls: 'bg-gray-500 text-white',          label: '▶ RECORDED',  dot: 'bg-green-500' },
  cancelled: { bg: 'bg-gray-50 border-gray-100', labelCls: 'bg-gray-300 text-gray-500',       label: '✕ CANCELLED', dot: 'bg-gray-300' },
};

function getClassStatus(cls) {
  const topic = (cls.topic || '').toLowerCase();
  if (topic.includes('cancelled')) return 'cancelled';
  
  // Check time-based status first
  const now = new Date();
  const startTime = cls.startTime ? new Date(cls.startTime) : null;
  const endTime = cls.endTime ? new Date(cls.endTime) : null;
  
  if (startTime) {
    // If class has started and not ended yet, it's LIVE
    if (now >= startTime) {
      // Check if it has ended
      if (endTime && now > endTime) {
        return 'ended';
      }
      // If no end time, assume 2 hour duration
      const estimatedEnd = new Date(startTime.getTime() + (2 * 60 * 60 * 1000));
      if (now > estimatedEnd) {
        return 'ended';
      }
      // Class is currently live
      return 'live';
    } else {
      // Class hasn't started yet
      return 'upcoming';
    }
  }
  
  // Fallback to tag/status if no time info
  if (cls.tag === 'live'     || cls.status === 'live')     return 'live';
  if (cls.tag === 'ended'    || cls.status === 'ended'    || topic.includes('recorded')) return 'ended';
  if (cls.tag === 'upcoming' || cls.status === 'upcoming') return 'upcoming';
  return 'upcoming';
}

function LiveClassCard({ cls, batchId, router, currentStatus }) {
  const status   = currentStatus || getClassStatus(cls);
  const cancelled = status === 'cancelled';
  const sc       = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  const findKey  = cls.videoDetails?.findKey || cls.videoId || cls._id || '';
  const subjectId = cls.subjectId?._id || cls.subjectId || '';
  const scheduleId = cls._id || '';
  const teacher  = cls.teachers?.[0]?.name || cls.teacher || '';
  const thumb    = cls.videoDetails?.image || cls.thumbnail || cls.image || '';
  const subject  = cls.subjectId?.name || cls.subject || '';
  const time     = cls.startTime
    ? new Date(cls.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '';
  
  // Use the batch ID from the class if not provided (for multi-batch view)
  const actualBatchId = batchId || cls._batchId || cls.batchId;
  const batchName = cls._batchName || '';

  const handleClick = () => {
    if (cancelled) return;
    if (status === 'live') {
      // Live classes go to live.js
      router.push(`/live?video_id=${findKey}&batch_id=${actualBatchId}&schedule_id=${scheduleId}&subject_id=${encodeURIComponent(subjectId)}&title=${encodeURIComponent(cls.topic || 'Class')}`);
    } else {
      // Recorded classes go to player.js
      router.push(`/player?video_id=${findKey}&batch_id=${actualBatchId}&schedule_id=${scheduleId}&subject_id=${encodeURIComponent(subjectId)}&title=${encodeURIComponent(cls.topic || 'Class')}`);
    }
  };

  return (
    <div onClick={handleClick}
      className={`flex-shrink-0 w-[280px] rounded-2xl border overflow-hidden transition-all ${cancelled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg active:scale-[0.98]'} bg-white`}>
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-gray-200">
        {thumb ? (
          <img src={thumb} alt={cls.topic} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-3xl">📺</span>
            </div>
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${sc.labelCls} shadow-lg`}>
            {sc.label}
          </span>
        </div>

        {/* Live indicator */}
        {status === 'live' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 rounded-full px-2 py-1 shadow-lg">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white text-[10px] font-bold">LIVE</span>
          </div>
        )}

        {/* Batch Logo Overlay */}
        <div className="absolute bottom-2 left-2">
          <div className="w-10 h-10 rounded-lg bg-white shadow-md flex items-center justify-center overflow-hidden">
            <img 
              src="https://i.ibb.co/m53b0YKH/file-00000000d664720997f7f5165cbd5131.png" 
              alt="Study Portal"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<span class="text-lg">⚡</span>';
              }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Batch Name */}
        {batchName && (
          <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wide mb-1 truncate">
            {batchName}
          </p>
        )}

        {/* Title */}
        <h3 className="font-bold text-sm text-gray-900 line-clamp-2 leading-snug mb-2 min-h-[2.5rem]">
          {cls.topic || 'Class'}
        </h3>

        {/* Subject */}
        {subject && (
          <p className="text-xs text-gray-600 mb-2 truncate">
            📚 {subject}
          </p>
        )}

        {/* Time */}
        {time && (
          <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
            <span>🕐</span> {time}
          </p>
        )}

        {/* Action Button */}
        {!cancelled && (
          <button className={`w-full py-2 rounded-lg font-semibold text-sm transition-all ${
            status === 'live' 
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg' 
              : 'bg-indigo-500 hover:bg-indigo-600 text-white'
          }`}>
            {status === 'live' ? '▶ Watch Live' : '▶ Play Now'}
          </button>
        )}
      </div>
    </div>
  );
}

function LiveClassesSection({ liveClasses, batchId, router }) {
  const [activeTab, setActiveTab] = useState('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Auto-refresh every 30 seconds to update live status
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      setLastRefresh(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  const manualRefresh = () => {
    setCurrentTime(new Date());
    setLastRefresh(new Date());
  };

  // Recalculate status based on current time
  const getUpdatedStatus = (cls) => {
    const topic = (cls.topic || '').toLowerCase();
    if (topic.includes('cancelled')) return 'cancelled';
    
    const now = currentTime;
    const startTime = cls.startTime ? new Date(cls.startTime) : null;
    const endTime = cls.endTime ? new Date(cls.endTime) : null;
    
    if (startTime) {
      if (now >= startTime) {
        if (endTime && now > endTime) {
          return 'ended';
        }
        const estimatedEnd = new Date(startTime.getTime() + (2 * 60 * 60 * 1000));
        if (now > estimatedEnd) {
          return 'ended';
        }
        return 'live';
      } else {
        // Class hasn't started yet - don't show it
        return 'upcoming';
      }
    }
    
    if (cls.tag === 'live' || cls.status === 'live') return 'live';
    if (cls.tag === 'ended' || cls.status === 'ended' || topic.includes('recorded')) return 'ended';
    if (cls.tag === 'upcoming' || cls.status === 'upcoming') return 'upcoming';
    return 'upcoming';
  };

  // Only show classes that have started (live or ended), not upcoming
  const allStarted = liveClasses.filter(c => {
    const status = getUpdatedStatus(c);
    return status !== 'cancelled' && status !== 'upcoming';
  });
  
  const live     = allStarted.filter(c => getUpdatedStatus(c) === 'live');
  const recorded = allStarted.filter(c => getUpdatedStatus(c) === 'ended');

  const tabs = [
    { key: 'all',      label: 'All',       count: allStarted.length, color: 'bg-gray-800 text-white', inactive: 'text-gray-600' },
    { key: 'live',     label: '🔴 Live',   count: live.length,     color: 'bg-red-500 text-white',  inactive: 'text-red-500' },
    { key: 'recorded', label: '▶ Recorded', count: recorded.length, color: 'bg-gray-500 text-white', inactive: 'text-gray-500' },
  ];

  const filtered = activeTab === 'all'
    ? allStarted
    : activeTab === 'live'     ? live
    : recorded;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 px-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse inline-block" />
            Today's Classes
          </p>
          <button 
            onClick={manualRefresh}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh status"
          >
            🔄
          </button>
        </div>
        {live.length > 0 && (
          <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
            {live.length} LIVE
          </span>
        )}
      </div>

      {/* Tabs */}
      {allStarted.length > 0 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide px-4">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                activeTab === tab.key ? tab.color + ' shadow-sm' : 'bg-gray-100 ' + tab.inactive
              }`}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.key ? 'bg-white/25' : 'bg-gray-200 text-gray-600'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {allStarted.length === 0 ? (
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center mx-4">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-gray-500 text-sm">No live classes right now</p>
          <p className="text-gray-400 text-xs mt-1">Classes will appear here when they start</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center mx-4">
          <p className="text-gray-400 text-sm">No {activeTab} classes</p>
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 px-4 pb-2">
            {filtered.map((cls, idx) => (
              <LiveClassCard key={cls._id || idx} cls={cls} batchId={batchId} router={router} currentStatus={getUpdatedStatus(cls)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subjects View ────────────────────────────────────────────────────────────

function SubjectsView({ batchId, batch, subjects, trail, liveClasses = [] }) {
  const router = useRouter();
  const [sel, setSel] = useState(null);

  const batchTitle = batch?.batchName || batch?.name || `Batch ${batchId}`;
  const batchThumb = batch?.batchImage || batch?.image || batch?.thumbnail;

  if (sel) {
    return (
      <TopicsView
        batchId={batchId}
        subject={sel}
        trail={[...trail, { label: batchTitle, fn: () => setSel(null) }]}
      />
    );
  }

  return (
    <div>
      <Crumb trail={[...trail, { label: batchTitle }]} />

      {/* Batch header */}
      <div className="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-r from-orange-500 to-red-600 p-5 text-white shadow-lg min-h-[100px]">
        {batchThumb && (
          <img src={batchThumb} alt={batchTitle}
            className="absolute inset-0 w-full h-full object-cover opacity-20"
            onError={e => { e.target.style.display = 'none'; }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/50 to-red-700/50" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-200 mb-1">Batch</p>
          <h2 className="text-2xl font-bold leading-tight">{batchTitle}</h2>
          <p className="text-xs text-orange-200 mt-1 font-mono opacity-60">ID: {batchId}</p>
        </div>
      </div>

      {/* Today's Live Classes */}
      <LiveClassesSection liveClasses={liveClasses} batchId={batchId} router={router} />

      <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
        📚 Subjects ({subjects.length})
      </p>

      {subjects.length === 0
        ? <Empty t="Is batch mein koi subject nahi mila" />
        : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {subjects.map((sub, idx) => (
              <div key={sub._id || idx} onClick={() => setSel(sub)}
                className={`bg-gradient-to-br ${GRADIENTS[idx % GRADIENTS.length]} p-5 rounded-2xl text-white cursor-pointer hover:scale-[1.04] hover:shadow-xl transition-all shadow-md`}>
                {sub.icon
                  ? <img src={sub.icon} alt={sub.subject} loading="lazy" className="w-10 h-10 rounded-lg object-cover mb-3 bg-white/20" onError={e => { e.target.style.display = 'none'; }} />
                  : <div className="text-3xl mb-3">📚</div>
                }
                <p className="font-bold text-sm leading-tight">{sub.subject || sub.name}</p>
                {sub.lectureCount > 0 && <p className="text-xs mt-1 text-white/70">{sub.lectureCount} lectures</p>}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ─── Featured Batches ─────────────────────────────────────────────────────────

// ─── Featured Mission Topper Batches ──────────────────────────────────────────
const FEATURED_BATCHES = [
  {
    batchId: 'MT-JEE-2025',
    batchName: '⚠️ URGENT: Fake Website Alert - Join Telegram NOW!',
    batchImage: 'https://i.ibb.co/m53b0YKH/file-00000000d664720997f7f5165cbd5131.png',
    description: '🚨 Jaldi Telegram join karo varna fake website tumhara data le legi! Official channel pe jao FAST!',
    isFeatured: true,
    telegramLink: 'https://t.me/Study_Portalz'
  },
  {
    batchId: 'MT-NEET-2025',
    batchName: '⚠️ DANGER: Tumhara Data Khatre Me Hai - Telegram Join Karo!',
    batchImage: 'https://i.ibb.co/m53b0YKH/file-00000000d664720997f7f5165cbd5131.png',
    description: '🚨 Fake website se bacho! Apna data safe rakho - Study Portal Telegram channel abhi join karo!',
    isFeatured: true,
    telegramLink: 'https://t.me/Study_Portalz'
  }
];

function BatchesGrid({ onSelect }) {
  const router = useRouter();
  const [batches, setBatches] = useState([]);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [allLiveClasses, setAllLiveClasses] = useState([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [enrolledBatches, setEnrolledBatches] = useState([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(15);

  // Load enrolled batches from localStorage
  useEffect(() => {
    const enrolled = JSON.parse(localStorage.getItem('enrolledBatches') || '[]');
    setEnrolledBatches(enrolled);
  }, []);

  const toggleEnroll = (batchId, e) => {
    e.stopPropagation();
    const enrolled = JSON.parse(localStorage.getItem('enrolledBatches') || '[]');
    const isEnrolled = enrolled.includes(batchId);
    
    if (isEnrolled) {
      const updated = enrolled.filter(id => id !== batchId);
      localStorage.setItem('enrolledBatches', JSON.stringify(updated));
      setEnrolledBatches(updated);
    } else {
      const updated = [...enrolled, batchId];
      localStorage.setItem('enrolledBatches', JSON.stringify(updated));
      setEnrolledBatches(updated);
    }
  };

  useEffect(() => {
    async function loadBatches() {
      setLoadingLive(true);
      
      // Check cache first
      const cached = localStorage.getItem('pwBatchesCache');
      const cacheTimestamp = localStorage.getItem('pwBatchesCacheTimestamp');
      const now = Date.now();
      const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cached && cacheTimestamp && (now - parseInt(cacheTimestamp)) < CACHE_DURATION) {
        try {
          const cachedBatches = JSON.parse(cached);
          setBatches(cachedBatches);
          console.log('📦 Loaded batches from cache:', cachedBatches.length);
          setLoadingLive(false);
          return;
        } catch (e) {
          console.error('Error parsing cached batches:', e);
        }
      }
      
      // Check if API is configured
      try {
        const apiUrl = await getApiUrl();
        setApiConfigured(!!apiUrl);
        console.log('🔗 API URL configured:', apiUrl);
        
        // Fetch batches through proxy endpoint (avoids CORS)
        if (apiUrl) {
          try {
            console.log('📡 Fetching batches from proxy...');
            const response = await fetch('/api/proxy/batches');
            console.log('📥 Proxy response status:', response.status);
            
            if (response.ok) {
              const data = await response.json();
              console.log('📦 Received data:', data);
              console.log('📦 Data.data exists:', !!data.data);
              
              if (data.data) {
                // Decrypt if needed
                console.log('🔓 Decrypting data...');
                const decrypted = await decryptData(data.data);
                console.log('🔓 Decryption result:', decrypted.success ? 'Success' : 'Failed');
                console.log('🔓 Decrypted data type:', typeof decrypted.data);
                console.log('🔓 Decrypted data is array:', Array.isArray(decrypted.data));
                console.log('🔓 Decrypted data keys:', decrypted.data ? Object.keys(decrypted.data) : 'null');
                console.log('🔓 Decrypted data sample:', decrypted.data);
                
                if (decrypted.success && decrypted.data) {
                  // Check if data is directly an array or nested in an object
                  let allBatches = Array.isArray(decrypted.data) 
                    ? decrypted.data 
                    : (decrypted.data.data || decrypted.data.batches || []);
                  
                  console.log('📚 Extracted batches array:', Array.isArray(allBatches));
                  console.log('📚 Total batches before filter:', allBatches.length);
                  
                  if (!Array.isArray(allBatches) || allBatches.length === 0) {
                    console.error('❌ No batches array found in decrypted data');
                    return;
                  }
                  
                  // Filter out unwanted batches
                  const excludeKeywords = ['nsat', 'pw-sat', 'summer camp', 'test series'];
                  allBatches = allBatches.filter(batch => {
                    const name = (batch.batchName || '').toLowerCase();
                    return !excludeKeywords.some(keyword => name.includes(keyword));
                  });
                  console.log('📚 Total batches after filter:', allBatches.length);
                  
                  // Apply edits from Firebase (only for editing batch names/images, not adding batches)
                  const batchesWithEdits = await Promise.all(
                    allBatches.map(async (batch) => {
                      const editedBatch = await getBatchWithEdits(batch);
                      return editedBatch;
                    })
                  );
                  
                  // Cache the results
                  localStorage.setItem('pwBatchesCache', JSON.stringify(batchesWithEdits));
                  localStorage.setItem('pwBatchesCacheTimestamp', now.toString());
                  
                  setBatches(batchesWithEdits);
                  console.log('✅ Loaded batches from API:', batchesWithEdits.length);
                } else {
                  console.error('❌ Decryption failed or data is null');
                }
              } else {
                console.error('❌ No data.data in response');
              }
            } else {
              console.error('❌ Proxy response not OK:', response.status);
            }
          } catch (e) {
            console.error('❌ Error fetching batches from API:', e);
          }
        } else {
          console.error('❌ API URL not configured');
        }
      } catch (e) {
        console.error('❌ Error loading API URL:', e);
      }
      
      setLoadingLive(false);
    }
    
    loadBatches();
  }, []);

  const enrolledBatchList = batches.filter(b => enrolledBatches.includes(b.batchId));
  const [currentView, setCurrentView] = useState('batches'); // batches, todaysStudy, myBatches

  // Filter batches based on search query
  const filteredBatches = batches.filter(batch => 
    (batch.batchName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Merge featured batches at the top (only if not searching)
  const allBatchesToDisplay = searchQuery 
    ? filteredBatches 
    : [...FEATURED_BATCHES, ...filteredBatches];
  
  // Show only visibleCount batches unless searching
  const displayedBatches = searchQuery ? filteredBatches : allBatchesToDisplay.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-white">
      {/* Sidebar */}
      {showSidebar && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowSidebar(false)}>
          <div className="w-72 h-full bg-black text-white p-6 border-r border-gray-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-8">
              <img src="https://i.ibb.co/m53b0YKH/file-00000000d664720997f7f5165cbd5131.png" alt="Mission-Pw" className="w-12 h-12 rounded-xl object-cover" />
              <span className="text-xl font-bold">Mission-Pw</span>
            </div>
            <div className="space-y-2">
              <button 
                onClick={() => { setCurrentView('batches'); setShowSidebar(false); }}
                className="flex items-center gap-3 w-full text-left py-3 hover:bg-white/10 rounded-lg px-3 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
                <span>Batches</span>
              </button>
              <button 
                onClick={() => { setCurrentView('myBatches'); setShowSidebar(false); }}
                className="flex items-center gap-3 w-full text-left py-3 hover:bg-white/10 rounded-lg px-3 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>My Batches</span>
              </button>
              <button
                onClick={() => { router.push('/donate'); setShowSidebar(false); }}
                className="flex items-center gap-3 w-full text-left py-3 hover:bg-white/10 rounded-lg px-3 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
                <span>Donate Batch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-black border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setShowSidebar(true)} className="p-2 hover:bg-gray-800 rounded-lg transition text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">Batches</h1>
          <button className="p-2 hover:bg-gray-800 rounded-lg transition text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>




      {/* My Batches View */}
      {currentView === 'myBatches' && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">My Batches</h2>
          {enrolledBatchList.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-gray-600 font-medium mb-4">No enrolled batches yet!</p>
              <button 
                onClick={() => setCurrentView('batches')}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                Browse Batches
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
              {enrolledBatchList.map((batch) => {
                const thumbnail = batch.batchImage || batch.previewImage || batch.thumbnail;
                
                return (
                  <div key={batch.batchId}
                    className="group relative bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100">
                    
                    {/* Thumbnail */}
                    {thumbnail ? (
                      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                        <img 
                          src={thumbnail} 
                          alt={batch.batchName}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        
                        {/* Mission Topper Logo */}
                        <div className="absolute top-3 right-3 z-10">
                          <div className="bg-white rounded-lg shadow-lg p-1.5 flex items-center gap-1.5">
                            <img 
                              src="https://i.ibb.co/m53b0YKH/file-00000000d664720997f7f5165cbd5131.png" 
                              alt="Study Portal"
                              className="w-6 h-6 object-contain"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                            <span className="text-[10px] font-bold text-gray-800">SP</span>
                          </div>
                        </div>

                        {/* Warning Banner - Bottom */}
                        <a
                          href="https://pw-missiontopper.vercel.app"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-red-600 to-red-700 text-white py-1.5 px-2 flex items-center justify-center gap-1.5 hover:from-red-700 hover:to-red-800 transition-all cursor-pointer z-10"
                        >
                          <span className="text-[10px] font-bold animate-pulse">⚠️</span>
                          <span className="text-[10px] font-bold text-center leading-tight">
                            Fake site? Official pe jao
                          </span>
                          <span className="text-[10px]">→</span>
                        </a>
                      </div>
                    ) : (
                      <div className="relative h-40 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-6xl">📚</span>
                        
                        {/* Mission Topper Logo */}
                        <div className="absolute top-3 right-3 z-10">
                          <div className="bg-white rounded-lg shadow-lg p-1.5 flex items-center gap-1.5">
                            <img 
                              src="https://i.ibb.co/m53b0YKH/file-00000000d664720997f7f5165cbd5131.png" 
                              alt="Study Portal"
                              className="w-6 h-6 object-contain"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                            <span className="text-[10px] font-bold text-gray-800">MT</span>
                          </div>
                        </div>

                        {/* Warning Banner - Bottom */}
                        <a
                          href="https://pw-missiontopper.vercel.app"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-red-600 to-red-700 text-white py-1.5 px-2 flex items-center justify-center gap-1.5 hover:from-red-700 hover:to-red-800 transition-all cursor-pointer z-10"
                        >
                          <span className="text-[10px] font-bold animate-pulse">⚠️</span>
                          <span className="text-[10px] font-bold text-center leading-tight">
                            Fake site? Official pe jao
                          </span>
                          <span className="text-[10px]">→</span>
                        </a>
                      </div>
                    )}
                    
                    {/* Enrolled Badge */}
                    <div className="absolute top-3 left-3 z-20 bg-green-500 text-white text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 shadow-lg">
                      <span>✓</span> Enrolled
                    </div>
                    
                    {/* Content */}
                    <div className="p-4">
                      <p className="font-bold text-gray-900 text-base leading-snug line-clamp-2 mb-3">
                        {batch.batchName}
                      </p>
                      
                      {/* Study Button */}
                      <button
                        onClick={() => onSelect(batch.batchId, batch)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2 group/btn mb-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span>Study</span>
                        <span className="transform group-hover/btn:translate-x-1 transition-transform">→</span>
                      </button>
                      
                      {/* Unenroll Button */}
                      <button
                        onClick={(e) => toggleEnroll(batch.batchId, e)}
                        className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                      >
                        <span>✕</span>
                        <span>Unenroll</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* All Batches View */}
      {currentView === 'batches' && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Warning Banners */}
          <BatchWarningBanner />
          
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(15); }}
                placeholder="Search batches..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent shadow-sm"
              />
            </div>
          </div>
          
          {loadingLive ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 rounded-full border-[3px] border-indigo-200 border-t-indigo-500 animate-spin" />
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-gray-600 font-medium mb-2">
                {searchQuery ? 'No batches found' : 'No batches available'}
              </p>
              <p className="text-gray-400 text-sm">
                {searchQuery ? 'Try a different search term' : 'Batches will appear here once API is configured'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayedBatches.map((batch, idx) => {
                  const thumbnail = batch.batchImage || batch.previewImage || batch.thumbnail;
                  const isEnrolled = enrolledBatches.includes(batch.batchId);
                  const isTrending = idx < 3 && !batch.isFeatured;
                  const isFeatured = batch.isFeatured;
                  
                  return (
                    <div key={batch.batchId}
                      className={`group bg-white rounded-2xl overflow-hidden border-2 hover:shadow-xl transition-all duration-300 flex flex-col ${
                        isFeatured ? 'border-yellow-400 shadow-lg shadow-yellow-200' : 'border-gray-200'
                      }`}>
                      
                      {/* Thumbnail with 16:9 aspect ratio */}
                      <div className="relative">
                        <div className="aspect-[16/9] w-full bg-gray-100 relative overflow-hidden">
                          {thumbnail ? (
                            <img 
                              src={thumbnail} 
                              alt={batch.batchName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                              <span className="text-6xl">📚</span>
                            </div>
                          )}
                          
                          {/* Featured Badge Overlay */}
                          {isFeatured && (
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-orange-400/20 to-red-400/20" />
                          )}
                        </div>

                        {/* Mission Topper Logo - Top Left */}
                        <div className="absolute top-3 left-3 z-10">
                          <div className={`rounded-lg shadow-lg p-2 flex items-center gap-2 ${
                            isFeatured ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-white'
                          }`}>
                            <img 
                              src="https://i.ibb.co/m53b0YKH/file-00000000d664720997f7f5165cbd5131.png" 
                              alt="Study Portal"
                              className="w-8 h-8 object-contain"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = '<span class="text-lg">⚡</span>';
                              }}
                            />
                            <span className={`text-xs font-bold ${isFeatured ? 'text-white' : 'text-gray-800'}`}>
                              Study Portal 
                            </span>
                          </div>
                        </div>

                        {/* Featured Star Badge - Top Right */}
                        {isFeatured && (
                          <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg animate-pulse">
                            <span>⭐</span>
                            <span>FEATURED</span>
                          </div>
                        )}

                        {/* Trending Badge - Top Right (for non-featured) */}
                        {isTrending && !isFeatured && (
                          <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"/>
                            </svg>
                            <span>Trending</span>
                          </div>
                        )}

                        {/* Warning Banner - Bottom - Clickable */}
                        <a
                          href="https://pw-missiontopper.vercel.app"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute bottom-0 left-0 right-0 text-white py-2 px-3 flex items-center justify-center gap-2 transition-all cursor-pointer z-10 ${
                            isFeatured 
                              ? 'bg-gradient-to-r from-red-600 via-red-700 to-orange-600 hover:from-red-700 hover:via-red-800 hover:to-orange-700' 
                              : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                          }`}
                        >
                          <span className="text-xs font-bold animate-pulse">⚠️</span>
                          <span className="text-xs font-bold text-center leading-tight">
                            Fake website se bacho! Official site pe jao
                          </span>
                          <span className="text-xs">→</span>
                        </a>
                      </div>
                      
                      {/* Content */}
                      <div className="p-4 flex-grow flex flex-col">
                        {/* Featured Description */}
                        {isFeatured && batch.description && (
                          <div className="mb-2 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-2">
                            <p className="text-xs text-gray-700 leading-relaxed">{batch.description}</p>
                          </div>
                        )}
                        
                        <h3 className="text-base font-bold leading-tight mb-3 line-clamp-2 text-gray-900 group-hover:text-indigo-600 transition-colors min-h-[3rem]">
                          {batch.batchName}
                        </h3>
                        
                        <div className="mt-auto pt-3 flex gap-2">
                          {isFeatured && batch.telegramLink ? (
                            // Featured batch - Telegram button
                            <a
                              href={batch.telegramLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold transition-all py-2.5 rounded-lg flex items-center justify-center gap-2"
                            >
                              <span className="text-lg">📢</span>
                              <span>Join Telegram</span>
                            </a>
                          ) : (
                            // Regular batch - Study button
                            <button
                              onClick={() => onSelect(batch.batchId, batch)}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all py-2.5 rounded-lg flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Study</span>
                            </button>
                          )}
                          
                          {!isFeatured && (
                            isEnrolled ? (
                              <button
                                onClick={(e) => toggleEnroll(batch.batchId, e)}
                                className="flex-1 border-2 border-red-200 text-red-500 hover:bg-red-50 transition-all py-2.5 rounded-lg flex items-center justify-center gap-2 font-semibold"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>Unenroll</span>
                              </button>
                            ) : (
                              <button
                                onClick={(e) => toggleEnroll(batch.batchId, e)}
                                className="flex-1 border-2 border-amber-300 text-amber-600 hover:bg-amber-50 transition-all py-2.5 rounded-lg flex items-center justify-center gap-2 font-semibold"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>Enroll</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button */}
              {!searchQuery && visibleCount < allBatchesToDisplay.length && (
                <div className="flex justify-center mt-10">
                  <button
                    onClick={() => setVisibleCount(v => v + 15)}
                    className="px-10 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-full text-base flex items-center gap-3 shadow-lg hover:shadow-indigo-500/30 transition-all"
                  >
                    Load More Batches
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState({ screen: 'batches' });
  const [loadingBatch, setLoadingBatch] = useState(false);

  const goHome = () => {
    setView({ screen: 'batches' });
    router.replace('/', undefined, { shallow: true });
  };

  // Handle deep-link from /batch/[batchId] when a subject is clicked
  useEffect(() => {
    const { batchId, batchName } = router.query;
    if (!batchId) return;
    if (view.screen === 'subjects') return; // already loaded

    setLoadingBatch(true);
    const fakeBatch = { batchId, batchName: batchName ? decodeURIComponent(batchName) : batchId };

    Promise.all([
      api(`/api/batchdetails?batchId=${batchId}`).catch(() => ({})),
      api(`/api/live?batchId=${batchId}`).catch(() => []),
    ]).then(([d, live]) => {
      const subjects = d?.data?.subjects || d?.subjects || [];
      const arr = live?.data || live || [];
      setView({ screen: 'subjects', batchId, batch: fakeBatch, subjects, liveClasses: Array.isArray(arr) ? arr : [] });
    }).finally(() => setLoadingBatch(false));
  }, [router.query]); // eslint-disable-line

  const handleBatchSelect = (batchId, batch) => {
    const name = encodeURIComponent(batch?.batchName || batch?.name || '');
    router.push(`/batch/${batchId}?name=${name}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Telegram Popup */}
      <TelegramPopup />
      
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={goHome} className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center text-white font-bold shadow hover:scale-105 transition-transform">
            ⚡
          </button>
          <span className="font-bold text-gray-900">Physics Wallah</span>
        </div>
      </nav>

      {loadingBatch && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full border-[3px] border-orange-200 border-t-orange-500 animate-spin" />
            <p className="text-gray-700 font-semibold">Batch load ho raha hai...</p>
          </div>
        </div>
      )}

      <main className="min-h-screen bg-white">
        {view.screen === 'batches' && <BatchesGrid onSelect={handleBatchSelect} />}
        {view.screen === 'subjects' && (
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 min-h-[500px]">
              <SubjectsView
                batchId={view.batchId}
                batch={view.batch}
                subjects={view.subjects}
                liveClasses={view.liveClasses || []}
                trail={[{ label: '⚡ PW', fn: goHome }]}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
