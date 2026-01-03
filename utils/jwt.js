import dotenv from "dotenv";
dotenv.config();

export const getJwtSecret = () => {
	const secret = process.env.JWT_SECRET || process.env.JWT_PRIVATE_KEY;

	if (!secret) {
		throw new Error("Fatal Error: JWT secret is required");
	}

	return secret;
};
