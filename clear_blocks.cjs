const { MongoClient } = require('mongodb');
const http = require('http');

async function clearPlacedBlocks() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return console.log('No MONGODB_URI set');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  // 1. Clear only placedBlocks in DB (preserve users/inventories/trees/drops)
  const result = await db.collection('world').updateOne(
    { _id: 'main' },
    { $set: { placedBlocks: [] } },
    { upsert: true }
  );
  console.log(`DB updated: ${result.modifiedCount || result.upsertedCount} doc(s). placedBlocks cleared.`);
  await client.close();

  // 2. Also clear local world.json
  const fs = require('fs');
  const filePath = require('path').join(process.cwd(), 'data', 'world.json');
  if (fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    existing.placedBlocks = [];
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf8');
    console.log('Local world.json placedBlocks also cleared.');
  }

  // 3. Signal running server to clear in-memory state + broadcast to all clients
  const req = http.request({ hostname: 'localhost', port: 3001, path: '/admin/reset-world', method: 'POST' }, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      try { console.log('Server response:', JSON.parse(body).message); }
      catch { console.log('Server response:', body); }
    });
  });
  req.on('error', (e) => {
    console.warn('Could not reach admin server (restart server.js manually to apply):', e.message);
  });
  req.end();
}
clearPlacedBlocks();
