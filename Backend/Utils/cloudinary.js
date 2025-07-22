const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  // Add timeout configuration
  timeout: 600000, // 10 minutes
  secure: true,
  // Add chunk size for large uploads
  chunk_size: 6000000, // 6MB chunks
});

// const uploadToCloudinary = async (file) => {
//   const { createReadStream } = await file;

//   return new Promise(async (resolve, reject) => {
//     try {
//       // Step 1: Convert stream to buffer
//       const chunks = [];
//       const stream = createReadStream();
//       for await (const chunk of stream) {
//         chunks.push(chunk);
//       }
//       const buffer = Buffer.concat(chunks);

//       // Step 2: Resize image with sharp
//       const optimizedBuffer = await sharp(buffer)
//         .resize({ width: 600, height: 800, fit: 'inside' })
//         .jpeg({ quality: 70 }) // reduce size more
//         .toBuffer();

//       // Step 3: Upload to Cloudinary using streamifier
//       const uploadStream = cloudinary.uploader.upload_stream(
//         {
//           resource_type: 'image',
//           folder: 'posts', // Optional
//           format: 'jpg',
//         },
//         (err, result) => {
//           if (err) {
//             console.error('❌ Cloudinary Upload Error:', err);
//             reject(err);
//           } else {
//             console.log('✅ Cloudinary Upload Success:', result.secure_url);
//             resolve(result.secure_url);
//           }
//         }
//       );

//       streamifier.createReadStream(optimizedBuffer).pipe(uploadStream);
//     } catch (err) {
//       console.error('❌ Error during image resize/upload:', err);
//       reject(err);
//     }
//   });
// };

// module.exports = { uploadToCloudinary };







const uploadToCloudinary = async (file, type = 'image') => {
  const { createReadStream, filename, mimetype } = await file;

  return new Promise(async (resolve, reject) => {
    try {
      console.log(`🚀 Starting ${type} upload to Cloudinary:`, {
        filename,
        mimetype,
        type
      });

      const stream = createReadStream();
      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      console.log(`📦 Buffer created, size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);

      let uploadBuffer = buffer;
      let format = undefined;

      // ✅ Only process images with sharp
      if (type === 'image') {
        uploadBuffer = await sharp(buffer)
          .resize({ width: 600, height: 800, fit: 'inside' })
          .jpeg({ quality: 70 })
          .toBuffer();
        format = 'jpg';
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: type, // 'image' or 'video'
          folder: 'posts',
          format: format, // only used for image
          // Add timeout for upload
          timeout: 600000, // 10 minutes
          // Add chunk size for large uploads
          chunk_size: 6000000, // 6MB chunks
          // Add eager transformation for videos to ensure processing
          eager_async: true,
        },
        (err, result) => {
          if (err) {
            console.error('❌ Cloudinary Upload Error:', {
              error: err.message,
              http_code: err.http_code,
              name: err.name
            });
            reject(new Error(`Cloudinary upload failed: ${err.message}`));
          } else {
            console.log('✅ Cloudinary Upload Success:', {
              url: result.secure_url,
              bytes: result.bytes,
              duration: result.duration,
              format: result.format
            });
            
            // For videos, return metadata along with URL
            if (type === 'video') {
              resolve({
                url: result.secure_url,
                duration: result.duration || 0, // in seconds
                width: result.width || 0,
                height: result.height || 0,
                bytes: result.bytes || buffer.length
              });
            } else {
              // For images, just return URL
              resolve(result.secure_url);
            }
          }
        }
      );

      streamifier.createReadStream(uploadBuffer).pipe(uploadStream);
    } catch (err) {
      console.error('❌ Error during Cloudinary upload:', err);
      reject(err);
    }
  });
};

 module.exports = { uploadToCloudinary };
