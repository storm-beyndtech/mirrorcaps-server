import express from "express";
import { Transaction } from "../models/transaction.js";
import { User } from "../models/user.js";
import mongoose from "mongoose";
import { DemoTrade } from "../models/DemoTrade.js";
import { Trader } from "../models/trader.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

const isSelfOrAdmin = (req, id, email) => {
	if (!req.user) return false;
	if (req.user.isAdmin) return true;
	if (id && req.user._id?.toString() === id?.toString()) return true;
	if (email && req.user.email === email) return true;
	return false;
};

router.get("/", authenticate, requireAdmin, async (req, res) => {
	try {
		const trades = await Transaction.find({ type: "trade" }).sort({ date: "asc" });
		res.send(trades);
	} catch (error) {
		console.error(error);
		return res.status(500).send({ message: "Something Went Wrong..." });
	}
});

//Get user trades
router.get("/user/:userId/trader/:traderId", authenticate, async (req, res) => {
	try {
		const { userId, traderId } = req.params;

		// Validate ObjectIds
		if (!userId || userId === "null" || userId === "undefined") {
			return res.status(400).send({ message: "Invalid user ID" });
		}

		if (!traderId || traderId === "null" || traderId === "undefined") {
			return res.status(400).send({ message: "Invalid trader ID" });
		}

		// Get user's createdAt date
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).send({ message: "User not found" });
		}

		if (!isSelfOrAdmin(req, user._id, user.email)) {
			return res.status(403).send({ message: "Access denied" });
		}

		// Get trader to access their category
		const trader = await Trader.findById(traderId);
		if (!trader) {
			return res.status(404).send({ message: "Trader not found" });
		}

		// Filter trades by trader's category and user creation date
		const trades = await Transaction.find({
			type: "trade",
			"tradeData.category": trader.specialization,
			date: { $gte: user.createdAt },
		});

		res.send(trades);
	} catch (error) {
		console.error(error);
		return res.status(500).send({ message: "Something went wrong..." });
	}
});

// Get all demo trades for a user
router.get("/demo-trades/:email", authenticate, async (req, res) => {
	try {
		const { email } = req.params;
		if (!isSelfOrAdmin(req, null, email)) {
			return res.status(403).json({ message: "Access denied" });
		}
		const trades = await DemoTrade.find({ email }).sort({ createdAt: -1 });

		res.status(200).json({ trades });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

router.post("/create-demo-trade", authenticate, async (req, res) => {
	try {
		const { email, symbol, marketDirection, amount, duration, profit } = req.body;
		if (!isSelfOrAdmin(req, null, email)) {
			return res.status(403).json({ message: "Access denied" });
		}

		const newTrade = await DemoTrade.create({
			email,
			symbol,
			marketDirection,
			amount,
			duration,
			profit,
		});

		// Execute trade immediately
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const win = Math.random() > 0.5;
		const updatedBalance = win ? user.demo + profit : user.demo - amount;

		user.demo = updatedBalance;
		await user.save();

		res.status(201).json({
			message: "Trade created and executed",
			trade: newTrade,
			result: win ? "win" : "loss",
			newBalance: updatedBalance,
		});
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

// making a trade
router.post("/", authenticate, requireAdmin, async (req, res) => {
	const { symbol, interest, category } = req.body;

	try {
		const trade = new Transaction({
			tradeData: { package: symbol, interest, category },
			type: "trade",
			amount: 0,
		});

		await trade.save();

		await logActivity(req, {
			action: "create_trade",
			actor: req.user,
			target: { collection: "transactions", id: trade._id },
			metadata: { symbol, interest, category },
			notifyAdmin: true,
		});

		res.status(200).send({ message: "Success" });
	} catch (error) {
		for (i in error.errors) res.status(500).send({ message: error.errors[i].message });
	}
});

// updating a trade
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
	const { id } = req.params;
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const trade = await Transaction.findById(id).session(session);
		if (!trade) {
			await session.abortTransaction();
			session.endSession();
			return res.status(404).send({ message: "Trade not found" });
		}

		// Check and update user balances
		const users = await User.find({ deposit: { $gt: 0 } }).session(session);

		for (const user of users) {
			// Check if user has a trader assigned
			if (!user.traderId) {
				console.log(`User ${user._id} has no trader assigned - skipping interest disbursement`);
				continue;
			}

			// Get the trader's specialization
			const trader = await Trader.findById(user.traderId).session(session);
			if (!trader) {
				console.log(
					`Trader ${user.traderId} not found for user ${user._id} - skipping interest disbursement`,
				);
				continue;
			}

			// Check if trader's specialization matches trade category
			if (trader.specialization !== trade.tradeData.category) {
				console.log(
					`Trader specialization (${trader.specialization}) doesn't match trade category (${trade.tradeData.category}) for user ${user._id} - skipping interest disbursement`,
				);
				continue;
			}

			// Calculate and add interest if all checks pass
			const calculatedInterest = trade.tradeData.interest * user.deposit;
			user.interest += calculatedInterest;
			await user.save({ session });

			console.log(`Interest disbursed to user ${user._id}: ${calculatedInterest}`);
		}

		// Update trade status
		if (trade.status === "pending") {
			trade.status = "success";
		}

		await trade.save({ session });
		await session.commitTransaction();
		session.endSession();

		await logActivity(req, {
			action: "update_trade",
			actor: req.user,
			target: { collection: "transactions", id: trade._id },
			metadata: { status: trade.status },
			notifyAdmin: true,
		});

		res.send({ message: "Trade successfully updated" });
	} catch (error) {
		await session.abortTransaction();
		session.endSession();
		console.error(error);
		res.status(500).send({ message: "Internal Server Error" });
	}
});

// deleting a trade
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
	const { id } = req.params;

	try {
		const trade = await Transaction.findByIdAndRemove(id);
		if (!trade) return res.status(404).send({ message: "Trade not found" });

		await logActivity(req, {
			action: "delete_trade",
			actor: req.user,
			target: { collection: "transactions", id },
			notifyAdmin: true,
		});

		res.send(trade);
	} catch (error) {
		for (i in error.errors) res.status(500).send({ message: error.errors[i].message });
	}
});

export default router;
