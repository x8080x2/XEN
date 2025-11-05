const nodemailer = require('nodemailer');

async function testSMTP() {
  console.log('🔍 Testing Office 365 SMTP on Port 25 (No Authentication)...\n');
  
  const config = {
    host: 'frogmoreplantation-com.mail.protection.outlook.com',
    port: 25,
    secure: false,
    tls: {
      rejectUnauthorized: false
    }
    // No auth property - testing as relay server
  };

  console.log('📋 Configuration:');
  console.log('   Host:', config.host);
  console.log('   Port:', config.port);
  console.log('   Authentication: None (relay mode)');
  console.log('   From Email: lynettetanner@frogmoreplantation.com\n');

  try {
    const transporter = nodemailer.createTransport(config);
    
    console.log('📡 Step 1: Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!\n');

    console.log('📧 Step 2: Sending test email...');
    const info = await transporter.sendMail({
      from: 'lynettetanner@frogmoreplantation.com',
      to: 'test@example.com',
      subject: 'Port 25 SMTP Test - No Authentication',
      text: 'This is a test email sent via Office 365 on port 25 without authentication (relay mode).',
      html: '<p>This is a test email sent via <strong>Office 365</strong> on port 25 without authentication (relay mode).</p>'
    });

    console.log('✅ Email sent successfully!\n');
    console.log('📊 Results:');
    console.log('   Message ID:', info.messageId);
    console.log('   Response:', info.response);
    console.log('   Accepted:', info.accepted);
    console.log('   Rejected:', info.rejected);
    
  } catch (error) {
    console.error('\n❌ SMTP Test Failed!\n');
    console.error('Error Message:', error.message);
    if (error.code) console.error('Error Code:', error.code);
    if (error.command) console.error('Failed Command:', error.command);
    if (error.responseCode) console.error('Response Code:', error.responseCode);
    
    console.error('\n💡 Troubleshooting:');
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('   - Connection timeout/refused: The server may be blocking connections');
      console.error('   - Port 25 might be blocked by firewall or ISP');
      console.error('   - Server may require authentication even on port 25');
    } else if (error.responseCode === 550) {
      console.error('   - Server rejected the email (relay access denied)');
      console.error('   - This domain may not allow unauthenticated relay');
    }
  }
}

testSMTP().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
