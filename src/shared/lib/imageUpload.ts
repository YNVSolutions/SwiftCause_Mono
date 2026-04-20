import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FILE_UPLOAD_LIMITS } from '../config/constants';

export interface ImageUploadConstraints {
  allowedTypes?: readonly string[];
  maxSizeBytes?: number;
  requireSquare?: boolean;
}

export interface UploadedImageAsset {
  url: string;
  storagePath: string;
  width: number;
  height: number;
  contentType: string;
  sizeBytes: number;
}

const DEFAULT_ALLOWED_TYPES = FILE_UPLOAD_LIMITS.image.allowedTypes;
const DEFAULT_MAX_SIZE_BYTES = FILE_UPLOAD_LIMITS.image.maxSize;

const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read image file'));
    };

    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };
      image.onerror = () => {
        reject(new Error('Failed to parse image dimensions'));
      };

      image.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
};

const validateImageFile = (
  file: File,
  {
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
    requireSquare = false,
  }: ImageUploadConstraints,
  dimensions: { width: number; height: number },
) => {
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Unsupported image type. Allowed: ${allowedTypes.join(', ')}`);
  }

  if (file.size > maxSizeBytes) {
    const maxSizeMb = Math.round((maxSizeBytes / (1024 * 1024)) * 10) / 10;
    throw new Error(`Image size must be less than ${maxSizeMb}MB`);
  }

  if (requireSquare && dimensions.width !== dimensions.height) {
    throw new Error('Image must have a square (1:1) aspect ratio');
  }
};

export const uploadImageAsset = async (
  file: File,
  path: string,
  constraints: ImageUploadConstraints = {},
): Promise<UploadedImageAsset> => {
  try {
    const dimensions = await getImageDimensions(file);
    validateImageFile(file, constraints, dimensions);

    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        width: String(dimensions.width),
        height: String(dimensions.height),
      },
    });
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      url: downloadURL,
      storagePath: snapshot.ref.fullPath,
      width: dimensions.width,
      height: dimensions.height,
      contentType: file.type,
      sizeBytes: file.size,
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to upload image');
  }
};

export const uploadImage = async (file: File, path: string): Promise<string> => {
  const uploadedAsset = await uploadImageAsset(file, path);
  return uploadedAsset.url;
};
