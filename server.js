const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize database
const db = new sqlite3.Database('./bus_schedule.db', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

// Initialize tables
function initDb() {
  db.serialize(() => {
    // Create stops table
    db.run(`CREATE TABLE IF NOT EXISTS stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )`);

    // Create departures table
    db.run(`CREATE TABLE IF NOT EXISTS departures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stop_id INTEGER,
      departure_time TEXT NOT NULL,
      day_type TEXT NOT NULL DEFAULT 'weekday',
      FOREIGN KEY (stop_id) REFERENCES stops (id)
    )`);

    // Insert initial bus stops if they don't exist
    db.get("SELECT COUNT(*) as count FROM stops", (err, row) => {
      if (err) {
        console.error(err.message);
      } else if (row.count === 0) {
        // Insert default stops
        const stops = ["Lehmja", "Tornimäe"];
        stops.forEach(stop => {
          db.run("INSERT INTO stops (name) VALUES (?)", [stop], function(err) {
            if (err) {
              console.error(err.message);
            } else {
              console.log(`Added stop: ${stop} with ID: ${this.lastID}`);
            }
          });
        });

        // Add some sample departure times
        setTimeout(() => {
          const sampleDepartures = [
            { 
              stop: "Lehmja", 
              times: [
                { time: "07:30", dayType: "weekday" },
                { time: "08:15", dayType: "weekday" },
                { time: "09:00", dayType: "weekday" },
                { time: "12:30", dayType: "weekday" },
                { time: "16:45", dayType: "weekday" },
                { time: "18:00", dayType: "weekday" },
                { time: "09:30", dayType: "weekend" },
                { time: "12:00", dayType: "weekend" },
                { time: "15:30", dayType: "weekend" }
              ]
            },
            { 
              stop: "Tornimäe", 
              times: [
                { time: "07:45", dayType: "weekday" },
                { time: "08:30", dayType: "weekday" },
                { time: "09:15", dayType: "weekday" },
                { time: "12:45", dayType: "weekday" },
                { time: "17:00", dayType: "weekday" },
                { time: "18:15", dayType: "weekday" },
                { time: "09:45", dayType: "weekend" },
                { time: "12:15", dayType: "weekend" },
                { time: "15:45", dayType: "weekend" }
              ]
            }
          ];

          sampleDepartures.forEach(stopData => {
            db.get("SELECT id FROM stops WHERE name = ?", [stopData.stop], (err, row) => {
              if (err) {
                console.error(err.message);
              } else if (row) {
                stopData.times.forEach(timeData => {
                  db.run("INSERT INTO departures (stop_id, departure_time, day_type) VALUES (?, ?, ?)",
                    [row.id, timeData.time, timeData.dayType], function(err) {
                    if (err) {
                      console.error(err.message);
                    } else {
                      console.log(`Added ${timeData.dayType} departure time ${timeData.time} for stop ${stopData.stop}`);
                    }
                  });
                });
              }
            });
          });
        }, 1000); // Wait for stops to be inserted
      }
    });
  });
}

// API Routes

// Get all stops
app.get('/api/stops', (req, res) => {
  db.all("SELECT * FROM stops", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add a new stop
app.post('/api/stops', (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "Stop name is required" });
    return;
  }

  db.run("INSERT INTO stops (name) VALUES (?)", [name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name });
  });
});

// Delete a stop
app.delete('/api/stops/:id', (req, res) => {
  const stopId = req.params.id;
  
  // First delete all departures associated with this stop
  db.run("DELETE FROM departures WHERE stop_id = ?", [stopId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Then delete the stop itself
    db.run("DELETE FROM stops WHERE id = ?", [stopId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: "Stop deleted", changes: this.changes });
    });
  });
});

// Get next 3 departures for a stop
app.get('/api/departures/:stopId/next', (req, res) => {
  const stopId = req.params.stopId;
  const now = new Date();
  const timeStr = now.toTimeString().substring(0, 5); // Get current time in format HH:MM
  
  // Check if today is a weekend (0 = Sunday, 6 = Saturday)
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const dayType = isWeekend ? 'weekend' : 'weekday';

  db.all(
    `SELECT d.id, d.departure_time, d.day_type, s.name as stop_name 
     FROM departures d 
     JOIN stops s ON d.stop_id = s.id 
     WHERE d.stop_id = ? AND d.departure_time >= ? AND d.day_type = ?
     ORDER BY d.departure_time ASC
     LIMIT 3`,
    [stopId, timeStr, dayType],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Get all departures for a stop
app.get('/api/departures/:stopId', (req, res) => {
  const stopId = req.params.stopId;
  const dayType = req.query.dayType || 'all'; // Optional query parameter for filtering by day type

  let query = `SELECT d.id, d.departure_time, d.day_type, s.name as stop_name 
               FROM departures d 
               JOIN stops s ON d.stop_id = s.id 
               WHERE d.stop_id = ?`;
  
  const params = [stopId];
  
  if (dayType !== 'all') {
    query += ` AND d.day_type = ?`;
    params.push(dayType);
  }
  
  query += ` ORDER BY d.day_type, d.departure_time ASC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add a new departure time
app.post('/api/departures', (req, res) => {
  const { stop_id, departure_time, day_type } = req.body;
  if (!stop_id || !departure_time || !day_type) {
    res.status(400).json({ error: "Stop ID, departure time, and day type are required" });
    return;
  }

  // Validate time format (HH:MM)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(departure_time)) {
    res.status(400).json({ error: "Departure time must be in format HH:MM" });
    return;
  }
  
  // Validate day type
  if (day_type !== 'weekday' && day_type !== 'weekend') {
    res.status(400).json({ error: "Day type must be 'weekday' or 'weekend'" });
    return;
  }

  db.run(
    "INSERT INTO departures (stop_id, departure_time, day_type) VALUES (?, ?, ?)",
    [stop_id, departure_time, day_type],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        id: this.lastID,
        stop_id,
        departure_time,
        day_type
      });
    }
  );
});

// Delete a departure
app.delete('/api/departures/:id', (req, res) => {
  const id = req.params.id;
  
  db.run("DELETE FROM departures WHERE id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: "Departure deleted", changes: this.changes });
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT} at ${new Date().toISOString()}`);
  console.log(`Server hostname: ${require('os').hostname()}`);
  console.log(`Server IP: 0.0.0.0 (all interfaces)`);
});

// Close the database connection when the server is stopped
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Closed the database connection.');
    process.exit(0);
  });
});
