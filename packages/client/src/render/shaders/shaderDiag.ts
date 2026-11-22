/** Validates WebGL2 GlProgram compile/link status and reports exact driver diagnostics. */
import type { Filter, Renderer } from "pixi.js";

export interface NamedFilter {
  readonly name: string;
  readonly filter: Filter;
}

interface GlRendererLike {
  readonly gl?: WebGL2RenderingContext;
}

export function reportShaderDiagnostics(renderer: Renderer, filters: readonly NamedFilter[]): void {
  const errors = diagnoseFilterShaders(renderer, filters);
  if (errors.length === 0) return;
  const pre = document.createElement("pre");
  pre.id = "shader-diag-overlay";
  pre.style.cssText = "position:fixed;bottom:10px;left:10px;right:10px;z-index:99;background:rgba(120,0,0,.92);color:#fff;padding:10px;font-size:12px;white-space:pre-wrap;";
  pre.textContent = errors.join("\n");
  document.body.appendChild(pre);
}

export function diagnoseFilterShaders(renderer: Renderer, filters: readonly NamedFilter[]): string[] {
  const gl = (renderer as unknown as GlRendererLike).gl;
  if (!gl) return [];
  const errors: string[] = [];
  for (const entry of filters) {
    const err = checkGlProgram(gl, entry.name, entry.filter);
    if (err) errors.push(err);
  }
  return errors;
}

function readCompileError(gl: WebGL2RenderingContext, shader: WebGLShader, fallback: string): string {
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return "";
  return (gl.getShaderInfoLog(shader) ?? fallback).trim();
}

function readLinkError(gl: WebGL2RenderingContext, program: WebGLProgram): string {
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return "";
  return (gl.getProgramInfoLog(program) ?? "link err").trim();
}

function checkGlProgram(gl: WebGL2RenderingContext, name: string, filter: Filter): string | null {
  const prog = filter.glProgram;
  if (!prog.vertex || !prog.fragment) return `${name}: missing shader source`;
  const vShader = compilePart(gl, gl.VERTEX_SHADER, prog.vertex);
  const fShader = compilePart(gl, gl.FRAGMENT_SHADER, prog.fragment);
  const program = gl.createProgram();
  if (!program) return `${name}: gl.createProgram failed`;
  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);
  const vLog = readCompileError(gl, vShader, "vert err");
  const fLog = readCompileError(gl, fShader, "frag err");
  const pLog = readLinkError(gl, program);
  gl.deleteShader(vShader);
  gl.deleteShader(fShader);
  gl.deleteProgram(program);
  if (!vLog && !fLog && !pLog) return null;
  const msg = `[ShaderDiag ${name}] V=[${vLog}] F=[${fLog}] L=[${pLog}]`;
  console.error(msg);
  return msg;
}

function compilePart(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("gl.createShader failed");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  return shader;
}
