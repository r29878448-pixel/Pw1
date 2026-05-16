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
    const t = setTimeout(() => reject(new Error('timeout')), 20000);
    https.get('https://deltaserver.vercel.app' + path, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { clearTimeout(t); try { resolve(JSON.parse(d)); } catch (e) { resolve({}); } });
    }).on('error', e => { clearTimeout(t); reject(e); });
  });
}

async function main() {
  const braw = await getReq('/api/pw/batches');
  const batches = decrypt(braw.data).data;
  console.log('Total batches:', batches.length);

  // Find Arjuna JEE 2027
  const arjunaJEE = batches.filter(b => b.batchName && b.batchName.toLowerCase().includes('arjuna') && b.batchName.includes('2027') && (b.batchName.toLowerCase().includes('jee') || b.batchName.toLowerCase().includes('iit')));
  console.log('\n=== Arjuna JEE 2027 ===');
  arjunaJEE.forEach(b => console.log(b.batchId, '|', b.batchName));

  // Find Arjuna NEET 2027
  const arjunaNEET = batches.filter(b => b.batchName && b.batchName.toLowerCase().includes('arjuna') && b.batchName.includes('2027') && b.batchName.toLowerCase().includes('neet'));
  console.log('\n=== Arjuna NEET 2027 ===');
  arjunaNEET.forEach(b => console.log(b.batchId, '|', b.batchName));

  // Find Class 10 2027
  const class10 = batches.filter(b => b.batchName && b.batchName.includes('2027') && (b.batchName.toLowerCase().includes('class 10') || b.batchName.toLowerCase().includes('10th') || b.batchName.includes('Class 10')));
  console.log('\n=== Class 10 2027 ===');
  class10.slice(0, 10).forEach(b => console.log(b.batchId, '|', b.batchName));
}
main().catch(e => console.log('ERR:', e.message));
