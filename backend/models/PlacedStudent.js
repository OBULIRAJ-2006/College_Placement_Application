const mongoose = require("mongoose");

const placedStudentSchema = new mongoose.Schema(
  {
    jobDrive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobDrive",
      required: true,
    },
    companyName: { type: String, default: "" },
    name: { type: String, required: true },
    rollNumber: { type: String, required: true },
    department: { type: String, default: "" },
    email: { type: String, default: "" },
    mobileNumber: { type: String, default: "" },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

placedStudentSchema.index({ jobDrive: 1, rollNumber: 1 }, { unique: true });

module.exports = mongoose.model("PlacedStudent", placedStudentSchema);
