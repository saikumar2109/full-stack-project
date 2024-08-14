require('dotenv').config();
const express = require("express");
const path = require("path");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const session = require("express-session");
const mongoose = require("mongoose");
const User = require("./models/user");
const Appointment = require("./models/appointment");
const appointmentsRouter = require('./routes/appointments');

const { debug } = require('console');

const app = express();
const PORT = process.env.PORT || 1997;


mongoose.connect(process.env.MONGODB_URI, {
useNewUrlParser: true,
useUnifiedTopology: true,
});

app.use(session({
secret: process.env.SESSION_SECRET,
resave: false,
saveUninitialized: false,
}));

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/appointments', appointmentsRouter);



// Middleware for user authentication
const authenticateUser = async (req, res, next, userType) => {
try {
if (req.session && req.session.user && req.session.user.userType === userType) {
console.log('UserType:', req.session.user.userType);
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



module.exports = authenticateUser;


const authenticateDriver = (req, res, next) => authenticateUser(req, res, next, "Driver");
const authenticateAdmin = (req, res, next) => authenticateUser(req, res, next, "Admin");
const authenticateExaminer = (req, res, next) => authenticateUser(req, res, next, "Examiner");

app.get("/", (req, res) => {
res.render("index", { user: req.session.user });
});

app.get("/login", (req, res) => {
res.render("login", { user: req.session.user });
});

app.post("/login", async (req, res) => {
const { email, password } = req.body;
try {
const user = await User.findOne({ username: email });
if (!user || !(await bcrypt.compare(password, user.password))) {
return res.status(400).send("Invalid email or password");
}
req.session.user = { _id: user._id, userType: user.userType };
res.redirect("/");
} catch (error) {
console.error("Error during login:", error);
res.status(500).send("Internal Server Error");
}
});

app.get("/signup", (req, res) => {
res.render("signup", { user: req.session.user });
});

app.post("/signup", async (req, res) => {
  const { username, password, repeatPassword, userType } = req.body;

  if (!username || !password || !repeatPassword || !userType) {
      return res.status(400).send("All fields are required.");
  }

  if (password !== repeatPassword) {
      return res.status(400).send("Passwords do not match.");
  }

  try {
      let licenseNumber = "default";
      let count = 1;
      let userExists = true;

      // Loop until a unique licenseNumber is found
      while (userExists) {
          const existingUser = await User.findOne({ licenseNumber });
          if (!existingUser) {
              userExists = false;
          } else {
              licenseNumber = `default${count}`;
              count++;
          }
      }

      const newUser = new User({
          username,
          password,
          userType,
          firstName: "default",
          lastName: "default",
          licenseNumber,
          age: 0,
          carDetails: {
              make: "default",
              model: "default",
              year: 0,
              plateNumber: "default",
          },
          testType: userType === "Driver" ? "G2" : undefined,
      });
      await newUser.save();
      res.redirect("/login");
  } catch (error) {
      if (error.code === 11000 && error.keyPattern && error.keyPattern.licenseNumber === 1) {
          return res.status(400).send("License Number already exists");
      }
      console.error("Error creating user:", error);
      res.status(500).send("Internal Server Error");
  }
});


app.get("/logout", (req, res) => {
req.session.destroy((err) => {
if (err) {
return res.status(500).send("Failed to logout");
}
res.redirect("/login");
});
});

app.get("/G", authenticateDriver, (req, res) => {
res.render("G", { user: req.user });
});

app.get("/G2", authenticateDriver, async (req, res) => {
const appointments = await Appointment.find({
date: { $gte: new Date() },
isTimeSlotAvailable: true,
});
const user = await User.findById(req.session.user._id).populate("appointment");
res.render("G2", { user, appointments });
});

app.post("/submit", authenticateDriver, async (req, res) => {
const {
firstName,
lastName,
licenseNumber,
age,
make,
model,
year,
plateNumber,
} = req.body;
try {
await User.findByIdAndUpdate(
req.user._id,
{
firstName,
lastName,
licenseNumber,
age,
"carDetails.make": make,
"carDetails.model": model,
"carDetails.year": year,
"carDetails.plateNumber": plateNumber,
},
{ new: true }
);
res.redirect("/G2");
} catch (error) {
console.error("Error updating user:", error);
res.status(500).send("Internal Server Error");
}
});

app.post("/updateUser", authenticateDriver, async (req, res) => {
const { make, model, year, plateNumber } = req.body;
try {
const updatedUser = await User.findByIdAndUpdate(
req.user._id,
{
"carDetails.make": make,
"carDetails.model": model,
"carDetails.year": year,
"carDetails.plateNumber": plateNumber,
},
{ new: true }
);
res.render("G", { user: updatedUser });
} catch (error) {
console.error("Error updating user:", error);
res.status(500).send("Internal Server Error");
}
});


app.get("/appointments", authenticateAdmin, async (req, res) => {
const appointments = await Appointment.find();


res.render("appointments", { user: req.user, appointments });
});

app.post("/appointments", authenticateAdmin, async (req, res) => {
let { date, times } = req.body;
if (!Array.isArray(times)) {
times = [times];
}

date = new Date(date); // Convert to Date object

try {
for (const time of times) {
const existingAppointment = await Appointment.findOne({ date, time });
if (existingAppointment) {
continue; // Skip creating duplicate time slots
}
const appointment = new Appointment({
date,
time,
isTimeSlotAvailable: true,
});
await appointment.save();
}
res.redirect("/appointments");
} catch (error) {
console.error("Error creating appointments:", error);
res.status(500).send("Internal Server Error");
}
});




app.post('/cancel', authenticateUser, async (req, res) => {
try {
const { appointmentId } = req.body; // Ensure appointmentId is passed in the request body

if (!appointmentId) {
return res.status(400).send('Appointment ID is required.');
}

const appointment = await Appointment.findByIdAndDelete(appointmentId);

if (!appointment) {
return res.status(404).send('Appointment not found.');
}

res.send('Appointment canceled successfully.');
} catch (error) {
console.error(error);
res.status(500).send('Internal Server Error');
}
});

app.get("/examiner", authenticateExaminer, async (req, res) => {
try {
const appointments = await Appointment.find({ isTimeSlotAvailable: true }).populate("user");
res.render("examiner", { user: req.user, appointments });
} catch (error) {
console.error(error);
res.status(500).send("Internal Server Error");
}
});

app.post("/examiner/filter", authenticateExaminer, async (req, res) => {
console.log("hello", req.body);
const { testType } = req.body;
try {
const appointments = await Appointment.find({ isTimeSlotAvailable: false }).populate({
path: "user",
match: { testType },
});
res.render("examiner", { user: req.user, appointments });
} catch (error) {
console.error(error);
res.status(500).send("Internal Server Error");
}
});

// Add Comment and Pass/Fail Status
app.post("/examiner/comment/:userId", authenticateExaminer, async (req, res) => {
const { userId } = req.params;
const { comment, passFail } = req.body;
await User.findByIdAndUpdate(userId, { comment, passFail });
res.redirect("/examiner");
});

app.post('/book-appointment', authenticateDriver, async (req, res) => {
// console.log('User11:', req.user); // Check the user object

if (!req.user || !req.user._id) {
return res.status(401).send('Unauthorized');
}
req.body.testType = 'G';
try {
const { date, time, testType } = req.body;

if (!date || !time || !testType) {
return res.status(400).send('Date, time, and test type are required.');
}

const appointment = new Appointment({
date,
time,
testType,
isTimeSlotAvailable: true,
user: req.user._id
});

await appointment.save();

res.redirect('/');
} catch (error) {
console.error(error);
res.status(500).send('Internal Server Error');
}
});

// Admin View Pass/Fail Candidates
app.get("/passfail", authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({ userType: "Driver" });
    res.render("passfail", { users, user: req.session.user });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});






app.listen(PORT, () => {
console.log(`App listening on port ${PORT}`);
});
