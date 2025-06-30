import dotenv from "dotenv";
dotenv.config();
import { transporter } from "./emailConfig.js";
import { emailTemplate } from "./emailTemplate.js";

const sendMail = (mailData) => {
	return new Promise((resolve, reject) => {
		transporter.sendMail(mailData, (err, info) => {
			if (err) {
				console.error(err);
				reject(err);
			} else {
				console.log(info);
				resolve(info);
			}
		});
	});
};

const sendMailWithRetry = async (mailData, retries = 3) => {
	for (let i = 0; i < retries; i++) {
		try {
			return await sendMail(mailData);
		} catch (error) {
			if (i === retries - 1) throw error;
			console.log(`Retrying sendMail... Attempt ${i + 1}`);
		}
	}
};

// Welcome mail
export async function welcomeMail(userEmail) {
	try {
		let bodyContent = `
      <td style="padding: 20px; line-height: 1.8;">
        <p>Welcome to Mirrorcaps!</p>
        <p>
          We're thrilled to have you as part of our community. At Mirrorcaps, we are
          dedicated to providing the best services and support to our customers.
        </p>
        <p>Best regards</p>
        <p>The Mirrorcaps Team</p>
      </td>
    `;

		let mailOptions = {
			from: `Mirrorcaps ${process.env.SMTP_USER}`,
			to: userEmail,
			subject: "Welcome to Mirrorcaps!",
			html: emailTemplate(bodyContent),
		};

		const result = await sendMailWithRetry(mailOptions);
		return result;
	} catch (error) {
		return { error: error instanceof Error && error.message };
	}
}

export async function otpMail(userEmail, otp) {
	try {
		let bodyContent = `
      <td style="padding: 20px; line-height: 1.8;">
        <p>Your Verification code is:</p>
        <p class="otp">${otp}</p>
        <p>
          Copy and paste the above code into the form on the 
          website to continue. This code expires in 5 minutes.
        </p>
        <p>
          If you have questions or need assistance, reach out 
          to our support team at support@mirrorcaps.com.
        </p>
        <p>Best regards</p>
        <p>The Mirrorcaps Team</p>
      </td>
    `;

		let mailOptions = {
			from: `Mirrorcaps ${process.env.SMTP_USER}`,
			to: userEmail,
			subject: "Otp!",
			html: emailTemplate(bodyContent),
		};

		const result = await sendMailWithRetry(mailOptions);
		return result;
	} catch (error) {
		return { error: error instanceof Error && error.message };
	}
}

// Password reset mail
export async function passwordReset(userEmail) {
	try {
		let bodyContent = `
      <td style="padding: 20px; line-height: 1.8;">
        <p>
          A request was sent for password reset, if this wasn't you please
          contact our customer service. Click the reset link below to proceed
        </p>
        <a href="https://www.mirrorcaps.com/reset-password/newPassword">
          Reset Password
        </a>
        <p>
          If you have questions or need assistance, reach out 
          to our support team at support@mirrorcaps.com.
        </p>
        <p>Best regards</p>
        <p>The Mirrorcaps Team</p>
      </td>
    `;

		let mailOptions = {
			from: `Mirrorcaps ${process.env.SMTP_USER}`,
			to: userEmail,
			subject: "Password Reset!",
			html: emailTemplate(bodyContent),
		};

		const result = await sendMailWithRetry(mailOptions);
		return result;
	} catch (error) {
		return { error: error instanceof Error && error.message };
	}
}

// Alert Admin! mail
export async function alertAdmin(email, amount, date, type) {
	try {
		let bodyContent = `
      <td style="padding: 20px; line-height: 1.8;">
        <p>
            A ${type} request of $${amount} was initiated 
            by a user with this email: ${email}, date: ${date}
        </p>
      </td>
    `;

		let mailOptions = {
			from: `Mirrorcaps ${process.env.SMTP_USER}`,
			to: process.env.SMTP_USER,
			subject: "Admin Alert!",
			html: emailTemplate(bodyContent),
		};

		const result = await sendMailWithRetry(mailOptions);
		return result;
	} catch (error) {
		return { error: error instanceof Error && error.message };
	}
}

// deposit mail
export async function depositMail(fullName, amount, date, email, rejected) {
	try {
		let bodyContent = `
      <td style="padding: 20px; line-height: 1.8;">
        <p>Dear ${fullName}</p>
        <p>
          Your deposit of <strong>${amount}</strong>, ${date}, was 
          ${rejected ? "unsuccessful" : "successful"}! ${rejected ? "Please try again later." : "You can now use your funds to trade on Mirrorcaps."}
        </p>
        <p>
          If you have questions or need assistance, reach out 
          to our support team at support@mirrorcaps.com.
        </p>
        <p>Best regards</p>
        <p>The Mirrorcaps Team</p>
      </td>
    `;

		let mailOptions = {
			from: `Mirrorcaps ${process.env.SMTP_USER}`,
			to: email,
			subject: "Deposit!",
			html: emailTemplate(bodyContent),
		};

		const result = await sendMailWithRetry(mailOptions);
		return result;
	} catch (error) {
		return { error: error instanceof Error && error.message };
	}
}

export async function pendingDepositMail(fullName, amount, date, email) {
	try {
		let bodyContent = `
      <td style="padding: 20px; line-height: 1.8;">
        <p>Dear ${fullName},</p>
        <p>
          We've received your deposit request of <strong>${amount}</strong> on ${date}. 
          It is currently being reviewed and will be processed shortly.
        </p>
        <p>
          You'll receive a confirmation email once the deposit is approved.
          If you have any questions, feel free to contact us at support@mirrorcaps.com.
        </p>
        <p>Thank you for choosing Mirrorcaps.</p>
        <p>The Mirrorcaps Team</p>
      </td>
    `;

		let mailOptions = {
			from: `Mirrorcaps ${process.env.SMTP_USER}`,
			to: email,
			subject: "Deposit Pending",
			html: emailTemplate(bodyContent),
		};

		return await sendMailWithRetry(mailOptions);
	} catch (error) {
		return { error: error instanceof Error && error.message };
	}
}


