import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import { loadConfig } from "./config";

export async function apiRequest(method: string, path: string, body?: any, isFormData?: boolean): Promise<any> {
  const config = loadConfig();
  const url = new URL(`${config.api_url}${path}`);
  const isHttps = url.protocol === "https:";
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (config.token) headers["Authorization"] = `Bearer ${config.token}`;

    let postData: string | Buffer | undefined;
    if (body && !isFormData) {
      postData = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(postData).toString();
    }

    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

export async function uploadFile(path_: string, filePath: string): Promise<any> {
  const config = loadConfig();
  const fileBuffer = fs.readFileSync(filePath);
  const boundary = "----NuMuCLI" + Date.now();
  const fileName = filePath.split("/").pop() || "theme.zip";

  const bodyParts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/zip\r\n\r\n`,
    fileBuffer,
    `\r\n--${boundary}--\r\n`,
  ];

  const url = new URL(`${config.api_url}${path_}`);
  const isHttps = url.protocol === "https:";
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    };
    if (config.token) headers["Authorization"] = `Bearer ${config.token}`;

    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });

    req.on("error", reject);
    req.write(bodyParts[0]);
    req.write(bodyParts[1]);
    req.write(bodyParts[2]);
    req.end();
  });
}
