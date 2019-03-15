const express = require('express');
const mongo = require('mongodb');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const mongooseConfig = require('./config/mongoose_config');
const { User } = require('./models/User');
const crypto = require('crypto');
const cors = require('cors');
const app = express(); 

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cors());

mongoose.connect(process.env.MONGO_URI, mongooseConfig);

const db = mongoose.connection;

db.on('error', err => console.error(`connection error:${err}`));

db.once('open', () => console.log('db connection successful'));

app.get('/', (req, res) => res.sendFile(__dirname + '/views/index.html'));

app.get('/api/exercise/users', (req, res, next) => {
  User.find({}, '_id username', (err, docs) => {
    if (err) next(err);
    if (docs.length === 0) return res.send('No users yet in the database.');
    res.status(201).json(docs);
  });
});

app.get('/api/exercise/log', (req, res, next) => {
  const { userId, from, to, limit } = req.query;
  const fromDate = from ? new Date(from.replace('-', ',')).toDateString() : undefined;
  const toDate = to ? new Date(to.replace('-', ',')).toDateString() : undefined;
  if (!userId) res.send('UserId Required');
  User.findOne({ _id: userId }, (err, doc) => {
    if (err) next(err);
    if (!doc) return res.send('Unknown UserId');
    let log = doc.log;
    if (from) log = log.filter(exercise => new Date(exercise.date) >= new Date(from));
    if (to) log = log.filter(exercise => new Date(exercise.date) <= new Date(to));
    if (limit) log = log.slice(0, limit);
    res.status(201).json({ _id: doc._id, username: doc.username, from: fromDate, to: toDate, count: log.length, log: log });
  });
});

app.post('/api/exercise/new-user', (req, res, next) => {
  const username = req.body.username;
  const userId = crypto.randomBytes(7).toString('base64').replace(/\W/g, '0').slice(-9);
  const user = new User({ _id: userId, username: username });
  if (!username) res.send('Path `username` is required');
  User.findOne({ username: username }, '_id username', (err, doc) => {
    if (err) next(err);
    if (doc) return res.status(201).json(doc);
    user.save((err, doc) => {
      if (err) next(err);
      res.status(201).json({ _id: doc._id, username: doc.username });
    });
  });
});

app.post('/api/exercise/add', (req, res, next) => {
  const { userId, description, duration, date } = req.body;
  const givenDate = date ? new Date(date.replace('-', ',')).toDateString() : new Date().toDateString();
  const givenDescription = description.toLowerCase().replace(/(\b\w(?!\b))/g, char => char.toUpperCase());
  if (!userId || !description || !duration) res.send('Please fill in required fields');
  User.findById({ _id: userId }, (err, doc) => {
    if (err) next(err);
    if (!doc) return res.send('Unknown UserId');
    doc.log.push({ description: givenDescription, duration: duration, date: givenDate });
    doc.log.sort((a, b) => new Date(b.date) - new Date(a.date));
    doc.count = doc.log.length;
    doc.save((err, doc) => {
      if (err) next(err); 
      res.json({ _id: doc._id, username: doc.username, count: doc.count, log: doc.log });
    });
  });
});

// Not found middleware
app.use((req, res, next) => next({status: 404, message: 'not found'}));

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;
  if (err.errors) {
    errCode = 400;
    const keys = Object.keys(err.errors);
    errMessage = err.errors[keys[0]].message;
  } else {
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error';
  }
  res.status(errCode).type('txt').send(errMessage);
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});