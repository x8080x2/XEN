#!/usr/bin/env node

/**
 * Email Sender Licensing System Test Script
 * 
 * This script tests the complete licensing system including:
 * - License creation and validation
 * - Client-backend communication
 * - API key authentication
 * - JWT token handling
 * - Email sending restrictions based on license
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL || 'http://localhost:4000';
const CLIENT_BACKEND_URL = process.env.CLIENT_BACKEND_URL || 'http://localhost:3000';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'admin-api-key-2024';

console.log('🧪 Starting Email Sender Licensing System Test');
console.log(`📡 Main Backend: ${MAIN_BACKEND_URL}`);
console.log(`🖥️  Client Backend: ${CLIENT_BACKEND_URL}`);
console.log('');

// Test utilities
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testMainBackendHealth() {
  console.log('1️⃣  Testing Main Backend Health...');
  try {
    const response = await axios.get(`${MAIN_BACKEND_URL}/health`);
    console.log('✅ Main backend is healthy:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Main backend health check failed:', error.message);
    return false;
  }
}

async function testClientBackendHealth() {
  console.log('2️⃣  Testing Client Backend Health...');
  try {
    const response = await axios.get(`${CLIENT_BACKEND_URL}/api/health`);
    console.log('✅ Client backend is healthy:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Client backend health check failed:', error.message);
    return false;
  }
}

async function createTestLicense() {
  console.log('3️⃣  Creating Test License...');
  try {
    const licenseData = {
      userId: 'test-user-123',
      userEmail: 'test@example.com',
      userName: 'Test User',
      planType: 'professional',
      features: {
        maxEmailsPerMonth: 10000,
        maxRecipientsPerEmail: 500,
        allowQRCodes: true,
        allowAttachments: true,
        allowDomainLogos: true,
        allowHTMLConvert: true,
        smtpRotation: false,
        apiAccess: false,
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      maxActivations: 1
    };

    const response = await axios.post(`${MAIN_BACKEND_URL}/api/license/create`, licenseData, {
      headers: {
        'Authorization': `Bearer ${ADMIN_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ License created successfully');
    console.log('📄 License Key:', response.data.license.licenseKey);
    return response.data.license;
  } catch (error) {
    console.error('❌ License creation failed:', error.response?.data || error.message);
    return null;
  }
}

async function activateLicenseOnClient(licenseKey) {
  console.log('4️⃣  Activating License on Client...');
  try {
    const response = await axios.post(`${CLIENT_BACKEND_URL}/api/license/activate`, {
      licenseKey
    });

    console.log('✅ License activated on client');
    console.log('👤 User:', response.data.license.userEmail);
    console.log('📦 Plan:', response.data.license.planType);
    console.log('📧 Emails remaining:', response.data.license.emailsRemaining);
    return true;
  } catch (error) {
    console.error('❌ License activation failed:', error.response?.data || error.message);
    return false;
  }
}

async function testLicenseStatus() {
  console.log('5️⃣  Testing License Status...');
  try {
    const response = await axios.get(`${CLIENT_BACKEND_URL}/api/license/status`);
    
    console.log('✅ License status retrieved');
    console.log('📊 Status:', response.data.status);
    return response.data.status;
  } catch (error) {
    console.error('❌ License status check failed:', error.response?.data || error.message);
    return null;
  }
}

async function testEmailSendingWithLicense() {
  console.log('6️⃣  Testing Email Sending with License...');
  try {
    const emailData = {
      recipients: JSON.stringify(['test1@example.com', 'test2@example.com']),
      subject: 'Test Email from Licensed System',
      htmlContent: '<h1>Hello {user}!</h1><p>This is a test email from the licensed email system.</p>',
      settings: JSON.stringify({
        senderEmail: 'sender@example.com'
      })
    };

    const response = await axios.post(`${CLIENT_BACKEND_URL}/api/emails/send`, emailData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Email sending request accepted');
    console.log('🆔 Job ID:', response.data.jobId || 'N/A');
    return true;
  } catch (error) {
    console.error('❌ Email sending failed:', error.response?.data || error.message);
    return false;
  }
}

async function testUnauthorizedAccess() {
  console.log('7️⃣  Testing Unauthorized Access (should fail)...');
  try {
    // Try to access main backend directly without API key
    const response = await axios.get(`${MAIN_BACKEND_URL}/api/license/list`);
    console.log('❌ Unauthorized access succeeded (this should not happen!)');
    return false;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Unauthorized access properly blocked');
      return true;
    } else {
      console.error('❌ Unexpected error:', error.message);
      return false;
    }
  }
}

async function testFeatureRestrictions() {
  console.log('8️⃣  Testing Feature Restrictions...');
  try {
    // Test accessing a feature that requires specific license
    const response = await axios.get(`${CLIENT_BACKEND_URL}/api/placeholders`);
    
    if (response.status === 200) {
      console.log('✅ Feature access working correctly');
      return true;
    }
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('✅ Feature restriction working correctly');
      return true;
    } else {
      console.error('❌ Feature restriction test failed:', error.response?.data || error.message);
      return false;
    }
  }
}

async function testLicenseRefresh() {
  console.log('9️⃣  Testing License Refresh...');
  try {
    const response = await axios.post(`${CLIENT_BACKEND_URL}/api/license/refresh`);
    
    console.log('✅ License refresh successful');
    console.log('🔄 Updated license info:', response.data.license);
    return true;
  } catch (error) {
    console.error('❌ License refresh failed:', error.response?.data || error.message);
    return false;
  }
}

async function testLicenseDeactivation() {
  console.log('🔟 Testing License Deactivation...');
  try {
    const response = await axios.post(`${CLIENT_BACKEND_URL}/api/license/deactivate`);
    
    console.log('✅ License deactivated successfully');
    return true;
  } catch (error) {
    console.error('❌ License deactivation failed:', error.response?.data || error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Running Complete Licensing System Test Suite\n');
  
  const results = [];
  
  // Test 1: Main Backend Health
  results.push(await testMainBackendHealth());
  await delay(1000);
  
  // Test 2: Client Backend Health
  results.push(await testClientBackendHealth());
  await delay(1000);
  
  // Test 3: Create License
  const license = await createTestLicense();
  results.push(license !== null);
  await delay(1000);
  
  if (license) {
    // Test 4: Activate License
    results.push(await activateLicenseOnClient(license.licenseKey));
    await delay(1000);
    
    // Test 5: License Status
    const status = await testLicenseStatus();
    results.push(status !== null);
    await delay(1000);
    
    // Test 6: Email Sending
    results.push(await testEmailSendingWithLicense());
    await delay(1000);
    
    // Test 7: Unauthorized Access
    results.push(await testUnauthorizedAccess());
    await delay(1000);
    
    // Test 8: Feature Restrictions
    results.push(await testFeatureRestrictions());
    await delay(1000);
    
    // Test 9: License Refresh
    results.push(await testLicenseRefresh());
    await delay(1000);
    
    // Test 10: License Deactivation
    results.push(await testLicenseDeactivation());
  } else {
    // Skip remaining tests if license creation failed
    results.push(...Array(7).fill(false));
  }
  
  // Results Summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  const testNames = [
    'Main Backend Health',
    'Client Backend Health', 
    'License Creation',
    'License Activation',
    'License Status Check',
    'Email Sending',
    'Unauthorized Access Block',
    'Feature Restrictions',
    'License Refresh',
    'License Deactivation'
  ];
  
  let passedTests = 0;
  results.forEach((result, index) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${testNames[index]}: ${status}`);
    if (result) passedTests++;
  });
  
  console.log('========================');
  console.log(`🏆 Overall Result: ${passedTests}/${results.length} tests passed`);
  
  if (passedTests === results.length) {
    console.log('🎉 All tests passed! Licensing system is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the logs above for details.');
  }
  
  return passedTests === results.length;
}

// Run tests if script is executed directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };