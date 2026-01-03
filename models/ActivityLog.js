import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
	{
		city: { type: String },
		region: { type: String },
		country: { type: String },
		lat: { type: Number },
		lng: { type: Number },
	},
	{ _id: false },
);

const activityLogSchema = new mongoose.Schema({
	actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	actorEmail: { type: String },
	actorRole: { type: String },
	action: { type: String, required: true },
	targetCollection: { type: String },
	targetId: { type: String },
	metadata: { type: mongoose.Schema.Types.Mixed },
	ipAddress: { type: String },
	userAgent: { type: String },
	location: locationSchema,
	createdAt: { type: Date, default: Date.now },
});

activityLogSchema.index({ createdAt: -1 });

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
