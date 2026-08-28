/**
 * AI Provider Abstraktion
 *
 * Unterstützt mehrere Provider mit einheitlicher Schnittstelle.
 * Standard: Replicate (günstigster Cloud-Provider)
 *
 * Modelle:
 *   Avatar-Generierung:  Flux 1.1 Pro      ~$0.03–0.05/Bild
 *   Virtual Try-On:      IDM-VTON           ~$0.01–0.03/Bild
 *   Video-Animation:     Minimax Video-01   ~$0.10–0.20/Video
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
    avatarModel: process.env.AVATAR_MODEL || 'black-forest-labs/flux-1.1-pro',
    tryonModel: process.env.TRYON_MODEL || 'cuuupid/idm-vton',
    videoModel: process.env.VIDEO_MODEL || 'minimax/video-01',
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
// AVATAR-PROMPT GENERATOR
// ═══════════════════════════════════════════════════

/**
 * Erstellt einen optimalen Prompt für Avatar-Basisbild-Generierung.
 * Jeder Avatar bekommt ein einzigartiges Aussehen (Haarfarbe, Ethnie, Stil).
 * Das Bild zeigt die Person in neutraler Kleidung, damit IDM-VTON
 * die eigentliche Mode auftragen kann.
 */
function buildAvatarPrompt(avatar) {
  // Bekannte männliche Namen – alles andere wird als weiblich behandelt
  const maleNames = ['liam', 'noah', 'felix', 'max', 'leon', 'tim', 'david', 'paul', 'ben', 'tom'];
  const isMale = maleNames.includes((avatar.name || '').toLowerCase());

  // Einzigartige Looks für jeden Avatar-Namen
  const uniqueLooks = {
    // Weibliche Avatare – jede ist anders!
    'sol':     { age: 23, look: 'korean woman, smooth light skin, long straight silky black hair, dark brown almond-shaped eyes, soft natural makeup, gentle warm smile, elegant K-beauty look' },
    'elena':   { age: 27, look: 'eastern european woman, fair skin, sleek straight blonde hair in a low bun, blue-grey eyes, sharp elegant features, confident expression' },
    'mira':    { age: 24, look: 'south asian woman, medium brown skin, long black hair in a high ponytail, dark brown eyes, athletic build, bright energetic smile' },
    'lauren':  { age: 26, look: 'scandinavian woman, pale porcelain skin, short platinum bob haircut, light green eyes, minimal makeup, serene composed expression' },
    'claire':  { age: 28, look: 'french woman, light olive skin, shoulder-length chestnut brown hair with soft waves, hazel eyes, classic beauty, subtle knowing smile' },
    'amy':     { age: 22, look: 'mixed race woman, light caramel skin, long curly auburn hair, green-brown eyes, freckles across nose, playful warm expression' },

    // Weitere weibliche Namen
    'sophia':  { age: 25, look: 'mediterranean woman, olive skin, dark brown straight hair, brown eyes, elegant features, confident look' },
    'mia':     { age: 23, look: 'asian woman, light skin, long straight black hair, dark eyes, delicate features, gentle smile' },
    'emma':    { age: 24, look: 'british woman, fair skin, strawberry blonde hair in a ponytail, blue eyes, athletic build, cheerful expression' },
    'nina':    { age: 26, look: 'african woman, dark brown skin, short natural curly hair, dark brown eyes, striking high cheekbones, powerful confident gaze' },
  };

  // Stil-basierte Ergänzungen
  const styleAdditions = {
    'Jeans Style':                   'casual relaxed pose',
    'Business Style':                'professional confident posture',
    'Sportlich-elegant':             'athletic graceful stance',
    'Quiet Luxury / Minimalismus':   'refined understated elegance',
    'Klassisch-zeitlos':             'timeless classic poise',
    'Romantisch-verspielt / Boho':   'free-spirited bohemian vibe',
  };

  const nameKey = (avatar.name || '').toLowerCase();
  const avatarLook = uniqueLooks[nameKey];
  const styleNote = styleAdditions[avatar.description] || '';

  if (avatarLook) {
    const gender = isMale ? 'man' : 'woman';
    return `Full body professional fashion photograph of a ${avatarLook.look}, ` +
      `${avatarLook.age} years old, fashion model, 170-178cm tall, slim figure, ${styleNote}, ` +
      `standing in a natural front-facing pose, wearing a simple fitted white t-shirt ` +
      `and plain dark fitted jeans, simple white sneakers, ` +
      `clean pure white studio background, professional fashion photography lighting, ` +
      `sharp focus, high resolution, photorealistic, no accessories, full body visible head to toe, ` +
      `center frame, 8k quality, fashion catalog style`;
  }

  // Fallback für unbekannte Namen
  const gender = isMale ? 'man' : 'woman';
  const genderDetails = isMale
    ? 'young man, 26 years old, athletic build, 185cm tall, handsome face'
    : 'young woman, 24 years old, slim athletic build, 175cm tall, beautiful face, natural look';

  return `Full body professional fashion photograph of a ${genderDetails}, ${styleNote}, ` +
    `fashion model standing in a natural front-facing pose, wearing a simple fitted white t-shirt ` +
    `and plain dark fitted jeans, simple white sneakers, ` +
    `clean pure white studio background, professional fashion photography lighting, ` +
    `sharp focus, high resolution, photorealistic, no accessories, full body visible head to toe, ` +
    `center frame, 8k quality, fashion catalog style`;
}

