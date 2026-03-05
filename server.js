const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Make HTML available
const projectRoutes = require('./routes/project');
app.use('/', projectRoutes);


// Test route
app.get('/', (req, res) => {
  db.query('SELECT 1 + 1 AS solution', (err, results) => {
    if (err) return res.status(500).send('DB connection failed');
    res.send(`✅ Database connected! Test result: ${results[0].solution}`);
  });
});

// Signup route
app.post('/signup', (req, res) => {
  const { name, email, phone, address, password } = req.body;

  if (!name || !email || !phone || !address || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const query = 'INSERT INTO users (name, email, phone, address, password) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [name, email, phone, address, password], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Email already registered' });
      }
      console.error('Signup error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Signup successful', userId: result.insertId });
  });
});

// Login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const query = 'SELECT * FROM users WHERE email = ? AND password = ?';
  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = results[0];
    res.json({ message: 'Login successful', userId: user.id, name: user.name });
  });
});

// GET user profile
app.get('/user/:userId', (req, res) => {
  db.query('SELECT id, name, email, phone, address FROM users WHERE id = ?', [req.params.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!results.length) return res.status(404).json({ error: 'User not found' });
    res.json(results[0]);
  });
});

// PUT update user profile
app.put('/user/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address } = req.body;

  if (!name || !email || !phone || !address) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const sql = `UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?`;
  db.query(sql, [name, email, phone, address, id], (err, result) => {
    if (err) {
      console.error('Profile update error:', err);
      return res.status(500).json({ error: 'Database update failed' });
    }

    res.json({ message: 'Profile updated successfully' });
  });
});


// GET all projects for a user
app.get('/projects/:userId', (req, res) => {
  db.query('SELECT id, name, type, deadline FROM projects WHERE user_id = ?', [req.params.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});


// POST new project with response insertId
app.post('/projects', (req, res) => {
  const { name, type, user_id, deadline, total_amount } = req.body;

  const sql = 'INSERT INTO projects (name, type, user_id, deadline, total_amount) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [name, type, user_id, deadline, total_amount], (err, result) => {
    if (err) {
      console.error('Error inserting project:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Project added', insertId: result.insertId });
  });
});

// PUT update existing project by ID
app.put('/projects/:id', (req, res) => {
  const { id } = req.params;
  const { name, deadline, total_amount } = req.body;

  const fields = [];
  const values = [];

  if (name !== undefined) {
    fields.push('name = ?');
    values.push(name);
  }
  if (deadline !== undefined) {
    fields.push('deadline = ?');
    values.push(deadline);
  }
  if (total_amount !== undefined) {
    fields.push('total_amount = ?');
    values.push(total_amount);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);

  const sql = `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`;
  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Project update error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Project updated successfully' });
  });
});



