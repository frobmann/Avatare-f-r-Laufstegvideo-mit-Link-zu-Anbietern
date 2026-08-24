const express = require('express');
const {
  generateOutfitImage,
  generateWalkAnimation,
  generateAllOutfits,
  getGenerationHistory,
  getCostSummary,
} = require('../services/generation-pipeline');

const router = express.Router();

// Provider-Status prüfen
router.get('/status', (req, res) => {
  const provider = process.env.AI_PROVIDER || 'replicate';
  const hasToken = provider === 'replicate'
    ? !!process.env.REPLICATE_API_TOKEN
    : provider === 'huggingface'
      ? !!process.env.HUGGINGFACE_API_TOKEN
      : true;

  res.json({
    provider,
    configured: hasToken,
    tryonModel: process.env.TRYON_MODEL || 'cuuupid/idm-vton',
    videoModel: process.env.VIDEO_MODEL || 'stability-ai/stable-video-diffusion',
    quality: process.env.IMAGE_QUALITY || 'medium',
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_GENERATIONS) || 2,
    costEstimate: {
      perTryOn: '$0.01–0.03',
      perVideo: '$0.03–0.05',
      daily6Avatars: '$0.72–2.16',
      monthly6Avatars: '$22–65',
    },
  });
});

// Outfit-Bild für einen Avatar generieren
router.post('/outfit/:avatarId', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await generateOutfitImage(req.params.avatarId, date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Walking-Animation generieren
router.post('/walk/:avatarId', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await generateWalkAnimation(req.params.avatarId, date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alle Avatare für ein Datum generieren (Batch)
router.post('/batch', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await generateAllOutfits(date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generierungs-Historie
router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const history = getGenerationHistory(limit);
  res.json(history);
});

// Kosten-Übersicht
router.get('/costs', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const costs = getCostSummary(days);
  res.json(costs);
});

module.exports = router;
