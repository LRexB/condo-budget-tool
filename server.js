const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'client/build')));

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

// Database management
let db = null;
let currentDbPath = null;

// Create database directory if it doesn't exist
const dbDir = path.join(__dirname, 'databases');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Function to create a new database
function createNewDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dbPath = path.join(dbDir, `condo_repairs_${timestamp}.db`);
  
  // Close existing database if open
  if (db) {
    db.close();
  }
  
  // Create new database
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error creating new database:', err.message);
    } else {
      console.log(`New database created: ${dbPath}`);
      currentDbPath = dbPath;
      initializeTables();
    }
  });
  
  return dbPath;
}

// Function to initialize database tables
function initializeTables() {
  if (!db) return;
  
  // Units table
  db.run(`CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address_number TEXT,
    address_street TEXT,
    name1 TEXT,
    name2 TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Repair items table
  db.run(`CREATE TABLE IF NOT EXISTS repair_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER,
    repair_type TEXT,
    description TEXT,
    priority INTEGER DEFAULT 1,
    estimated_cost REAL DEFAULT 0,
    supplier TEXT,
    required_completion_date TEXT,
    actual_completion_status TEXT DEFAULT 'incomplete',
    actual_completion_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (unit_id) REFERENCES units (id)
  )`);
}

// Initialize by loading the most recent database or creating a new one
function initializeDatabase() {
  // Check if databases directory exists and has files
  if (fs.existsSync(dbDir)) {
    fs.readdir(dbDir, (err, files) => {
      if (err) {
        console.error('Error reading databases directory:', err);
        createNewDatabase();
        return;
      }
      
      const dbFiles = files
        .filter(file => file.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(dbDir, file),
          created: fs.statSync(path.join(dbDir, file)).birthtime
        }))
        .sort((a, b) => b.created - a.created); // Most recent first
      
      if (dbFiles.length > 0) {
        // Load the most recent database
        const mostRecent = dbFiles[0];
        console.log(`Loading most recent database: ${mostRecent.name}`);
        
        db = new sqlite3.Database(mostRecent.path, (err) => {
          if (err) {
            console.error('Error loading database:', err);
            createNewDatabase();
          } else {
            currentDbPath = mostRecent.path;
            console.log(`Successfully loaded database: ${mostRecent.name}`);
          }
        });
      } else {
        // No databases found, create a new one
        console.log('No existing databases found, creating new one');
        createNewDatabase();
      }
    });
  } else {
    // No databases directory, create a new one
    console.log('No databases directory found, creating new one');
    createNewDatabase();
  }
}

// Initialize the database system
initializeDatabase();

// Parse CSV file
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        console.log('CSV parsing complete. Total rows:', results.length);
        if (results.length > 0) {
          console.log('All columns found:', Object.keys(results[0]));
          console.log('Column count:', Object.keys(results[0]).length);
        }
        // Clean up uploaded file
        fs.unlinkSync(filePath);
        resolve(results);
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        reject(error);
      });
  });
}

// API Routes

// Upload and process CSV file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Create a new database for this CSV upload (replaces current session)
    const newDbPath = createNewDatabase();
    console.log('Created new database for upload:', newDbPath);

    const filePath = req.file.path;
    const csvData = await parseCSV(filePath);

    // Process the CSV data
    const processedData = [];
    
    console.log('CSV Data received:', csvData.length, 'rows');
    if (csvData.length > 0) {
      const allColumns = Object.keys(csvData[0]);
      console.log('Available columns:', allColumns);
      console.log('Total column count:', allColumns.length);
      console.log('First 4 columns (fixed):', allColumns.slice(0, 4));
      console.log('Remaining columns (repair items):', allColumns.slice(4));
    }
    
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const columns = Object.keys(row);
      const fixedColumns = columns.slice(0, 4); // First 4 columns are fixed
      const repairColumns = columns.slice(4); // Remaining columns are repair items

      // Extract fixed data using the actual column names from the CSV
      const unitData = {
        address_number: row[fixedColumns[0]] || '',
        address_street: row[fixedColumns[1]] || '',
        name1: row[fixedColumns[2]] || '',
        name2: row[fixedColumns[3]] || ''
      };

      // Extract repair items - only create items that have descriptions
      const repairItems = repairColumns
        .map(column => ({
          repair_type: column,
          description: row[column] || '',
          priority: 1,
          estimated_cost: 0,
          supplier: '',
          completion_date: ''
        }))
        .filter(item => item && item.description && item.description.trim() !== ''); // Only include items with descriptions

      console.log(`Unit ${i + 1} (${unitData.address_number} ${unitData.address_street}): ${repairItems.length} repair items`);
      repairItems.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.repair_type}: "${item.description}"`);
      });

      processedData.push({
        id: i + 1, // Temporary ID for frontend
        address_number: unitData.address_number,
        address_street: unitData.address_street,
        name1: unitData.name1,
        name2: unitData.name2,
        repair_items: repairItems
      });
    }

    // Automatically save the data to the database
    try {
      console.log(`Starting to save ${processedData.length} units to database`);
      // Insert units and repair items into the database
      for (const unitData of processedData) {
        console.log(`Saving unit: ${unitData.address_number} ${unitData.address_street}`);
        const unitResult = await new Promise((resolve, reject) => {
          db.run(`
            INSERT INTO units (address_number, address_street, name1, name2)
            VALUES (?, ?, ?, ?)
          `, [unitData.address_number, unitData.address_street, unitData.name1, unitData.name2], function(err) {
            if (err) {
              console.error('Error inserting unit:', err);
              reject(err);
            } else {
              console.log(`Unit inserted with ID: ${this.lastID}`);
              resolve(this.lastID);
            }
          });
        });

        // Insert repair items for this unit
        console.log(`Inserting ${unitData.repair_items.length} repair items for unit ${unitResult}`);
        for (const repairItem of unitData.repair_items) {
          // Skip undefined or null repair items
          if (!repairItem) {
            console.log('Skipping undefined repair item');
            continue;
          }
          
          console.log(`Inserting repair item: ${repairItem.repair_type} - ${repairItem.description}`);
          await new Promise((resolve, reject) => {
            db.run(`
              INSERT INTO repair_items (unit_id, repair_type, description, priority, estimated_cost, supplier, required_completion_date, actual_completion_status, actual_completion_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              unitResult,
              repairItem.repair_type || '',
              repairItem.description || '',
              repairItem.priority || 1,
              repairItem.estimated_cost || 0,
              repairItem.supplier || '',
              repairItem.required_completion_date || repairItem.completion_date || '',
              repairItem.actual_completion_status || 'incomplete',
              repairItem.actual_completion_date || ''
            ], function(err) {
              if (err) {
                console.error('Error inserting repair item:', err);
                reject(err);
              } else {
                console.log(`Repair item inserted with ID: ${this.lastID}`);
                resolve();
              }
            });
          });
        }
      }
      
      console.log(`Automatically saved ${processedData.length} units to database`);
    } catch (saveError) {
      console.error('Error auto-saving data:', saveError);
      // Continue anyway - data is still returned to frontend
    }

    res.json({
      success: true,
      data: processedData,
      total_units: processedData.length
    });

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'Error processing file: ' + error.message });
  }
});

// Save data to database
app.post('/api/save-data', (req, res) => {
  const { units } = req.body;
  
  db.serialize(() => {
    // Clear existing data
    db.run('DELETE FROM repair_items');
    db.run('DELETE FROM units');
    
    const stmt = db.prepare('INSERT INTO units (address_number, address_street, name1, name2) VALUES (?, ?, ?, ?)');
    const repairStmt = db.prepare('INSERT INTO repair_items (unit_id, repair_type, description, priority, estimated_cost, supplier, required_completion_date, actual_completion_status, actual_completion_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    
    let completedUnits = 0;
    const totalUnits = units.length;
    
    units.forEach((unitData, index) => {
      // Skip undefined units
      if (!unitData) {
        console.log(`Skipping undefined unit at index ${index}`);
        return;
      }
      
      // Handle both flat and nested data structures
      const address_number = unitData.address_number || unitData.unit?.address_number;
      const address_street = unitData.address_street || unitData.unit?.address_street;
      const name1 = unitData.name1 || unitData.unit?.name1;
      const name2 = unitData.name2 || unitData.unit?.name2;
      
      stmt.run([address_number, address_street, name1, name2], function(err) {
        if (err) {
          console.error('Error inserting unit:', err);
          return;
        }
        
        const unitId = this.lastID;
        
        // Insert repair items for this unit
        if (unitData.repair_items && Array.isArray(unitData.repair_items)) {
          unitData.repair_items.forEach(repair => {
            // Skip undefined repair items
            if (!repair) {
              console.log('Skipping undefined repair item');
              return;
            }
            
            repairStmt.run([
              unitId,
              repair.repair_type || '',
              repair.description || '',
              repair.priority || 1,
              repair.estimated_cost || 0,
              repair.supplier || '',
              repair.required_completion_date || '',
              repair.actual_completion_status || 'incomplete',
              repair.actual_completion_date || ''
            ], function(err) {
              if (err) {
                console.error('Error inserting repair item:', err);
              }
            });
          });
        }
        
        completedUnits++;
        if (completedUnits === totalUnits) {
          // All units processed, now finalize statements
          stmt.finalize();
          repairStmt.finalize();
          
          // Get the saved data with IDs
          db.all(`
            SELECT u.*, 
                   ri.id as repair_id,
                   ri.repair_type,
                   ri.description,
                   ri.priority,
                   ri.estimated_cost,
                   ri.supplier,
                   ri.required_completion_date,
                   ri.actual_completion_status,
                   ri.actual_completion_date
            FROM units u
            LEFT JOIN repair_items ri ON u.id = ri.unit_id
            ORDER BY u.id, ri.id
          `, (err, rows) => {
            if (err) {
              console.error('Error fetching saved data:', err);
              res.json({ success: true, message: 'Data saved successfully' });
              return;
            }
            
            // Group the data by unit
            const groupedData = {};
            rows.forEach(row => {
              if (!groupedData[row.id]) {
                groupedData[row.id] = {
                  unit: {
                    id: row.id,
                    address_number: row.address_number,
                    address_street: row.address_street,
                    name1: row.name1,
                    name2: row.name2
                  },
                  repair_items: []
                };
              }
              
              if (row.repair_id) {
                groupedData[row.id].repair_items.push({
                  id: row.repair_id,
                  repair_type: row.repair_type,
                  description: row.description,
                  priority: row.priority,
                  estimated_cost: row.estimated_cost,
                  supplier: row.supplier,
                  required_completion_date: row.required_completion_date,
                  actual_completion_status: row.actual_completion_status,
                  actual_completion_date: row.actual_completion_date
                });
              }
            });
            
            res.json({ 
              success: true, 
              message: 'Data saved successfully',
              savedData: Object.values(groupedData)
            });
          });
        }
      });
    });
  });
});

// Get all units
app.get('/api/units', (req, res) => {
  db.all(`
    SELECT u.*, 
           COUNT(ri.id) as repair_count,
           SUM(ri.estimated_cost) as total_cost
    FROM units u
    LEFT JOIN repair_items ri ON u.id = ri.unit_id
    GROUP BY u.id
    ORDER BY u.address_number
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get unit details with repair items
app.get('/api/units/:id', (req, res) => {
  const unitId = req.params.id;
  
  db.get('SELECT * FROM units WHERE id = ?', [unitId], (err, unit) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!unit) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }
    
    db.all('SELECT * FROM repair_items WHERE unit_id = ? ORDER BY priority DESC, repair_type', [unitId], (err, repairItems) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        unit,
        repair_items: repairItems
      });
    });
  });
});