//Deleting the projects
app.delete('/delete-projects', async (req, res) => {
  const { projectIds } = req.body;

  if (!projectIds || !Array.isArray(projectIds)) {
    return res.status(400).json({ message: 'Invalid request.' });
  }

  try {
    for (const projectId of projectIds) {
      // 1. Fetch project details
      const [projectRows] = await db.promise().query("SELECT * FROM projects WHERE id = ?", [projectId]);
      const project = projectRows[0];
      if (!project) continue;

      // 2. Fetch related attendance
      const [attendanceRows] = await db.promise().query("SELECT * FROM attendance WHERE project_id = ?", [projectId]);

      // 3. Fetch related users (distinct users from attendance present_workers JSON)
      const userIdsSet = new Set();
      attendanceRows.forEach(att => {
        try {
          const present = JSON.parse(att.present_workers);
          present.forEach(uid => userIdsSet.add(uid));
        } catch (_) {}
      });
      const userIds = Array.from(userIdsSet);

      let userRows = [];
      if (userIds.length > 0) {
        const placeholders = userIds.map(() => '?').join(',');
        const [users] = await db.promise().query(`SELECT * FROM users WHERE id IN (${placeholders})`, userIds);
        userRows = users;
      }

      // 4. Insert into bin table
      await db.promise().query(
        `INSERT INTO bin (project_id, name, type, deadline, total_amount, pending_amount, deleted_at, project_data, attendance_data, user_data)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
        [
          project.id,
          project.name,
          project.type,
          project.deadline,
          project.total_amount,
          project.pending_amount,
          JSON.stringify(project),
          JSON.stringify(attendanceRows),
          JSON.stringify(userRows)
        ]
      );

      // 5. Delete from attendance table
      await db.promise().query("DELETE FROM attendance WHERE project_id = ?", [projectId]);

      // 6. Delete from projects table
      await db.promise().query("DELETE FROM projects WHERE id = ?", [projectId]);
    }

    res.json({ message: 'Projects moved to bin and deleted successfully.' });
  } catch (err) {
    console.error('Error processing deletion:', err);
    res.status(500).json({ message: 'Server error during project deletion.' });
  }
});



//individual worker attendance
app.get('/project/:projectId/attendance/worker/:workerId', async (req, res) => {
  const { projectId, workerId } = req.params;

  function safeJsonParse(str) {
    try {
      if (typeof str === 'string') {
        if (str.startsWith('"') && str.endsWith('"')) {
          str = str.slice(1, -1).replace(/\\"/g, '"');
        }
        return JSON.parse(str);
      }
      return str;
    } catch (err) {
      console.log('❌ Invalid JSON:', str);
      return null;
    }
  }

  try {
    const [rows] = await db.promise().query(
      'SELECT date, present_workers FROM attendance WHERE project_id = ? ORDER BY date DESC',
      [projectId]
    );

    const attendanceData = [];
    const absentDates = [];
    let presentCount = 0;

    for (const record of rows) {
      const workers = safeJsonParse(record.present_workers);
      if (!workers) {
        console.log('❌ Invalid JSON:', record.present_workers);
        continue;
      }

      const matched = workers.find(w => String(w.id) === String(workerId));
      if (matched) {
        if (matched.status === 'full') presentCount += 2;
        else if (matched.status === 'half') presentCount += 1;

        attendanceData.push({
          date: record.date,
          status: matched.status,
          name: matched.name,
          category: matched.category
        });
      } else {
        // Worker was not present — add to absents
        absentDates.push(record.date);
      }
    }

    const totalSessions = rows.length * 2;
    const percentage = totalSessions > 0 ? ((presentCount / totalSessions) * 100).toFixed(2) : '0.00';

    res.json({
      name: attendanceData[0]?.name || '',
      category: attendanceData[0]?.category || '',
      totalSessions,
      presentSessions: presentCount,
      percentage,
      records: attendanceData,
      absents: absentDates
    });
  } catch (err) {
    console.error('❌ Worker attendance fetch error:', err);
    res.status(500).json({ error: 'Server error while fetching worker attendance' });
  }
});




//Update Payments
app.put('/projects/:id/payments', (req, res) => {
  const { id } = req.params;
  const { received, pending } = req.body;

  // First, fetch project type and total_amount
  db.query('SELECT type, total_amount FROM projects WHERE id = ?', [id], (err, results) => {
    if (err || results.length === 0) {
      console.error('Fetch error:', err);
      return res.status(500).json({ error: 'Project not found or error occurred' });
    }

    const { type, total_amount } = results[0];

    if (type === 'contract') {
      const updatedPending = total_amount - received;

      const sql = 'UPDATE projects SET amount_received = ?, pending_amount = ? WHERE id = ?';
      db.query(sql, [received, updatedPending, id], (err, result) => {
        if (err) {
          console.error('Update error:', err);
          return res.status(500).json({ error: 'Update failed' });
        }
        res.json({ message: 'Contract payment updated' });
      });

    } else {
      // For daily-based, both fields come from frontend
      const sql = 'UPDATE projects SET amount_received = ?, pending_amount = ? WHERE id = ?';
      db.query(sql, [received, pending, id], (err, result) => {
        if (err) {
          console.error('Update error:', err);
          return res.status(500).json({ error: 'Update failed' });
        }
        res.json({ message: 'Daily payment updated' });
      });
    }
  });
});




// POST attendance for project on given date
app.post('/project/:id/attendance', async (req, res) => {
  const projectId = req.params.id;
  const { date, presentWorkers } = req.body; // presentWorkers is an array from frontend

  if (!date || !Array.isArray(presentWorkers)) {
    console.log("Invalid data received:", req.body);
    return res.status(400).send("Invalid data format");
  }

  try {
    const payload = JSON.stringify(presentWorkers); // Converts array to JSON string
    const [result] = await db.promise().execute(
      'INSERT INTO attendance (project_id, date, present_workers) VALUES (?, ?, ?)',
      [projectId, date, payload] // Inserts JSON string into JSON column
    );
    res.status(200).send("Attendance saved");
    
  } catch (err) {
    console.error("Insert error:", err.stack);
    res.status(500).send("Internal Server Error");
  }
});



// Add worker to workers table
app.post('/project/:id/workers', (req, res) => {
  const pid = req.params.id;
  const { name, type } = req.body;
  const sql = 'INSERT INTO workers (name, category, project_id) VALUES (?, ?, ?)';
  db.query(sql, [name, type, pid], (err, result) => {
    if (err) {
      console.error('Worker insert error:', err);
      return res.status(500).json({ error: 'DB error' });
    }
    res.json({ id: result.insertId, name, type });
  });
});

app.get('/project/:id/workers', (req, res) => {
  const projectId = req.params.id;
  const sql = 'SELECT * FROM workers WHERE project_id = ?';

  db.query(sql, [projectId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results); // Return list of workers
  });
});



// Get project by ID and include its workers
app.get('/project/:id', (req, res) => {
  const pid = req.params.id;

  const sqlProject = 'SELECT * FROM projects WHERE id = ?';
  const sqlWorkers = 'SELECT id, name, category FROM workers WHERE project_id = ?';

  db.query(sqlProject, [pid], (err, projectResults) => {
    if (err || projectResults.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    db.query(sqlWorkers, [pid], (err, workerResults) => {
      if (err) return res.status(500).json({ error: "Worker query failed" });

      // Don't map to just names — keep full objects
      const contractWorkers = workerResults.filter(w => w.category === 'contract');
      const dailyWorkers = workerResults.filter(w => w.category === 'daily');

      console.log('workerResults:', workerResults);
      res.json({
        ...projectResults[0],
        contractWorkers,
        dailyWorkers
      });
    });
  });
});


app.post('/workers', (req, res) => {
  const { name, category, project_id } = req.body;
  const sql = 'INSERT INTO workers (name, category, project_id) VALUES (?, ?, ?)';
  db.query(sql, [name, category, project_id], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ id: result.insertId });
  });
});



// Unified GET attendance route (dates OR filtered data)
// Filter attendance by date range and worker type
app.get('/project/:projectId/attendance', async (req, res) => {
  const pid = req.params.projectId;
  const { start, end, type } = req.query;

   // Helper function to safely parse JSON
  function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch (err) {
      return null;
    }
  }

  // If filter parameters are NOT present, return basic attendance list
  if (!start || !end || !type) {
    try {
      const [results] = await db.promise().query(
        'SELECT id, date, present_workers FROM attendance WHERE project_id = ? ORDER BY date DESC',
        [pid]
      );
      return res.json(results);
    } catch (err) {
      console.error('❌ DB error:', err);
      return res.status(500).json({ error: 'DB error' });
    }
  }

  // Otherwise, run filter logic

  try {
    const [rows] = await db.promise().query(
      `SELECT * FROM attendance WHERE project_id = ? AND date BETWEEN ? AND ?`,
      [pid, start, end]
    );

    console.log(`📊 Total attendance rows fetched: ${rows.length}`);

    const allSessions = [];
    const contractSummary = [];
    const dailySummary = [];

    const contractMap = {};
    const dailyMap = {};

    for (const record of rows) {
      const attendance = safeJsonParse(record.present_workers);
      if (!attendance) {
        continue;
      }

      for (const w of attendance) {
        allSessions.push({ ...w, date: record.date });

        const map = w.category === 'contract' ? contractMap : dailyMap;

        if (!map[w.id]) {
          map[w.id] = { name: w.name, total: 0, present: 0 };
        }

        map[w.id].total += 1;
        if (w.status === 'full' || w.status === 'half') {
          map[w.id].present += 1;
        }
      }
    }

    for (const [wid, worker] of Object.entries(contractMap)) {
      contractSummary.push({
        id: wid,
        name: worker.name,
        total: worker.total,
        present: worker.present,
        percentage: ((worker.present / worker.total) * 100).toFixed(2)
      });
    }

    for (const [wid, worker] of Object.entries(dailyMap)) {
      dailySummary.push({
        id: wid,
        name: worker.name,
        total: worker.total,
        present: worker.present,
        percentage: ((worker.present / worker.total) * 100).toFixed(2)
      });
    }

    const detailedMap = {};
    for (const session of allSessions) {
      const { id, name, category, date, status } = session;
      if (!detailedMap[id]) {
        detailedMap[id] = {
          id,
          name,
          category,
          dates: [],
          statuses: []
        };
      }
      detailedMap[id].dates.push(date);
      detailedMap[id].statuses.push(status);
    }

    const detailedAttendance = Object.values(detailedMap);
    res.json(rows); // Return raw attendance rows (same format as unfiltered)

  } catch (error) {
    console.error("❌ Filter route error:", error.stack);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});




app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});