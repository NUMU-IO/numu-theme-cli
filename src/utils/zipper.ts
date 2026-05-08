import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";

interface ZipOptions {
  /** Extra ignore globs on top of the defaults. */
  excludePatterns?: string[];
  /**
   * Include `dist/**` in the archive. Default: false (we don't ship
   * build output for `submit`, where the worker rebuilds from source).
   * Set true for `install`, where the worker can't resolve workspace
   * `link:` deps and we'd rather it use the dist the dev built locally.
   */
  includeDist?: boolean;
}

export async function zipDirectory(
  sourceDir: string,
  outputPath: string,
  optsOrLegacyExcludes: ZipOptions | string[] = {},
): Promise<string> {
  // Backwards-compat: the original signature was
  // `zipDirectory(sourceDir, outputPath, excludePatterns: string[])`.
  // Accept either shape so existing callers keep working.
  const opts: ZipOptions = Array.isArray(optsOrLegacyExcludes)
    ? { excludePatterns: optsOrLegacyExcludes }
    : optsOrLegacyExcludes;

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(outputPath));
    archive.on("error", reject);

    archive.pipe(output);

    const defaultExcludes = [
      "node_modules/**",
      ".git/**",
      ".env",
      ".env.*",
      ".next/**",
    ];
    if (!opts.includeDist) defaultExcludes.push("dist/**");

    const allExcludes = [...defaultExcludes, ...(opts.excludePatterns ?? [])];

    archive.glob("**/*", {
      cwd: sourceDir,
      ignore: allExcludes,
      dot: false,
    });

    archive.finalize();
  });
}
