const express = require('express');
const uuid = require('uuid');
const multer = require('multer');
const path = require('path');
const adminRouter = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const adminController = require('../../controllers/adminController');

adminRouter.post('/login', adminController.login);
adminRouter.get('/venue', authMiddleware.checkAdmin, adminController.getVenue);
adminRouter.get('/venue/not_verified', authMiddleware.checkAdmin, adminController.getVenueNotVerified);
adminRouter.get('/venue/:id', authMiddleware.checkAdmin, adminController.getDetailVenue);
adminRouter.post('/venue/:id/verification', authMiddleware.checkAdmin, adminController.venueVerification);
adminRouter.get('/user', authMiddleware.checkAdmin, adminController.getUser);
adminRouter.post('/logout', adminController.logout);

module.exports = adminRouter;