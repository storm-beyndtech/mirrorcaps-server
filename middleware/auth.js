import jwt from "jsonwebtoken";
import { User } from "../models/user.js";
import { getJwtSecret } from "../utils/jwt.js";

const extractToken = (req) => {
	const bearer = req.headers.authorization;
	if (bearer && bearer.startsWith("Bearer ")) {
		return bearer.replace("Bearer ", "").trim();
	}

	const headerToken = req.headers["x-auth-token"];
	return typeof headerToken === "string" ? headerToken.trim() : null;
};

export const authenticate = async (req, res, next) => {
	try {
		const token = extractToken(req);
		if (!token) {
			return res.status(401).send({ message: "Access denied. No token provided." });
		}

		const decoded = jwt.verify(token, getJwtSecret());
		const user = await User.findById(decoded._id);

		if (!user) {
			return res.status(401).send({ message: "Invalid token." });
		}

		req.user = user;
		next();
	} catch (error) {
		return res.status(401).send({ message: "Invalid token." });
	}
};

export const requireAdmin = (req, res, next) => {
	if (!req.user?.isAdmin) {
		return res.status(403).send({ message: "Access denied. Admin only." });
	}

	next();
};
