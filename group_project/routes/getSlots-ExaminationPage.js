// Controller to get the Appointment slots from MongoDB

const checkAppointments = require('../functions/checkAppointments');
//const appointmentSchema = require('../models/AppointmentModel')

module.exports = async (req, res) => {

  try {
    const selectedDate = req.query.date;
    console.log("GETSLOTS-EXAM req.query.date: ", req.query.date);
    const selectedTestType = req.query.testType;
    console.log("GETSLOTS-EXAM selectedTestType: ", selectedTestType);

    const slots = await checkAppointments(selectedDate, selectedTestType); // Get the drivers appointments
    console.log("GETSLOTS-EXAM:", slots);

    if (req.session.userId) {
      res.render('examination', { ...slots, selectedDate, selectedTestType });
    }
    else { res.redirect('/login'); }

  } catch (error) {
    console.log(error);
  }
}