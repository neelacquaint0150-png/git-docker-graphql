import { redis } from '../../config/redis.js';
import { sendSMSViaHttpSMS } from '../../services/sms.service.js';

export const authResolver = {
  Mutation: {
    sendOTP: async (_, { phone }) => {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const redisKey = `otp:${phone}`;

      await redis.set(redisKey, otpCode, 'EX', 300);
      console.log(`🔑 OTP generated for ${phone}: ${otpCode}`);

      try {
        await sendSMSViaHttpSMS(
          phone,
          `Your verification code is: ${otpCode}. Valid for 5 minutes.`
        );
        return {
          success: true,
          message: `OTP sent successfully to ${phone}`,
        };
      } catch (error) {
        console.error('HttpSMS Error:', error.message);
        return {
          success: false,
          message: `Failed to dispatch SMS: ${error.message}`,
        };
      }
    },

    verifyOTP: async (_, { phone, code }) => {
      const redisKey = `otp:${phone}`;
      const storedOTP = await redis.get(redisKey);

      if (!storedOTP) {
        return {
          success: false,
          message: 'OTP has expired or was never requested.',
        };
      }

      if (storedOTP !== code) {
        return {
          success: false,
          message: 'Invalid OTP code. Please try again.',
        };
      }

      await redis.del(redisKey);

      return {
        success: true,
        message: 'Phone number verified successfully!',
      };
    },
  },
};