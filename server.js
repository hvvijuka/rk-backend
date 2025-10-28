require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------------
// Cloudinary configuration
// ----------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// ----------------------------
// 🔐 Signed upload route (fixed)
// ----------------------------
app.get("/api/signature", (req, res) => {
  try {
    const { folder, public_id } = req.query;
    const timestamp = Math.floor(Date.now() / 1000);

    const paramsToSign = { timestamp };
    if (folder) paramsToSign.folder = folder;
    if (public_id) paramsToSign.public_id = public_id;

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (err) {
    console.error("Error generating signature:", err);
    res.status(500).json({ error: "Failed to generate signature" });
  }
});

// ----------------------------
// ✅ Fetch all images recursively under "Radha"
// ----------------------------
// ----------------------------
// ✅ Fetch *all* images recursively from Radha and subfolders
// ----------------------------
app.get("/api/getCloudImages", async (req, res) => {
  try {
    const MAIN_FOLDER = "Radha";
    let allResources = [];
    let nextCursor = null;

    do {
      const result = await cloudinary.search
        // 👇 Search recursively for all images under Radha (any nested depth)
        .expression(`folder:${MAIN_FOLDER}/*`)
        .sort_by("public_id", "asc")
        .max_results(100)
        .next_cursor(nextCursor || undefined)
        .execute();

      allResources = allResources.concat(result.resources);
      nextCursor = result.next_cursor;
    } while (nextCursor);

    // ✅ Filter only those under Radha/
    const filtered = allResources.filter((img) =>
      img.public_id.startsWith(`${MAIN_FOLDER}/`)
    );

    console.log(`✅ Total images fetched from Cloudinary: ${filtered.length}`);
    res.json(filtered);
  } catch (err) {
    console.error("❌ Error fetching from Cloudinary:", err);
    res.status(500).json({ error: "Failed to fetch images from Cloudinary" });
  }
});




// ----------------------------
// 📁 Fetch all folders & images under Radha
// ----------------------------
app.get("/api/getImages", async (req, res) => {
  try {
    const MAIN_FOLDER = "Radha";

    // Step 1: Get all subfolders under Radha
    const foldersResult = await cloudinary.api.sub_folders(MAIN_FOLDER);

    // ✅ Only include subfolders, not the main folder itself
    const allFolders = foldersResult.folders.map((f) => f.path);

    const folderImages = {};

    // Step 2: Fetch images for each subfolder
    for (const folder of allFolders) {
      const searchResult = await cloudinary.search
        .expression(`folder:${folder}`)
        .sort_by("public_id", "asc")
        .max_results(100)
        .execute();

      // Store images under their folder name
      folderImages[folder] = searchResult.resources.map((r) => ({
        id: r.asset_id,
        name: r.public_id.split("/").pop(),
        url: r.secure_url,
        category: folder.replace(`${MAIN_FOLDER}/`, ""), // e.g., "Krishna"
      }));
    }

    res.json(folderImages);
  } catch (err) {
    console.error("Error fetching images:", err);
    res.status(500).json({ error: "Failed to fetch images from Cloudinary" });
  }
});


// ----------------------------
// Start server
// ----------------------------
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
