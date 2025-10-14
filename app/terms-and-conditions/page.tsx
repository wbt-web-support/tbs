import React from 'react';

export default function TermsAndConditionsPage() {
  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      <img src="/logo.png" alt="Trade Business School Logo" className=" mb-8 h-16 w-auto " /> 
      <h1 className="text-3xl font-bold mb-6 border-t-2 pt-5">Terms & Conditions</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
        <p className="text-gray-700">
          Welcome to Trades Business School ("we," "our," or "us"). These Terms and Conditions ("Terms") govern your use of our website <a href="https://app.tradebusinessschool.com/" className="text-blue-600 hover:underline">(https://app.tradebusinessschool.com/)</a> and our services. By accessing or using the application, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the application.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">2. Use of the Service</h2>
        <h3 className="text-xl font-semibold mb-2">2.1. User Responsibilities</h3>
        <ul className="list-disc list-inside text-gray-700 mt-2">
          <li><strong>Accurate Information:</strong> Users must provide truthful and up-to-date information during registration and use of the platform.</li>
          <li><strong>Prohibited Conduct:</strong> Users agree to use the AI Assistant only for lawful business purposes and in ways that do not infringe on others’ rights. Activities such as unauthorized data scraping, reverse engineering, or any actions that could harm the platform's integrity are strictly prohibited.</li>
        </ul>
        <h3 className="text-xl font-semibold mb-2 mt-4">2.2. General Use of the Service</h3>
        <p className="text-gray-700">
          The AI Assistant may provide guidance, but decisions based on its suggestions remain the responsibility of the user or their organization.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">3. AI Assistant Specific Terms</h2>
        <h3 className="text-xl font-semibold mb-2">3.1. Purpose of the AI Assistant</h3>
        <p className="text-gray-700">
          The AI Assistant within Command HQ is designed to help users improve their business operations through automated insights, data retrieval, and strategic recommendations. It serves as a digital business assistant for Trade Business School clients.
        </p>

        <h3 className="text-xl font-semibold mb-2 mt-4">3.2. Data Ownership</h3>
        <p className="text-gray-700">
          All data, including chats, uploads, and company information provided through the AI Assistant, remains the property of the client company. Trade Business School does not claim ownership over user-generated content.
        </p>

        <h3 className="text-xl font-semibold mb-2 mt-4">3.3. Data Segregation</h3>
        <p className="text-gray-700">
          Each client’s data is stored and processed in a secure, isolated environment. Information shared within a company’s AI Assistant is not accessible to other clients and cannot be used for any purpose that may identify another organization.
        </p>

        <h3 className="text-xl font-semibold mb-2 mt-4">3.4. Aggregated and Anonymized Data</h3>
        <p className="text-gray-700">
          Trade Business School may analyze aggregated and anonymized data across all clients for research, performance improvement, and feature development. No personally identifiable or company-specific information will ever be disclosed or shared externally.
        </p>

        <h3 className="text-xl font-semibold mb-2 mt-4">3.5. Accuracy and Liability</h3>
        <p className="text-gray-700">
          While the AI Assistant uses advanced models and company data to provide relevant information, outputs are generated automatically and may not always be accurate or complete. Users are responsible for verifying critical information before acting upon it.
        </p>
        <p className="text-gray-700 mt-2">
          Trade Business School is not liable for any loss, error, or decision made based on AI responses.
        </p>

        <h3 className="text-xl font-semibold mb-2 mt-4">3.6. Account Access and Security</h3>
        <p className="text-gray-700">
          Users must maintain the confidentiality of their Command HQ login credentials. Any activity performed using an authenticated session will be considered as authorized by the account holder.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">4. Intellectual Property Rights</h2>
        <p className="text-gray-700">
          The application and its original content (excluding content provided by users), features, and functionality are and will remain the exclusive property of Trades Business School and its licensors. The application is protected by copyright, trademark, and other laws of both the United States and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Trades Business School. Users grant Trades Business School a worldwide, non-exclusive, royalty-free license to use, reproduce, adapt, publish, translate and distribute any content they submit for the purpose of operating and improving the service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">5. Links to Other Web Sites</h2>
        <p className="text-gray-700">
          Our application may contain links to third-party web sites or services that are not owned or controlled by Trades Business School.
        </p>
        <p className="text-gray-700 mt-2">
          Trades Business School has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third-party web sites or services. You further acknowledge and agree that Trades Business School shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with use of or reliance on any such content, goods or services available on or through any such web sites or services.
        </p>
        <p className="text-gray-700 mt-2">
          We strongly advise you to read the terms and conditions and privacy policies of any third-party web sites or services that you visit.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">6. Termination</h2>
        <p className="text-gray-700">
          We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms. Upon termination, your right to use the application will immediately cease.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
        <p className="text-gray-700">
          In no event shall Trades Business School, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the application; (ii) any conduct or content of any third party on the application; (iii) any content obtained from the application; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage, and even if a remedy set forth herein is found to have failed of its essential purpose.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">8. Governing Law and Dispute Resolution</h2>
        <p className="text-gray-700">
          These Terms shall be governed and construed in accordance with the laws of United Kingdom, without regard to its conflict of law provisions.
        </p>
        <p className="text-gray-700 mt-2">
          Any dispute arising out of or in connection with these Terms shall be resolved through arbitration in London, United Kingdom.
        </p>
        <p className="text-gray-700 mt-2">
          Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect. These Terms constitute the entire agreement between us regarding our application, and supersede and replace any prior agreements we might have between us regarding the application.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">9. Updates and Modifications</h2>
        <p className="text-gray-700">
          Trades Business School reserves the right to update or modify the AI Assistant, Terms & Conditions, or Privacy Policy to reflect system enhancements, new regulations, or business improvements. Users will be notified in advance of major changes.
        </p>
      </section>

    </div>
  );
}
