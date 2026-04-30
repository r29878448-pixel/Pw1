import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { decryptData } from '@/lib/decryptBrowser';

// ─── AES-CBC Decrypt ──────────────────────────────────────────────────────────
function hexToBuffer(hex) {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.substr(i, 2), 16);
  return b.buffer;
}

async function aesDecrypt(data, keyHex) {
  const key = await crypto.subtle.importKey('raw', hexToBuffer(keyHex), { name: 'AES-CBC' }, false, ['decrypt']);
  const iv = new Uint8Array(16);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, data));
}

// ─── Download Page ────────────────────────────────────────────────────────────
function DownloadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const videoId    = searchParams.get('video_id');
  const batchId    = searchParams.get('batch_id');
  const subjectId  = searchParams.get('subject_id');
  const subjectSlug = searchParams.get('subject_slug');
  const title      = searchParams.get('title') ? decodeURIComponent(searchParams.get('title')) : 'video';

  // Internal state - not shown to user
  const [masterUrl, setMasterUrl]   = useState('');
  const [queryStr, setQueryStr]     = useState('');
  const [keyHex, setKeyHex]         = useState('');

  const [qualities, setQualities]   = useState([]);
  const [selQuality, setSelQuality] = useState(null);
  const [segments, setSegments]     = useState([]);
  const [estSize, setEstSize]       = useState(0);

  const [phase, setPhase]           = useState('init'); // init|ready|downloading|done|error
  const [progress, setProgress]     = useState(0);
  const [statusMsg, setStatusMsg]   = useState('Ready');
  const [downloaded, setDownloaded] = useState(0);
  const [logs, setLogs]             = useState([]);
  const [paused, setPaused]         = useState(false);

  const stopRef  = useRef(false);
  const pauseRef = useRef(false);
  const logRef   = useRef(null);

  const log = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-100), { msg, type, time }]);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Build segment/quality URL - same logic as reference: override search with queryStr
  const buildUrl = useCallback((path, base, qs) => {
    try {
      const u = new URL(path, base);
      if (qs) u.search = qs; // override with auth tokens
      return u.href;
    } catch {
      return path;
    }
  }, []);

  // ── Auto-init on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoId || !batchId) return;
    init();
  }, [videoId, batchId]); // eslint-disable-line

  const init = async () => {
    log('Fetching video URL...', 'info');
    setPhase('init');

    try {
      // Step 1: Get video URL via proxy endpoints
      let videoUrl = null;
      const endpoints = [
        `/api/proxy/get-url?batchId=${batchId}&childId=${videoId}&subjectId=${subjectId}`,
        `/api/proxy/video?batchId=${batchId}&subjectId=${subjectSlug}&childId=${videoId}`,
        `/api/proxy/videoplay?batchId=${batchId}&childId=${videoId}&subjectId=${subjectId}`,
        `/api/proxy/get-urls?batchId=${batchId}&childId=${videoId}&subjectId=${subjectId}`,
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.data && typeof data.data === 'string') {
            const dec = await decryptData(data.data);
            if (dec.success && dec.data?.url) {
              videoUrl = dec.data.signedUrl ? dec.data.url + dec.data.signedUrl : dec.data.url;
              break;
            }
          }
          if (data.success && Array.isArray(data.data) && data.data[0]?.url) {
            if (data.data[0].type === 'youtube') continue;
            videoUrl = data.data[0].url;
            break;
          }
        } catch (_) {}
      }

      if (!videoUrl) { log('Could not fetch video URL', 'error'); setPhase('error'); return; }
      log('✓ Video URL fetched', 'success');

      // Step 2: Parse URL - separate base from query string
      let base = videoUrl, qs = '';
      try {
        const u = new URL(videoUrl);
        base = u.origin + u.pathname;
        qs = u.search; // e.g. "?URLPrefix=...&Signature=..."
      } catch (_) {
        const idx = videoUrl.indexOf('?');
        if (idx !== -1) { base = videoUrl.slice(0, idx); qs = videoUrl.slice(idx); }
      }

      // Ensure we use .m3u8 not .mpd
      if (base.endsWith('.mpd')) base = base.replace(/\.mpd$/i, '.m3u8');
      // If no extension, try adding .m3u8
      if (!base.match(/\.(m3u8|mpd|ts)$/i)) base = base + '.m3u8';

      setMasterUrl(base);
      setQueryStr(qs);

      // Step 3: Get decryption key
      const mpdUrl = base.replace(/\.m3u8$/i, '.mpd') + qs;
      log('Extracting KID...', 'info');
      try {
        const kidRes = await fetch(`/api/proxy/kid?mpdUrl=${encodeURIComponent(mpdUrl)}`);
        if (kidRes.ok) {
          const kidData = await kidRes.json();
          if (kidData.success && kidData.kid) {
            log('✓ KID: ' + kidData.kid, 'success');
            const otpRes = await fetch(`/api/proxy/otp?kid=${kidData.kid}`);
            if (otpRes.ok) {
              const otpData = await otpRes.json();
              if (otpData.success && otpData.key) {
                setKeyHex(otpData.key);
                log('✓ Decryption key fetched', 'success');
              }
            }
          }
        }
      } catch (_) { log('Could not fetch key', 'warning'); }

      // Step 4: Fetch master playlist via proxy
      log('Fetching playlist...', 'info');
      const fullUrl = base + qs;
      const plRes = await fetch(`/api/proxy/hls?url=${encodeURIComponent(fullUrl)}`);
      if (!plRes.ok) throw new Error('Playlist fetch failed: HTTP ' + plRes.status);
      const plText = await plRes.text();

      // Check if response is XML/MPD instead of m3u8
      if (plText.trim().startsWith('<') || plText.includes('<?xml')) {
        // Try with explicit .m3u8 extension
        const m3u8Url = base.replace(/\.[^.]+$/, '.m3u8') + qs;
        log('Got XML response, retrying with .m3u8...', 'warning');
        const retryRes = await fetch(`/api/proxy/hls?url=${encodeURIComponent(m3u8Url)}`);
        if (!retryRes.ok) throw new Error('m3u8 fetch failed: HTTP ' + retryRes.status);
        const retryText = await retryRes.text();
        if (retryText.trim().startsWith('<')) throw new Error('Server returned XML/MPD, not m3u8. This video may not be downloadable.');
        return processPlaylist(retryText, m3u8Url, qs);
      }

      log('✓ Playlist fetched', 'success');
      await processPlaylist(plText, fullUrl, qs);
    } catch (e) {
      log('Error: ' + e.message, 'error');
      setPhase('error');
    }
  };

  const processPlaylist = async (plText, fullUrl, qs) => {
    const lines = plText.split('\n');
    const isMaster = lines.some(l => l.startsWith('#EXT-X-STREAM-INF:'));

    if (isMaster) {
      const qs_list = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
          const rm = lines[i].match(/RESOLUTION=(\d+x\d+)/);
          const height = rm ? rm[1].split('x')[1] + 'p' : 'Unknown';
          const path = lines[i + 1]?.trim();
          if (path && !path.startsWith('<')) qs_list.push({ name: height, url: buildUrl(path, fullUrl, qs), selected: false });
        }
      }
      if (!qs_list.length) throw new Error('No qualities in master playlist');
      qs_list[0].selected = true;
      setQualities(qs_list);
      setSelQuality(qs_list[0]);
      log(`Found ${qs_list.length} quality levels`, 'success');
      setPhase('ready');
    } else {
      log('Media playlist detected, parsing segments...', 'info');
      const segs = parseSegments(lines, fullUrl, qs);
      if (!segs.length) throw new Error('No valid segments found. Video may use a different format.');
      setQualities([{ name: 'Default', url: fullUrl, selected: true }]);
      setSelQuality({ name: 'Default', url: fullUrl });
      setSegments(segs);
      log(`Found ${segs.length} segments`, 'success');
      await estimateSize(segs[0].url);
      setPhase('ready');
    }
  };

  const parseSegments = (lines, baseUrl, qs) => {
    const segs = [];
    let idx = 0;
    lines.forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('<') || t.startsWith('?') || t.includes('<?xml')) return;
      if (!t.match(/\.(ts|aac|mp4|m4s|fmp4)(\?|$)/i) && !t.match(/^[a-zA-Z0-9_\-\/\.]+$/)) return;
      idx++;
      segs.push({ index: idx, name: `seg_${String(idx).padStart(3,'0')}.ts`, url: buildUrl(t, baseUrl, qs) });
    });
    return segs;
  };

  const estimateSize = async (firstSegUrl) => {
    try {
      const r = await fetch(`/api/proxy/hls?url=${encodeURIComponent(firstSegUrl)}`);
      if (r.ok) {
        const size = (await r.arrayBuffer()).byteLength;
        setEstSize(size);
      }
    } catch (_) {}
  };

  const loadSegments = async () => {
    if (!selQuality || segments.length > 0) return;
    log('Loading segments from ' + selQuality.name + '...', 'info');
    try {
      const r = await fetch(`/api/proxy/hls?url=${encodeURIComponent(selQuality.url)}`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const text = await r.text();
      const segs = parseSegments(text.split('\n'), selQuality.url, queryStr);
      if (!segs.length) throw new Error('No segments found');
      setSegments(segs);
      log(`Found ${segs.length} segments`, 'success');
      await estimateSize(segs[0].url);
    } catch (e) {
      log('Error: ' + e.message, 'error');
    }
  };

  const selectQuality = (idx) => {
    const updated = qualities.map((q, i) => ({ ...q, selected: i === idx }));
    setQualities(updated);
    setSelQuality(updated[idx]);
    setSegments([]);
    setEstSize(0);
    log('Selected: ' + updated[idx].name, 'info');
  };

  const startDownload = async () => {
    if (!segments.length) return log('No segments loaded', 'error');
    if (!keyHex.trim() || keyHex.trim().length !== 32) return log('Invalid decryption key (need 32 hex chars)', 'error');

    stopRef.current = false;
    pauseRef.current = false;
    setPhase('downloading');
    setPaused(false);
    setDownloaded(0);
    setProgress(0);

    const buffers = new Array(segments.length);
    let totalBytes = 0;
    let done = 0;

    const CONCURRENCY = 6; // download 6 segments at a time

    const downloadSegment = async (i) => {
      if (stopRef.current) return;
      while (pauseRef.current) {
        await new Promise(r => setTimeout(r, 300));
        if (stopRef.current) return;
      }
      const r = await fetch(`/api/proxy/hls?url=${encodeURIComponent(segments[i].url)}`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const raw = await r.arrayBuffer();
      const dec = await aesDecrypt(raw, keyHex.trim());
      buffers[i] = dec;
      totalBytes += dec.length;
      done++;
      setDownloaded(prev => prev + dec.length);
      setProgress(Math.round((done / segments.length) * 100));
      setStatusMsg(`${done} / ${segments.length} segments downloaded`);
    };

    // Process in parallel batches
    for (let i = 0; i < segments.length; i += CONCURRENCY) {
      if (stopRef.current) { log('Stopped', 'warning'); setPhase('ready'); return; }
      const batch = segments.slice(i, i + CONCURRENCY).map((_, j) => i + j);
      try {
        await Promise.all(batch.map(idx => downloadSegment(idx)));
      } catch (e) {
        log(`✗ Segment failed: ${e.message}`, 'error');
        log('Download paused due to error. Resume or Stop.', 'warning');
        pauseRef.current = true;
        setPaused(true);
        return;
      }
    }

    // Combine
    log('Combining segments...', 'info');
    setStatusMsg('Combining segments into video file...');
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const buf of buffers) { if (buf) { combined.set(buf, offset); offset += buf.length; } }

    const blob = new Blob([combined], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.replace(/[/\\?%*:|"<>]/g, '-')}.mp4`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    log('✓ Download complete!', 'success');
    setPhase('done');
    setProgress(100);
    setStatusMsg('Download Complete!');
  };

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setPaused(pauseRef.current);
    log(pauseRef.current ? 'Paused' : 'Resumed', 'info');
  };

  const isDownloading = phase === 'downloading';
  const isReady = phase === 'ready' || phase === 'done';

  return (
    <>
      <Head><title>Download Video</title></Head>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-black text-white flex items-center h-14 px-4 gap-3">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 className="font-semibold text-base">Video Downloader</h1>
        </header>

        <div className="max-w-2xl mx-auto p-4 space-y-4">

          {/* Init loading */}
          {phase === 'init' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center gap-4">
              <div className="w-10 h-10 rounded-full border-[3px] border-indigo-200 border-t-indigo-500 animate-spin" />
              <p className="text-gray-600 font-medium">Preparing download...</p>
            </div>
          )}

          {/* Error state */}
          {phase === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
              <p className="text-red-600 font-semibold mb-3">Failed to prepare download</p>
              <button onClick={init} className="px-6 py-2 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: '#5a4bda' }}>
                Retry
              </button>
            </div>
          )}

          {/* Action buttons */}
          {(isReady || isDownloading) && (
            <div className="space-y-3">
              {/* Load segments if quality selected but not loaded */}
              {qualities.length > 0 && segments.length === 0 && !isDownloading && (
                <button onClick={loadSegments} className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2" style={{ backgroundColor: '#5a4bda' }}>
                  Load Segments
                </button>
              )}

              {/* Download button */}
              {segments.length > 0 && !isDownloading && (
                <button onClick={startDownload} className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2" style={{ backgroundColor: '#5a4bda' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 13v8m0 0-4-4m4 4 4-4M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284"/>
                  </svg>
                  Download MP4 ({segments.length} segments)
                </button>
              )}

              {/* Pause / Stop */}
              {isDownloading && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={togglePause} className="py-3 rounded-xl font-bold text-sm border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-2">
                    {paused ? (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        Resume
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        Pause
                      </>
                    )}
                  </button>
                  <button onClick={() => { stopRef.current = true; setPaused(false); log('Stopping...', 'warning'); }} className="py-3 rounded-xl font-bold text-sm bg-red-500 hover:bg-red-600 text-white transition flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                    Stop
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Progress bar */}
          {(isDownloading || phase === 'done') && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              {/* Segment download info banner */}
              {isDownloading && progress < 100 && (
                <div className="flex items-start gap-3 mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-indigo-800">Downloading video segments...</p>
                    <p className="text-xs text-indigo-500 mt-0.5">Your video will be ready once all segments are downloaded and merged. Please keep this tab open.</p>
                  </div>
                </div>
              )}

              {/* Done banner */}
              {phase === 'done' && (
                <div className="flex items-center gap-3 mb-4 p-3 bg-green-50 border border-green-100 rounded-xl">
                  <div className="w-8 h-8 flex-shrink-0 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-green-800">Video downloaded successfully!</p>
                </div>
              )}

              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-gray-700">{statusMsg}</span>
                <span className="font-bold text-indigo-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 relative overflow-hidden"
                  style={{ width: `${progress}%`, backgroundColor: phase === 'done' ? '#22c55e' : '#5a4bda' }}
                >
                  {isDownloading && (
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  )}
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>{(downloaded / 1048576).toFixed(2)} MB downloaded</span>
                {estSize > 0 && segments.length > 0 && <span>~{((estSize * segments.length) / 1048576).toFixed(2)} MB total</span>}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Qualities', value: qualities.length },
              { label: 'Segments',  value: segments.length },
              { label: 'Est. Size', value: estSize > 0 && segments.length > 0 ? ((estSize * segments.length) / 1048576).toFixed(1) + ' MB' : 'N/A' },
              { label: 'Downloaded', value: (downloaded / 1048576).toFixed(2) + ' MB' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Quality selector */}
          {qualities.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" strokeWidth="2"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 21h8M12 17v4"/>
                </svg>
                Available Qualities
              </h3>
              <div className="space-y-2">
                {qualities.map((q, i) => (
                  <div key={i} onClick={() => selectQuality(i)}
                    className={`p-3 rounded-xl border-2 cursor-pointer flex justify-between items-center transition ${q.selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className={`font-semibold text-sm ${q.selected ? 'text-indigo-700' : 'text-gray-700'}`}>{q.name}</span>
                    {q.selected && (
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Log */}
          <div ref={logRef} className="bg-gray-900 text-white rounded-2xl p-4 h-52 overflow-y-auto font-mono text-xs space-y-1">
            <p className="text-blue-400 mb-2">--- Video Downloader Log ---</p>
            {logs.map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-gray-500 flex-shrink-0">[{l.time}]</span>
                <span className={l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-green-400' : l.type === 'warning' ? 'text-yellow-400' : 'text-gray-300'}>
                  {l.msg}
                </span>
              </div>
            ))}
            {logs.length === 0 && <p className="text-gray-500">Waiting...</p>}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Download() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse" />
          <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    }>
      <DownloadPage />
    </Suspense>
  );
}
