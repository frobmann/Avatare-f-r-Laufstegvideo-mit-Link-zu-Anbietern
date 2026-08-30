/**
 * AI Provider Abstraktion
 *
 * Unterstützt mehrere Provider mit einheitlicher Schnittstelle.
 * Standard: Replicate (günstigster Cloud-Provider)
 *
 * Modelle:
 *   Avatar-Generierung:  Flux 1.1 Pro      ~$0.03–0.05/Bild
 *   Virtual Try-On:      IDM-VTON           ~$0.01–0.03/Bild
 *   Video-Animation:     Kling v2.1         ~$0.05–0.15/Video
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
    videoModel: process.env.VIDEO_MODEL || 'kwaivgi/kling-v2.1',
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
 * Unterstützt: https://, http://, data:image/... URIs
 */
async function downloadImage(url, outputPath) {
  // Data-URI direkt als Datei speichern (Base64 dekodieren)
  if (url && url.startsWith('data:')) {
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    const base64Match = url.match(/^data:[^;]+;base64,(.+)$/);
    if (base64Match) {
      const buffer = Buffer.from(base64Match[1], 'base64');
      fs.writeFileSync(outputPath, buffer);
      return outputPath;
    }
    throw new Error('Ungültiges data: URI Format');
  }

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

  // ★ Einheitliche Pose und Kamera für alle Models (wie Sol)
  const basePose = `standing in a natural front-facing pose, straight upright posture, ` +
    `shoulders back, arms relaxed at sides, weight evenly distributed, ` +
    `camera positioned at waist height, model centered in frame, ` +
    `full body from head to feet with 10 percent margin above and below, ` +
    `wearing a simple fitted white t-shirt and plain dark fitted jeans, simple white sneakers, ` +
    `clean pure white studio background, professional fashion photography lighting, ` +
    `sharp focus, high resolution, photorealistic, no accessories, full body visible head to toe, ` +
    `center frame, 9:16 portrait aspect ratio, 8k quality, fashion catalog style`;

  if (avatarLook) {
    return `Full body professional fashion photograph of a ${avatarLook.look}, ` +
      `${avatarLook.age} years old, fashion model, 175cm tall, slim figure, ${styleNote}, ` +
      basePose;
  }

  // Fallback für unbekannte Namen
  const gender = isMale ? 'man' : 'woman';
  const genderDetails = isMale
    ? 'young man, 26 years old, athletic build, 180cm tall, handsome face'
    : 'young woman, 24 years old, slim figure, 175cm tall, beautiful face, natural look';

  return `Full body professional fashion photograph of a ${genderDetails}, ${styleNote}, ` +
    `fashion model, ` + basePose;
}

/**
 * Erstellt einen Prompt für die Catwalk-Walking-Animation.
 * Das Video soll das Model auf dem Laufsteg zeigen, wie es
 * selbstbewusst auf die Kamera zuläuft, eine Pose macht
 * und sich dann umdreht.
 */
