const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const admin = require('firebase-admin');
const serviceAccount = require('./lucid-sweep-368913-firebase-adminsdk-cts65-dd9ec06434.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://lucid-sweep-368913-default-rtdb.firebaseio.com',
  storageBucket: 'gs://lucid-sweep-368913.appspot.com',
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/upload', upload.single('music'), async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname; // Use the original file name
    const folderName = 'music'; // Specify your folder name
    const storageLocation = `gs://lucid-sweep-368913.appspot.com/${folderName}/${fileName}`;

    const bucket = admin.storage().bucket();
    const file = bucket.file(`${folderName}/${fileName}`);

    await file.save(fileBuffer, { resumable: false });

    const downloadURL = await file.getSignedUrl({ action: 'read', expires: '03-09-2500' });

    const databaseRef = admin.database().ref('/music');
    const newMusicRef = databaseRef.push({
      name: fileName,
      downloadURL: downloadURL[0],
      storageLocation: storageLocation,
    });

    res.status(201).json({
      id: newMusicRef.key,
      name: fileName,
      downloadURL: downloadURL[0],
      storageLocation: storageLocation,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// New endpoint for searching songs by storageLocation
app.get('/search', async (req, res) => {
  try {
    const searchStorageLocation = req.query.storageLocation;

    if (!searchStorageLocation) {
      return res.status(400).json({ error: 'Missing search storageLocation' });
    }

    const databaseRef = admin.database().ref('/music');
    const snapshot = await databaseRef.orderByChild('storageLocation').equalTo(searchStorageLocation).once('value');

    const results = [];
    snapshot.forEach((childSnapshot) => {
      const song = childSnapshot.val();
      results.push({
        id: childSnapshot.key,
        name: song.name,
        downloadURL: song.downloadURL,
        storageLocation: song.storageLocation,
      });
    });

    res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.get('/', (req, res) => {
  res.send('Welcome to the Firebase Music API');
});

// New endpoint for searching songs by name
app.get('/music/search/:name', async (req, res) => {
  try {
    const songName = req.params.name;

    const databaseRef = admin.database().ref('/music');
    const snapshot = await databaseRef.orderByChild('name').equalTo(songName).once('value');

    const results = [];
    snapshot.forEach((childSnapshot) => {
      const song = childSnapshot.val();
      results.push({
        id: childSnapshot.key,
        name: song.name,
        downloadURL: song.downloadURL,
        storageLocation: song.storageLocation,
      });
    });

    if (results.length === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

    res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
