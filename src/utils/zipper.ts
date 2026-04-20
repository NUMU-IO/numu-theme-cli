import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";

export async function zipDirectory(sourceDir: string, outputPath: string, excludePatterns: string[] = []): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(outputPath));
    archive.on("error", reject);

    archive.pipe(output);

    const defaultExcludes = ["node_modules/**", ".git/**", ".env", ".env.*", "dist/**", ".next/**"];
    const allExcludes = [...defaultExcludes, ...excludePatterns];

    archive.glob("**/*", {
      cwd: sourceDir,
      ignore: allExcludes,
      dot: false,
    });

    archive.finalize();
  });
}
