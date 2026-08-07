import { transporter } from "../config/emailConfig.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const paymentDetails = (payment) => {
  const details = [payment.mode];

  if (payment.bankType) details.push(payment.bankType);
  if (payment.utrNumber) details.push(`UTR: ${payment.utrNumber}`);
  if (payment.chequeNumber) details.push(`Cheque: ${payment.chequeNumber}`);
  if (payment.upiProvider) details.push(payment.upiProvider);
  if (payment.upiTransactionId) details.push(`Transaction: ${payment.upiTransactionId}`);
  if (payment.machineProvider) details.push(payment.machineProvider);
  if (payment.machineCardType) details.push(payment.machineCardType);
  if (payment.machineCardLast4Digits) details.push(`Card ending ${payment.machineCardLast4Digits}`);
  if (payment.machineTransactionId) details.push(`Transaction: ${payment.machineTransactionId}`);
  if (payment.loanId) details.push(`Loan ID: ${payment.loanId}`);
  if (payment.brandOrderType) details.push(payment.brandOrderType);

  return details.filter(Boolean).join(" — ");
};

export const sendInvoiceEmail = async (billing) => {
  if (!billing?.email) {
    return { sent: false, reason: "Customer email address was not provided" };
  }

  const products = Array.isArray(billing.products) ? billing.products : [];
  const payments = Array.isArray(billing.paymentMode) ? billing.paymentMode : [];
  const invoiceId = billing._id?.toString() || "N/A";
  const invoiceDateValue = new Date(billing.date || billing.createdAt);
  const createdAtValue = new Date(billing.createdAt || billing.date);
  const invoiceDate = invoiceDateValue.toLocaleDateString("en-IN", {
    dateStyle: "long",
    timeZone: "Asia/Kolkata",
  });
  const invoiceTime = createdAtValue.toLocaleTimeString("en-IN", {
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  const invoiceDateTime = `${invoiceDate} at ${invoiceTime}`;

  const productRows = products.length
    ? products.map((product, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(product.name || "N/A")}</td>
          <td>${escapeHtml(product.model || "N/A")}</td>
          <td>${escapeHtml(product.serialNumber || "N/A")}</td>
          <td style="text-align:right">${escapeHtml(formatCurrency(product.price))}</td>
        </tr>`).join("")
    : '<tr><td colspan="5">No products were added to this invoice.</td></tr>';

  const paymentRows = payments.length
    ? payments.map((payment) => `
        <tr>
          <td>${escapeHtml(paymentDetails(payment))}</td>
          <td style="text-align:right">${escapeHtml(formatCurrency(payment.amount))}</td>
        </tr>`).join("")
    : '<tr><td colspan="2">No payment mode was recorded.</td></tr>';

  const customFields = Array.isArray(billing.customFields) && billing.customFields.length
    ? billing.customFields.map((field) => `<p><strong>${escapeHtml(field.key)}:</strong> ${escapeHtml(field.value || "N/A")}</p>`).join("")
    : "";

  const textProducts = products.length
    ? products.map((product, index) => `${index + 1}. ${product.name || "N/A"} | Model: ${product.model || "N/A"} | Serial: ${product.serialNumber || "N/A"} | Price: ${formatCurrency(product.price)}`).join("\n")
    : "No products were added.";
  const textPayments = payments.length
    ? payments.map((payment) => `${paymentDetails(payment)}: ${formatCurrency(payment.amount)}`).join("\n")
    : "No payment mode was recorded.";

  const subject = `Invoice ${invoiceId} - ${billing.companyName || "WareFlow"}`;
  const html = `
    <!doctype html>
    <html>
      <body style="font-family:Arial,sans-serif;color:#222;line-height:1.5;max-width:760px;margin:auto">
        <h2>Invoice details</h2>
        <p>Dear ${escapeHtml(billing.customerName)},</p>
        <p>Thank you for your purchase. Your billing details are below.</p>
        <p><strong>Invoice ID:</strong> ${escapeHtml(invoiceId)}<br>
        <strong>Date:</strong> ${escapeHtml(invoiceDateTime)}<br>
        <strong>Company:</strong> ${escapeHtml(billing.companyName || "N/A")}<br>
        <strong>Branch:</strong> ${escapeHtml(billing.branch?.name || "N/A")}<br>
        <strong>Salesperson:</strong> ${escapeHtml(`${billing.salesPerson?.firstName || ""} ${billing.salesPerson?.lastName || ""}`.trim() || "N/A")}<br>
        <strong>Sales type:</strong> ${escapeHtml(billing.salesType || "Retail")}</p>

        <h3>Customer</h3>
        <p><strong>Name:</strong> ${escapeHtml(billing.customerName)}<br>
        <strong>Contact person:</strong> ${escapeHtml(billing.contactPerson || billing.customerName)}<br>
        <strong>Address:</strong> ${escapeHtml(billing.address || "N/A")}<br>
        <strong>PIN code:</strong> ${escapeHtml(billing.pinCode || "N/A")}<br>
        <strong>Mobile:</strong> ${escapeHtml(billing.mobile || "N/A")}<br>
        <strong>Phone:</strong> ${escapeHtml(billing.phone || "N/A")}<br>
        <strong>Email:</strong> ${escapeHtml(billing.email)}<br>
        <strong>GST number:</strong> ${escapeHtml(billing.gstNumber || "N/A")}</p>
        ${customFields}

        <h3>Products</h3>
        <table style="width:100%;border-collapse:collapse" border="1" cellpadding="8">
          <thead><tr><th>#</th><th>Product</th><th>Model</th><th>Serial number</th><th>Price</th></tr></thead>
          <tbody>${productRows}</tbody>
        </table>

        <h3>Payment</h3>
        <table style="width:100%;border-collapse:collapse" border="1" cellpadding="8">
          <thead><tr><th>Mode and details</th><th>Amount</th></tr></thead>
          <tbody>${paymentRows}</tbody>
          <tfoot><tr><th style="text-align:right">Total</th><th style="text-align:right">${escapeHtml(formatCurrency(billing.totalAmount))}</th></tr></tfoot>
        </table>
      </body>
    </html>`;

  const text = `Invoice details\n\nDear ${billing.customerName},\n\nInvoice ID: ${invoiceId}\nDate: ${invoiceDateTime}\nCompany: ${billing.companyName || "N/A"}\nBranch: ${billing.branch?.name || "N/A"}\nSalesperson: ${`${billing.salesPerson?.firstName || ""} ${billing.salesPerson?.lastName || ""}`.trim() || "N/A"}\n\nCustomer: ${billing.customerName}\nAddress: ${billing.address || "N/A"}\nMobile: ${billing.mobile || "N/A"}\nGST number: ${billing.gstNumber || "N/A"}\n\nProducts\n${textProducts}\n\nPayment\n${textPayments}\n\nTotal: ${formatCurrency(billing.totalAmount)}`;

  const info = await transporter.sendMail({
    from: `"${billing.companyName || "WareFlow Billing"}" <${process.env.EMAIL_USER}>`,
    to: billing.email,
    subject,
    html,
    text,
  });

  return { sent: true, messageId: info.messageId };
};
