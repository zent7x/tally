import { useEffect, useRef } from "react";

const VERT = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uMouse;
uniform float uRevealRadius;
uniform float uRevealSoftness;
uniform float uPixelSize;
uniform float uMouseActive;
uniform float uWaveSpeed;
uniform float uWaveFrequency;
uniform float uWaveAmplitude;
uniform float uMouseRadius;
uniform float uBaseColorMix;
uniform vec2 uResolution;
uniform vec2 uImageSize;

in vec2 vUv;
out vec4 fragColor;

float bayer4x4(vec2 pos) {
  int x = int(mod(pos.x, 4.0));
  int y = int(mod(pos.y, 4.0));
  int index = x + y * 4;
  float pattern[16];
  pattern[0] = 0.0;  pattern[1] = 8.0;  pattern[2] = 2.0;  pattern[3] = 10.0;
  pattern[4] = 12.0; pattern[5] = 4.0;  pattern[6] = 14.0; pattern[7] = 6.0;
  pattern[8] = 3.0;  pattern[9] = 11.0; pattern[10] = 1.0; pattern[11] = 9.0;
  pattern[12] = 15.0; pattern[13] = 7.0; pattern[14] = 13.0; pattern[15] = 5.0;
  for (int i = 0; i < 16; i++) {
    if (i == index) return pattern[i] / 16.0;
  }
  return 0.0;
}

vec2 coverUv(vec2 uv) {
  float viewAspect = uResolution.x / max(uResolution.y, 1.0);
  float imageAspect = uImageSize.x / max(uImageSize.y, 1.0);
  vec2 outUv = uv;
  if (viewAspect > imageAspect) {
    float visibleV = imageAspect / viewAspect;
    outUv.y = (uv.y - 0.5) * visibleV + 0.5;
  } else {
    float visibleU = viewAspect / imageAspect;
    outUv.x = (uv.x - 0.5) * visibleU + 0.5;
  }
  return outUv;
}

