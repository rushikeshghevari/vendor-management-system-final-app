require('dotenv').config({ quiet: true });

const BASE = 'http://localhost:5000/api/v1';
let pass = 0, fail = 0;

function check(label, cond, extra) {
  if (cond) { pass++; console.log('PASS', label); }
  else { fail++; console.log('FAIL', label, extra ?? ''); }
}

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`login failed for ${email}: ${JSON.stringify(json)}`);
  return json.data.accessToken;
}

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  const deptToken = await login('rghevari2000@gmail.com', 'TempPass123!');
  const dir1Token = await login('director.test@genericart.com', 'TempPass123!');
  const dir2Token = await login('director.b.test@genericart.com', 'TempPass123!');
  const ceoToken = await login('ceo@gmail.com', 'TempPass123!');
  const accountsToken = await login('accounts@gmail.com', 'accounts123');

  // Need a vendor + department for the Department User.
  const me = await api('GET', '/auth/me', deptToken);
  const departmentId = me.json.data.department?._id ?? me.json.data.department;

  const vendorRes = await api('POST', '/vendors', deptToken, {
    name: 'Unanimity Test Vendor',
    code: `UTV-${Date.now()}`,
    category: 'goods',
    contactPerson: 'Test Contact',
    phone: '9876543210',
    email: `vendor.${Date.now()}@test.com`,
    address: '123 Test Street',
    state: 'Maharashtra',
    district: 'Pune',
    city: 'Pune',
    pincode: '411001',
    bankDetails: {
      bankName: 'Test Bank',
      accountHolderName: 'Test Contact',
      accountNumber: '1234567890',
      ifscCode: 'TEST0001234',
    },
  });
  if (vendorRes.status !== 201) throw new Error('vendor create failed: ' + JSON.stringify(vendorRes.json));
  const vendorId = vendorRes.json.data._id;

  // ===== SCENARIO A: Quotation, Director route (amount above CEO limit) =====
  const settingRes = await api('GET', '/settings', deptToken);
  const ceoLimit = settingRes.json.data.ceoApprovalLimit ?? 50000;
  console.log('CEO Approval Limit:', ceoLimit);

  const highAmount = Number(ceoLimit) + 100000;

  const quotationRes = await api('POST', '/quotations', deptToken, {
    vendor: vendorId,
    quotationDate: new Date().toISOString(),
    requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    amount: highAmount,
    gst: 18,
    paymentTerms: 'Net 30',
    deliveryTerms: 'FOB',
    priority: 'medium',
    description: 'Unanimity test quotation',
  });
  if (quotationRes.status !== 201) throw new Error('quotation create failed: ' + JSON.stringify(quotationRes.json));
  const quotationId = quotationRes.json.data._id;

  const submitRes = await api('PATCH', `/quotations/${quotationId}/submit`, deptToken);
  check('Quotation submit succeeds', submitRes.status === 200, JSON.stringify(submitRes.json));
  check('Quotation status = submitted after submit', submitRes.json.data.status === 'submitted', submitRes.json.data.status);

  // Director 1 approves.
  const dir1Decide = await api('PATCH', `/quotations/${quotationId}/decision`, dir1Token, { decision: 'approved' });
  check('Director 1 decision call succeeds', dir1Decide.status === 200, JSON.stringify(dir1Decide.json));
  check(
    'After Director 1 approves alone, status REMAINS submitted (not approved)',
    dir1Decide.json.data.status === 'submitted',
    'actual status: ' + dir1Decide.json.data.status,
  );

  // Confirm via a fresh GET as well (not just the decision response).
  const afterDir1Get = await api('GET', `/quotations/${quotationId}`, dir1Token);
  check(
    'GET after Director 1 approval shows status=submitted',
    afterDir1Get.json.data.status === 'submitted',
    afterDir1Get.json.data.status,
  );

  // Director 2 approves -> now should flip to approved.
  const dir2Decide = await api('PATCH', `/quotations/${quotationId}/decision`, dir2Token, { decision: 'approved' });
  check('Director 2 decision call succeeds', dir2Decide.status === 200, JSON.stringify(dir2Decide.json));
  check(
    'After Director 2 approves, status becomes approved',
    dir2Decide.json.data.status === 'approved',
    dir2Decide.json.data.status,
  );

  // ===== SCENARIO B: Bill, Director route, same unanimity check, plus Accounts visibility =====
  const billRes = await api('POST', '/bills', deptToken, {
    quotation: quotationId,
    invoiceAmount: highAmount,
    invoiceNumber: `INV-${Date.now()}`,
    invoiceDate: new Date().toISOString(),
    taxableAmount: highAmount,
    gstAmount: 0,
    paymentTerms: 'Net 30',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (billRes.status !== 201) throw new Error('bill create failed: ' + JSON.stringify(billRes.json));
  const billId = billRes.json.data._id;

  // Upload a tiny invoice PDF (required before submit).
  const pdfBytes = Buffer.from('%PDF-1.4 test');
  const form = new FormData();
  form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'invoice.pdf');
  const uploadRes = await fetch(`${BASE}/bills/${billId}/invoice`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${deptToken}` },
    body: form,
  });
  check('Invoice upload succeeds', uploadRes.status === 200 || uploadRes.status === 201, await uploadRes.text());

  const billSubmitRes = await api('PATCH', `/bills/${billId}/submit`, deptToken);
  check('Bill submit succeeds', billSubmitRes.status === 200, JSON.stringify(billSubmitRes.json));
  check('Bill status = submitted after submit', billSubmitRes.json.data.status === 'submitted', billSubmitRes.json.data.status);

  // Accounts should NOT see this bill yet (still submitted, pre-approval).
  const accountsListBefore = await api('GET', '/bills?limit=100', accountsToken);
  const visibleBefore = accountsListBefore.json.data.items.some((b) => b._id === billId);
  check('Accounts cannot see Bill while status=submitted', !visibleBefore);

  // Director 1 approves the bill.
  const billDir1 = await api('PATCH', `/bills/${billId}/approval-decision`, dir1Token, { decision: 'approved' });
  check('Bill Director 1 decision succeeds', billDir1.status === 200, JSON.stringify(billDir1.json));
  check(
    'After Bill Director 1 approves alone, status REMAINS submitted',
    billDir1.json.data.status === 'submitted',
    'actual: ' + billDir1.json.data.status,
  );

  // Accounts should STILL not see it after only one Director approved.
  const accountsListMid = await api('GET', '/bills?limit=100', accountsToken);
  const visibleMid = accountsListMid.json.data.items.some((b) => b._id === billId);
  check('Accounts STILL cannot see Bill after only Director 1 approved', !visibleMid);

  // Director 2 approves -> now fully approved, visible to Accounts.
  const billDir2 = await api('PATCH', `/bills/${billId}/approval-decision`, dir2Token, { decision: 'approved' });
  check('Bill Director 2 decision succeeds', billDir2.status === 200, JSON.stringify(billDir2.json));
  check(
    'After Bill Director 2 approves, status becomes approved',
    billDir2.json.data.status === 'approved',
    billDir2.json.data.status,
  );

  const accountsListAfter = await api('GET', '/bills?limit=100', accountsToken);
  const visibleAfter = accountsListAfter.json.data.items.some((b) => b._id === billId);
  check('Accounts CAN see Bill once status=approved (fully approved)', visibleAfter);

  // ===== SCENARIO C: CEO route still completes on a single decision (sanity check, single-approver route) =====
  const lowAmount = Math.max(1000, Number(ceoLimit) - 1000);
  const ceoQuotationRes = await api('POST', '/quotations', deptToken, {
    vendor: vendorId,
    quotationDate: new Date().toISOString(),
    requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    amount: lowAmount,
    gst: 18,
    paymentTerms: 'Net 30',
    deliveryTerms: 'FOB',
    priority: 'low',
    description: 'CEO route sanity check',
  });
  const ceoQuotationId = ceoQuotationRes.json.data._id;
  await api('PATCH', `/quotations/${ceoQuotationId}/submit`, deptToken);
  const ceoDecide = await api('PATCH', `/quotations/${ceoQuotationId}/decision`, ceoToken, { decision: 'approved' });
  check(
    'CEO route: single CEO approval immediately flips status to approved',
    ceoDecide.json.data.status === 'approved',
    ceoDecide.json.data.status,
  );

  // ===== SCENARIO D: Negotiation is still a blocking decision (single Director can send back immediately) =====
  const negQuotationRes = await api('POST', '/quotations', deptToken, {
    vendor: vendorId,
    quotationDate: new Date().toISOString(),
    requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    amount: highAmount,
    gst: 18,
    paymentTerms: 'Net 30',
    deliveryTerms: 'FOB',
    priority: 'medium',
    description: 'Negotiation blocking check',
  });
  const negQuotationId = negQuotationRes.json.data._id;
  await api('PATCH', `/quotations/${negQuotationId}/submit`, deptToken);
  const negDecide = await api('PATCH', `/quotations/${negQuotationId}/decision`, dir1Token, {
    decision: 'negotiation',
    remarks: 'Please revise the amount',
  });
  check(
    'Director route: a single Director sending to Negotiation takes effect immediately',
    negDecide.json.data.status === 'negotiation',
    negDecide.json.data.status,
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('SCRIPT ERROR', err);
  process.exit(1);
});
