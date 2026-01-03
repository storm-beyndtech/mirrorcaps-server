import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { ActivityLog } from "../models/ActivityLog.js";

const router = express.Router();

router.get("/", authenticate, requireAdmin, async (req, res) => {
	const { limit = 50, action } = req.query;
	const query = action ? { action } : {};

	try {
		const logs = await ActivityLog.find(query)
			.sort({ createdAt: -1 })
			.limit(Math.min(parseInt(limit, 10) || 50, 200));

		res.send({ logs });
	} catch (error) {
		console.error("Error fetching activity logs:", error);
		res.status(500).send({ message: "Failed to fetch activity logs" });
	}
});

export default router;
