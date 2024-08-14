const express = require('express');
const router = express.Router();
const Appointment = require('../models/appointment');
const User = require('../models/user');

// Middleware for user authentication
const authenticateUser = async (req, res, next, userType) => {
  try {
    if (req.session && req.session.user && req.session.user.userType === userType) {
      const user = await User.findById(req.session.user._id);
      if (user) {
        req.user = user;
        return next();
      }
    }
    res.redirect("/login");
  } catch (error) {
    console.error("Error authenticating user:", error);
    res.status(500).send("Internal Server Error");
  }
};

const authenticateDriver = (req, res, next) => authenticateUser(req, res, next, "Driver");
const authenticateAdmin = (req, res, next) => authenticateUser(req, res, next, "Admin");
const authenticateExaminer = (req, res, next) => authenticateUser(req, res, next, "Examiner");

router.post("/book", authenticateDriver, async (req, res) => {
  const { appointmentId } = req.body;
  try {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment.isTimeSlotAvailable) {
      return res.status(400).send("Time slot is already booked");
    }
    appointment.isTimeSlotAvailable = false;
    appointment.user = req.user._id;
    await appointment.save();

    req.user.appointment = appointment._id;
    await req.user.save();

    res.redirect("/G2");
  } catch (error) {
    console.error("Error booking appointment:", error);
    res.status(500).send("Internal Server Error");
  }
});
router.post('/cancel', async (req, res) => {
  const userId = req.session.user._id;

  try {
    const user = await User.findById(userId).populate('appointment');
    if (!user.appointment) {
      return res.status(400).send('You have no booked appointment to cancel.');
    }

    const appointment = await Appointment.findById(user.appointment._id);
    if (!appointment) {
      return res.status(400).send('Appointment not found.');
    }

    appointment.isTimeSlotAvailable = true;
    await appointment.save();

    user.appointment = null;
    await user.save();

    res.redirect('/G2');
  } catch (error) {
    console.error('Error canceling appointment:', error);
    res.status(500).send('Internal Server Error');
  }
});


module.exports = router;