void main() {
  vec2 screenUv = vUv;
  vec2 uv = coverUv(screenUv);

  float waveStrength = uWaveAmplitude * 0.016;
  float wave1 = sin(uv.y * uWaveFrequency * 12.0 + uTime * uWaveSpeed) * waveStrength;
  float wave2 = sin(uv.x * uWaveFrequency * 9.0 + uTime * uWaveSpeed * 0.85) * waveStrength * 0.6;
  vec2 distortedUv = uv + vec2(wave1, wave2);

  float dist = distance(screenUv, uMouse);
  float mouseInfluence = smoothstep(uMouseRadius, 0.0, dist) * uMouseActive;
  float ripple = sin(dist * 36.0 - uTime * uWaveSpeed * 4.0)
    * uWaveAmplitude * 0.012 * mouseInfluence;
  distortedUv += vec2(ripple);

  vec4 color = texture(uTexture, clamp(distortedUv, 0.0, 1.0));
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));

  vec2 pixelCoord = floor(gl_FragCoord.xy / max(uPixelSize, 1.0));
  float dither = bayer4x4(pixelCoord);
  float levels = 3.0;
  float dithered = floor(gray * levels + dither) / levels;
  // High-contrast ink dither so the idle state reads clearly
  vec3 bwColor = vec3(mix(0.08, 0.92, dithered));

  float soft = clamp(uRevealSoftness, 0.05, 0.95);
  float innerRadius = uRevealRadius * (1.0 - soft);
  float revealAmount =
    (1.0 - smoothstep(innerRadius, max(uRevealRadius, innerRadius + 0.001), dist))
    * uMouseActive;

  // Punch up revealed color so cream paper actually "opens"
  vec3 revealed = color.rgb;
  revealed = mix(vec3(dot(revealed, vec3(0.299, 0.587, 0.114))), revealed, 1.45);
  revealed = clamp(revealed * vec3(0.92, 1.05, 0.95), 0.0, 1.0);

  vec3 base = mix(bwColor, color.rgb, clamp(uBaseColorMix, 0.0, 0.25));
  vec3 finalColor = mix(base, revealed, revealAmount);
  fragColor = vec4(finalColor, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "compile error";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vert: string, frag: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, vert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "link error";
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

export interface RevealWaveImageProps {
  src: string;
  revealRadius?: number;
  revealSoftness?: number;
  pixelSize?: number;
  waveSpeed?: number;
  waveFrequency?: number;
  waveAmplitude?: number;
  mouseRadius?: number;
  baseColorMix?: number;
  className?: string;
  trackWindow?: boolean;
}

export function RevealWaveImage({
  src,
  revealRadius = 0.32,
  revealSoftness = 0.5,
  pixelSize = 3,
  waveSpeed = 1.2,
  waveFrequency = 1.5,
  waveAmplitude = 1,
  mouseRadius = 0.36,
  baseColorMix = 0.14,
  className = "h-full w-full",
  trackWindow = true,
}: RevealWaveImageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ u: 0.52, v: 0.42, active: 1 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      pointerRef.current = {
        u: (e.clientX - rect.left) / rect.width,
        v: 1 - (e.clientY - rect.top) / rect.height,
        active: 1,
      };
    };

    if (trackWindow) {
      window.addEventListener("pointermove", onMove, { passive: true });
      return () => window.removeEventListener("pointermove", onMove);
    }

    const el = rootRef.current;
    if (!el) return;
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, [trackWindow]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    let disposed = false;
    let raf = 0;
    let program: WebGLProgram | null = null;
    let texture: WebGLTexture | null = null;
    let buffer: WebGLBuffer | null = null;
    let imageW = 1920;
    let imageH = 1080;
    let mouseActive = 1;

    const props = {
      revealRadius,
      revealSoftness,
      pixelSize,
      waveSpeed,
      waveFrequency,
      waveAmplitude,
      mouseRadius,
      baseColorMix,
    };

    try {
      program = createProgram(gl, VERT, FRAG);
    } catch (err) {
      console.error("[RevealWaveImage]", err);
      return;
    }

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const aPosition = gl.getAttribLocation(program, "aPosition");
    const uniforms = {
      uTexture: gl.getUniformLocation(program, "uTexture"),
      uTime: gl.getUniformLocation(program, "uTime"),
      uMouse: gl.getUniformLocation(program, "uMouse"),
      uRevealRadius: gl.getUniformLocation(program, "uRevealRadius"),
      uRevealSoftness: gl.getUniformLocation(program, "uRevealSoftness"),
      uPixelSize: gl.getUniformLocation(program, "uPixelSize"),
      uMouseActive: gl.getUniformLocation(program, "uMouseActive"),
      uWaveSpeed: gl.getUniformLocation(program, "uWaveSpeed"),
      uWaveFrequency: gl.getUniformLocation(program, "uWaveFrequency"),
      uWaveAmplitude: gl.getUniformLocation(program, "uWaveAmplitude"),
      uMouseRadius: gl.getUniformLocation(program, "uMouseRadius"),
      uBaseColorMix: gl.getUniformLocation(program, "uBaseColorMix"),
      uResolution: gl.getUniformLocation(program, "uResolution"),
      uImageSize: gl.getUniformLocation(program, "uImageSize"),
    };

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // placeholder pixel while image loads
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([235, 232, 223, 255]),
    );

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (disposed) return;
      imageW = image.naturalWidth || image.width;
      imageH = image.naturalHeight || image.height;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    };
    image.src = src;

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(root);
    resize();

    const start = performance.now();
    const draw = (now: number) => {
      if (disposed || !program) return;
      resize();
      const t = (now - start) / 1000;
      const ptr = pointerRef.current;
      mouseActive += (ptr.active - mouseActive) * 0.16;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniforms.uTexture, 0);
      gl.uniform1f(uniforms.uTime, t);
      gl.uniform2f(uniforms.uMouse, ptr.u, ptr.v);
      gl.uniform1f(uniforms.uRevealRadius, props.revealRadius);
      gl.uniform1f(uniforms.uRevealSoftness, props.revealSoftness);
      gl.uniform1f(
        uniforms.uPixelSize,
        Math.max(1.5, props.pixelSize * Math.min(window.devicePixelRatio || 1, 1.75)),
      );
      gl.uniform1f(uniforms.uMouseActive, mouseActive);
      gl.uniform1f(uniforms.uWaveSpeed, props.waveSpeed);
      gl.uniform1f(uniforms.uWaveFrequency, props.waveFrequency);
      gl.uniform1f(uniforms.uWaveAmplitude, props.waveAmplitude);
      gl.uniform1f(uniforms.uMouseRadius, props.mouseRadius);
      gl.uniform1f(uniforms.uBaseColorMix, props.baseColorMix);
      gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.uImageSize, imageW, imageH);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (texture) gl.deleteTexture(texture);
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
    };
  }, [
    src,
    revealRadius,
    revealSoftness,
    pixelSize,
    waveSpeed,
    waveFrequency,
    waveAmplitude,
    mouseRadius,
    baseColorMix,
  ]);

  return (
    <div
      ref={rootRef}
      className={`reveal-wave-root ${className}`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="reveal-wave-fallback"
        draggable={false}
      />
      <canvas
        ref={canvasRef}
        className="reveal-wave-canvas"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default RevealWaveImage;
