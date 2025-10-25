import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.get("/api/getImages", async (req, res) => {
  try {
    const categories = {};

    // Example: fetch images under folders in your Cloudinary account
    const folderList = ["Category1", "Category2", "Category3"];

    for (const folder of folderList) {
      const result = await cloudinary.search
        .expression(`folder=${folder}`)
        .sort_by("public_id", "desc")
        .max_results(30)
        .execute();

      categories[folder] = result.resources.map((r) => ({
        cloudinaryUrl: r.secure_url,
        name: r.public_id.split("/").pop(),
        description: r.context?.custom?.description || "",
        price: r.context?.custom?.price || "",
      }));
    }

    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