/**
 * Erstellt einen Prompt für die Catwalk-Walking-Animation
 */
function buildWalkPrompt(avatar) {
  const maleNames = ['liam', 'noah', 'felix', 'max', 'leon', 'tim', 'david', 'paul', 'ben', 'tom'];
  const isMale = maleNames.includes((avatar.name || '').toLowerCase());
  const gender = isMale ? 'male' : 'female';

  return `Professional fashion show, ${gender} model walking confidently on a catwalk runway, ` +
    `elegant walking motion, one foot in front of the other, straight posture, ` +
    `professional studio lighting, fashion show atmosphere, ` +
    `smooth camera, full body shot, cinematic quality`;
}

// ═══════════════════════════════════════════════════
// REPLICATE PROVIDER
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
   * Avatar-Basisbild generieren (Flux 1.1 Pro)
   *
   * Erstellt ein fotorealistisches Ganzkörper-Model-Foto
   * in neutraler Kleidung für Virtual Try-On.
   * Kosten: ~$0.03–0.05 pro Bild
   */
  async generateAvatarImage({ prompt, width, height }) {
    if (!this.token) throw new Error('REPLICATE_API_TOKEN nicht gesetzt');

    const model = CONFIG.replicate.avatarModel;
    const quality = QUALITY_PRESETS[CONFIG.imageQuality] || QUALITY_PRESETS.medium;

    const input = {
      prompt: prompt,
      width: width || quality.width,
      height: height || quality.height,
      num_inference_steps: quality.steps,
      guidance_scale: 7.5,
      output_format: 'png',
    };

    // Flux-spezifische Parameter
    if (model.includes('flux')) {
      input.aspect_ratio = '3:4'; // Hochformat für Ganzkörper
      delete input.width;
      delete input.height;
      delete input.guidance_scale;
    }

    const prediction = await httpRequest(`${this.baseUrl}/models/${model}/predictions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ input }),
    });

    return this._waitForPrediction(prediction.id);
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

    const tryonModel = CONFIG.replicate.tryonModel;
    const prediction = await httpRequest(`${this.baseUrl}/models/${tryonModel}/predictions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
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

    return this._waitForPrediction(prediction.id);
  }

  /**
   * Walking-Video generieren
   *
   * Unterstützt mehrere Video-Modelle:
   * - Minimax Video-01: Beste Qualität (~$0.10–0.20, 5-6 Sek)
   * - Stable Video Diffusion: Günstigster (~$0.03–0.05, 3 Sek)
   *
   * Input: Bild des fertig eingekleideten Avatars
   * Output: Laufanimation auf dem Catwalk
   */
  async generateWalkAnimation({ imageUrl, motionStrength, prompt }) {
    if (!this.token) throw new Error('REPLICATE_API_TOKEN nicht gesetzt');

    const model = CONFIG.replicate.videoModel;
    let input;

    if (model.includes('minimax')) {
      // ── Minimax Video-01 ──
      input = {
        prompt: prompt || 'Fashion model walking confidently on a catwalk runway, ' +
          'professional fashion show, elegant walking motion, studio lighting, ' +
          'smooth camera following, full body shot, cinematic quality',
        first_frame_image: imageUrl,
      };
    } else if (model.includes('kling')) {
      // ── Kling Video ──
      input = {
        prompt: prompt || 'Fashion model walking on catwalk, professional fashion show, ' +
          'elegant confident walk, studio lighting, full body',
        image: imageUrl,
        duration: 5,
      };
    } else if (model.includes('wan')) {
      // ── Wan 2.1 ──
      input = {
        prompt: prompt || 'Fashion model walking on catwalk runway, professional fashion show',
        image: imageUrl,
        num_frames: 81,
        fps: 16,
      };
    } else {
      // ── Stable Video Diffusion (Fallback/günstigster) ──
      input = {
        input_image: imageUrl,
        motion_bucket_id: motionStrength || 40,
        fps: 12,
        num_frames: 25,
        sizing_strategy: 'maintain_aspect_ratio',
        cond_aug: 0.02,
        decoding_t: 7,
        seed: 42,
      };
    }

    const prediction = await httpRequest(`${this.baseUrl}/models/${model}/predictions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ input }),
    });

    return this._waitForPrediction(prediction.id, 600000); // 10 Min Timeout für Video
  }

  /**
   * Einfache Bild-zu-Bild Transformation
   */
  async imageToImage({ imageUrl, prompt, strength }) {
    if (!this.token) throw new Error('REPLICATE_API_TOKEN nicht gesetzt');

    const img2imgModel = 'stability-ai/sdxl';
    const prediction = await httpRequest(`${this.baseUrl}/models/${img2imgModel}/predictions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
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
    const pollInterval = 3000; // 3 Sekunden

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
   * Hintergrund entfernen (transparent machen)
   * Verwendet lucataco/remove-bg (~$0.004 pro Bild)
   */
  async removeBackground({ imageUrl }) {
    if (!this.token) throw new Error('REPLICATE_API_TOKEN nicht gesetzt');

    const prediction = await httpRequest(`${this.baseUrl}/models/lucataco/remove-bg/predictions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        input: { image: imageUrl },
      }),
    });

    return this._waitForPrediction(prediction.id);
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
      const gpuSeconds = prediction.metrics.predict_time;
      return Math.round(gpuSeconds * 0.000575 * 10000) / 10000;
    }
    return 0.02;
  }
}

// ═══════════════════════════════════════════════════
// HUGGING FACE PROVIDER (Alternative)
// ═══════════════════════════════════════════════════

class HuggingFaceProvider {
  constructor() {
    this.baseUrl = 'https://api-inference.huggingface.co';
    this.token = CONFIG.huggingface.token;
  }

  async generateAvatarImage({ prompt }) {
    if (!this.token) throw new Error('HUGGINGFACE_API_TOKEN nicht gesetzt');
    return {
      success: false,
      error: 'Avatar-Generierung über HuggingFace noch nicht implementiert. Nutze Replicate.',
    };
  }

  async virtualTryOn({ avatarImageUrl, garmentImageUrl, category }) {
    if (!this.token) throw new Error('HUGGINGFACE_API_TOKEN nicht gesetzt');

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
      cost: 0.01,
    };
  }

  async generateWalkAnimation() {
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

  async generateAvatarImage() {
    return {
      success: false,
      error: 'Lokale Avatar-Generierung benötigt ComfyUI oder Stable Diffusion WebUI.',
    };
  }

  async virtualTryOn({ avatarImageUrl, garmentImageUrl, category }) {
    const response = await httpRequest(`${this.apiUrl}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [avatarImageUrl, garmentImageUrl, category],
      }),
    });

    return { success: true, output: response.data, cost: 0 };
  }

  async generateWalkAnimation() {
    return {
      success: false,
      error: 'Lokale Video-Generierung noch nicht implementiert.',
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

/**
 * Erstellt einen Prompt für Avatar MIT Fashion-Outfit (kein weißes T-Shirt).
 * Der Avatar wird direkt in stilvoller Kleidung generiert.
 */
function buildOutfitPrompt(avatar, outfitArticles) {
  const maleNames = ['liam', 'noah', 'felix', 'max', 'leon', 'tim', 'david', 'paul', 'ben', 'tom'];
  const isMale = maleNames.includes((avatar.name || '').toLowerCase());

  const uniqueLooks = {
    'sol':     { age: 23, look: 'korean woman, smooth light skin, long straight silky black hair, dark brown almond-shaped eyes, soft natural makeup, gentle warm smile' },
    'elena':   { age: 27, look: 'eastern european woman, fair skin, sleek straight blonde hair in a low bun, blue-grey eyes, sharp elegant features, confident expression' },
    'mira':    { age: 24, look: 'south asian woman, medium brown skin, long black hair in a high ponytail, dark brown eyes, athletic build, bright energetic smile' },
    'lauren':  { age: 26, look: 'scandinavian woman, pale porcelain skin, short platinum bob haircut, light green eyes, minimal makeup, serene composed expression' },
    'claire':  { age: 28, look: 'french woman, light olive skin, shoulder-length chestnut brown hair with soft waves, hazel eyes, classic beauty, subtle knowing smile' },
    'amy':     { age: 22, look: 'mixed race woman, light caramel skin, long curly auburn hair, green-brown eyes, freckles across nose, playful warm expression' },
  };

  // Outfit-Beschreibung aus den zugewiesenen Artikeln
  const outfitDescriptions = {
    'Jeans Style': 'wearing stylish dark blue skinny jeans, a casual fitted crop top, white sneakers, relaxed streetwear look',
    'Business Style': 'wearing an elegant fitted blazer, tailored dress pants, classic heels, professional business attire',
    'Sportlich-elegant': 'wearing a sporty-chic outfit with fitted jogger pants, designer sneakers, a modern zip jacket, athleisure style',
    'Quiet Luxury / Minimalismus': 'wearing a minimalist cashmere sweater, tailored wide-leg trousers, elegant loafers, quiet luxury understated elegance',
    'Klassisch-zeitlos': 'wearing an elegant knee-length wrap dress, classic pumps, timeless style',
    'Romantisch-verspielt / Boho': 'wearing a flowing bohemian maxi dress with floral patterns, strappy sandals, boho-chic style',
  };

  // Wenn konkrete Artikel vorhanden, deren Beschreibung nutzen
  let clothingDesc = outfitDescriptions[avatar.description] || 'wearing fashionable modern clothing, stylish outfit';
  if (outfitArticles && outfitArticles.length > 0) {
    const items = outfitArticles.map(a => {
      const color = a.color ? `${a.color} ` : '';
      return `${color}${a.name}`;
    }).join(', ');
    clothingDesc = `wearing ${items}`;
  }

  const nameKey = (avatar.name || '').toLowerCase();
  const avatarLook = uniqueLooks[nameKey];

  if (avatarLook) {
    return `Full body professional fashion photograph of a ${avatarLook.look}, ` +
      `${avatarLook.age} years old, fashion model, 170-178cm tall, slim figure, ` +
      `${clothingDesc}, ` +
      `walking confidently on a dark fashion runway catwalk, ` +
      `dramatic fashion show lighting, spotlight from above, ` +
      `sharp focus, high resolution, photorealistic, full body visible head to toe, ` +
      `center frame, 8k quality, Vogue editorial fashion photography`;
  }

  const gender = isMale ? 'man' : 'woman';
  return `Full body professional fashion photograph of a young ${gender}, 25 years old, ` +
    `fashion model, ${clothingDesc}, ` +
    `walking confidently on a dark fashion runway catwalk, ` +
    `dramatic fashion show lighting, spotlight from above, ` +
    `sharp focus, high resolution, photorealistic, full body visible head to toe, ` +
    `center frame, 8k quality, Vogue editorial fashion photography`;
}

module.exports = {
  createProvider,
  downloadImage,
  buildAvatarPrompt,
  buildOutfitPrompt,
  buildWalkPrompt,
  CONFIG,
  QUALITY_PRESETS,
  ReplicateProvider,
  HuggingFaceProvider,
  LocalProvider,
};
