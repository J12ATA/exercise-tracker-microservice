const express = require('express');
const mongo = require('mongodb');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const mongooseConfig = require('./config/mongoose_config');
const { User } = require('./models/User');
const crypto = require('crypto');
const cors = require('cors');
const app = express(); 
const { MONGO_URI, PORT } = process.env;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cors());

mongoose.connect(MONGO_URI, mongooseConfig);

const db = mongoose.connection;

db.on('error', err => { 
  console.error(`connection error:${err}`); 
});

db.once('open', () => { 
  console.log('db connection successful'); 
});

app.get('/', (req, res) => { 
  res.sendFile(__dirname + '/views/index.html'); 
});

app.get('/api/exercise/users', (req, res, next) => {
  User.find({}, '_id username', (err, users) => {
    if (err) next(err);
    if (users.length === 0) return res.send('No users yet in the database.');
    res.status(201).json(users);
  });
});

app.get('/api/exercise/log', (req, res, next) => {
  const { userId, from, to, limit } = req.query;
  const dateValidation = /([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))/;
  const fromString = (from && dateValidation.test(from)) ? new Date(from.replace('-', ',')).toDateString() : undefined;
  const toString = to ? new Date(to.replace('-', ',')).toDateString() : undefined;
  if (!userId) res.send('UserId Required');
  User.findOne({ _id: userId }, (err, user) => {
    if (err) next(err);
    let { _id, username, log } = user;
    switch (user) {
      case from:
        log = log.filter(exercise => { 
          new Date(exercise.date) >= new Date(from); 
        });
      case to:
        log = log.filter(exercise => { 
          new Date(exercise.date) <= new Date(to); 
        });
      case limit:
        log = log.slice(0, limit);
        break;
      default:
        return res.send('Unknown UserId');
    }
    res.status(201).json({ _id, username, from: fromString, to: toString, count: log.length, log });
  });
});

app.post('/api/exercise/new-user', (req, res, next) => {
  const { username } = req.body;
  const _id = crypto.randomBytes(7).toString('base64').replace(/\W/g, '0').slice(-9);
  const newUser = new User({ _id, username });
  if (!username) res.send('username is required');
  User.findOne({ username }, '_id username', (err, user) => {
    if (err) next(err);
    if (user) return res.status(201).json(user);
    newUser.save((err, user) => {
      if (err) next(err);
      const { _id, username } = user;
      res.status(201).json({ _id, username });
    });
  });
});

app.post('/api/exercise/add', (req, res, next) => {
  const { userId, description, duration, date } = req.body;
  const firstChars = /(\b\w(?!\b))/g;
  const minsValidation = /^[1-9]\d*$/;
  const dateValidation = /([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))/;
  const dateString = date ? new Date(date.replace('-', ',')).toDateString() : new Date().toDateString();
  const descriptionString = description.toLowerCase().replace(firstChars, char => char.toUpperCase());
  if (!userId || !description || !duration) res.send('Please fill in required fields');
  if (!minsValidation.test(duration)) res.send('Invalid Duration');
  if (date && !dateValidation.test(date)) res.send('Invalid Date');
  User.findById({ _id: userId }, (err, user) => {
    if (err) next(err);
    if (!user) return res.send('Unknown UserId');
    let { _id, username, log, count } = user;
    log.push({ description: descriptionString, duration: Number(duration), date: dateString });
    log.sort((a, b) => new Date(b.date) - new Date(a.date));
    count = log.length;
    user.save((err, user) => {
      if (err) next(err);
      res.json({ _id, username, count, log });
    });
  });
});

// Not found middleware
app.use((req, res, next) => { 
  res.status(404).type('text').send('Not Found');
});

// Error Handling middleware
app.use((err, req, res, next) => {
  const { errors, status, message } = err;
  const errCode = errors ? 400 : status || 500;
  const keys = Object.keys(errors);
  const errMessage = errors ? errors[keys[0]].message : message || 'Internal Server Error';
  res.status(errCode).type('txt').send(errMessage);
});

app.listen(PORT || 3000, () => { 
  console.log(`Your app is listening on port ${PORT}`); 
});