/**
 * AI Provider Abstraktion
 *
 * Unterstützt mehrere Provider mit einheitlicher Schnittstelle.
 * Standard: Replicate (günstigster Cloud-Provider für IDM-VTON)
 *
 * Kosten-Vergleich pro Bild:
 *   Replicate IDM-VTON:  ~$0.01–0.03
 *   Replicate Kolors:    ~$0.02–0.04
 *   Hugging Face:        ~$0.01–0.02 (langsamer)
 *   Seed 2.5:            ~$0.03–0.08
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Provider-Konfiguration aus Umgebungsvariablen
const CONFIG = {
  provider: process.env.AI_PROVIDER || 'replicate',
  replicate: {
    token: process.env.REPLICATE_API_TOKEN || '',
    tryonModel: process.env.TRYON_MODEL || 'cuuupid/idm-vton',
    videoModel: process.env.VIDEO_MODEL || 'stability-ai/stable-video-diffusion',
  },
  huggingface: {
    token: process.env.HUGGINGFACE_API_TOKEN || '',
  },
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT_GENERATIONS) || 2,
  cacheHours: parseInt(process.env.GENERATION_CACHE_HOURS) || 24,
  imageQuality: process.env.IMAGE_QUALITY || 'medium',
};

// Qualitäts-Presets
const QUALITY_PRESETS = {
  low:    { width: 512, height: 768, steps: 20 },
  medium: { width: 768, height: 1024, steps: 30 },
  high:   { width: 1024, height: 1536, steps: 40 },
};

/**
 * HTTP-Request-Hilfsfunktion (ohne externe Abhängigkeiten)
 */
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    // Proxy-Unterstützung
    if (process.env.HTTPS_PROXY && isHttps) {
      reqOptions.ca = process.env.NODE_EXTRA_CA_CERTS
        ? fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS)
        : undefined;
    }

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(json)}`));
          } else {
            resolve(json);
          }
        } catch {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Timeout')); });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

/**
 * Bild von URL herunterladen und lokal speichern
 */
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    lib.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, outputPath).then(resolve).catch(reject);
      }

      const dir = path.dirname(outputPath);
      fs.mkdirSync(dir, { recursive: true });

      const fileStream = fs.createWriteStream(outputPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => { fileStream.close(); resolve(outputPath); });
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

// ═══════════════════════════════════════════════════
// REPLICATE PROVIDER (Günstigster)
// ═══════════════════════════════════════════════════

class ReplicateProvider {
  constructor() {
    this.baseUrl = 'https://api.replicate.com/v1';
    this.token = CONFIG.replicate.token;
  }

  get headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Virtual Try-On: Kleidungsbild auf Avatar-Körper auftragen
   *
   * Verwendet IDM-VTON (~$0.01–0.03 pro Bild)
   * Input: Avatar-Basisbild + Kleidungsbild
   * Output: Avatar mit Kleidung
   */
  async virtualTryOn({ avatarImageUrl, garmentImageUrl, category }) {
    if (!this.token) throw new Error('REPLICATE_API_TOKEN nicht gesetzt');

    const quality = QUALITY_PRESETS[CONFIG.imageQuality] || QUALITY_PRESETS.medium;

    // IDM-VTON Prediction erstellen
    const prediction = await httpRequest(`${this.baseUrl}/predictions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        // IDM-VTON Modell auf Replicate
        model: CONFIG.replicate.tryonModel,
        input: {
          human_img: avatarImageUrl,
          garm_img: garmentImageUrl,
          category: this._mapCategory(category),
          crop: false,
          seed: 42,
          steps: quality.steps,
          width: quality.width,
          height: quality.height,
        },
      }),
    });

    // Auf Ergebnis warten (Polling)
    return this._waitForPrediction(prediction.id);
  }

  /**
   * Video/Animation generieren
   *
   * Verwendet Stable Video Diffusion (~$0.03–0.05 pro Clip)
   * Input: Einzelbild des fertig eingekleideten Avatars
   * Output: Kurze Laufanimation (3-4 Sekunden)
   */
  async generateWalkAnimation({ imageUrl, motionStrength }) {
    if (!this.token) throw new Error('REPLICATE_API_TOKEN nicht gesetzt');

    const prediction = await httpRequest(`${this.baseUrl}/predictions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: CONFIG.replicate.videoModel,
        input: {
          input_image: imageUrl,
          motion_bucket_id: motionStrength || 40,
          fps: 12,
          num_frames: 25,
          sizing_strategy: 'maintain_aspect_ratio',
          cond_aug: 0.02,
          decoding_t: 7,
          seed: 42,
        },
      }),
    });

    return this._waitForPrediction(prediction.id);
  }

  /**
   * Einfache Bild-zu-Bild Transformation
   * Für Stil-Anpassungen, Beleuchtung etc.
   */
  async imageToImage({ imageUrl, prompt, strength }) {
    if (!this.token) throw new Error('REPLICATE_API_TOKEN nicht gesetzt');

    const prediction = await httpRequest(`${this.baseUrl}/predictions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: 'stability-ai/sdxl',
        input: {
          image: imageUrl,
          prompt: prompt || 'fashion model walking on catwalk, professional lighting',
          prompt_strength: strength || 0.3,
          num_inference_steps: 25,
          seed: 42,
        },
      }),
    });

    return this._waitForPrediction(prediction.id);
  }

  /**
   * Prediction-Status abfragen (Polling)
   */
  async _waitForPrediction(predictionId, maxWaitMs = 300000) {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < maxWaitMs) {
      const status = await httpRequest(`${this.baseUrl}/predictions/${predictionId}`, {
        headers: this.headers,
      });

      if (status.status === 'succeeded') {
        return {
          success: true,
          output: status.output,
          metrics: status.metrics,
          cost: this._estimateCost(status),
        };
      }

      if (status.status === 'failed' || status.status === 'canceled') {
        return {
          success: false,
          error: status.error || 'Generierung fehlgeschlagen',
        };
      }

      // Warten vor nächstem Poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return { success: false, error: 'Timeout – Generierung dauert zu lange' };
  }

  /**
   * Kategorie-Mapping für IDM-VTON
   */
  _mapCategory(category) {
    const mapping = {
      'oberteil': 'upper_body',
      'jacke': 'upper_body',
      'hose': 'lower_body',
      'rock': 'lower_body',
      'kleid': 'dresses',
      'schuhe': 'lower_body',
    };
    return mapping[category] || 'upper_body';
  }

  /**
   * Kosten schätzen basierend auf Prediction-Metriken
   */
  _estimateCost(prediction) {
    if (prediction.metrics && prediction.metrics.predict_time) {
      // Replicate berechnet nach GPU-Sekunden
      // A40: ~$0.000575/s, T4: ~$0.000225/s
      const gpuSeconds = prediction.metrics.predict_time;
      return Math.round(gpuSeconds * 0.000575 * 10000) / 10000;
    }
    return 0.02; // Fallback-Schätzung
  }
}

