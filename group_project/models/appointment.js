const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  date: Date,
  time: String,
  isTimeSlotAvailable: Boolean,
  testType: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const Appointment = mongoose.model("Appointment", appointmentSchema);

module.exports = Appointment;
