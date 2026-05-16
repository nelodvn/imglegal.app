import { Hono } from "hono";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
};

type Bindings = {
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

function isAllowedReferer(referer: string | null, requestUrl: string): boolean {
  if (!referer) return false;
  try {
    const refHost = new URL(referer).hostname;
    const reqHost = new URL(requestUrl).hostname;
    return refHost === reqHost;
  } catch {
    return false;
  }
}

function checkMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;

  // GIF: GIF8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;

  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return true;

  // BMP: BM
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return true;

  // TIFF little-endian: II*\0
  if (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) return true;

  // TIFF big-endian: MM\0*
  if (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a) return true;

  // ICO: \0\0\x01\0
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) return true;

  // AVIF/HEIF/HEIC: ftyp box at offset 4
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return true;

  // SVG: starts with '<svg' or '<?xml'
  const head = new TextDecoder().decode(bytes.slice(0, 32)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return true;

  return false;
}

app.post("/upload", async (c) => {
  const formData = await c.req.formData().catch(() => null);
  if (!formData) return c.json({ error: "Requisição inválida" }, 400);

  const entry = formData.get("image");
  if (!entry || typeof entry === "string") return c.json({ error: "Campo 'image' ausente" }, 400);
  const file = entry as File;

  if (!file.type.startsWith("image/")) {
    return c.json({ error: "Somente imagens são permitidas" }, 415);
  }

  if (file.size > MAX_SIZE) {
    return c.json({ error: "Imagem muito grande (máximo 10 MB)" }, 413);
  }

  const buffer = await file.arrayBuffer();

  if (!checkMagicBytes(new Uint8Array(buffer))) {
    return c.json({ error: "Conteúdo do arquivo não é uma imagem válida" }, 415);
  }

  const id = generateId();

  await c.env.IMAGES.put(id, buffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name, uploadedAt: new Date().toISOString() },
  });

  const base = new URL(c.req.url);
  const url = `${base.origin}/${id}`;

  return c.json({ id, url }, 200, SECURITY_HEADERS);
});

app.get("/img/:id", async (c) => {
  const id = c.req.param("id");
  const referer = c.req.header("Referer") ?? null;

  if (!isAllowedReferer(referer, c.req.url)) {
    if (!referer) {
      return c.redirect(`/${id}`, 303);
    }
    return c.text("Hotlink não permitido", 403, SECURITY_HEADERS);
  }

  const object = await c.env.IMAGES.get(id);
  if (!object) return c.text("Imagem não encontrada", 404, SECURITY_HEADERS);

  const contentType = object.httpMetadata?.contentType ?? "application/octet-stream";

  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=1209600, immutable",
      ...SECURITY_HEADERS,
    },
  });
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const object = await c.env.IMAGES.head(id);
  if (!object) return c.text("Imagem não encontrada", 404, SECURITY_HEADERS);

  const uploadedAt = object.customMetadata?.uploadedAt
    ? new Date(object.customMetadata.uploadedAt).toLocaleDateString("pt-BR")
    : null;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Imagem — imglegal</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100dvh;
      background: #0f0f0f;
      color: #e5e5e5;
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      padding: 2rem 1rem;
    }
    img {
      max-width: min(90vw, 1200px);
      max-height: 80vh;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,.6);
      object-fit: contain;
    }
    .actions {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    a, button {
      padding: .5rem 1.25rem;
      border-radius: 6px;
      text-decoration: none;
      font-size: .9rem;
      font-weight: 500;
      transition: opacity .15s;
      cursor: pointer;
      font-family: inherit;
      border: none;
    }
    a:hover, button:hover { opacity: .8; }
    .btn-primary { background: #f6821f; color: #fff; }
    .btn-secondary { background: #2a2a2a; color: #e5e5e5; border: 1px solid #3a3a3a; }
    small { color: #666; font-size: .8rem; }
  </style>
</head>
<body>
  <img src="/img/${id}" referrerpolicy="same-origin" alt="Imagem ${id}" />
  <div class="actions">
    <a class="btn-primary" href="/">Enviar nova imagem</a>
    <button class="btn-secondary" id="copyBtn" onclick="navigator.clipboard.writeText(location.href).then(()=>{this.textContent='Copiado!';setTimeout(()=>{this.textContent='Copiar URL'},2000)})">Copiar URL</button>
  </div>
  ${uploadedAt ? `<small>Enviada em ${uploadedAt}</small>` : ""}
</body>
</html>`;

  return c.html(html, 200, {
    ...SECURITY_HEADERS,
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
  });
});

export default app;
