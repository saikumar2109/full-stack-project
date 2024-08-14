const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const carDetailsSchema = new mongoose.Schema({
  make: { type: String, default: "default" },
  model: { type: String, default: "default" },
  year: { type: Number, default: 0 },
  plateNumber: { type: String, default: "default" },
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  userType: { type: String, required: true, enum: ["Driver", "Admin", "Examiner"] },
  firstName: { type: String, default: "default" },
  lastName: { type: String, default: "default" },
  licenseNumber: { type: String, default: "default", unique: true },
  age: { type: Number, default: 0 },
  carDetails: carDetailsSchema,
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
  testType: { type: String, enum: ["G2", "G"], },
  comment: String,
  passFail: Boolean
});
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.isValidPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
