const sqlite3 = require('sqlite3').verbose();

// Initialize database connection
const db = new sqlite3.Database('./bus_schedule.db', err => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the database.');
  
  // First, add the Tuule stop if it doesn't exist
  db.run('INSERT OR IGNORE INTO stops (name) VALUES (?)', ['Tuule'], function(err) {
    if (err) {
      console.error('Error adding Tuule stop:', err.message);
      closeDb();
      return;
    }
    
    let tuuleId;
    if (this.changes > 0) {
      tuuleId = this.lastID;
      console.log(`Added new stop Tuule with ID: ${tuuleId}`);
    } else {
      // If stop already existed, get its ID
      db.get('SELECT id FROM stops WHERE name = ?', ['Tuule'], (err, row) => {
        if (err) {
          console.error('Error finding Tuule stop:', err.message);
          closeDb();
          return;
        }
        
        if (!row) {
          console.error('Tuule stop not found in database');
          closeDb();
          return;
        }
        
        tuuleId = row.id;
        console.log(`Found existing Tuule stop with ID: ${tuuleId}`);
        addDepartureTimes(tuuleId);
      });
      return;
    }
    
    addDepartureTimes(tuuleId);
  });
});

function addDepartureTimes(tuuleId) {
  // Delete existing departure times for Tuule
  db.run('DELETE FROM departures WHERE stop_id = ?', [tuuleId], err => {
    if (err) {
      console.error('Error clearing existing departures:', err.message);
      closeDb();
      return;
    }
    
    console.log('Cleared existing departures for Tuule');
    
    // Weekday times (ETKNR)
    const weekdayTimes = [
      '05:56', '07:26', '08:11', '08:36', '10:16', '13:11', '16:26', '17:31', '20:26', '22:21',
      '06:31', '19:00',
      '06:52', '07:41', '09:32', '11:12', '14:04', '15:32', '16:17', '17:34', '18:53', '20:16', '21:44', '23:03',
      '07:03', '18:48',
      '07:42', '14:42', '17:42', '20:11',
      '08:49', '15:29',
      '09:21', '12:21', '17:01', '19:36', '20:26',
      '11:06',
      '15:32', '18:53',
      '16:30',
      '15:18'
    ];
    
    // Weekend times (LP)
    const weekendTimes = [
      '10:46', '14:11', '17:16', '20:01', '20:51', '22:47',
      '07:25',
      '08:34', '09:36', '12:11', '14:16', '17:11', '18:26', '21:44',
      '08:18', '15:39', '18:33',
      '14:26',
      '17:18',
      '09:16', '12:20A', // Note: 12:20A has a special format
      '11:05',
      '09:36', '18:26',
      '-',
      '-'
    ];
    
    // Add all weekday times
    let inserted = 0;
    const totalToInsert = weekdayTimes.filter(t => t !== '-').length + 
                         weekendTimes.filter(t => t !== '-' && t !== '12:20A').length + 1; // +1 for the special 12:20 format
    
    weekdayTimes.forEach(time => {
      if (time === '-') return;
      
      db.run(
        'INSERT INTO departures (stop_id, departure_time) VALUES (?, ?)',
        [tuuleId, time],
        function(err) {
          if (err) {
            console.error(`Error adding weekday time ${time}:`, err.message);
          } else {
            console.log(`Added weekday time: ${time}`);
            checkCompletion(++inserted, totalToInsert);
          }
        }
      );
    });
    
    // Add all weekend times
    weekendTimes.forEach(time => {
      if (time === '-') return;
      
      // Handle special case for 12:20A
      if (time === '12:20A') {
        db.run(
          'INSERT INTO departures (stop_id, departure_time) VALUES (?, ?)',
          [tuuleId, '12:20'],
          function(err) {
            if (err) {
              console.error(`Error adding weekend time 12:20:`, err.message);
            } else {
              console.log(`Added weekend time: 12:20 (note: original had 'A' suffix)`);
              checkCompletion(++inserted, totalToInsert);
            }
          }
        );
        return;
      }
      
      db.run(
        'INSERT INTO departures (stop_id, departure_time) VALUES (?, ?)',
        [tuuleId, time],
        function(err) {
          if (err) {
            console.error(`Error adding weekend time ${time}:`, err.message);
          } else {
            console.log(`Added weekend time: ${time}`);
            checkCompletion(++inserted, totalToInsert);
          }
        }
      );
    });
  });
}

function checkCompletion(inserted, total) {
  if (inserted >= total) {
    console.log('All departure times have been added successfully.');
    closeDb();
  }
}

function closeDb() {
  db.close(err => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
}
