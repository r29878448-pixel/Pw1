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

function postReq(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const t = setTimeout(() => reject(new Error('timeout')), 15000);
    const opts = { hostname: 'apiserver-6hat.onrender.com', path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { clearTimeout(t); try { resolve(JSON.parse(d)); } catch (e) { resolve({}); } }); });
    req.on('error', e => { clearTimeout(t); reject(e); }); req.write(data); req.end();
  });
}

function getReq(path) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), 15000);
    https.get('https://deltaserver.vercel.app' + path, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { clearTimeout(t); try { resolve(JSON.parse(d)); } catch (e) { resolve({}); } });
    }).on('error', e => { clearTimeout(t); reject(e); });
  });
}

async function main() {
  // Use Prayas JEE which we know has videos
  const batchId = '699eb68042fc3387632ca249';
  const subSlug = '-air--physics-795041';
  const topicSlug = 'kinematics-488134';

  const craw = await getReq('/api/pw/datacontent?batchId=' + batchId + '&subjectSlug=' + subSlug + '&topicSlug=' + topicSlug + '&contentType=videos');
  const dec = decrypt(craw.data);
  const videos = dec.data;
  
  console.log('Videos count:', videos && videos.length);
  if (videos && videos.length > 0) {
    videos.forEach((v, i) => {
      const vd = v.videoDetails || {};
      console.log(`\nVideo[${i}]:`);
      console.log('  topic:', v.topic);
      console.log('  url:', v.url);
      console.log('  urlType:', v.urlType);
      console.log('  drmProtected:', vd.drmProtected);
      console.log('  types:', JSON.stringify(vd.types));
      console.log('  videoUrl:', vd.videoUrl);
      console.log('  findKey:', vd.findKey);
      
      // Test HLS URL
      const hlsUrl = (vd.videoUrl || v.url || '').replace('master.mpd', 'master.m3u8');
      console.log('  hlsUrl:', hlsUrl);
    });
  }
  
  // Also test videonew API for signed URL
  const findKey = videos[0].videoDetails?.findKey || videos[0]._id;
  console.log('\n--- Testing videonew for signed URL ---');
  const vraw = await getReq('/api/pw/videonew?batchId=' + batchId + '&subjectId=' + subSlug + '&childId=' + findKey);
  console.log('videonew raw:', JSON.stringify(vraw).substring(0, 200));
  
  if (vraw.data && typeof vraw.data === 'string') {
    const vdec = decrypt(vraw.data);
    console.log('videonew decrypted:', JSON.stringify(vdec).substring(0, 300));
  }
}
main().catch(e => console.log('ERR:', e.message));
