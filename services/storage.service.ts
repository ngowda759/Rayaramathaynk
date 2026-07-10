/**
 * Storage Service for local file management
 * Since Vercel doesn't allow runtime file writes, this generates URLs for files
 * stored in public/images/ folder. Files must be committed to GitHub repo.
 */

class StorageService {
  /**
   * Generate a URL for a local image file
   * The file should be placed in public/images/{folder}/{filename}
   * and committed to the GitHub repository
   */
  getImageUrl(filename: string, folder: string = "aaradhane"): string {
    return `/images/${folder}/${filename}`;
  }
  
  /**
   * List of uploaded images (tracked via Firestore or you can add files manually)
   * This is a placeholder - in production, you might want to:
   * 1. Add images to public/images/aaradhane/ folder
   * 2. Commit to GitHub
   * 3. Images will be available at /images/aaradhane/{filename}
   */
  getUploadedImages(): string[] {
    // Images are stored in public/images/aaradhane/
    // Add files there and commit to GitHub
    return [];
  }
}

export const storageService = new StorageService();
