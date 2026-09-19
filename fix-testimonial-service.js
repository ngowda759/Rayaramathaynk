const fs = require('fs');

let content = fs.readFileSync('services/testimonial.service.ts', 'utf8');

const replacement = `
    try {
      // Use the storage API instead of directly importing storage.service
      const cleanPhone = submission.phone ? submission.phone.replace(/[^0-9+]/g, '') : '';
      const sanitizedName = submission.name.toLowerCase().replace(/[^a-z0-9\\s.-]/g, '').replace(/\\s+/g, '_').substring(0, 100);
      const filename = cleanPhone
        ? \`\${sanitizedName}_\${cleanPhone}.jpg\`
        : \`\${sanitizedName}_\${Date.now()}.jpg\`;

      const formData = new FormData();
      formData.append('base64', submission.image);
      formData.append('filename', filename);
      formData.append('folder', 'testimonials');

      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const result = await response.json();
      imageUrl = result.url;

      console.log("[Testimonials] Upload successful, URL:", imageUrl);
    } catch (error) {
`;

// replace between try and catch
content = content.replace(/try\s*\{\s*const \{ storageService \} = await import\("@\/services\/storage\.service"\);[\s\S]*?imageUrl = result\.url;\s*console\.log\("\[Testimonials\] Upload successful, URL:", imageUrl\);\s*\}\s*catch\s*\(error\)\s*\{/m, replacement);

fs.writeFileSync('services/testimonial.service.ts', content);
