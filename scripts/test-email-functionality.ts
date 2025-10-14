import { sendEmail } from '../lib/send-email';
import { getWelcomeEmailHtml } from '../lib/email-templates/welcome-admin-created';

async function testEmailFunctionality() {
  console.log('🧪 Testing email functionality...');
  
  // Test data
  const testData = {
    invitedBy: 'Test Admin',
    companyName: 'Test Company',
    userEmail: 'test@example.com', // Change this to your test email
    userPassword: 'testpassword123',
    loginUrl: 'https://your-domain.com/sign-in',
  };

  try {
    // Test email template generation
    console.log('📧 Generating email template...');
    const emailHtml = getWelcomeEmailHtml(testData);
    console.log('✅ Email template generated successfully');
    
    // Test email sending (only if SMTP is configured)
    console.log('📤 Attempting to send test email...');
    const result = await sendEmail({
      to: testData.userEmail,
      subject: `Welcome to ${testData.companyName} - Your Account is Ready!`,
      html: emailHtml,
    });

    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
    } else {
      console.log('❌ Email sending failed:', result.error);
      console.log('💡 Make sure SMTP environment variables are configured:');
      console.log('   - SMTP_HOST');
      console.log('   - SMTP_PORT');
      console.log('   - SMTP_USER');
      console.log('   - SMTP_PASSWORD');
      console.log('   - SMTP_FROM');
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testEmailFunctionality();
