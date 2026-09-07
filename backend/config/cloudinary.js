const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer or file path to Cloudinary
 * @param {Buffer|string} fileSource - File buffer or local file path
 * @param {Object} options - Cloudinary upload options
 * @returns {Promise<Object>} Cloudinary upload result containing secure_url
 */
const uploadToCloudinary = (fileSource, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: 'employee_tracker',
      resource_type: 'auto',
      ...options,
    };

    if (Buffer.isBuffer(fileSource)) {
      const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
      uploadStream.end(fileSource);
    } else {
      cloudinary.uploader.upload(fileSource, uploadOptions, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    }
  });
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
};
