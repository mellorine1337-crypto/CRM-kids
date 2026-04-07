const fs = require("node:fs");
const path = require("node:path");
const multer = require("multer");
const { env } = require("../config/env");

const ensureDir = (targetPath) => {
  fs.mkdirSync(targetPath, { recursive: true });
};

ensureDir(env.uploadDir);
ensureDir(path.join(env.uploadDir, "children"));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(env.uploadDir, "children"));
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || ".jpg");
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = { upload };
