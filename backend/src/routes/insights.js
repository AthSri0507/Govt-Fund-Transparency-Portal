const express = require('express');
const { getInsights } = require('../insights/insights');
const router = express.Router();

// GET /insights/:projectId
router.get('/:id', async (req, res) => {
  const projectId = req.params.id;
  try {
    const ins = await getInsights(projectId);
    if (!ins) return res.status(404).json({ message: 'No insights available' });
    return res.json({ data: ins });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
