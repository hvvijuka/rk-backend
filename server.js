import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

console.log("Cloudinary Config:", process.env.CLOUDINARY_CLOUD_NAME);

if (!process.env.CLOUDINARY_CLOUD_NAME) {
  console.error("❌ Missing Cloudinary credentials in .env");
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.get("/api/getImages", async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: "",
      max_results: 500,
      resource_type: "image",
    });

    // Group images by folder (category)
    const categories = {};
    result.resources.forEach((img) => {
      const folder = img.folder || "Uncategorized";
      if (!categories[folder]) categories[folder] = [];
      categories[folder].push({
        name: img.public_id.split("/").pop(),
        cloudinaryUrl: img.secure_url,
        folder: folder,
        uploaded_at: img.created_at,
        width: img.width,
        height: img.height,
      });
    });

    res.json(categories);
  } catch (err) {
    console.error("Error fetching images:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
