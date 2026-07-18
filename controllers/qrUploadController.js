import QRUpload from "../models/QRUpload.js";


export const uploadViaQR = async (req, res) => {

  try {
    const { sessionId } = req.params;
    const { fieldType } = req.body;

    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        message: "Session ID is required" 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "No file uploaded" 
      });
    }

    // Get file URL from Cloudinary or local storage
    const fileUrl = req.file.secure_url || req.file.url || req.file.path;

    // Create QR upload record
    const qrUpload = await QRUpload.create({
      sessionId,
      filename: req.file.originalname,
      fileUrl,
      fieldType: fieldType || "General Attachment",
      size: req.file.size,
      mimetype: req.file.mimetype,
    });

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      upload: qrUpload,
    });
  } catch (error) {
    console.error("QR upload error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Controller to get all uploads for a session
export const getSessionUploads = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        message: "Session ID is required" 
      });
    }

    const uploads = await QRUpload.find({ sessionId }).sort({ uploadedAt: -1 });

    res.status(200).json({
      success: true,
      count: uploads.length,
      uploads,
    });
  } catch (error) {
    console.error("Get session uploads error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Controller to delete a QR upload
export const deleteQRUpload = async (req, res) => {
  try {
    const { uploadId } = req.params;

    const upload = await QRUpload.findById(uploadId);
    if (!upload) {
      return res.status(404).json({ 
        success: false, 
        message: "Upload not found" 
      });
    }

    await upload.deleteOne();

    res.status(200).json({
      success: true,
      message: "Upload deleted successfully",
    });
  } catch (error) {
    console.error("Delete QR upload error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
