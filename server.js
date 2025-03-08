const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

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
            { stop: "Lehmja", times: ["07:30", "08:15", "09:00", "12:30", "16:45", "18:00"] },
            { stop: "Tornimäe", times: ["07:45", "08:30", "09:15", "12:45", "17:00", "18:15"] }
          ];

          sampleDepartures.forEach(stopData => {
            db.get("SELECT id FROM stops WHERE name = ?", [stopData.stop], (err, row) => {
              if (err) {
                console.error(err.message);
              } else if (row) {
                stopData.times.forEach(time => {
                  db.run("INSERT INTO departures (stop_id, departure_time) VALUES (?, ?)",
                    [row.id, time], function(err) {
                    if (err) {
                      console.error(err.message);
                    } else {
                      console.log(`Added departure time ${time} for stop ${stopData.stop}`);
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

// Get next 3 departures for a stop
app.get('/api/departures/:stopId/next', (req, res) => {
  const stopId = req.params.stopId;
  const now = new Date();
  const timeStr = now.toTimeString().substring(0, 5); // Get current time in format HH:MM

  db.all(
    `SELECT d.id, d.departure_time, s.name as stop_name 
     FROM departures d 
     JOIN stops s ON d.stop_id = s.id 
     WHERE d.stop_id = ? AND d.departure_time >= ?
     ORDER BY d.departure_time ASC
     LIMIT 3`,
    [stopId, timeStr],
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

  db.all(
    `SELECT d.id, d.departure_time, s.name as stop_name 
     FROM departures d 
     JOIN stops s ON d.stop_id = s.id 
     WHERE d.stop_id = ?
     ORDER BY d.departure_time ASC`,
    [stopId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Add a new departure time
app.post('/api/departures', (req, res) => {
  const { stop_id, departure_time } = req.body;
  if (!stop_id || !departure_time) {
    res.status(400).json({ error: "Stop ID and departure time are required" });
    return;
  }

  // Validate time format (HH:MM)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(departure_time)) {
    res.status(400).json({ error: "Departure time must be in format HH:MM" });
    return;
  }

  db.run(
    "INSERT INTO departures (stop_id, departure_time) VALUES (?, ?)",
    [stop_id, departure_time],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        id: this.lastID,
        stop_id,
        departure_time
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
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
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
