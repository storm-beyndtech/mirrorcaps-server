import express from "express";
const router = express.Router();
import { Trader } from "../models/trader.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { logActivity } from "../utils/activityLogger.js";

// Configure Cloudinary
cloudinary.config({
	cloud_name: process.env.CLOUD_NAME,
	api_key: process.env.CLOUD_API_KEY,
	api_secret: process.env.CLOUD_API_SECRET,
});

// Configure Multer with Cloudinary storage
const storage = new CloudinaryStorage({
	cloudinary: cloudinary,
	params: {
		folder: "traders",
		allowed_formats: ["jpg", "jpeg", "png", "gif"],
		transformation: [{ width: 500, height: 500, crop: "limit" }],
	},
});

const upload = multer({ storage: storage });

/**
 * @route   GET /api/admin
 * @desc    Get all traders (admin only)
 */
router.get("/", authenticate, async (req, res) => {
	try {
		const traders = await Trader.find();

		res.status(200).json(traders);
	} catch (error) {
		res.status(500).json({
			message: error.message,
		});
	}
});

/**
 * @route   GET /api/admin/:id
 * @desc    Get trader by ID (admin only)
 */
router.get("/:id", authenticate, async (req, res) => {
	try {
		const trader = await Trader.findById(req.params.id);

		if (!trader) {
			return res.status(404).json({
				message: "Trader not found",
			});
		}

		res.status(200).json(trader);
	} catch (error) {
		res.status(500).json({
			message: error.message,
		});
	}
});

/**
 * @route   POST /api/admin/create
 * @desc    Create a new trader with profile image (admin only)
 */
router.post("/create", authenticate, requireAdmin, upload.single("profileImage"), async (req, res) => {
	try {
		const traderData = JSON.parse(req.body.traderData);

		// If there's a file uploaded, use its URL
		if (req.file) {
			traderData.profileImage = req.file.path;
		}

		const newTrader = await Trader.create(traderData);

		await logActivity(req, {
			action: "create_trader",
			actor: req.user,
			target: { collection: "traders", id: newTrader._id },
			metadata: { name: traderData.name },
			notifyAdmin: true,
		});

		res.status(201).json({ message: "Trader Created Successfully", newTrader });
	} catch (error) {
		if (error.name === "ValidationError") {
			const messages = Object.values(error.errors).map((val) => val.message);
			return res.status(400).json({
				message: messages.join(", "),
			});
		}

		res.status(500).json({
			message: error.message,
		});
	}
});

/**
 * @route   PUT /api/admin/:id
 * @desc    Update a trader with profile image (admin only)
 */
router.put("/:id", authenticate, requireAdmin, upload.single("profileImage"), async (req, res) => {
	try {
		const traderData = JSON.parse(req.body.traderData);

		// If there's a file uploaded, use its URL
		if (req.file) {
			traderData.profileImage = req.file.path;
		}

		const trader = await Trader.findByIdAndUpdate(req.params.id, traderData, {
			new: true,
			runValidators: true,
		});

		if (!trader) {
			return res.status(404).json({
				message: "Trader not found",
			});
		}

		res.status(200).json({ message: "Trader Updated Successfully", trader });
		await logActivity(req, {
			action: "update_trader",
			actor: req.user,
			target: { collection: "traders", id: trader._id },
			metadata: { name: traderData.name },
			notifyAdmin: true,
		});
	} catch (error) {
		if (error.name === "ValidationError") {
			const messages = Object.values(error.errors).map((val) => val.message);
			return res.status(400).json({
				message: messages.join(", "),
			});
		}

		res.status(500).json({
			message: error.message,
		});
	}
});

/**
 * @route   DELETE /api/admin/:id
 * @desc    Delete a trader (admin only)
 */
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
	try {
		const trader = await Trader.findByIdAndDelete(req.params.id);

		if (!trader) {
			return res.status(404).json({
				message: "Trader not found",
			});
		}

		await logActivity(req, {
			action: "delete_trader",
			actor: req.user,
			target: { collection: "traders", id: trader._id },
			notifyAdmin: true,
		});

		res.status(204).json({ message: "Trader Deleted Successfully" });
	} catch (error) {
		res.status(500).json({
			message: error.message,
		});
	}
});

export default router;
