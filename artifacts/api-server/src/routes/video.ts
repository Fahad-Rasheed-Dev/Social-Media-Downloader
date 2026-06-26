import { Router } from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const router = Router();

const DOWNLOAD_DIR = "/tmp/saveflow";
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

interface JobEntry {
  status: "processing" | "done" | "error";
  percent: number;
  speed: string;
  eta: string;
  filePath?: string;
  ext?: string;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, JobEntry>();

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function findYtDlp(): string {
  const candidates = [
    "yt-dlp",
    "/home/runner/.nix-profile/bin/yt-dlp",
    "/nix/var/nix/profiles/default/bin/yt-dlp",
    "/home/runner/workspace/.local/bin/yt-dlp",
  ];
  for (const c of candidates) {
    try {
      const { execSync } = require("child_process");
      execSync(`${c} --version`, { stdio: "ignore" });
      return c;
    } catch {}
  }
  return "yt-dlp";
}

// Cleanup jobs older than 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > 60 * 60 * 1000) {
      if (job.filePath) fs.rm(job.filePath, () => {});
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

router.post("/video/info", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  const ytdlp = findYtDlp();
  const args = ["--dump-json", "--no-playlist", "--no-warnings", url];
  const proc = spawn(ytdlp, args);
  let output = "";
  let errorOutput = "";

  proc.stdout.on("data", (d: Buffer) => {
    output += d.toString();
  });
  proc.stderr.on("data", (d: Buffer) => {
    errorOutput += d.toString();
  });

  proc.on("close", (code) => {
    if (code !== 0) {
      req.log.warn({ url, errorOutput }, "yt-dlp info failed");
      res
        .status(400)
        .json({ error: "Could not fetch video info. Check the URL." });
      return;
    }
    try {
      const info = JSON.parse(output);
      res.json({
        title: info.title ?? "Unknown Title",
        duration:
          info.duration_string ?? formatDuration(info.duration ?? 0),
        thumbnail: info.thumbnail ?? null,
        platform: (info.extractor_key ?? "unknown").toLowerCase(),
        uploader: info.uploader ?? info.channel ?? "Unknown",
        formats: [
          { id: "mp4-1080", label: "MP4 1080p HD", ext: "mp4", quality: "1080" },
          { id: "mp4-720", label: "MP4 720p", ext: "mp4", quality: "720" },
          { id: "mp4-480", label: "MP4 480p", ext: "mp4", quality: "480" },
          { id: "mp3-320", label: "MP3 320kbps", ext: "mp3", quality: "320" },
          { id: "mp3-128", label: "MP3 128kbps", ext: "mp3", quality: "128" },
        ],
      });
    } catch {
      res.status(500).json({ error: "Failed to parse video info" });
    }
  });

  proc.on("error", () => {
    res.status(500).json({
      error:
        "yt-dlp is not installed on this server. Please install yt-dlp to enable downloads.",
    });
  });
});

router.post("/video/download", (req, res) => {
  const { url, format, quality } = req.body as {
    url?: string;
    format?: string;
    quality?: string;
  };
  if (!url || !format || !quality) {
    res.status(400).json({ error: "url, format, and quality are required" });
    return;
  }

  const jobId = randomUUID();
  const isAudio = format === "mp3";
  const outputTemplate = path.join(DOWNLOAD_DIR, `${jobId}.%(ext)s`);

  jobs.set(jobId, {
    status: "processing",
    percent: 0,
    speed: "",
    eta: "",
    createdAt: Date.now(),
  });

  let args: string[];
  if (isAudio) {
    args = [
      "-f", "bestaudio/best",
      "--extract-audio", "--audio-format", "mp3",
      "--audio-quality", quality === "128" ? "5" : "0",
      "--no-playlist", "--no-warnings",
      "--newline",
      "--progress-template",
      "%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
      "-o", outputTemplate,
      url,
    ];
  } else {
    args = [
      "-f",
      `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best`,
      "--merge-output-format", "mp4",
      "--no-playlist", "--no-warnings",
      "--newline",
      "--progress-template",
      "%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
      "-o", outputTemplate,
      url,
    ];
  }

  const ytdlp = findYtDlp();
  const proc = spawn(ytdlp, args);
  const job = jobs.get(jobId)!;

  proc.stdout.on("data", (d: Buffer) => {
    const lines = d.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      if (line.includes("|")) {
        const parts = line.split("|");
        const pct = parseFloat(parts[0] ?? "0") || 0;
        job.percent = Math.min(pct, 99);
        job.speed = parts[1]?.trim() ?? "";
        job.eta = parts[2]?.trim() ?? "";
      }
    }
  });

  proc.on("close", async (code) => {
    if (code !== 0) {
      job.status = "error";
      job.error = "Download failed. Video might be private or geo-restricted.";
      return;
    }
    const files = fs.readdirSync(DOWNLOAD_DIR);
    const downloaded = files.find((f) => f.startsWith(jobId));
    if (!downloaded) {
      job.status = "error";
      job.error = "Downloaded file not found";
      return;
    }
    job.status = "done";
    job.percent = 100;
    job.filePath = path.join(DOWNLOAD_DIR, downloaded);
    job.ext = downloaded.split(".").pop() ?? (isAudio ? "mp3" : "mp4");
  });

  proc.on("error", () => {
    job.status = "error";
    job.error =
      "yt-dlp is not installed. Please install yt-dlp on the server.";
  });

  res.json({ jobId });
});

router.get("/video/progress/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId ?? "");
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({
    status: job.status,
    percent: job.percent,
    speed: job.speed,
    eta: job.eta,
    ext: job.ext,
    error: job.error,
  });
});

router.get("/video/file/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId ?? "");
  if (!job || job.status !== "done" || !job.filePath) {
    res.status(404).json({ error: "File not ready" });
    return;
  }

  const isAudio = job.ext === "mp3";
  const fileName = `saveflow_${Date.now()}.${job.ext}`;

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileName}"`,
  );
  res.setHeader(
    "Content-Type",
    isAudio ? "audio/mpeg" : "video/mp4",
  );

  const stream = fs.createReadStream(job.filePath);
  stream.pipe(res);
  stream.on("end", () => {
    fs.rm(job.filePath!, () => {});
    jobs.delete(req.params.jobId ?? "");
  });
  res.on("error", () => {
    fs.rm(job.filePath!, () => {});
  });
});

export default router;
