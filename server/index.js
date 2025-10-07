const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const XLSX = require('xlsx');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Repair priority scoring system
const PRIORITY_WEIGHTS = {
  safety: 10,
  structural: 9,
  water_damage: 8,
  electrical: 7,
  hvac: 6,
  plumbing: 5,
  cosmetic: 3,
  maintenance: 2
};

const URGENCY_LEVELS = {
  'Critical': 10,
  'High': 7,
  'Medium': 4,
  'Low': 1
};

// Cost estimation based on repair type and unit size
const COST_ESTIMATES = {
  'Roof Repair': { base: 5000, per_sqft: 15 },
  'HVAC System': { base: 3000, per_sqft: 8 },
  'Plumbing': { base: 800, per_sqft: 3 },
  'Electrical': { base: 1200, per_sqft: 4 },
  'Flooring': { base: 2000, per_sqft: 6 },
  'Windows': { base: 1500, per_sqft: 12 },
  'Paint': { base: 500, per_sqft: 2 },
  'Appliances': { base: 1000, per_sqft: 0 },
  'Structural': { base: 8000, per_sqft: 20 },
  'Water Damage': { base: 2000, per_sqft: 8 }
};

// Parse uploaded file
function parseFile(filePath, fileType) {
  return new Promise((resolve, reject) => {
    try {
      if (fileType === 'csv') {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        resolve(data);
      } else {
        reject(new Error('Unsupported file type'));
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Calculate repair priority score
function calculatePriorityScore(repair) {
  let score = 0;
  
  // Base priority from repair type
  const repairType = repair.repair_type?.toLowerCase() || '';
  if (repairType.includes('safety') || repairType.includes('structural')) {
    score += PRIORITY_WEIGHTS.safety;
  } else if (repairType.includes('water') || repairType.includes('leak')) {
    score += PRIORITY_WEIGHTS.water_damage;
  } else if (repairType.includes('electrical') || repairType.includes('electrical')) {
    score += PRIORITY_WEIGHTS.electrical;
  } else if (repairType.includes('hvac') || repairType.includes('heating') || repairType.includes('cooling')) {
    score += PRIORITY_WEIGHTS.hvac;
  } else if (repairType.includes('plumbing') || repairType.includes('pipe')) {
    score += PRIORITY_WEIGHTS.plumbing;
  } else {
    score += PRIORITY_WEIGHTS.cosmetic;
  }
  
  // Urgency multiplier
  const urgency = repair.urgency || 'Medium';
  score *= URGENCY_LEVELS[urgency] || URGENCY_LEVELS.Medium;
  
  // Age factor (older units get higher priority)
  const unitAge = parseInt(repair.unit_age) || 0;
  if (unitAge > 20) score *= 1.5;
  else if (unitAge > 10) score *= 1.2;
  
  // Impact factor (number of units affected)
  const unitsAffected = parseInt(repair.units_affected) || 1;
  score *= Math.log(unitsAffected + 1);
  
  return Math.round(score);
}

// Estimate repair cost
function estimateCost(repair) {
  const repairType = repair.repair_type || 'General';
  const unitSize = parseFloat(repair.unit_size) || 1000; // Default 1000 sqft
  
  let cost = 0;
  
  // Find matching cost estimate
  for (const [type, estimate] of Object.entries(COST_ESTIMATES)) {
    if (repairType.toLowerCase().includes(type.toLowerCase())) {
      cost = estimate.base + (estimate.per_sqft * unitSize);
      break;
    }
  }
  
  // If no match found, use general estimate
  if (cost === 0) {
    cost = 2000 + (unitSize * 5);
  }
  
  // Apply urgency multiplier
  const urgency = repair.urgency || 'Medium';
  const urgencyMultiplier = {
    'Critical': 1.5,
    'High': 1.3,
    'Medium': 1.0,
    'Low': 0.8
  };
  
  cost *= urgencyMultiplier[urgency] || 1.0;
  
  return Math.round(cost);
}

// Process repair data
function processRepairs(data) {
  return data.map(repair => {
    const priorityScore = calculatePriorityScore(repair);
    const estimatedCost = estimateCost(repair);
    
    return {
      ...repair,
      priority_score: priorityScore,
      estimated_cost: estimatedCost,
      priority_rank: 0 // Will be set after sorting
    };
  }).sort((a, b) => b.priority_score - a.priority_score)
    .map((repair, index) => ({
      ...repair,
      priority_rank: index + 1
    }));
}

// Generate budget summary
function generateBudgetSummary(processedRepairs) {
  const totalCost = processedRepairs.reduce((sum, repair) => sum + repair.estimated_cost, 0);
  const criticalRepairs = processedRepairs.filter(r => r.urgency === 'Critical');
  const highPriorityRepairs = processedRepairs.filter(r => r.urgency === 'High');
  
  const repairTypes = {};
  processedRepairs.forEach(repair => {
    const type = repair.repair_type || 'Unknown';
    if (!repairTypes[type]) {
      repairTypes[type] = { count: 0, totalCost: 0 };
    }
    repairTypes[type].count++;
    repairTypes[type].totalCost += repair.estimated_cost;
  });
  
  return {
    total_repairs: processedRepairs.length,
    total_estimated_cost: totalCost,
    critical_repairs: criticalRepairs.length,
    high_priority_repairs: highPriorityRepairs.length,
    repair_types_breakdown: repairTypes,
    top_10_priorities: processedRepairs.slice(0, 10)
  };
}

// API Routes
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const fileType = path.extname(req.file.originalname).toLowerCase().substring(1);
    
    // Parse the uploaded file
    const rawData = await parseFile(filePath, fileType);
    
    // Process the repairs
    const processedRepairs = processRepairs(rawData);
    
    // Generate summary
    const summary = generateBudgetSummary(processedRepairs);
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      repairs: processedRepairs,
      summary: summary
    });
    
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'Error processing file: ' + error.message });
  }
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

