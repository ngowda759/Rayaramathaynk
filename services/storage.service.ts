import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { storage } from "@/lib/firebase";

class StorageService {
  async uploadImage(file: File, folder: string) {
    const fileName = `${Date.now()}-${file.name}`;

    const storageRef = ref(
      storage,
      `${folder}/${fileName}`
    );

    await uploadBytes(storageRef, file);

    return getDownloadURL(storageRef);
  }
}

export const storageService = new StorageService();
