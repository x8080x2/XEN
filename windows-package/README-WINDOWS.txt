================================================================
                    EMAIL SENDER - QUICK START GUIDE
================================================================

Thank you for purchasing Email Sender! This guide will help you get started on Windows.

WHAT'S INCLUDED:
- Install-Email-Sender.cmd - First-time installation
- Start-Email-Sender.cmd - Start the application  
- Stop-Email-Sender.cmd - Stop the application
- Update-Email-Sender.cmd - Update to new versions
- config/setup.ini - Configuration file
- files/ - Templates and resources folder

QUICK START (3 STEPS):
================================================================

STEP 1: INSTALL
Double-click \"Install-Email-Sender.cmd\"
- This will install Node.js if needed
- Download and build the application  
- Takes 2-5 minutes depending on your internet speed

STEP 2: CONFIGURE YOUR LICENSE
Open \"config/setup.ini\" in any text editor and add:
- Your LICENSE_KEY (provided with your purchase)
- Your email settings (SENDER_EMAIL, SENDER_NAME)
- Backend URL (MAIN_BACKEND_URL) is pre-configured

STEP 3: START THE APPLICATION
Double-click \"Start-Email-Sender.cmd\"
- The application will start automatically
- Your web browser will open to http://localhost:5000
- You can now use the Email Sender interface!

================================================================

TROUBLESHOOTING:
================================================================

PROBLEM: \"Node.js not found\" error
SOLUTION: Install Node.js from https://nodejs.org (LTS version)

PROBLEM: \"Port 5000 is already in use\"
SOLUTION: 
1. Run Stop-Email-Sender.cmd first
2. Or edit Start-Email-Sender.cmd and change PORT=5000 to PORT=5001

PROBLEM: License validation fails
SOLUTION:
1. Check your LICENSE_KEY in config/setup.ini
2. Ensure you have internet connection
3. Check that your system date/time is correct

PROBLEM: Windows Firewall blocks the application
SOLUTION: Click \"Allow\" when Windows asks about firewall permissions

PROBLEM: Application won't start
SOLUTION:
1. Check the server window for error messages
2. Try running Update-Email-Sender.cmd
3. Restart Windows and try again

================================================================

USAGE TIPS:
================================================================

- Keep the server window open while using the application
- The application runs in your web browser at http://localhost:5000
- Your email templates go in the \"files\" folder
- Your leads/contacts go in \"files/leads.txt\" 
- Close the server window or run Stop-Email-Sender.cmd to stop

UPDATES:
- Run Update-Email-Sender.cmd to get the latest features
- Your configuration and files will be preserved

SUPPORT:
For technical support, contact us with your license key and
a description of the issue.

================================================================
                    Happy Email Marketing!
================================================================