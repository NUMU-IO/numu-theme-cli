import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import { loadConfig } from "./config";

interface ApiResponse<T = unknown> {
  status: number;
  /** Unwrapped payload — equivalent to backend's SuccessResponse.data when
   *  the response was wrapped, or the raw body otherwise. */
  data: T;
  /** Raw envelope, retained for callers that need `success`, `message`, etc. */
  raw: unknown;
}

function parseBody(body: string): { unwrapped: unknown; raw: unknown } {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return { unwrapped: body, raw: body };
  }
  // Backend wraps responses as { success, data, message, ... }. Unwrap when
  // the envelope is present so callers can read e.g. `res.data.access_token`
  // without having to drill into `res.data.data`.
  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    Object.prototype.hasOwnProperty.call(raw, "data")
  ) {
    return { unwrapped: (raw as { data: unknown }).data, raw };
  }
  return { unwrapped: raw, raw };
}

function assertHttpsOrLocalhost(urlStr: string): URL {
  const url = new URL(urlStr);
  if (url.protocol === "https:") return url;
  if (url.protocol === "http:") {
    const isLocal =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1";
    if (!isLocal) {
      throw new Error(
        `Refusing to send credentials over HTTP to ${url.hostname}. ` +
          `Set NUMU_API_URL to an https:// URL.`,
      );
    }
    return url;
  }
  throw new Error(`Unsupported protocol: ${url.protocol}`);
}

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const config = loadConfig();
  const url = assertHttpsOrLocalhost(`${config.api_url}${path}`);
  const isHttps = url.protocol === "https:";
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (config.token) headers["Authorization"] = `Bearer ${config.token}`;

    let postData: Buffer | undefined;
    if (body !== undefined) {
      postData = Buffer.from(JSON.stringify(body), "utf8");
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = String(postData.byteLength);
    }

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const { unwrapped, raw } = parseBody(data);
          resolve({
            status: res.statusCode ?? 0,
            data: unwrapped as T,
            raw,
          });
        });
      },
    );

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

export async function uploadFile<T = unknown>(
  path_: string,
  filePath: string,
): Promise<ApiResponse<T>> {
  const config = loadConfig();
  const url = assertHttpsOrLocalhost(`${config.api_url}${path_}`);
  const fileBuffer = fs.readFileSync(filePath);
  const boundary = "----NuMuCLI" + Date.now();
  const fileName = filePath.split(/[\\/]/).pop() || "theme.zip";

  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/zip\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  const fullBody = Buffer.concat([head, fileBuffer, tail]);

  const isHttps = url.protocol === "https:";
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(fullBody.byteLength),
    };
    if (config.token) headers["Authorization"] = `Bearer ${config.token}`;

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        // Preserve querystring so callers can pass `?queue_build=false`
        // (used by install/submit to keep the uploaded ZIP from being
        // consumed by the BYOT-from-zip Celery task before the
        // marketplace builder picks it up).
        path: url.pathname + (url.search || ""),
        method: "POST",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const { unwrapped, raw } = parseBody(data);
          resolve({
            status: res.statusCode ?? 0,
            data: unwrapped as T,
            raw,
          });
        });
      },
    );

    req.on("error", reject);
    req.write(fullBody);
    req.end();
  });
}
