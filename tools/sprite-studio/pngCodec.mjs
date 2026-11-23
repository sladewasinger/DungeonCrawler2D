/** Pure Node PNG decoder and encoder for 8-bit RGB/RGBA pixel buffers. */
import zlib from "node:zlib";

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function unfilterPixelByte(opts) {
  const { type, rawVal, left, up, upLeft } = opts;
  if (type === 0) return rawVal;
  if (type === 1) return (rawVal + left) & 0xff;
  if (type === 2) return (rawVal + up) & 0xff;
  if (type === 3) return (rawVal + ((left + up) >> 1)) & 0xff;
  if (type === 4) return (rawVal + paethPredictor(left, up, upLeft)) & 0xff;
  throw new Error(`Unsupported PNG filter type: ${type}`);
}

function unfilterRowByte(opts) {
  const { type, srcByte, dstIdx, stride, bpp, pixels, x, y } = opts;
  const left = x >= bpp ? pixels[dstIdx - bpp] : 0;
  const up = y > 0 ? pixels[dstIdx - stride] : 0;
  const upLeft = x >= bpp && y > 0 ? pixels[dstIdx - stride - bpp] : 0;
  return unfilterPixelByte({ type, rawVal: srcByte, left, up, upLeft });
}

function unfilterSingleRow(opts) {
  const { raw, pixels, width, bpp, y } = opts;
  const stride = width * bpp;
  const type = raw[y * (stride + 1)];
  const srcStart = y * (stride + 1) + 1;
  const dstStart = y * stride;
  for (let x = 0; x < stride; x++) {
    pixels[dstStart + x] = unfilterRowByte({
      type, srcByte: raw[srcStart + x], dstIdx: dstStart + x, stride, bpp, pixels, x, y,
    });
  }
}

function unfilterScanlines(opts) {
  const { raw, width, height, bpp } = opts;
  const pixels = new Uint8Array(height * width * bpp);
  for (let y = 0; y < height; y++) {
    unfilterSingleRow({ raw, pixels, width, bpp, y });
  }
  return pixels;
}

function expandToRgba(pixels, count, colorType) {
  if (colorType === 6) return pixels;
  if (colorType !== 2) throw new Error(`Unsupported PNG colorType: ${colorType}`);
  const out = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    out[i * 4] = pixels[i * 3];
    out[i * 4 + 1] = pixels[i * 3 + 1];
    out[i * 4 + 2] = pixels[i * 3 + 2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

export function decodePng(buf) {
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idatParts = [];
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "IDAT") {
      idatParts.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  const unfiltered = unfilterScanlines({ raw, width, height, bpp });
  return { width, height, rgba: expandToRgba(unfiltered, width * height, colorType) };
}

function buildPngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

export function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rowBytes = width * 4;
  const raw = Buffer.alloc(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    const rowOff = y * (1 + rowBytes);
    raw[rowOff] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * rowBytes, rowBytes).copy(raw, rowOff + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, buildPngChunk("IHDR", ihdr), buildPngChunk("IDAT", idat), buildPngChunk("IEND", Buffer.alloc(0))]);
}
