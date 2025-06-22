import { OAuth2Client } from "google-auth-library";
import { welcomeMail } from "./mailer.js";
import { User } from "../models/user.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req, res) => {
	const { token } = req.body;
	try {
		const ticket = await client.verifyIdToken({
			idToken: token,
			audience: process.env.GOOGLE_CLIENT_ID,
		});

		const payload = ticket.getPayload();
		const { email, picture } = payload;
		const raw = email.split("@")[0];
		const username = raw.replace(/[^a-zA-Z0-9]/g, "");

		let user = await User.findOne({ email });

		if (user && !user.isGoogleUser) {
			return res.status(400).json({
				error: "Email is already registered with password login. Please use password login instead.",
			});
		}

		if (!user) {
			user = new User({
				email,
				username,
				profileImage: picture,
				isGoogleUser: true,
			});
			await user.save();
			await welcomeMail(user.email);
		}

		res.json({ user });
	} catch (error) {
		console.error(error);
		res.status(401).json({ message: "Invalid Google token" });
	}
};
