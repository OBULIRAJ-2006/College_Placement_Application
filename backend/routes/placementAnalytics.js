const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const PlacementAnalytics = require("../models/PlacementAnalytics");
const { auth } = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { emitPlacementDataUpdate } = require("../utils/socketUtils");

// Middleware to check for PO/admin roles
const authorizePOorAdmin = (req, res, next) => {
  const allowedRoles = ['placement_officer', 'po', 'admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. Only Placement Officers and Admins can access this resource.' });
  }
  next();
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../uploads/placement-data/");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const batch = req.body.batch || "unknown";
    const ext = path.extname(file.originalname);
    cb(null, `${batch}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only CSV and PDF files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Helper function to parse complex CSVs with department sections and extra columns
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const data = fs.readFileSync(filePath, "utf8");
      const lines = data.split(/\r?\n/).filter((line) => line.trim());
      const results = [];
      let currentDepartment = "";
      let header = null;
      let headerMap = {};
      let parsingStudents = false;

      // Helper to normalize header names
      const normalize = (str) => str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Detect department section
        const deptMatch = line.match(/^Department *[:-] *(.*)/i);
        if (deptMatch) {
          currentDepartment = deptMatch[1].trim();
          parsingStudents = false;
          continue;
        }
        // Detect student table header
        if (
          line.toLowerCase().includes("name") &&
          line.toLowerCase().includes("company")
        ) {
          header = line.split(",").map((h) => h.trim());
          // Build a map from normalized header to index
          headerMap = {};
          header.forEach((h, idx) => {
            const norm = normalize(h);
            if (norm.includes("name") && !norm.includes("company"))
              headerMap["name"] = idx;
            if (norm.includes("department")) headerMap["department"] = idx;
            if (norm.includes("company")) headerMap["company"] = idx;
            // Robust: match any header containing 'package' or 'ctc'
            if (norm.includes("package") || norm.includes("ctc"))
              headerMap["package"] = idx;
          });
          // DEBUG: log headerMap for development
          console.log("Detected headerMap:", headerMap);
          parsingStudents = true;
          continue;
        }
        // Skip the line with (In LPA) etc.
        if (parsingStudents && line.toLowerCase().includes("in lpa")) continue;
        // Parse student row
        if (parsingStudents && header && line.match(/\d/)) {
          const values = line.split(",").map(v => v.trim());
          
          // Defensive: skip if not enough columns or if row is empty
          if (values.length < 3 || values.every(v => !v)) continue;
          
          const name = (values[headerMap["name"]] || "").trim();
          const department =
            (values[headerMap["department"]] || currentDepartment || "Unknown").trim();
          const company = (values[headerMap["company"]] || "").trim();
          const pkg = (values[headerMap["package"]] || "").trim();
          
          // Skip rows without a valid name
          if (!name || name.length < 2) continue;
          
          // Infer status - more robust check
          const hasValidPackage = pkg && pkg !== "0" && pkg.toLowerCase() !== "not placed";
          const status = company && hasValidPackage ? "Placed" : "Not Placed";
          
          const row = {
            name,
            department,
            company: company || "Not Placed",
            package: pkg || "0",
            status,
          };
          
          // DEBUG: log a sample parsed row
          if (results.length < 2) console.log("Sample parsed row:", row);
          results.push(row);
        }
        // If we hit an empty line or a new section, stop parsing students
        if (parsingStudents && (!line || line.startsWith("Department :-"))) {
          parsingStudents = false;
        }
      }
      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
};

// Helper to robustly parse package/CTC values (always returns a float in LPA)
function parsePackage(val) {
  if (!val || val === null || val === undefined) return 0;
  
  const str = val.toString().trim();
  if (str === '' || str === '0' || str.toLowerCase() === 'not placed') return 0;
  
  // Handle range format like "10-12 LPA" - take average
  const rangeMatch = str.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    return isNaN(low) || isNaN(high) ? 0 : (low + high) / 2;
  }
  
  // Handle "K" format (e.g., "500K" -> 0.5 LPA)
  if (str.toLowerCase().includes('k')) {
    const num = parseFloat(str.replace(/[^0-9.\-]/g, ""));
    return isNaN(num) ? 0 : num / 100;
  }
  
  // Remove all non-numeric except dot and minus
  const cleaned = str.replace(/[^0-9.\-]/g, "");
  const num = parseFloat(cleaned);
  
  // Validate reasonable range (0.5 LPA to 200 LPA)
  if (isNaN(num) || num < 0 || num > 200) return 0;
  
  return num;
}

// Helper to normalize company names for grouping
function normalizeCompanyName(name) {
  if (!name || typeof name !== 'string') return "";
  
  // Less aggressive normalization to avoid false merges
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ") // Normalize spaces
    .replace(/\b(ltd|limited|pvt|private|inc|corp|corporation)\b\.?/gi, "") // Remove common suffixes
    .replace(/[.,]/g, "") // Remove punctuation
    .trim();
}

// Helper function to generate statistics
const generateStatistics = (data) => {
  if (!data || data.length === 0) {
    return {
      totalStudents: 0,
      placedStudents: 0,
      placementRate: 0,
      averagePackage: 0,
      highestPackage: 0,
      lowestPackage: 0,
      totalCompanies: 0,
      departmentStats: [],
      companyStats: [],
    };
  }

  const totalStudents = data.length;
  const placedStudents = data.filter(
    (student) =>
      student.status === "Placed" || student.company || student.Company
  ).length;

  const placementRate =
    totalStudents > 0 ? Math.round((placedStudents / totalStudents) * 100) : 0;

  // Process packages
  const packages = data
    .filter((student) => student.package || student.Package)
    .map((student) => parsePackage(student.package || student.Package))
    .filter((amount) => amount > 0);

  // Safe calculation with proper validation
  const averagePackage =
    packages.length > 0
      ? Math.round(
          (packages.reduce((sum, pkg) => sum + pkg, 0) / packages.length) * 100
        ) / 100
      : 0;

  const highestPackage = packages.length > 0 ? Math.max(...packages) : 0;
  const lowestPackage = packages.length > 0 ? Math.min(...packages) : 0;

  // Generate department statistics
  const departmentMap = new Map();
  data.forEach((student) => {
    if (!student) return; // Skip null/undefined entries
    
    let dept = (student.department || student.Department || "Unknown").trim();
    // Standardize department names (case-insensitive)
    dept = dept.charAt(0).toUpperCase() + dept.slice(1).toLowerCase();
    const company = (student.company || student.Company || "").trim();
    const normCompany = normalizeCompanyName(company);
    const packageVal = student.package || student.Package || 0;
    const pkg = parsePackage(packageVal);

    if (!departmentMap.has(dept)) {
      departmentMap.set(dept, {
        department: dept,
        totalStudents: 0,
        placedStudents: 0,
        companies: new Map(),
      });
    }

    const deptStats = departmentMap.get(dept);
    deptStats.totalStudents++;

    if (company) {
      deptStats.placedStudents++;
      if (!deptStats.companies.has(normCompany)) {
        deptStats.companies.set(normCompany, {
          displayNames: {}, // for most common/original name
          studentsPlaced: 0,
          packages: [],
        });
      }
      const companyStats = deptStats.companies.get(normCompany);
      // Track display name frequency
      if (!companyStats.displayNames[company])
        companyStats.displayNames[company] = 0;
      companyStats.displayNames[company]++;
      companyStats.studentsPlaced++;
      if (pkg > 0) {
        companyStats.packages.push(pkg);
      }
    }
  });

  const departmentStats = Array.from(departmentMap.values()).map((dept) => {
    const companyPackages = Array.from(dept.companies.values()).flatMap(
      (company) => company.packages
    );
    const deptHighestPackage =
      companyPackages.length > 0 ? Math.max(...companyPackages) : 0;
    const deptLowestPackage =
      companyPackages.length > 0 ? Math.min(...companyPackages) : 0;

    return {
      department: dept.department,
      totalStudents: dept.totalStudents,
      placedStudents: dept.placedStudents,
      placementRate:
        dept.totalStudents > 0
          ? Math.round((dept.placedStudents / dept.totalStudents) * 100)
          : 0,
      highestPackage: deptHighestPackage,
      lowestPackage: deptLowestPackage,
      totalCompanies: dept.companies.size,
      companies: Array.from(dept.companies.values()).map((company) => {
        // Pick the most common display name
        const displayName = Object.entries(company.displayNames).sort(
          (a, b) => b[1] - a[1]
        )[0][0];
        const avgPackage =
          company.packages.length > 0
            ? Math.round(
                (company.packages.reduce((sum, pkg) => sum + pkg, 0) /
                  company.packages.length) *
                  100
              ) / 100
            : 0;
        return {
          name: displayName,
          studentsPlaced: company.studentsPlaced,
          averagePackage: avgPackage,
        };
      }),
    };
  });

  // Generate company statistics (across all departments)
  const companyMap = new Map();
  data.forEach((student) => {
    const company = (student.company || student.Company || "").trim();
    const normCompany = normalizeCompanyName(company);
    const packageVal = student.package || student.Package || 0;
    const pkg = parsePackage(packageVal);

    if (company) {
      if (!companyMap.has(normCompany)) {
        companyMap.set(normCompany, {
          displayNames: {},
          studentsPlaced: 0,
          packages: [],
        });
      }
      const companyStats = companyMap.get(normCompany);
      if (!companyStats.displayNames[company])
        companyStats.displayNames[company] = 0;
      companyStats.displayNames[company]++;
      companyStats.studentsPlaced++;
      if (pkg > 0) {
        companyStats.packages.push(pkg);
      }
    }
  });

  const companyStats = Array.from(companyMap.values()).map((company) => {
    const displayName = Object.entries(company.displayNames).sort(
      (a, b) => b[1] - a[1]
    )[0][0];
    const avgPackage =
      company.packages.length > 0
        ? Math.round(
            (company.packages.reduce((sum, pkg) => sum + pkg, 0) /
              company.packages.length) *
              100
          ) / 100
        : 0;
    const highestPkg =
      company.packages.length > 0 ? Math.max(...company.packages) : 0;
    const lowestPkg =
      company.packages.length > 0 ? Math.min(...company.packages) : 0;
    return {
      name: displayName,
      studentsPlaced: company.studentsPlaced,
      averagePackage: avgPackage,
      highestPackage: highestPkg,
      lowestPackage: lowestPkg,
    };
  });

  return {
    totalStudents,
    placedStudents,
    placementRate,
    averagePackage,
    highestPackage,
    lowestPackage,
    totalCompanies: companyStats.length,
    departmentStats,
    companyStats,
  };
};

// Get all batches (PO/admin only)
router.get("/batches", auth, authorizePOorAdmin, async (req, res) => {
  try {
    console.log("Fetching batches...");
    const analytics = await PlacementAnalytics.find({}, "batch").distinct(
      "batch"
    );
    console.log("Found batches:", analytics);
    res.json({ batches: analytics || [] });
  } catch (error) {
    console.error("Error fetching batches:", error);
    res
      .status(500)
      .json({ message: "Error fetching batches", error: error.message });
  }
});

// Add new batch
router.post("/batches", auth, authorizePOorAdmin, async (req, res) => {
  try {
    console.log("Adding new batch:", req.body);
    const { batchName } = req.body;

    if (!batchName || !batchName.trim()) {
      return res.status(400).json({ message: "Batch name is required" });
    }

    // Validate batch name format (e.g., 2024, 2024-2025)
    const trimmedBatchName = batchName.trim();
    if (!/^\d{4}(-\d{4})?$/.test(trimmedBatchName)) {
      return res.status(400).json({ message: "Batch name must be in format YYYY or YYYY-YYYY (e.g., 2024 or 2024-2025)" });
    }

    // Check for case-insensitive duplicates
    const existingBatch = await PlacementAnalytics.findOne({
      batch: { $regex: new RegExp(`^${trimmedBatchName}$`, 'i') },
    });
    if (existingBatch) {
      return res.status(400).json({ message: "Batch already exists" });
    }

    const analytics = new PlacementAnalytics({
      batch: trimmedBatchName,
      uploadedBy: req.user.id,
      data: [],
      statistics: {
        totalStudents: 0,
        placedStudents: 0,
        placementRate: 0,
        averagePackage: 0,
        highestPackage: 0,
        lowestPackage: 0,
        totalCompanies: 0,
        departmentStats: [],
        companyStats: [],
      },
    });

    await analytics.save();
    console.log("Batch added successfully:", batchName);

    // Emit socket event for real-time updates
    const io = req.app.get("io");
    if (io) {
      emitPlacementDataUpdate(io, "batch_added", { batchName });
    }

    res.json({ message: "Batch added successfully" });
  } catch (error) {
    console.error("Error adding batch:", error);
    res
      .status(500)
      .json({ message: "Error adding batch", error: error.message });
  }
});

// Upload and process placement data
router.post("/upload", auth, authorizePOorAdmin, upload.single("file"), async (req, res) => {
  try {
    const { batch } = req.body;

    if (!batch) {
      return res.status(400).json({ message: "Batch is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    // Check minimum file size (at least 100 bytes)
    if (req.file.size < 100) {
      fs.unlinkSync(req.file.path); // Clean up
      return res.status(400).json({ message: "File is too small or empty" });
    }

    let placementData = [];
    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    if (fileExt === ".csv") {
      placementData = await parseCSV(filePath);
      
      // Validate parsed data
      if (!placementData || placementData.length === 0) {
        fs.unlinkSync(filePath); // Clean up
        return res.status(400).json({ message: "No valid data found in CSV file" });
      }
    } else if (fileExt === ".pdf") {
      // PDF parsing not implemented
      fs.unlinkSync(filePath); // Clean up
      return res.status(400).json({ message: "PDF parsing is not yet supported. Please upload a CSV file." });
    }

    const statistics = generateStatistics(placementData);

    let analytics = await PlacementAnalytics.findOne({ batch });
    if (analytics) {
      analytics.data = placementData;
      analytics.statistics = statistics;
      analytics.uploadedAt = new Date();
      analytics.fileName = req.file.originalname;
      analytics.filePath = filePath;
    } else {
      analytics = new PlacementAnalytics({
        batch,
        uploadedBy: req.user.id,
        data: placementData,
        statistics,
        fileName: req.file.originalname,
        filePath,
      });
    }

    await analytics.save();

    // Emit socket event for real-time updates
    const io = req.app.get("io");
    if (io) {
      emitPlacementDataUpdate(io, "data_uploaded", {
        batch,
        statistics: analytics.statistics,
        fileName: req.file.originalname,
      });
    }

    res.json({ message: "File uploaded and analytics generated successfully" });
  } catch (error) {
    console.error("Upload error:", error);
    res
      .status(500)
      .json({ message: "Error processing file", error: error.message });
  }
});

// Get analytics for a batch (PO/admin only)
router.get("/:batch", auth, authorizePOorAdmin, async (req, res) => {
  try {
    const { batch } = req.params;
    const analytics = await PlacementAnalytics.findOne({ batch });

    if (!analytics) {
      return res
        .status(404)
        .json({ message: "No analytics found for this batch" });
    }

    res.json({ analytics: analytics.statistics || {} });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res
      .status(500)
      .json({ message: "Error fetching analytics", error: error.message });
  }
});

// Delete analytics for a batch (PO/admin only)
router.delete("/:batch", auth, authorizePOorAdmin, async (req, res) => {
  try {
    const { batch } = req.params;
    const analytics = await PlacementAnalytics.findOne({ batch });

    if (!analytics) {
      return res.status(404).json({ message: "Analytics not found" });
    }

    // Safe file deletion with error handling
    if (analytics.filePath && fs.existsSync(analytics.filePath)) {
      try {
        fs.unlinkSync(analytics.filePath);
      } catch (fileError) {
        console.error('Error deleting file:', fileError);
        // Continue with database deletion even if file deletion fails
      }
    }

    await PlacementAnalytics.deleteOne({ batch });

    // Emit socket event for real-time updates
    const io = req.app.get("io");
    if (io) {
      emitPlacementDataUpdate(io, "batch_deleted", { batch });
    }

    res.json({ message: "Analytics deleted successfully" });
  } catch (error) {
    console.error("Error deleting analytics:", error);
    res
      .status(500)
      .json({ message: "Error deleting analytics", error: error.message });
  }
});

module.exports = router;
