import { emailQueue } from './emailQueue.js';
import { sendMail } from './sendMail.js';

const QUEUE_ENABLED = !!(process.env.REDIS_HOST || process.env.REDIS_URL || process.env.REDIS_PORT);
const QUEUE_ADD_TIMEOUT_MS = 1000; // don't let API wait on Redis

/**
 * Email Service for adding email jobs to BullMQ queue
 */
export class EmailService {
    
    /**
     * Add email job to queue
     * @param {string} receiver - Email recipient
     * @param {string} otp - OTP or dynamic content
     * @param {string} subject - Email subject (optional)
     * @param {string} template - Email template type (optional)
     * @param {object} options - Additional job options (optional)
     */
    static async addEmailJob(receiver, otp, subject, template = 'password-reset', options = {}) {
        try {
            const jobData = {
                receiver,
                otp,
                subject,
                template,
                timestamp: new Date().toISOString()
            };

            const jobOptions = {
                delay: options.delay || 0, // Delay in milliseconds
                priority: options.priority || 0, // Higher number = higher priority
                attempts: options.attempts || 3,
                ...options
            };

            if (!QUEUE_ENABLED) {
                // Queue not configured in environment: send in background without blocking
                setImmediate(async () => {
                    try {
                        await sendMail(receiver, otp, subject, template);
                    } catch (e) {
                        console.error('Background email send failed:', e?.message || e);
                    }
                });
                return {
                    success: true,
                    jobId: null,
                    message: 'Email dispatch scheduled (queue disabled)'
                };
            }

            const addPromise = emailQueue.add('send-email', jobData, jobOptions);
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), QUEUE_ADD_TIMEOUT_MS));
            const result = await Promise.race([addPromise, timeoutPromise]);

            if (result === 'timeout') {
                console.warn('Queue add timed out, proceeding without blocking');
                return { success: true, jobId: null, message: 'Email job scheduled (timeout fallback)' };
            }

            console.log(`📧 Email job added to queue: ${result.id} for ${receiver}`);
            return {
                success: true,
                jobId: result.id,
                message: 'Email job added to queue successfully'
            };
        } catch (error) {
            console.error('Error adding email job to queue:', error);
            return {
                success: false,
                message: 'Failed to add email job to queue: ' + error.message
            };
        }
    }

    /**
     * Send password reset email
     */
    static async sendPasswordResetEmail(receiver, otp) {
        return await this.addEmailJob(
            receiver, 
            otp, 
            'Password Reset - Food Delivery App',
            'password-reset',
            { priority: 10 } // High priority for password resets
        );
    }

    /**
     * Send welcome email
     */
    static async sendWelcomeEmail(receiver) {
        return await this.addEmailJob(
            receiver, 
            '', 
            'Welcome to Food Delivery App',
            'welcome',
            { priority: 5 }
        );
    }

    /**
     * Send order confirmation email
     */
    static async sendOrderConfirmationEmail(receiver, orderId) {
        return await this.addEmailJob(
            receiver, 
            orderId, 
            'Order Confirmation - Food Delivery App',
            'order-confirmation',
            { priority: 8 }
        );
    }

    static async sendOrderDeliveredEmail(receiver, otp) {
        return await this.addEmailJob(
            receiver,
            otp,
            'Order Delivered - OTP Verification',
            'order-delivered',
            { priority: 8 }
        );
    }

    /**
     * Send delayed email (for reminders, follow-ups, etc.)
     */
    static async sendDelayedEmail(receiver, otp, subject, template, delayInMinutes) {
        return await this.addEmailJob(
            receiver, 
            otp, 
            subject,
            template,
            { 
                delay: delayInMinutes * 60 * 1000, // Convert minutes to milliseconds
                priority: 3 
            }
        );
    }

    /**
     * Get queue statistics
     */
    static async getQueueStats() {
        try {
            const waiting = await emailQueue.getWaiting();
            const active = await emailQueue.getActive();
            const completed = await emailQueue.getCompleted();
            const failed = await emailQueue.getFailed();

            return {
                waiting: waiting.length,
                active: active.length,
                completed: completed.length,
                failed: failed.length,
                total: waiting.length + active.length + completed.length + failed.length
            };
        } catch (error) {
            console.error('Error getting queue stats:', error);
            return null;
        }
    }

    /**
     * Clear failed jobs
     */
    static async clearFailedJobs() {
        try {
            await emailQueue.clean(0, 'failed');
            console.log('✅ Failed jobs cleared');
            return { success: true, message: 'Failed jobs cleared' };
        } catch (error) {
            console.error('Error clearing failed jobs:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Retry failed jobs
     */
    static async retryFailedJobs() {
        try {
            const failedJobs = await emailQueue.getFailed();
            for (const job of failedJobs) {
                await job.retry();
            }
            console.log(`🔄 Retrying ${failedJobs.length} failed jobs`);
            return { success: true, message: `Retrying ${failedJobs.length} failed jobs` };
        } catch (error) {
            console.error('Error retrying failed jobs:', error);
            return { success: false, message: error.message };
        }
    }

    static async sendOrderStatusUpdateEmail(receiver, status) {
        return await this.addEmailJob(
            receiver, 
            status, 
            'Order Status Update - Food Delivery App',
            `order-status-update-preparing`,
            { priority: 8 }
        );
    }
}
export default EmailService;