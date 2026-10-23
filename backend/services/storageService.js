/**
 * Storage Service: Manages student verification photo uploads & signed URLs.
 * Uses private Supabase bucket 'student-verifications' when configured,
 * with local disk fallback (backend/uploads/verifications) for offline testing.
 */
const path = require('path');
const fs = require('fs');
const { supabase, isSupabaseConfigured } = require('../config/supabase');

const LOCAL_UPLOAD_DIR = path.join(__dirname, '../uploads/verifications');

/**
 * Uploads a photo buffer to private storage.
 * @param {Buffer} buffer - Image buffer
 * @param {string} studentId - Student identifier
 * @param {string} photoType - 'id_front' | 'id_back' | 'selfie'
 * @param {string} mimeType - e.g. 'image/png', 'image/jpeg'
 * @returns {Promise<string>} - Saved storage path
 */
async function uploadVerificationPhoto(buffer, studentId, photoType, mimeType = 'image/jpeg') {
  if (!['image/jpeg', 'image/png'].includes(mimeType)) {
    throw new Error('Only JPEG and PNG verification photos are supported.');
  }
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const cleanStudentId = studentId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanStudentId}/${photoType}-${Date.now()}.${ext}`;

  // Configured Supabase is authoritative; never hide storage failures with a local fallback.
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.storage
      .from('student-verifications')
      .upload(filename, buffer, {
        contentType: mimeType,
        upsert: true
      });
    if (error) throw new Error(`Supabase verification photo upload failed: ${error.message}`);
    if (!data?.path) throw new Error('Supabase did not return a verification photo path.');
    return data.path;
  }

  // Local fallback is only for an intentionally unconfigured development environment.
  const studentFolder = path.join(LOCAL_UPLOAD_DIR, cleanStudentId);
  if (!fs.existsSync(studentFolder)) {
    fs.mkdirSync(studentFolder, { recursive: true });
  }

  const localFilePath = path.join(studentFolder, `${photoType}-${Date.now()}.${ext}`);
  fs.writeFileSync(localFilePath, buffer);

  // Return relative path
  return `local:${cleanStudentId}/${path.basename(localFilePath)}`;
}

/**
 * Generates a temporary signed URL for Registrar viewing (expires in 1 hour).
 * @param {string} storagePath - Stored photo path
 * @returns {Promise<string|null>} - Signed URL or accessible route
 */
async function getSignedPhotoUrl(storagePath) {
  if (!storagePath) return null;

  // Local fallback
  if (storagePath.startsWith('local:')) {
    const relPath = storagePath.replace('local:', '');
    return `/api/students/photo/${relPath}`;
  }

  // Supabase private bucket signed URL (expires in 3600 seconds = 1 hour)
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.storage
        .from('student-verifications')
        .createSignedUrl(storagePath, 3600);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch (e) {
      console.warn('Signed URL generation failed:', e.message);
    }
  }

  return storagePath;
}

module.exports = {
  uploadVerificationPhoto,
  getSignedPhotoUrl,
  LOCAL_UPLOAD_DIR
};
