// Coordinates in the retouching files are measured on a 1000-unit square.
export async function loadPhotograph(name) {
  const image = new Image();
  image.src = new URL('../../assets/photographs/' + name + '.webp', import.meta.url);
  await image.decode();
  return image;
}

export async function photograph(canvas, name) {
  const image = await loadPhotograph(name);
  const ctx = canvas.getContext('2d', {alpha: false});
  function crop(x, y, w, h, dx = x, dy = y, dw = w, dh = h) {
    if (dw <= 0 || dh <= 0) return;
    ctx.drawImage(image, x * image.width / 1000, y * image.height / 1000,
      w * image.width / 1000, h * image.height / 1000, dx, dy, dw, dh);
  }
  function begin() {
    ctx.setTransform(canvas.width / 1000, 0, 0, canvas.height / 1000, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    crop(0, 0, 1000, 1000);
  }
  return {ctx, crop, begin, image};
}

export const mono = '"JetBrains Mono", monospace';
export const serif = '"Instrument Serif", Georgia, serif';
export function lettering(ctx, value, x, y, width, size, {
  family = mono, weight = 500, color = '#23201c', align = 'center'
} = {}) {
  ctx.font = weight + ' ' + size + 'px ' + family;
  const measured = ctx.measureText(value).width;
  if (measured > width) ctx.font = weight + ' ' + (size * width / measured) + 'px ' + family;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

// Re-use the actual photographed paper tooth as the broken edge of a ribbon
// or letterpress impression. Build this small ink tile once per loaded plate.
export function paperInk(ctx, image, x, y, colour, strength) {
  const tile=document.createElement('canvas');
  tile.width=tile.height=144;
  const ink=tile.getContext('2d');
  ink.drawImage(image,x*image.width,y*image.height,144,144,0,0,144,144);
  const pixels=ink.getImageData(0,0,144,144);
  const data=pixels.data, luminance=new Float32Array(144*144);
  for(let i=0;i<luminance.length;i++) luminance[i]=data[i*4+1];
  for(let i=0;i<luminance.length;i++) {
    const neighbour=luminance[(i+145)%luminance.length];
    const fibre=Math.max(0,luminance[i]-neighbour);
    const k=i*4;
    data[k]=colour[0];data[k+1]=colour[1];data[k+2]=colour[2];
    data[k+3]=Math.max(35,252-fibre*strength);
  }
  ink.putImageData(pixels,0,0);
  const pattern=ctx.createPattern(tile,'repeat');
  pattern.setTransform(new DOMMatrix().scale(.65));
  return pattern;
}

export function clamp(n, low = 0, high = 1) {
  return Math.min(high, Math.max(low, n));
}
