import nodemailer from "nodemailer";
  
export const sendMail = async (receiver, otp, subject = "For Password Reset", template = "password-reset") => {
  try {
    console.log(`Sending email to: ${receiver}, Subject: ${subject}`);
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for 587/STARTTLS
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        // Prevent long hangs in cloud environments
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        // pool: true, // enable if you send lots of mails
    });

    // Different email templates
    const emailTemplates = {
        'password-reset': {
            subject: "Password Reset - Vingo (Food Delivery App)",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ff4d2d;">Password Reset Request</h2>
                    <p>Hello,</p>
                    <p>You have requested to reset your password. Please use the following OTP:</p>
                    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #ff4d2d; font-size: 32px; margin: 0;">${otp}</h1>
                    </div>
                    <p><strong>This OTP is valid for 5 minutes only.</strong></p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <hr style="margin: 30px 0;">
                    <p style="color: #666; font-size: 12px;">This is an automated email from Vingo</p>
                </div>
            `
        },
        'welcome': {
            subject: "Welcome to Food Delivery App",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ff4d2d;">Welcome to Food Delivery App!</h2>
                    <p>Hello,</p>
                    <p>Thank you for signing up with us. Your account has been created successfully.</p>
                    <p>Start exploring delicious food options in your area!</p>
                    <hr style="margin: 30px 0;">
                    <p style="color: #666; font-size: 12px;">This is an automated email from Food Delivery App</p>
                </div>
            `
        },
        'order-confirmation': {
            subject: "Order Confirmation - Food Delivery App",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ff4d2d;">Order Confirmed!</h2>
                    <p>Hello,</p>
                    <p>Your order has been confirmed and is being prepared.</p>
                    <p><strong>Order ID:</strong> ${otp}</p>
                    <p>We'll notify you once your order is ready for delivery.</p>
                    <hr style="margin: 30px 0;">
                    <p style="color: #666; font-size: 12px;">This is an automated email from Food Delivery App</p>
                </div>
            `
        },
        'order-status-update-preparing': {
            subject: "Order Status Update - Food Delivery App",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ff4d2d;">Order Status Update</h2>
                    <p>Hello,</p>
                    <p>Your order status has been updated to: <strong>Preparing</strong></p>
                    <p>Thank you for choosing Food Delivery App!</p>
                    <hr style="margin: 30px 0;">
                    <p style="color: #666; font-size: 12px;">This is an automated email from Food Delivery App</p>
                </div>
            `
        }
    };

    const emailTemplate = emailTemplates[template] || emailTemplates['password-reset'];
    
    const info = await transporter.sendMail({
        from: `"Food Delivery App" <${process.env.SMTP_USER}>`,
        to: receiver,
        subject: subject || emailTemplate.subject,
        html: emailTemplate.html,
    });
    
    console.log("Message sent: %s", info.messageId);
    return { success: true, message: "Email sent successfully", messageId: info.messageId };
  } catch (error) {
        console.error("Error sending email:", error?.response || error?.message || error);
        return { success: false, message: "Error sending email: " + (error?.response?.message || error?.message) };
  }
};