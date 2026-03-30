/**
 * Cloudinary configuration — used for all image uploads.
 *
 * Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * in environment variables.
 */

import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Upload a buffer to Cloudinary.
 * Returns { public_id, url, thumb_url, width, height, size }.
 */
export async function uploadImage(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'photoshare',
        resource_type: 'image',
        ...options,
      },
      (error, result) => {
        if (error) return reject(error)

        const thumbUrl = cloudinary.url(result.public_id, {
          width: 400,
          height: 300,
          crop: 'fill',
          gravity: 'auto',
          quality: 'auto',
          format: 'webp',
        })

        resolve({
          public_id: result.public_id,
          url: result.secure_url,
          thumb_url: thumbUrl,
          width: result.width,
          height: result.height,
          size: result.bytes,
        })
      }
    )

    stream.end(buffer)
  })
}

/**
 * Delete an image from Cloudinary by public_id.
 */
export async function deleteImage(publicId) {
  return cloudinary.uploader.destroy(publicId)
}

/**
 * Delete multiple images from Cloudinary.
 */
export async function deleteImages(publicIds) {
  if (!publicIds.length) return
  return cloudinary.api.delete_resources(publicIds)
}
