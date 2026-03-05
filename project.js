// routes/project.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Get project details and workers
router.get('/project/:id', async (req, res) => {
  const projectId = req.params.id;
  try {
    const [projectRows] = await db.promise().query(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    );

    if (projectRows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const project = projectRows[0];

    const [contractWorkers] = await db.promise().query(
      'SELECT name FROM workers WHERE project_id = ? AND category = "contract"',
      [projectId]
    );

    const [dailyWorkers] = await db.promise().query(
      'SELECT name FROM workers WHERE project_id = ? AND category = "daily"',
      [projectId]
    );

    project.contractWorkers = contractWorkers.map(w => w.name);
    project.dailyWorkers = dailyWorkers.map(w => w.name);

    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;