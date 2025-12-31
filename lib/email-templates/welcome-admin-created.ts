interface WelcomeEmailProps {
  invitedBy: string;
  companyName: string;
  userEmail: string;
  userPassword: string;
  loginUrl: string;
}

export const getWelcomeEmailHtml = ({
  invitedBy,
  companyName,
  userEmail,
  userPassword,
  loginUrl,
}: WelcomeEmailProps): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Trades Business School</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #ffffff;
          color: #1e293b;
        }
        .container {
            max-width: 500px;
            margin: 0 auto;
            padding: 50px;
            background-color: #f1f5f9;
        }

        .logo {
          height: 60px;
          margin-bottom: 20px;
        }
        .header {
          margin-bottom: 30px;
        }
        .header h1 {
          color: #1e293b;
          font-size: 32px;
          margin: 0 0 10px 0;
          font-weight: 700;
        }
        .header p {
          color: #64748b;
          font-size: 16px;
          margin: 0;
        }
        .content {
          line-height: 1.6;
        }
        .content p {
          margin: 5px 0;
          color: #475569;
        }
        .credentials {
          padding: 20px 0;
        }
        .credentials p {
          margin: 8px 0;
          color: #1e293b;
        }
        .credentials strong {
          color: #1e293b;
          font-weight: 600;
        }
        .button-container {
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #1e293b;
          color: #ffffff;
          text-decoration: none;
          font-weight: 600;
        }
        .footer {
          margin-top: 40px;
          font-size: 14px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="https://app.tradebusinessschool.com/logo.png" alt="Trades Business School Logo" class="logo">
        
        <div class="header">
          <h1>Welcome to The Trades Business School</h1>
          <p>Your central hub for business growth and success</p>
        </div>
        
        <div class="content">
          <p>Hi <strong>${companyName}</strong>,</p>
          <p>Your account has been created and you're ready to get started.</p>
          
          <p>Here are your login credentials:</p>
          
          <div class="credentials">
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Password:</strong> ${userPassword}</p>
          </div>
          
          <p>You can now access your Command HQ by clicking the button below and signing in.</p>
          
          <div class="button-container">
            <a href="${loginUrl}" class="button">Sign in</a>
          </div>
          
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Trades Business School. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
