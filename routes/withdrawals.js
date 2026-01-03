import express from "express";
import { Transaction } from "../models/transaction.js";
import { User } from "../models/user.js";
import { alertAdmin, pendingWithdrawalMail, withdrawalMail } from "../utils/mailer.js";
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

// getting all withdrawals
router.get("/", authenticate, requireAdmin, async (req, res) => {
	try {
		const withdrawals = await Transaction.find({ type: "withdrawal" });
		res.send(withdrawals);
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// getting single withdrawal
router.get("/:id", authenticate, async (req, res) => {
	const { id } = req.params;

	try {
		const withdrawal = await Transaction.findById(id);
		if (!withdrawal) return res.status(400).send({ message: "Transaction not found..." });
		if (!isSelfOrAdmin(req, withdrawal.user?.id, withdrawal.user?.email)) {
			return res.status(403).send({ message: "Access denied" });
		}
		res.send(withdrawal);
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// get all withdrawals by user
router.get("/user/:email", authenticate, async (req, res) => {
	const { email } = req.params;

	try {
		if (!isSelfOrAdmin(req, null, email)) {
			return res.status(403).send({ message: "Access denied" });
		}
		const withdrawals = await Transaction.find({ from: email });
		if (!withdrawals || withdrawals.length === 0)
			return res.status(400).send({ message: "Transactions not found..." });
		res.send(withdrawals);
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// making a withdrawal
router.post("/", authenticate, async (req, res) => {
	const { id, amount, convertedAmount, coinName, network, address } = req.body;

	const targetUserId = id || req.user?._id;
	const user = await User.findById(targetUserId);
	if (!user) return res.status(400).send({ message: "Something went wrong" });
	if (!isSelfOrAdmin(req, user._id, user.email)) {
		return res.status(403).send({ message: "Access denied" });
	}

	// Check if there's any pending withdrawal for the user
	const pendingWithdrawal = await Transaction.findOne({
		"user.id": id,
		status: "pending",
		type: "withdrawal",
	});

	if (pendingWithdrawal) {
		return res.status(400).send({ message: "You have a pending withdrawal. Please wait for approval." });
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
			network,
			address,
		};

		// Create a new withdrawal instance
		const transaction = new Transaction({ type: "withdrawal", user: userData, amount, walletData });
		await transaction.save();

		const date = transaction.date;
		const type = transaction.type;
		const email = transaction.user.email;

		const emailDataForAdmin = await alertAdmin(email, amount, date, type);
		if (emailDataForAdmin.error) return res.status(400).send({ message: emailDataForAdmin.error });

		const emailData = await pendingWithdrawalMail(user.fullName, amount, date, email);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		await logActivity(req, {
			action: "create_withdrawal",
			actor: req.user,
			target: { collection: "transactions", id: transaction._id },
			metadata: { amount, coinName, network },
		});

		res.send({ message: "Withdraw successful and pending approval..." });
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// updating a withdrawal
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
	const { id } = req.params;
	const { email, amount, status } = req.body;

	let withdrawal = await Transaction.findById(id);
	if (!withdrawal) return res.status(404).send({ message: "Withdrawal not found" });

	let user = await User.findOne({ email });
	if (!user) return res.status(400).send({ message: "Something went wrong" });

	try {
		withdrawal.status = status;

		if (status === "success") {
			const totalAvailable = user.deposit + user.interest;

			if (amount > totalAvailable) {
				throw new Error("Insufficient funds");
			}

			if (amount <= user.deposit) {
				user.deposit -= amount;
			} else {
				const remaining = amount - user.deposit;
				user.deposit = 0;
				user.interest -= remaining;
			}

			user.withdraw += amount;
		}

		user = await user.save();
		withdrawal = await withdrawal.save();

		const { fullName, email } = user;
		const { date } = withdrawal;

		const isRejected = status === "success" ? false : true;

		const emailData = await withdrawalMail(fullName, amount, date, email, isRejected);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		await logActivity(req, {
			action: "update_withdrawal_status",
			actor: req.user,
			target: { collection: "transactions", id: withdrawal._id },
			metadata: { status, amount, userId: user._id },
		});

		res.send({ message: "Withdrawal successfully updated" });
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

export default router;
