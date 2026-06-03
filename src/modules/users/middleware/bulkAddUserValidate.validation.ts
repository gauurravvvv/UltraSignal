/**
 * BulkAddUserValidateValidation — accepts the CSV upload for the validate
 * endpoint.
 *
 * Multer is configured for in-memory storage (the file is small — ≤5 MB and
 * ≤500 rows — and we parse it synchronously after the upload completes). We
 * also enforce a single-file upload (the dialog only ever sends one file).
 *
 * File-level errors (size, count, missing) are surfaced as 400s here so the
 * controller can assume the file is present and parseable.
 */
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { CODE } from '../../../../config/config';
import sendResponse from '../../../shared/utility/response';

const BULK_FILE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: BULK_FILE_SIZE_LIMIT_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Accept .csv by extension OR by MIME — browsers report different types
    // depending on OS (text/csv, application/vnd.ms-excel, etc.).
    const isCsvExt = /\.csv$/i.test(file.originalname);
    const isCsvMime = /csv|excel|text\/plain/i.test(file.mimetype);
    if (isCsvExt || isCsvMime) {
      cb(null, true);
    } else {
      cb(new Error('Only .csv files are accepted'));
    }
  },
}).single('file');

const BulkAddUserValidateValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload(req, res, err => {
    if (err) {
      const msg =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? `File too large. Max ${BULK_FILE_SIZE_LIMIT_BYTES / 1024 / 1024} MB`
          : err.message || 'File upload failed';
      return sendResponse(res, false, CODE.BAD_REQUEST, msg);
    }
    if (!req.file) {
      return sendResponse(res, false, CODE.BAD_REQUEST, 'CSV file is required');
    }
    next();
  });
};

export default BulkAddUserValidateValidation;