// withdrawal mail
export async function withdrawalMail(fullName, amount, date, email, rejected) {
	try {
		let bodyContent = `
      <td style="padding: 20px; line-height: 1.8;">
        <p>Dear ${fullName}</p>
        <p>
          Your Withdrawal of <strong>${amount}</strong>, 
          ${date}, was ${rejected ? "unsuccessful" : "successful"}! ${rejected ? "Please try again later." : "Thanks for choosing Mirrorcaps!"}
        </p>
        <p>
          If you have questions or need assistance, reach out 
          to our support team at support@mirrorcaps.com.
        </p>
        <p>Best regards</p>
        <p>The Mirrorcaps Team</p>
      </td>
    `;

		let mailOptions = {
			from: `Mirrorcaps ${process.env.SMTP_USER}`,
			to: email,
			subject: "Withdrawal!",
			html: emailTemplate(bodyContent),
		};

		const result = await sendMailWithRetry(mailOptions);
		return result;
	} catch (error) {
		return { error: error instanceof Error && error.message };
	}
}

export async function pendingWithdrawalMail(fullName, amount, date, email) {
	try {
		let bodyContent = `
      <td style="padding: 20px; line-height: 1.8;">
        <p>Dear ${fullName},</p>
        <p>
          We've received your withdrawal request of <strong>${amount}</strong> on ${date}. 
          It is currently under review and will be processed soon.
        </p>
        <p>
          We'll notify you once the funds have been sent. If you have questions, 
          our support team is here to help: support@mirrorcaps.com.
        </p>
        <p>Thank you for using Mirrorcaps.</p>
        <p>The Mirrorcaps Team</p>
      </td>
    `;

		let mailOptions = {
			from: `Mirrorcaps ${process.env.SMTP_USER}`,
			to: email,
			subject: "Withdrawal Pending",
			html: emailTemplate(bodyContent),
		};

		return await sendMailWithRetry(mailOptions);
	} catch (error) {
		return { error: error instanceof Error && error.message };
	}
}


// withdrawal mail
export async function multiMails(emails, subject, message) {
	try {
		let bodyContent = `
      <td style="padding: 20px; line-height: 1.8;">
        <p>
          ${message}
        </p>
        <p>
          If you have questions or need assistance, reach out 
          to our support team at support@mirrorcaps.com.
        </p>
        <p>Best regards</p>
        <p>The Mirrorcaps Team</p>
      </td>
    `;

		let mailOptions = {
			from: `Mirrorcaps ${process.env.SMTP_USER}`,
			to: emails,
			subject: subject,
			html: emailTemplate(bodyContent),
		};

		const result = await sendMailWithRetry(mailOptions);
		return result;
	} catch (error) {
		return { error: error instanceof Error && error.message };
	}
}

// customer support mail
export async function sendContactUsMail({ name, email, subject, message }) {
	try {
		// Compose the email body content
		const bodyContent = `
      <td style="padding: 20px; line-height: 1.8;">
        <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      </td>
    `;

		// Email options
		const mailOptions = {
			from: `Mirrorcaps <${process.env.SMTP_USER}>`,
			to: process.env.SMTP_USER || "support@mirrorcaps.com",
			subject: `New Contact Us Message: ${subject}`,
			html: emailTemplate(bodyContent),
		};

		// Send the email
		const result = await sendMailWithRetry(mailOptions);

		return result;
	} catch (error) {
		console.error("Error sending contact us mail:", error);
		return { error: error instanceof Error ? error.message : String(error) };
	}
}


export async function kycPendingMail(fullName, email) {
	try {
		let bodyContent = `
      <td style="padding: 20px; line-height: 1.8;">
        <p>Dear ${fullName},</p>
        <p>
          Your KYC documents have been submitted successfully and are currently under review.
        </p>
        <p>
          We typically review submissions within 24-48 hours. You will be notified as soon 
          as your KYC is approved or if any additional documents are required.
        </p>
        <p>
          If you need assistance, reach us at support@mirrorcaps.com.
        </p>
        <p>Thank you for helping us keep Mirrorcaps secure.</p>
        <p>The Mirrorcaps Team</p>
      </td>
    `;

		let mailOptions = {
			from: `Mirrorcaps ${process.env.SMTP_USER}`,
			to: email,
			subject: "KYC Verification Pending",
			html: emailTemplate(bodyContent),
		};

		return await sendMailWithRetry(mailOptions);
	} catch (error) {
		return { error: error instanceof Error && error.message };
	}
}

export async function kycApprovedMail(fullName, email) {
	try {
		let bodyContent = `
      <td style="padding: 20px; line-height: 1.8;">
        <p>Dear ${fullName},</p>
        <p>
          Great news! Your KYC verification has been approved.
        </p>
        <p>
          You now have full access to all platform features including deposits, withdrawals, and trading.
        </p>
        <p>
          If you have any questions, our support team is here for you at support@mirrorcaps.com.
        </p>
        <p>Welcome aboard, and thank you for verifying your identity.</p>
        <p>The Mirrorcaps Team</p>
      </td>
    `;

		let mailOptions = {
			from: `Mirrorcaps ${process.env.SMTP_USER}`,
			to: email,
			subject: "KYC Approved!",
			html: emailTemplate(bodyContent),
		};

		return await sendMailWithRetry(mailOptions);
	} catch (error) {
		return { error: error instanceof Error && error.message };
	}
}
