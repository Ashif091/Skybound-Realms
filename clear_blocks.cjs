const { MongoClient } = require('mongodb');

async function clearPlacedBlocks() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return console.log('No MONGODB_URI set');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  // Clear only placedBlocks array in the world document, keep trees/drops
  const result = await db.collection('world').updateOne(
    { _id: 'main' },
    { $set: { placedBlocks: [] } }
  );
  console.log(`Updated: ${result.modifiedCount} document(s). placedBlocks cleared.`);
  await client.close();
}
clearPlacedBlocks();
