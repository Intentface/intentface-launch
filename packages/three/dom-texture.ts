// DOM drawn into WebGL through Chrome's HTML-in-Canvas (CanvasDrawElement).

/** True when this browser can draw DOM into WebGL (Chrome with CanvasDrawElement). */
export const htmlInCanvas = () =>
  typeof WebGL2RenderingContext !== "undefined" && "texElementImage2D" in WebGL2RenderingContext.prototype;

/** Upload a canvas child's paint into `texture` (sRGB, mipmapped, anisotropic). */
export function uploadElement(gl: WebGL2RenderingContext, texture: WebGLTexture, el: Element, mipmaps = true) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  (gl as unknown as { texElementImage2D(t: number, f: number, e: Element): void }).texElementImage2D(
    gl.TEXTURE_2D,
    gl.SRGB8_ALPHA8,
    el,
  );
  if (mipmaps) {
    // Mipmaps and anisotropy keep tilted text readable instead of shimmering.
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 16);
  } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
