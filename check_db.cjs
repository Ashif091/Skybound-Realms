const { MongoClient } = require('mongodb');

async function checkDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return console.log('No URI');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const doc = await db.collection('world').findOne({ _id: 'main' });
  if (doc && doc.placedBlocks) {
    console.log(`Found ${doc.placedBlocks.length} placed blocks in DB`);
    console.log(doc.placedBlocks.slice(-15)); // show last 15
  } else {
    console.log('No world doc found');
  }
  await client.close();
}
checkDB();
