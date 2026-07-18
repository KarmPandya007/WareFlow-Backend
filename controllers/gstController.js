import axios from "axios";

export const verifyGST = async (req, res) => {
  try {
    const { gstin } = req.params;

    if (!gstin || gstin.length !== 15) {
      return res.status(400).json({
        success: false,
        message: "Invalid GST number. Must be 15 characters."
      });
    }

    const response = await axios.get(
      `https://gst-return-status.p.rapidapi.com/free/gstin/${gstin}`,
      {
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY,
          'x-rapidapi-host': process.env.RAPIDAPI_HOST
        },
        timeout: 10000
      }
    );

    
    const gstData = response.data;

    
    res.json({
      success: true,
      data: {
        gstin: gstData.gstin || gstin,
        legalName: gstData.lgnm || gstData.tradeNam || "",
        tradeName: gstData.tradeNam || "",
        address: gstData.pradr?.adr || "",
        pincode: gstData.pradr?.pncd || "",
        state: gstData.pradr?.stcd || "",
        status: gstData.sts || "",
        registrationDate: gstData.rgdt || "",
        businessType: gstData.dty || "",
        raw: gstData 
      }
    });

  } catch (error) {
    console.error("GST Verification Error:", error.response?.data || error.message);

    if (error.response?.status === 403) {
      return res.status(403).json({
        success: false,
        message: "RapidAPI authentication failed. Please check API key or quota limits.",
        error: error.response?.data
      });
    }

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: "GST number not found in the records"
      });
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        success: false,
        message: "Request timeout. Please try again."
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to verify GST number",
      error: error.message
    });
  }
};
