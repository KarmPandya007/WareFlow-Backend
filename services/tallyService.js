import axios from "axios";
import fs from "fs";
import path from "path";

/**
 * Send XML to Tally running on local machine
 * Tally must be open and HTTP server enabled on port 9000
 */
export const sendXMLtoTally = async (xml) => {
  try {
    // Optional: save XML for debugging
    const exportDir = path.join(process.cwd(), "tally_exports");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }

    const filePath = path.join(
      exportDir,
      `tally_export_${Date.now()}.xml`
    );
    fs.writeFileSync(filePath, xml, "utf8");

    const response = await axios.post(
      "http://localhost:9000",
      xml,
      {
        headers: {
          "Content-Type": "application/xml",
        },
        timeout: 5000,
      }
    );

    return response.data;
  } catch (error) {
  console.error("🔴 Tally RAW ERROR");

  if (error.response) {
    console.error("STATUS:", error.response.status);
    console.error("HEADERS:", error.response.headers);
    console.error("DATA:", error.response.data);
  } else {
    console.error("MESSAGE:", error.message);
  }

  throw error;
}

};

/**
 * Generate Tally XML for Ledger creation
 */

export const createTallyLedgerXML = (ledger) => {
  return `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>

          <LEDGER ACTION="Create">
            <NAME>${ledger.name}</NAME>
            <PARENT>${ledger.ledgerGroup || "Sundry Debtors"}</PARENT>
            <ISBILLWISEON>Yes</ISBILLWISEON>

            <!-- 🔑 Enable mailing -->
            <ISMAILINGDETAILS>Yes</ISMAILINGDETAILS>

            <!-- 🔑 THIS IS WHAT TALLY PRIME READS -->
            <LEDMAILINGDETAILS.LIST TYPE="String">
              <MAILINGNAME>${ledger.name}</MAILINGNAME>
              <ADDRESS>${ledger.address}</ADDRESS>
              <STATENAME>${ledger.state}</STATENAME>
              <COUNTRYNAME>${ledger.country}</COUNTRYNAME>
              <PINCODE>${ledger.pincode}</PINCODE>
            </LEDMAILINGDETAILS.LIST>

            <!-- 🔑 GST flags -->
            <ISGSTAPPLICABLE>Yes</ISGSTAPPLICABLE>
            <GSTREGISTRATIONTYPE>${ledger.gstRegistrationType || "Unregistered"}</GSTREGISTRATIONTYPE>

            ${ledger.gstNo ? `<GSTIN>${ledger.gstNo}</GSTIN>` : ``}
            ${ledger.panCard ? `<INCOMETAXNUMBER>${ledger.panCard}</INCOMETAXNUMBER>` : ``}

          </LEDGER>

        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
};

