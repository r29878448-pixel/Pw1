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
    https.get('https://deltaserver-2bfee9989a1f.herokuapp.com' + path, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { clearTimeout(t); try { resolve(JSON.parse(d)); } catch (e) { resolve({ _raw: d.substring(0, 100) }); } });
    }).on('error', e => { clearTimeout(t); reject(e); });
  });
}

async function main() {
  const batchId = '699eb68042fc3387632ca249'; // Prayas JEE AIR
  const subSlug = '-air--physics-795041';

  const traw = await getReq('/api/pw/topics?BatchId=' + batchId + '&SubjectId=' + subSlug);
  const topics = decrypt(traw.data).data;
  const topic = topics.find(t => t.notes > 0) || topics[0];
  console.log('Topic:', topic.name, topic.slug, '| notes:', topic.notes);

  const nraw = await getReq('/api/pw/datacontent?batchId=' + batchId + '&subjectSlug=' + subSlug + '&topicSlug=' + topic.slug + '&contentType=notes');
  const dec = decrypt(nraw.data);
  console.log('Response keys:', Object.keys(dec));
  const notes = dec.data;
  console.log('Notes type:', typeof notes, Array.isArray(notes) ? 'array len:' + notes.length : JSON.stringify(dec).substring(0, 100));
  if (Array.isArray(notes) && notes.length > 0) {
    const n = notes[0];
    console.log('Note keys:', Object.keys(n));
    console.log('homeworkIds count:', n.homeworkIds && n.homeworkIds.length);
    if (n.homeworkIds && n.homeworkIds.length > 0) {
      const hw = n.homeworkIds[0];
      console.log('HW:', hw.topic, '| attachments:', hw.attachmentIds && hw.attachmentIds.length);
      if (hw.attachmentIds && hw.attachmentIds.length > 0) {
        const att = hw.attachmentIds[0];
        console.log('key:', JSON.stringify(att.key), '| baseUrl:', att.baseUrl);
        console.log('PDF URL:', (att.baseUrl || 'https://static.pw.live/') + att.key);
      }
    }
  }
}
main().catch(e => console.log('ERR:', e.message));
