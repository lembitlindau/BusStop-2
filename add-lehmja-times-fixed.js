const sqlite3 = require('sqlite3').verbose();

// Initialize database connection
const db = new sqlite3.Database('./bus_schedule.db', err => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the database.');
  
  // Get the ID for Lehmja
  db.get('SELECT id FROM stops WHERE name = ?', ['Lehmja'], (err, row) => {
    if (err) {
      console.error('Error finding Lehmja stop:', err.message);
      closeDb();
      return;
    }
    
    if (!row) {
      console.error('Lehmja stop not found in database');
      closeDb();
      return;
    }
    
    const lehmjaId = row.id;
    console.log(`Found Lehmja with ID: ${lehmjaId}`);
    
    // Clear existing departure times for Lehmja
    db.run('DELETE FROM departures WHERE stop_id = ?', [lehmjaId], err => {
      if (err) {
        console.error('Error clearing existing departures:', err.message);
        closeDb();
        return;
      }
      
      console.log('Cleared existing departures for Lehmja');
      
      // Weekday times (ETKNR)
      const weekdayTimes = [
        '06:05', '07:35', '08:21', '08:41', '10:25', '13:20', '16:35', '17:40',
        '06:33', '08:37', '14:37', '18:12',
        '06:40', '11:15', '14:51', '17:51',
        '07:03', '09:00',
        '07:13', '18:58',
        '09:17', '10:42', '14:02', '16:47', '18:22',
        '06:12', '07:48', '08:13', '09:33', '11:23', '13:28', '15:58',
        '08:59', '15:39',
        '19:04'
      ];
      
      // Weekend times (LP)
      const weekendTimes = [
        '10:55', '16:20', '19:47', '20:35', '21:27', '22:30',
        '-',
        '07:34', '11:14', '19:09',
        '-',
        '08:28', '15:48', '18:43',
        '07:51', '13:16', '16:06', '18:51',
        '06:27', '07:53', '10:53', '13:05', '13:53', '15:53', '18:53', '22:57',
        '17:28',
        '-'
      ];
      
      // Add all weekday times
      let inserted = 0;
      const totalToInsert = weekdayTimes.filter(t => t !== '-').length + 
                           weekendTimes.filter(t => t !== '-').length;
      
      weekdayTimes.forEach(time => {
        if (time === '-') return;
        
        db.run(
          'INSERT INTO departures (stop_id, departure_time, day_type) VALUES (?, ?, ?)',
          [lehmjaId, time, 'weekday'],
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
        
        db.run(
          'INSERT INTO departures (stop_id, departure_time, day_type) VALUES (?, ?, ?)',
          [lehmjaId, time, 'weekend'],
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
  });
});

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
