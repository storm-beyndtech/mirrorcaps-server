import express from "express";
import { Transaction } from "../models/transaction.js";
import { User } from "../models/user.js";
import { alertAdmin, depositMail, pendingDepositMail } from "../utils/mailer.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

const isSelfOrAdmin = (req, userId, email) => {
	if (!req.user) return false;
	if (req.user.isAdmin) return true;
	if (userId && req.user._id?.toString() === userId?.toString()) return true;
	if (email && req.user.email === email) return true;
	return false;
};

// getting all deposits
router.get("/", authenticate, requireAdmin, async (req, res) => {
	try {
		const deposits = await Transaction.find({ type: "deposit" });
		res.send(deposits);
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// get all deposits by user
router.get("/user/:email", authenticate, async (req, res) => {
	const { email } = req.params;

	try {
		if (!isSelfOrAdmin(req, null, email)) {
			return res.status(403).send({ message: "Access denied" });
		}
		const deposits = await Transaction.find({ "user.email": email });
		if (!deposits || deposits.length === 0) return res.status(400).send({ message: "Deposits not found..." });
		res.send(deposits);
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// making a deposit
router.post("/", authenticate, async (req, res) => {
	const { id, amount, convertedAmount, coinName } = req.body;

	const targetUserId = id || req.user?._id;
	const user = await User.findById(targetUserId);
	if (!user) return res.status(400).send({ message: "Something went wrong" });
	if (!isSelfOrAdmin(req, user._id, user.email)) {
		return res.status(403).send({ message: "Access denied" });
	}

	// Check if there's any pending deposit for the user
	const pendingDeposit = await Transaction.findOne({
		"user.id": id,
		status: "pending",
		type: "deposit",
	});

	if (pendingDeposit) {
		return res.status(400).send({ message: "You have a pending deposit. Please wait for approval." });
	}

	try {
		const userData = {
			id: user._id,
			email: user.email,
			name: user.fullName,
		};

		const walletData = {
			convertedAmount,
			coinName,
			network: "",
			address: "",
		};

		// Create a new deposit instance
		const transaction = new Transaction({ type: "deposit", user: userData, amount, walletData });
		await transaction.save();

		const date = transaction.date;
		const type = transaction.type;
		const email = transaction.user.email;

		const emailDataForAdmin = await alertAdmin(email, amount, date, type);
		if (emailDataForAdmin.error) return res.status(400).send({ message: emailDataForAdmin.error });

		const emailData = await pendingDepositMail(user.fullName, amount, date, email);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		await logActivity(req, {
			action: "create_deposit",
			actor: req.user,
			target: { collection: "transactions", id: transaction._id },
			metadata: { amount, coinName, convertedAmount },
		});

		res.send({ message: "Deposit successful and pending approval..." });
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// POST /users/reset-demo-balance
router.post("/reset-demo-balance", authenticate, async (req, res) => {
	const { email } = req.body;
	const targetEmail = email || req.user?.email;

	if (!isSelfOrAdmin(req, null, targetEmail)) {
		return res.status(403).json({ message: "Access denied" });
	}
	// Update demo balance in DB
	await User.updateOne({ email: targetEmail }, { demo: 10000 });

	await logActivity(req, {
		action: "reset_demo_balance",
		actor: req.user,
		target: { collection: "users", id: req.user?._id },
	});
	res.status(200).json({ message: "Demo balance topped up" });
});

// updating a deposit
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
	const { id } = req.params;
	const { email, amount, status } = req.body;

	let deposit = await Transaction.findById(id);
	if (!deposit) return res.status(404).send({ message: "Deposit not found" });

	let user = await User.findOne({ email });
	if (!user) return res.status(400).send({ message: "Something went wrong" });

	try {
		deposit.status = status;

		if (status === "success") {
			user.deposit += amount;
		}

		user = await user.save();
		deposit = await deposit.save();

		const { fullName, email } = user;
		const { date } = deposit;

		const isRejected = status === "success" ? false : true;

		const emailData = await depositMail(fullName, amount, date, email, isRejected);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		await logActivity(req, {
			action: "update_deposit_status",
			actor: req.user,
			target: { collection: "transactions", id: deposit._id },
			metadata: { status, amount, userId: user._id },
		});

		res.send({ message: "Deposit successfully updated" });
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

export default router;