// Update repair item
app.put('/api/repair-items/:id', (req, res) => {
  const { priority, estimated_cost, supplier, required_completion_date, actual_completion_status, actual_completion_date } = req.body;
  const itemId = req.params.id;
  
  if (!itemId || isNaN(parseInt(itemId))) {
    return res.status(400).json({ error: 'Invalid repair item ID' });
  }
  
  db.run(
    'UPDATE repair_items SET priority = ?, estimated_cost = ?, supplier = ?, required_completion_date = ?, actual_completion_status = ?, actual_completion_date = ? WHERE id = ?',
    [priority, estimated_cost, supplier, required_completion_date, actual_completion_status, actual_completion_date, itemId],
    function(err) {
      if (err) {
        console.error('Error updating repair item:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, changes: this.changes });
    }
  );
});

// Get cost analysis
app.get('/api/analysis/costs', (req, res) => {
  if (!db) {
    return res.status(400).json({ error: 'No database loaded. Please upload a CSV file first.' });
  }
  
  db.all(`
    SELECT 
      SUM(estimated_cost) as total_cost,
      AVG(estimated_cost) as average_cost,
      COUNT(*) as total_repairs,
      SUM(CASE WHEN priority >= 8 THEN estimated_cost ELSE 0 END) as high_priority_cost
    FROM repair_items
  `, (err, rows) => {
    if (err) {
      console.error('Error in cost analysis:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows[0] || { total_cost: 0, average_cost: 0, total_repairs: 0, high_priority_cost: 0 });
  });
});

// Get supplier analysis
app.get('/api/analysis/suppliers', (req, res) => {
  if (!db) {
    return res.status(400).json({ error: 'No database loaded. Please upload a CSV file first.' });
  }
  
  db.all(`
    SELECT 
      supplier,
      COUNT(*) as repair_count,
      SUM(estimated_cost) as total_cost,
      AVG(estimated_cost) as average_cost
    FROM repair_items 
    WHERE supplier != '' AND supplier IS NOT NULL
    GROUP BY supplier
    ORDER BY total_cost DESC
  `, (err, rows) => {
    if (err) {
      console.error('Error in supplier analysis:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// Get unit analysis
app.get('/api/analysis/units', (req, res) => {
  if (!db) {
    return res.status(400).json({ error: 'No database loaded. Please upload a CSV file first.' });
  }
  
  db.all(`
    SELECT 
      u.address_number,
      u.address_street,
      u.name1,
      u.name2,
      COUNT(ri.id) as repair_count,
      SUM(ri.estimated_cost) as total_cost,
      AVG(ri.priority) as average_priority
    FROM units u
    LEFT JOIN repair_items ri ON u.id = ri.unit_id
    GROUP BY u.id
    ORDER BY total_cost DESC
  `, (err, rows) => {
    if (err) {
      console.error('Error in unit analysis:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// Get date analysis
app.get('/api/analysis/dates', (req, res) => {
  if (!db) {
    return res.status(400).json({ error: 'No database loaded. Please upload a CSV file first.' });
  }
  
  db.all(`
    SELECT 
      required_completion_date as completion_date,
      COUNT(*) as repair_count,
      SUM(estimated_cost) as total_cost
    FROM repair_items 
    WHERE required_completion_date != '' AND required_completion_date IS NOT NULL
    GROUP BY required_completion_date
    ORDER BY required_completion_date
  `, (err, rows) => {
    if (err) {
      console.error('Error in date analysis:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// Get repair type analysis
app.get('/api/analysis/repair-types', (req, res) => {
  if (!db) {
    return res.status(400).json({ error: 'No database loaded. Please upload a CSV file first.' });
  }
  
  db.all(`
    SELECT 
      repair_type,
      COUNT(*) as count,
      SUM(estimated_cost) as total_cost,
      AVG(estimated_cost) as average_cost,
      SUM(CASE WHEN priority >= 7 THEN 1 ELSE 0 END) as high_priority_count
    FROM repair_items 
    GROUP BY repair_type
    ORDER BY total_cost DESC
  `, (err, rows) => {
    if (err) {
      console.error('Error in repair type analysis:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// Debug endpoint to check database contents
app.get('/api/debug/database', (req, res) => {
  if (!db) {
    return res.status(400).json({ error: 'No database loaded' });
  }
  
  // Check units count
  db.get('SELECT COUNT(*) as unit_count FROM units', (err, unitResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Check repair items count
    db.get('SELECT COUNT(*) as repair_count FROM repair_items', (err, repairResult) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.json({
        units: unitResult.unit_count,
        repair_items: repairResult.repair_count,
        database_loaded: !!db
      });
    });
  });
});

// List available databases
app.get('/api/databases', (req, res) => {
  fs.readdir(dbDir, (err, files) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const dbFiles = files
      .filter(file => file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(dbDir, file),
        created: fs.statSync(path.join(dbDir, file)).birthtime
      }))
      .sort((a, b) => b.created - a.created); // Most recent first
    
    res.json(dbFiles);
  });
});

// Create a new session (new database)
app.post('/api/new-session', (req, res) => {
  try {
    const newDbPath = createNewDatabase();
    console.log('Created new session database:', newDbPath);
    res.json({ 
      success: true, 
      message: 'New session created successfully',
      databasePath: newDbPath 
    });
  } catch (error) {
    console.error('Error creating new session:', error);
    res.status(500).json({ error: 'Failed to create new session' });
  }
});

// Load a specific database
app.post('/api/load-database', (req, res) => {
  const { dbPath } = req.body;
  
  if (!dbPath || !fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Invalid database path' });
  }
  
  // Close current database
  if (db) {
    db.close();
  }
  
  // Open the specified database
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    currentDbPath = dbPath;
    console.log(`Loaded database: ${dbPath}`);
    res.json({ success: true, message: 'Database loaded successfully' });
  });
});

// Load previous session data
app.get('/api/load-session', (req, res) => {
  db.all(`
    SELECT u.*, 
           ri.id as repair_id,
           ri.repair_type,
           ri.description,
           ri.priority,
           ri.estimated_cost,
           ri.supplier,
           ri.required_completion_date,
           ri.actual_completion_status,
           ri.actual_completion_date
    FROM units u
    LEFT JOIN repair_items ri ON u.id = ri.unit_id
    ORDER BY u.id, ri.id
  `, (err, rows) => {
    if (err) {
      console.error('Error loading session:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (rows.length === 0) {
      res.json([]);
      return;
    }
    
    // Group the data by unit
    const groupedData = {};
    rows.forEach(row => {
      if (!groupedData[row.id]) {
        groupedData[row.id] = {
          id: row.id,
          address_number: row.address_number,
          address_street: row.address_street,
          name1: row.name1,
          name2: row.name2,
          repair_items: []
        };
      }
      
      if (row.repair_id) {
        groupedData[row.id].repair_items.push({
          id: row.repair_id,
          repair_type: row.repair_type,
          description: row.description,
          priority: row.priority,
          estimated_cost: row.estimated_cost,
          supplier: row.supplier,
          required_completion_date: row.required_completion_date,
          actual_completion_status: row.actual_completion_status,
          actual_completion_date: row.actual_completion_date
        });
      }
    });
    
    res.json(Object.values(groupedData));
  });
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
