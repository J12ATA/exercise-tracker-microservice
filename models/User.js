const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ExerciseSchema = new Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: String,  }
}, { _id: false });

const UserSchema = new Schema({
  _id: { type: String, required: true },
  username: { type: String, required: true },
  count: { type: Number },
  log: [ExerciseSchema]
}, { versionKey: false });

const User = mongoose.model('User', UserSchema);

module.exports.User = User;
