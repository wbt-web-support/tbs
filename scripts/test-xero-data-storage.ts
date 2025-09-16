/**
 * Test script for Xero data storage functionality
 * This script tests the Xero data storage and retrieval
 */

import { saveXeroData, getLatestXeroData, getXeroData } from '../lib/external-api-data';

async function testXeroDataStorage() {
  console.log('🧪 Testing Xero Data Storage...\n');

  try {
    // Test data
    const testUserId = 'test-user-id';
    const testTenantId = 'test-tenant-123';
    const testOrganizationName = 'Test Xero Company';
    const testDate = new Date().toISOString().split('T')[0];

    // Sample Xero data matching the interface
    const testXeroData = {
      organization: {
        OrganisationID: testTenantId,
        Name: testOrganizationName,
        LegalName: 'Test Xero Company Pty Ltd',
        ShortCode: 'TXC',
        CountryCode: 'AU',
        BaseCurrency: 'AUD',
        CreatedDateUTC: '2020-01-01T00:00:00Z',
        EndOfYearLockDate: '2024-12-31',
        TaxNumber: '12345678901',
        FinancialYearEndDay: 31,
        FinancialYearEndMonth: 12,
        SalesTaxBasis: 'ACCRUALS',
        SalesTaxPeriod: 'MONTHLY',
        DefaultSalesTax: 'GST',
        DefaultPurchasesTax: 'GST',
        PeriodLockDate: '2024-01-01',
        Timezone: 'Australia/Sydney',
        OrganisationEntityType: 'COMPANY',
        Class: 'STANDARD',
        Edition: 'AU',
        LineOfBusiness: 'Professional Services',
        Addresses: [],
        Phones: [],
        ExternalLinks: [],
        PaymentTerms: {}
      },
      
      invoices: [
        {
          InvoiceID: 'inv-001',
          InvoiceNumber: 'INV-2024-001',
          Type: 'ACCREC',
          Status: 'PAID',
          Date: '2024-01-15',
          DueDate: '2024-02-15',
          SubTotal: 1000,
          TotalTax: 100,
          Total: 1100,
          Contact: {
            ContactID: 'contact-001',
            Name: 'Test Customer 1'
          }
        },
        {
          InvoiceID: 'inv-002',
          InvoiceNumber: 'INV-2024-002',
          Type: 'ACCREC',
          Status: 'AUTHORISED',
          Date: '2024-01-20',
          DueDate: '2024-02-20',
          SubTotal: 2000,
          TotalTax: 200,
          Total: 2200,
          Contact: {
            ContactID: 'contact-002',
            Name: 'Test Customer 2'
          }
        }
      ],
      
      contacts: [
        {
          ContactID: 'contact-001',
          Name: 'Test Customer 1',
          EmailAddress: 'customer1@test.com',
          Addresses: [],
          Phones: [],
          ContactStatus: 'ACTIVE',
          IsSupplier: false,
          IsCustomer: true
        },
        {
          ContactID: 'contact-002',
          Name: 'Test Customer 2',
          EmailAddress: 'customer2@test.com',
          Addresses: [],
          Phones: [],
          ContactStatus: 'ACTIVE',
          IsSupplier: false,
          IsCustomer: true
        },
        {
          ContactID: 'supplier-001',
          Name: 'Test Supplier 1',
          EmailAddress: 'supplier1@test.com',
          Addresses: [],
          Phones: [],
          ContactStatus: 'ACTIVE',
          IsSupplier: true,
          IsCustomer: false
        }
      ],
      
      accounts: [
        {
          AccountID: 'acc-001',
          Code: '200',
          Name: 'Sales',
          Type: 'REVENUE',
          Class: 'REVENUE',
          Status: 'ACTIVE',
          CurrencyCode: 'AUD'
        },
        {
          AccountID: 'acc-002',
          Code: '090',
          Name: 'Bank Account',
          Type: 'BANK',
          Class: 'ASSET',
          Status: 'ACTIVE',
          BankAccountNumber: '1234567890',
          CurrencyCode: 'AUD'
        }
      ],
      
      bank_transactions: [
        {
          BankTransactionID: 'bt-001',
          BankAccount: {
            AccountID: 'acc-002',
            Name: 'Bank Account'
          },
          Type: 'RECEIVE',
          Status: 'AUTHORISED',
          Date: '2024-01-15',
          Reference: 'Payment from Customer 1',
          Total: 1100,
          Contact: {
            ContactID: 'contact-001',
            Name: 'Test Customer 1'
          }
        }
      ],
      
      kpis: {
        totalRevenue: 1100,
        accountsReceivable: 2200,
        averageInvoiceValue: 1650,
        invoiceCount: 2,
        customerCount: 2,
        cashFlow: 1100,
        overdueAmount: 0,
        daysSalesOutstanding: 15
      },
      
      rawApiResponse: {
        testData: true,
        timestamp: new Date().toISOString(),
        source: 'manual_test'
      }
    };

    console.log('1. Saving Xero data...');
    console.log('   - Organization:', testXeroData.organization.Name);
    console.log('   - Invoices:', testXeroData.invoices.length);
    console.log('   - Contacts:', testXeroData.contacts.length);
    console.log('   - Accounts:', testXeroData.accounts.length);
    console.log('   - Bank Transactions:', testXeroData.bank_transactions.length);
    console.log('   - Total Revenue:', testXeroData.kpis?.totalRevenue);

    const saveResult = await saveXeroData(
      testUserId,
      testTenantId,
      testOrganizationName,
      testXeroData,
      testDate
    );

    if (saveResult.success) {
      console.log('✅ Xero data saved successfully');
    } else {
      console.log('❌ Failed to save Xero data:', saveResult.error);
      return;
    }

    console.log('\n2. Retrieving latest data...');
    const latestResult = await getLatestXeroData(testUserId, testTenantId);
    
    if (latestResult.data) {
      console.log('✅ Latest Xero data retrieved successfully');
      console.log('   - Organization:', latestResult.data.account_name);
      console.log('   - Data Date:', latestResult.data.data_date);
      console.log('   - Status:', latestResult.data.status);
      
      if (latestResult.data.metrics) {
        console.log('\n📊 Stored Metrics:');
        console.log('   - Organization Name:', latestResult.data.metrics.organizationName);
        console.log('   - Invoice Count:', latestResult.data.metrics.invoiceCount);
        console.log('   - Contact Count:', latestResult.data.metrics.contactCount);
        console.log('   - Account Count:', latestResult.data.metrics.accountCount);
        console.log('   - Bank Transaction Count:', latestResult.data.metrics.bankTransactionCount);
        
        if (latestResult.data.metrics.summary) {
          console.log('\n📈 Summary:');
          console.log('   - Total Invoices:', latestResult.data.metrics.summary.totalInvoices);
          console.log('   - Total Customers:', latestResult.data.metrics.summary.totalCustomers);
          console.log('   - Total Suppliers:', latestResult.data.metrics.summary.totalSuppliers);
          console.log('   - Total Revenue:', latestResult.data.metrics.summary.totalRevenue);
          console.log('   - Accounts Receivable:', latestResult.data.metrics.summary.accountsReceivable);
          console.log('   - Net Cash Flow:', latestResult.data.metrics.summary.netCashFlow);
        }
      }
    } else {
      console.log('❌ Failed to retrieve latest Xero data:', latestResult.error);
    }

    console.log('\n3. Testing data retrieval by date range...');
    const rangeResult = await getXeroData(
      testUserId,
      testTenantId,
      testDate,
      testDate
    );

    if (rangeResult.data.length > 0) {
      console.log('✅ Xero data retrieved by date range successfully');
      console.log('   - Records found:', rangeResult.data.length);
    } else {
      console.log('❌ No Xero data found for date range:', rangeResult.error);
    }

    console.log('\n🎉 Xero data storage test completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testXeroDataStorage();
}

export { testXeroDataStorage };
