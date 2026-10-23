import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import imageService from '../services/verificationImageService.js';

const { parseImageDataUrl, validateVerificationImage } = imageService;

async function createTestImage({ width = 640, height = 480, pattern = false } = {}) {
  const content = pattern
    ? `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff"/><path d="M0 0H${width}V${height}H0Z" fill="none" stroke="#111" stroke-width="12"/><path d="M0 40H${width}M0 80H${width}M0 120H${width}M0 160H${width}M0 200H${width}M0 240H${width}M0 280H${width}M0 320H${width}M0 360H${width}M0 400H${width}M0 440H${width}" stroke="#111" stroke-width="6"/></svg>`
    : `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#777"/></svg>`;
  return sharp(Buffer.from(content)).jpeg().toBuffer();
}

describe('verification image validation', () => {
  it('rejects unsupported or malformed data URLs', () => {
    expect(() => parseImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=', 'Front ID')).toThrow('JPEG or PNG');
    expect(() => parseImageDataUrl('data:image/jpeg;base64,not-base64!', 'Front ID')).toThrow('JPEG or PNG');
  });

  it('rejects bytes that are not a readable image', async () => {
    await expect(validateVerificationImage(Buffer.from('not an image'), 'Front ID', 'image/jpeg'))
      .rejects.toThrow('readable JPEG or PNG');
  });

  it('rejects images below the minimum resolution', async () => {
    const image = await createTestImage({ width: 320, height: 240, pattern: true });
    await expect(validateVerificationImage(image, 'Front ID', 'image/jpeg'))
      .rejects.toThrow('at least 400 by 400');
  });

  it('rejects a declared MIME type that does not match the decoded image', async () => {
    const image = await createTestImage({ pattern: true });
    await expect(validateVerificationImage(image, 'Front ID', 'image/png'))
      .rejects.toThrow('JPEG or PNG');
  });

  it('rejects overexposed images', async () => {
    const content = '<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff"/></svg>';
    const image = await sharp(Buffer.from(content)).jpeg().toBuffer();
    await expect(validateVerificationImage(image, 'Back ID', 'image/jpeg'))
      .rejects.toThrow('too dark or overexposed');
  });

  it('rejects blurry images and accepts a clear image', async () => {
    const blurryImage = await createTestImage();
    const clearImage = await createTestImage({ pattern: true });
    await expect(validateVerificationImage(blurryImage, 'Selfie', 'image/jpeg'))
      .rejects.toThrow('too blurry');
    await expect(validateVerificationImage(clearImage, 'Front ID', 'image/jpeg')).resolves.toBeUndefined();
  });
});