import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { sendMail } from './sendMail.js';

// Redis connection configuration
const redisConnection = new Redis({
    // host: process.env.REDIS_HOST || 'redis://red-d40vc7jipnbc73ftaumg',
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, 
});

// Create email queue
export const emailQueue = new Queue('email-queue', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: 10, 
        removeOnFail: 50, 
        attempts: 3, 
        backoff: {
            type: 'exponential',
            delay: 2000, 
        },
    },
});

// Email worker to process jobs
const emailWorker = new Worker('email-queue', async (job) => {
    const { receiver, otp, subject, template } = job.data;
    
    console.log(`Processing email job ${job.id} for ${receiver}`);
    
    try {
        // Call the original sendMail function
        const result = await sendMail(receiver, otp, subject, template);
        
        if (result.success) {
            console.log(`Email sent successfully to ${receiver}`);
            return result;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error(`Failed to send email to ${receiver}:`, error.message);
        throw error; // This will mark the job as failed
    }
}, {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 email jobs concurrently
});

// Event listeners for monitoring
emailWorker.on('completed', (job) => {
    console.log(`✅ Email job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job, err) => {
    console.error(`❌ Email job ${job.id} failed:`, err.message);
});

emailWorker.on('stalled', (jobId) => {
    console.warn(`⚠️ Email job ${jobId} stalled`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down email worker...');
    await emailWorker.close();
    await redisConnection.quit();
});

export default emailWorker;