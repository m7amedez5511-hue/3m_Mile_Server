/**
 * Generates a full URL for an uploaded file
 * @param {Object} req - Express request object
 * @param {string} folder - Subfolder name (e.g., 'car-photos', 'driver-photos')
 * @param {string} filename - The name of the file
 * @returns {string} - The full URL
 */
export const getFileUrl = (_req, folder, filename) => {
  if (!filename) return null;
  const baseUrl = process.env.API_PUBLIC_URL;
  return `${baseUrl}/public/uploads/${folder}/${filename}`;
};