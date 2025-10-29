require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------------
// ☁️ Cloudinary configuration
// ----------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ----------------------------
// 🔐 Generate secure upload signature
// ----------------------------
app.get("/api/signature", (req, res) => {
  try {
    let { folder, public_id, context, type } = req.query;
    const timestamp = Math.floor(Date.now() / 1000);

    // Always decode context safely
    if (context) context = decodeURIComponent(context);

    // Default type to upload
    if (!type) type = "upload";

    // Cloudinary requires identical params to the upload/explicit call
    // — include everything used in FormData
    const paramsToSign = {
      timestamp,
      type,
    };

    // Folder must be signed if sent in upload call
    if (folder) paramsToSign.folder = folder;
    if (public_id) paramsToSign.public_id = public_id;
    if (context) paramsToSign.context = context;

    // ✅ For Cloudinary upload endpoint, `folder` and `public_id` go together
    // ✅ For explicit endpoint, `public_id` includes full folder path already, so folder must NOT be added again

    // Generate signature
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    console.log("🟢 Params to sign:", paramsToSign);
    console.log("🟢 Signature generated successfully.");

    res.json({
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (err) {
    console.error("❌ Error generating signature:", err);
    res.status(500).json({ error: "Failed to generate Cloudinary signature" });
  }
});

// ----------------------------
// ✅ Fetch *all* images under "Radha" recursively
// ----------------------------
app.get("/api/getCloudImages", async (req, res) => {
  try {
    const MAIN_FOLDER = "Radha";
    let allResources = [];
    let nextCursor = null;

    do {
      const result = await cloudinary.search
        .expression(`folder:${MAIN_FOLDER}/*`)
        .with_field("context") // ✅ include metadata (price, qty, desc)
        .sort_by("public_id", "asc")
        .max_results(100)
        .next_cursor(nextCursor || undefined)
        .execute();

      allResources = allResources.concat(result.resources);
      nextCursor = result.next_cursor;
    } while (nextCursor);

    const filtered = allResources.filter((img) =>
      img.public_id.startsWith(`${MAIN_FOLDER}/`)
    );

    console.log(`✅ Total images fetched: ${filtered.length}`);
    res.json(filtered);
  } catch (err) {
    console.error("❌ Error fetching from Cloudinary:", err);
    res.status(500).json({ error: "Failed to fetch images from Cloudinary" });
  }
});

// ----------------------------
// 📁 Fetch all folders & images with metadata under "Radha"
// ----------------------------
app.get("/api/getImages", async (req, res) => {
  try {
    const MAIN_FOLDER = "Radha";
    const folderImages = {};

    console.log("📁 Fetching Cloudinary folders under:", MAIN_FOLDER);

    // Step 1️⃣: Get all subfolders under MAIN_FOLDER
    const foldersResult = await cloudinary.api.sub_folders(MAIN_FOLDER);
    const allFolders = foldersResult.folders.map((f) => f.path);

    // Step 2️⃣: Fetch images from each subfolder
    for (const folder of allFolders) {
      const searchResult = await cloudinary.search
        .expression(`folder:${folder}`)
        .with_field("context") // ensure metadata comes back
        .sort_by("public_id", "asc")
        .max_results(500) // increase if needed
        .execute();

      folderImages[folder] = searchResult.resources.map((r) => ({
        id: r.asset_id,
        name: r.public_id.split("/").pop(),
        url: r.secure_url,
        public_id: r.public_id,      // ✅ include actual public_id
        category: folder.replace(`${MAIN_FOLDER}/`, "") || "All",
        context: r.context || {},     // ✅ preserve metadata for frontend
      }));
    }

    // Step 3️⃣: Fetch images directly under the root folder (MAIN_FOLDER)
    const rootResult = await cloudinary.search
      .expression(`folder:${MAIN_FOLDER} AND NOT folder:${MAIN_FOLDER}/*`) // root only
      .with_field("context")
      .sort_by("public_id", "asc")
      .max_results(500)
      .execute();

    if (rootResult.resources.length > 0) {
      folderImages[MAIN_FOLDER] = rootResult.resources.map((r) => ({
        id: r.asset_id,
        name: r.public_id.split("/").pop(),
        url: r.secure_url,
        public_id: r.public_id,
        category: "All",
        context: r.context || {},
      }));
    }

    console.log("✅ Successfully fetched all folders and images with metadata.");
    res.json(folderImages);
  } catch (err) {
    console.error("❌ Error fetching images from Cloudinary:", err);
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
