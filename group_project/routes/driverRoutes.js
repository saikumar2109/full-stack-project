const express = require('express');
const router = express.Router();
const Appointment = require('../models/appointment');
const authenticateUser = require('../middlewares/authenticateUser');

// Route to handle booking appointment
router.post('/book-appointment', authenticateUser, async (req, res) => {
  console.log('Appointment');
  try {
    const { date, time, testType } = req.body;
    const appointment = new Appointment({
      user: req.user._id,
      date,
      time,
      testType
    });
    await appointment.save();
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
