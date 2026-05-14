const crypto = require('crypto');
const https = require('https');

function decrypt(payload) {
  const [ivHex, dataHex] = payload.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const key = Buffer.alloc(32);
  Buffer.from('maggikhalo').copy(key);
  const authTag = data.slice(-16);
  const encData = data.slice(0, -16);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(authTag);
  return JSON.parse(d.update(encData, null, 'utf8') + d.final('utf8'));
}

function getReq(path) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), 15000);
    https.get('https://deltaserver.vercel.app' + path, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { clearTimeout(t); try { resolve(JSON.parse(d)); } catch (e) { resolve({ _raw: d.substring(0, 200) }); } });
    }).on('error', e => { clearTimeout(t); reject(e); });
  });
}

async function main() {
  const batchId = '699eb68042fc3387632ca249';
  const subSlug = '-air--physics-795041';
  const findKey = '69afdd2d4725e0bf43d65a72'; // from earlier test

  const apis = [
    `/api/pw/videonew?batchId=${batchId}&subjectId=${subSlug}&childId=${findKey}`,
    `/api/pw/video?batchId=${batchId}&subjectId=${subSlug}&childId=${findKey}`,
    `/api/pw/videosuper?batchId=${batchId}&childId=${findKey}`,
    `/api/pw/videoplay?batchId=${batchId}&childId=${findKey}`,
  ];

  for (const path of apis) {
    const name = path.split('/api/pw/')[1].split('?')[0];
    try {
      const r = await getReq(path);
      if (r.data && typeof r.data === 'string') {
        const dec = decrypt(r.data);
        const url = dec?.url || dec?.videoUrl || dec?.hlsUrl || dec?.data?.url || dec?.data?.videoUrl;
        if (url) console.log('✅', name, ':', url.substring(0, 100));
        else console.log('❌', name, ':', JSON.stringify(dec).substring(0, 150));
      } else {
        const url = r?.url || r?.videoUrl || r?.hlsUrl || r?.data?.url;
        if (url) console.log('✅', name, '(plain):', url.substring(0, 100));
        else console.log('❌', name, ':', JSON.stringify(r).substring(0, 150));
      }
    } catch (e) { console.log('ERR', name, ':', e.message); }
  }

  // Also test HLS URL directly
  const mpdUrl = 'https://d1d34p8vz63oiq.cloudfront.net/5e3d8ae0-d0df-42d3-a203-cb1894919425/master.mpd';
  const hlsUrl = mpdUrl.replace('master.mpd', 'master.m3u8');
  console.log('\nTesting HLS URL:', hlsUrl);
  await new Promise((resolve) => {
    https.get(hlsUrl, (res) => {
      console.log('HLS status:', res.statusCode);
      resolve();
    }).on('error', e => { console.log('HLS ERR:', e.message); resolve(); });
  });
}
main().catch(e => console.log('ERR:', e.message));