// ═══════════════════════════════════════════════════
// HUGGING FACE PROVIDER (Alternative, günstig)
// ═══════════════════════════════════════════════════

class HuggingFaceProvider {
  constructor() {
    this.baseUrl = 'https://api-inference.huggingface.co';
    this.token = CONFIG.huggingface.token;
  }

  async virtualTryOn({ avatarImageUrl, garmentImageUrl, category }) {
    if (!this.token) throw new Error('HUGGINGFACE_API_TOKEN nicht gesetzt');

    // HF Inference API für IDM-VTON
    // Hinweis: Auf HF oft in der Free-Tier-Queue → langsamer
    const response = await httpRequest(
      `${this.baseUrl}/models/yisol/IDM-VTON`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            human_img: avatarImageUrl,
            garm_img: garmentImageUrl,
            category: category,
          },
        }),
      });

    return {
      success: true,
      output: response,
      cost: 0.01, // HF Pro: ~$0.01/Bild
    };
  }

  async generateWalkAnimation({ imageUrl }) {
    // HF hat keine direkte SVD-Inference, daher Fallback
    return {
      success: false,
      error: 'Video-Generierung nicht über Hugging Face verfügbar. Nutze Replicate.',
    };
  }
}

// ═══════════════════════════════════════════════════
// LOCAL PROVIDER (Kostenlos, braucht GPU)
// ═══════════════════════════════════════════════════

class LocalProvider {
  constructor() {
    this.apiUrl = process.env.LOCAL_AI_URL || 'http://localhost:7860';
  }

  async virtualTryOn({ avatarImageUrl, garmentImageUrl, category }) {
    // Erwartet ein lokal laufendes IDM-VTON via Gradio
    const response = await httpRequest(`${this.apiUrl}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [avatarImageUrl, garmentImageUrl, category],
      }),
    });

    return {
      success: true,
      output: response.data,
      cost: 0, // Lokal = keine API-Kosten
    };
  }

  async generateWalkAnimation({ imageUrl }) {
    return {
      success: false,
      error: 'Lokale Video-Generierung noch nicht implementiert. Installiere AnimateDiff.',
    };
  }
}

// ═══════════════════════════════════════════════════
// PROVIDER FACTORY
// ═══════════════════════════════════════════════════

function createProvider(providerName) {
  switch (providerName || CONFIG.provider) {
    case 'replicate':
      return new ReplicateProvider();
    case 'huggingface':
      return new HuggingFaceProvider();
    case 'local':
      return new LocalProvider();
    default:
      return new ReplicateProvider();
  }
}

module.exports = {
  createProvider,
  downloadImage,
  CONFIG,
  QUALITY_PRESETS,
  ReplicateProvider,
  HuggingFaceProvider,
  LocalProvider,
};
