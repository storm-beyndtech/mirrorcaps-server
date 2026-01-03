import { ActivityLog } from "../models/ActivityLog.js";
import { buildRequestContext } from "./requestContext.js";
import { emailTemplate } from "./emailTemplate.js";
import { sendMailWithRetry } from "./mailer.js";

export const logActivity = async (req, { actor, action, target, metadata, notifyAdmin = false }) => {
	try {
		const context = await buildRequestContext(req);
		const actorData = actor || req.user;
		const actorRole = actorData?.isAdmin ? "admin" : "user";

		const logEntry = new ActivityLog({
			actorId: actorData?._id || actorData?.id,
			actorEmail: actorData?.email,
			actorRole,
			action,
			targetCollection: target?.collection,
			targetId: target?.id,
			metadata,
			ipAddress: context.ipAddress,
			userAgent: context.userAgent,
			location: context.location || undefined,
		});

		await logEntry.save();

		if (notifyAdmin && process.env.SMTP_USER) {
			const bodyContent = `
        <td style="padding: 20px; line-height: 1.8;">
          <p><strong>Action:</strong> ${action}</p>
          <p><strong>Actor:</strong> ${actorData?.email || "Unknown"} (${actorRole})</p>
          <p><strong>Target:</strong> ${target?.collection || "n/a"} ${target?.id || ""}</p>
          <p><strong>IP:</strong> ${context.ipAddress || "n/a"}</p>
          <p><strong>User Agent:</strong> ${context.userAgent || "n/a"}</p>
          ${
				metadata
					? `<p><strong>Details:</strong></p><pre style="white-space:pre-wrap;background:#0b1220;color:#e5e7eb;padding:10px;border-radius:6px;">${JSON.stringify(metadata, null, 2)}</pre>`
					: ""
			}
        </td>
      `;

			await sendMailWithRetry({
				from: `Mirrorcaps <${process.env.SMTP_USER}>`,
				to: process.env.SMTP_USER,
				subject: `Admin activity: ${action}`,
				html: emailTemplate(bodyContent),
			}).catch((err) => console.error("Activity log email failed:", err));
		}

		return logEntry;
	} catch (error) {
		console.error("logActivity error:", error);
		return null;
	}
};
