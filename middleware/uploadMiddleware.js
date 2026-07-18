import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    return {
      folder: "billing_uploads",
      allowed_formats: ["jpg", "jpeg", "png", "pdf"],
      transformation: [{ quality: "auto", fetch_format: "auto" }],
      resource_type: file.mimetype.startsWith("image") ? "image" : "raw",
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

export default upload;
