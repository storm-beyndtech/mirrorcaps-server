import { Otp } from "../models/otp.js";

// Helper function to verify Otp (implement based on your Otp storage method)
export async function verifyOtp(email, otp) {
  try {
    const otpRecord = await Otp.findOne({ email, code: otp });
    if (!otpRecord) return false;
    
    // Check if Otp is expired (e.g., 5 minutes)
    const now = new Date();
    const otpAge = now - otpRecord.createdAt;
    if (otpAge > 5 * 60 * 1000) { // 5 minutes in milliseconds
      await Otp.deleteOne({ email, otp }); // Clean up expired Otp
      return false;
    }
    
    // Otp is valid, remove it to prevent reuse
    await Otp.deleteOne({ email, otp });
    return true;
  } catch (error) {
    console.error('Otp verification error:', error);
    return false;
  }
}