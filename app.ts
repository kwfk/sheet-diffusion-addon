import express, { Response } from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import md5 from "md5";
import { generateImage } from "./image-generation";

dotenv.config();
const app = express();

app.use("/ftp", express.static("imgs"));

const mime = {
  jpg: "image/jpeg",
  png: "image/png",
};

/**
 * Read image file at filepath and serve it as the response
 */
const serveImage = (filepath: string, res: Response) => {
  const ext = path.extname(filepath).slice(1);
  let type = "text/plain";
  if (ext === "jpg" || ext === "png") type = mime[ext];
  const s = fs.createReadStream(filepath);
  s.on("open", () => {
    res.set("Content-Type", type);
    s.pipe(res);
  });
  s.on("error", () => {
    res.set("Content-Type", "text/plain");
    res.status(404).end("Not found");
  });
};

app.get("/", (req, res) => {
  const prompt = req.query.prompt;
  const files = fs.readdirSync(path.join(__dirname, "/../imgs"));
  const rand = Math.floor(Math.random() * files.length);

  const img = path.join(__dirname, "..", "imgs", files[rand]);

  serveImage(img, res);
});

app.get("/generate", async (req, res) => {
  const { prompt } = req.query;
  if (typeof prompt !== "string") {
    res.status(401).send("Need a prompt as a string");
    return;
  }

  const hash = md5(prompt);

  // check if image file with hash exists
  const files = fs.readdirSync(path.join(__dirname, "..", "imgs"));
  const cachedImage = files.find((f) => f.split(".")[0] === hash);
  if (cachedImage) {
    const cachedImagePath = path.join(__dirname, "..", "imgs", cachedImage);
    serveImage(cachedImagePath, res);
    return;
  }

  // generate new image with prompt
  const { seed, base64Image } = await generateImage(prompt);
  const img = Buffer.from(base64Image, "base64");
  fs.writeFile(path.join(__dirname, "/../imgs", `${hash}.png`), img, (err) => {
    if (err) throw err;
    console.log("image has been saved");
  });

  res.writeHead(200, {
    "Content-Type": "image/png",
    "Content-Length": img.length,
  });
  res.end(img);
});

const port = parseInt(process.env.PORT || "") || 8080;
app.listen(port, () => {
  console.log(`Listen on the port ${port}...`);
});
