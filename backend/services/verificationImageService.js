const sharp = require('sharp');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;
const ALLOWED_FORMATS = new Set(['jpeg', 'png']);
const MIME_BY_FORMAT = { jpeg: 'image/jpeg', png: 'image/png' };

function parseImageDataUrl(dataUrl, label) {
  if (dataUrl == null || dataUrl === '') return null;
  if (typeof dataUrl !== 'string' || dataUrl.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 40) {
    throw new Error(`${label} image must be 5 MB or smaller.`);
  }
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new Error(`${label} must be a JPEG or PNG image.`);
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES || buffer.toString('base64') !== match[2]) {
    throw new Error(`${label} image must be a valid JPEG or PNG no larger than 5 MB.`);
  }
  return { buffer, mimeType: match[1] };
}

async function validateVerificationImage(buffer, label, declaredMimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`${label} image must be present and no larger than 5 MB.`);
  }
  try {
    const options = { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS };
    const metadata = await sharp(buffer, options).metadata();
    if (!ALLOWED_FORMATS.has(metadata.format) || MIME_BY_FORMAT[metadata.format] !== declaredMimeType) {
      throw new Error(`${label} must be a JPEG or PNG image.`);
    }
    if (!metadata.width || !metadata.height || metadata.width < 400 || metadata.height < 400) {
      throw new Error(`${label} image resolution must be at least 400 by 400 pixels.`);
    }
    const { data, info } = await sharp(buffer, options)
      .rotate().resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
      .greyscale().raw().toBuffer({ resolveWithObject: true });
    let pixelSum = 0;
    for (const pixel of data) pixelSum += pixel;
    const brightness = pixelSum / data.length;
    if (brightness < 18 || brightness > 242) {
      throw new Error(`${label} image is too dark or overexposed. Retake it with even lighting.`);
    }
    let laplacianSum = 0;
    let laplacianSquaredSum = 0;
    let sampleCount = 0;
    for (let y = 1; y < info.height - 1; y += 1) {
      for (let x = 1; x < info.width - 1; x += 1) {
        const index = y * info.width + x;
        const laplacian = data[index - info.width] + data[index + info.width]
          + data[index - 1] + data[index + 1] - 4 * data[index];
        laplacianSum += laplacian;
        laplacianSquaredSum += laplacian * laplacian;
        sampleCount += 1;
      }
    }
    const mean = laplacianSum / sampleCount;
    const sharpness = laplacianSquaredSum / sampleCount - mean * mean;
    if (sharpness < 12) throw new Error(`${label} image is too blurry. Hold the camera steady and retake it.`);
  } catch (error) {
    if (error.message.startsWith(`${label} `)) throw error;
    throw new Error(`${label} must be a readable JPEG or PNG image.`);
  }
}

module.exports = { MAX_IMAGE_BYTES, parseImageDataUrl, validateVerificationImage };