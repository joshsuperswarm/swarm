export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

export function isImageFile(filePath: string): boolean {
  const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  return IMAGE_EXTENSIONS.includes(extension);
}

export function getFileNameFromPath(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getMimeTypeFromBase64(base64: string): string {
  const matches = base64.match(/^data:([^;]+);base64,/);
  return matches ? matches[1] : 'image/jpeg';
}