function buildWalkPrompt(avatar) {
  const maleNames = ['liam', 'noah', 'felix', 'max', 'leon', 'tim', 'david', 'paul', 'ben', 'tom'];
  const isMale = maleNames.includes((avatar.name || '').toLowerCase());
  const gender = isMale ? 'male' : 'female';

  return `Professional high-fashion runway show, ${gender} fashion model walking confidently ` +
    `toward the camera on a dark catwalk runway, ` +
    `elegant model walk with one foot crossing in front of the other, ` +
    `straight upright posture, hips swaying naturally, arms relaxed at sides, ` +
    `dramatic single spotlight from directly above illuminating the model, ` +
    `dark glossy reflective runway floor, dark audience silhouettes on both sides, ` +
    `camera positioned at waist height looking slightly upward, fixed steady camera, ` +
    `model centered in frame, full body shot from head to shoes, ` +
    `same framing and distance for every model, ` +
    `dark moody atmosphere, professional fashion show lighting, ` +
    `Vogue fashion week quality, cinematic, smooth steady camera, 4K quality`;
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
   * - Kling v2.1:       Beste Laufbewegung, 5-10 Sek, 720p+ (~$0.05–0.15)
   * - Wan 2.1 I2V:      Schnell & günstig, gute Qualität (~$0.03–0.08)
   * - Minimax Video-01:  Gute Qualität, 5-6 Sek (~$0.10–0.20)
   * - Stable Video Diffusion: Günstigster (~$0.03–0.05, 3 Sek)
   *
   * Empfehlung für Catwalk: Kling v2.1 (beste Gehbewegung)
   *
   * Input: Bild des fertig eingekleideten Avatars
   * Output: Laufanimation auf dem Catwalk
   */
  async generateWalkAnimation({ imageUrl, motionStrength, prompt }) {
    if (!this.token) throw new Error('REPLICATE_API_TOKEN nicht gesetzt');

    const model = CONFIG.replicate.videoModel;
    let input;

    if (model.includes('kling')) {
      // ── Kling v2.1 (EMPFOHLEN: beste Gehbewegung) ──
      // Modell: kwaivgi/kling-v2.1
      // Produziert 5-10 Sek Videos in 720p/1080p
      // Sehr realistische menschliche Bewegungen
      console.log('   🎬 Video-Modell: Kling v2.1 (beste Gehbewegung)');
      input = {
        prompt: prompt || 'Fashion model walking confidently toward the camera on a dark catwalk runway, ' +
          'elegant model walk with one foot crossing in front of the other, ' +
          'straight upright posture, natural hip sway, arms swinging gracefully at sides, ' +
          'dramatic single spotlight from directly above, dark glossy reflective floor, dark background, ' +
          'camera at waist height looking slightly upward, fixed steady camera position, ' +
          'model centered in frame, full body shot from head to shoes, ' +
          'professional fashion show, cinematic quality, 4K',
        start_image: imageUrl,
        duration: 5,
        aspect_ratio: '9:16',
        negative_prompt: 'blurry, distorted, low quality, static, frozen, no movement, stiff',
        cfg_scale: 0.5,
      };
    } else if (model.includes('wan')) {
      // ── Wan 2.1 I2V (schnell & günstig) ──
      // Modell: wavespeedai/wan-2.1-i2v-480p oder -720p
      console.log('   🎬 Video-Modell: Wan 2.1 I2V');
      input = {
        prompt: prompt || 'Fashion model walking confidently on a dark catwalk runway toward the camera, ' +
          'elegant walking motion, natural body movement, full body shot, cinematic quality',
        image: imageUrl,
      };
    } else if (model.includes('minimax') || model.includes('hailuo')) {
      // ── Minimax Video-01 / Hailuo ──
      console.log('   🎬 Video-Modell: Minimax Video-01');
      input = {
        prompt: prompt || 'Fashion model walking confidently on a catwalk runway, ' +
          'professional fashion show, elegant walking motion, studio lighting, ' +
          'smooth camera following, full body shot, cinematic quality',
        first_frame_image: imageUrl,
      };
    } else {
      // ── Stable Video Diffusion (Fallback/günstigster) ──
      console.log('   🎬 Video-Modell: Stable Video Diffusion (Fallback)');
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

  // ★ Einheitliche Kamera-Perspektive für alle Models (wie Sol)
  // Gleiche Pose, gleicher Ausschnitt, gleiche Entfernung → identisches Laufsteg-Feeling
  const cameraSetup = `standing at the end of a dark fashion runway catwalk facing the camera, ` +
    `mid-stride walking pose, left foot slightly forward, weight shifting naturally, ` +
    `straight upright posture, shoulders back, chin slightly up, ` +
    `camera positioned at waist height looking slightly upward at the model, ` +
    `model centered in frame, full body from head to feet with 10 percent margin above head and below feet, ` +
    `solid pitch black dark background, dramatic single spotlight from directly above, ` +
    `dark glossy reflective runway floor, dark moody atmosphere, ` +
    `no audience visible, no studio background, ` +
    `sharp focus, high resolution, photorealistic, full body visible head to toe, ` +
    `center frame, 9:16 portrait aspect ratio, 8k quality, Vogue editorial fashion show photography`;

  if (avatarLook) {
    return `Full body professional fashion photograph of a ${avatarLook.look}, ` +
      `${avatarLook.age} years old, fashion model, 175cm tall, slim figure, ` +
      `${clothingDesc}, ` +
      cameraSetup;
  }

  const gender = isMale ? 'man' : 'woman';
  return `Full body professional fashion photograph of a young ${gender}, 25 years old, ` +
    `fashion model, 175cm tall, slim figure, ${clothingDesc}, ` +
    cameraSetup;
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
