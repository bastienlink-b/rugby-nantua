const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

async function generateFavicons() {
  try {
    // Source image
    const sourceImage = path.resolve(__dirname, '../original-logo.png');
    
    // Target sizes for different devices
    const sizes = [16, 32, 48, 57, 60, 72, 76, 96, 114, 120, 144, 152, 180, 192, 512];
    
    // Load the source image
    const image = await loadImage(sourceImage);
    
    // Original image dimensions
    const originalWidth = image.width;
    const originalHeight = image.height;
    const originalAspectRatio = originalWidth / originalHeight;
    
    // Generate favicons for each size
    for (const size of sizes) {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');
      
      // Fill background with white
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      
      // Calculate dimensions to preserve aspect ratio
      let targetWidth, targetHeight;
      let x, y;
      
      // Maintain aspect ratio without stretching or distorting
      if (originalWidth > originalHeight) {
        // Landscape orientation
        targetWidth = size;
        targetHeight = size / originalAspectRatio;
        x = 0;
        y = (size - targetHeight) / 2;
      } else if (originalHeight > originalWidth) {
        // Portrait orientation
        targetHeight = size;
        targetWidth = size * originalAspectRatio;
        x = (size - targetWidth) / 2;
        y = 0;
      } else {
        // Square
        targetWidth = size;
        targetHeight = size;
        x = 0;
        y = 0;
      }
      
      // Draw image centered without distortion
      ctx.drawImage(image, x, y, targetWidth, targetHeight);
      
      // Save specific sized icons with appropriate names
      let outputFilename = '';
      
      if (size === 16) {
        outputFilename = '../favicon-16x16.png';
      } else if (size === 32) {
        outputFilename = '../favicon-32x32.png';
      } else if (size === 180) {
        outputFilename = '../apple-touch-icon.png';
      } else if (size === 192) {
        outputFilename = '../android-chrome-192x192.png';
      } else if (size === 512) {
        outputFilename = '../android-chrome-512x512.png';
      } else {
        outputFilename = `../favicon-${size}x${size}.png`;
      }
      
      // Convert canvas to PNG buffer
      const buffer = canvas.toBuffer('image/png');
      
      // Save the file
      fs.writeFileSync(path.resolve(__dirname, outputFilename), buffer);
      console.log(`Generated ${outputFilename}`);
    }
    
    console.log('Favicon generation complete!');
    
  } catch (error) {
    console.error('Error generating favicons:', error);
  }
}

generateFavicons();