/**
 * A product photo, made small in the browser before it is sent: at most
 * 512 px on its longer side, as WebP (or JPEG where the browser cannot write
 * WebP). A phone picture of several megabytes becomes a few dozen kilobytes,
 * so a till with a hundred tiles loads quickly.
 */
const MAX_SIDE = 512;
const MAX_BYTES = 300_000;

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not a picture this browser can open."));
    };
    img.src = url;
  });
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export type PhotoType = "image/webp" | "image/jpeg";

export async function shrinkPhoto(file: File): Promise<{ contentType: PhotoType; data: string }> {
  // An <img> applies the photo's own rotation (a phone's portrait shot stays upright).
  const img = await load(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot prepare the picture.");
  ctx.fillStyle = "#fff"; // a transparent PNG becomes a white background, not black, as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let blob = await encode(canvas, "image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", 0.85);
  if (blob && blob.size > MAX_BYTES) blob = await encode(canvas, "image/jpeg", 0.6);
  if (!blob) throw new Error("This browser cannot prepare the picture.");
  if (blob.size > MAX_BYTES) throw new Error("The picture is still too large; try a smaller one.");

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return {
    contentType: blob.type === "image/webp" ? "image/webp" : "image/jpeg",
    data: btoa(binary),
  };
}
