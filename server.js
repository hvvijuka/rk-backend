require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------------
// 🔗 MongoDB Connection
// ----------------------------
const DB_USER = process.env.MONGO_USER || "radhaAdmin";
const DB_PASSWORD = encodeURIComponent(process.env.MONGO_PASS || "Krishna@123");
const DB_NAME = process.env.MONGO_DB || "RadhaDB";
const CLUSTER_URL = process.env.MONGO_CLUSTER || "cluster0.gcx9ehe.mongodb.net";

const MONGO_URI = `mongodb+srv://${DB_USER}:${DB_PASSWORD}@${CLUSTER_URL}/${DB_NAME}?retryWrites=true&w=majority`;

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Connected to MongoDB successfully"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

// ----------------------------
// 👤 User Model
// ----------------------------
const UserSchema = new mongoose.Schema({
  name: String,
  area: String,
  address: String,
  email: String,
  phone: String,
  username: { type: String, unique: true },
  password: String,
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model("User", UserSchema);

// ----------------------------
// 🛒 Temporary in-memory order storage (will reset on restart)
let orders = [];

// ----------------------------
// 👤 User Login Route
// ----------------------------
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

    // Find user by username
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "User not found" });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Incorrect password" });

    // ✅ Successful login
    res.json({ success: true, user });
  } catch (err) {
    console.error("❌ Error during login:", err);
    res.status(500).json({ error: "Failed to login" });
  }
});


// ----------------------------
// 👤 Signup Route
// ----------------------------
app.post("/api/signup", async (req, res) => {
  try {
    const { name, area, address, email, phone, username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: "Username already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      area,
      address,
      email,
      phone,
      username,
      password: hashedPassword,
    });

    await newUser.save();
    res.json({ success: true, message: "User created", user: newUser });
  } catch (err) {
    console.error("❌ Error creating user:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ----------------------------
// ☁️ Cloudinary configuration
// ----------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ----------------------------
// 🔐 Cloudinary Signature
// ----------------------------
app.get("/api/signature", (req, res) => {
  try {
    let { folder, public_id, context, type } = req.query;
    const timestamp = Math.floor(Date.now() / 1000);
    if (context) context = decodeURIComponent(context);
    if (!type) type = "upload";

    const paramsToSign = { timestamp, type };
    if (folder) paramsToSign.folder = folder;
    if (public_id) paramsToSign.public_id = public_id;
    if (context) paramsToSign.context = context;

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
    console.error("❌ Error generating signature:", err);
    res.status(500).json({ error: "Failed to generate Cloudinary signature" });
  }
});

// ----------------------------
// 📸 Fetch Cloud Images (Radha)
// ----------------------------
app.get("/api/getCloudImages", async (req, res) => {
  try {
    const MAIN_FOLDER = "Radha";
    let allResources = [];
    let nextCursor = null;

    do {
      const result = await cloudinary.search
        .expression(`folder:${MAIN_FOLDER}/*`)
        .with_field("context")
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
// 🛍️ Place Order
// ----------------------------
app.post("/api/placeOrder", async (req, res) => {
  try {
    const {
      userId,
      username,
      address,
      items,
      totalAmount,
      paymentMethod,
      cashCollected,
      images,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "No items in order." });
    }

    const finalUserId = userId || "demo";

    const newOrder = {
      _id: Date.now().toString(),
      userId: finalUserId,
      username: username || "Guest User",
      address,
      items,
      totalAmount,
      paymentMethod,
      cashCollected,
      images,
      createdAt: new Date(),
    };

    orders.push(newOrder);
    console.log("✅ [BACKEND] New order stored:", newOrder);
    console.log("✅ [BACKEND] Total orders count:", orders.length);

    res.json(newOrder);
  } catch (err) {
    console.error("❌ Error placing order:", err);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// ----------------------------
// 📦 Get all orders (admin)
// ----------------------------
app.get("/api/orders", (req, res) => {
  res.json(orders);
});

// ----------------------------
// 👤 Get orders for specific user
// ----------------------------
app.get("/api/getOrders/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    console.log("📦 [BACKEND] Fetching orders for userId:", userId);

    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const userOrders = orders.filter(
      (order) => order.userId === userId || userId === "demo"
    );

    console.log("📦 [BACKEND] Orders found for user:", userOrders.length);
    res.json(userOrders);
  } catch (err) {
    console.error("❌ Error fetching user orders:", err);
    res.status(500).json({ error: "Failed to fetch user orders" });
  }
});

// ----------------------------
// 📁 Get all images grouped by folder
// ----------------------------
app.get("/api/getImages", async (req, res) => {
  try {
    const MAIN_FOLDER = "Radha";
    const folderImages = {};

    const foldersResult = await cloudinary.api.sub_folders(MAIN_FOLDER);
    const allFolders = foldersResult.folders.map((f) => f.path);

    // Iterate all subfolders
    for (const folder of allFolders) {
      const searchResult = await cloudinary.search
        .expression(`folder:${folder}`)
        .with_field("context")
        .sort_by("public_id", "asc")
        .max_results(500)
        .execute();

      folderImages[folder] = searchResult.resources.map((r) => ({
        id: r.asset_id,
        name: r.public_id.split("/").pop(),
        url: r.secure_url,
        public_id: r.public_id,
        category: folder.replace(`${MAIN_FOLDER}/`, "") || "All",
        context: r.context || {},
      }));
    }

    // Also include images in root folder
    const rootResult = await cloudinary.search
      .expression(`folder:${MAIN_FOLDER} AND NOT folder:${MAIN_FOLDER}/*`)
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

    console.log("✅ Successfully fetched all folders and images.");
    res.json(folderImages);
  } catch (err) {
    console.error("❌ Error fetching images:", err);
    res.status(500).json({ error: "Failed to fetch images from Cloudinary" });
  }
});


// ----------------------------
// 🚀 Start server
// ----------------------------
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
