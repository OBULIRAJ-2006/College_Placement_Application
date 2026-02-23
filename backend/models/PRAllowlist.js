const mongoose = require('mongoose');

const prAllowlistSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /.+@gct\.ac\.in$/
  },
  role: {
    type: String,
    enum: ['placement_representative', 'placement_officer'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  requestedDate: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedDate: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  department: {
    type: String,
    enum: ['CSE', 'IT', 'ECE', 'MECH', 'CIVIL', 'EEE'],
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  // For PO management
  isFirstPO: {
    type: Boolean,
    default: false
  },
  requiresExistingPOApproval: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Index for efficient queries
prAllowlistSchema.index({ status: 1, role: 1 });
prAllowlistSchema.index({ email: 1 });

module.exports = mongoose.model('PRAllowlist', prAllowlistSchema);
