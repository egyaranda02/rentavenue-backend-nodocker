require("dotenv").config({ path: "./.env" });
const db = require("../models/index.js");
const uuid = require("uuid");
const fs = require('fs');
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;
const { use } = require("../routes/index.js");
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { sequelize } = require("../models/index.js");
const smtpTransportModule = require("nodemailer-smtp-transport");
const { triggerAsyncId } = require("async_hooks");
const { count } = require("console");
const { cloudinary } = require("../config/cloudinary.js");

const tokenAge = 60 * 60;
const oauth2Client = new OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
);

const checkVendor = (id, token) => {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const VendorId = decoded.VendorId;
    if (id != VendorId) {
        return true
    }
}

module.exports.getWallet = async function (req, res) {
    try {
        const token = req.cookies.jwt;
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (decoded.VendorId != req.params.id) {
            return res.status(401).json({
                success: false,
                message: "You don't have authorization"
            })
        }
        const wallet = await db.Wallet.findOne({
            where: {
                VendorId: req.params.id
            },
            attributes: ['VendorId', 'balance']
        })
        if (!wallet) {
            const wallet = await db.Wallet.create({
                VendorId: req.params.id
            })
            return res.status(200).json({
                success: true,
                data: wallet
            });
        }
        return res.status(200).json({
            success: true,
            data: wallet
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}

module.exports.getVendorDetails = async function (req, res) {
    try {
        const vendor = await db.Vendor.findByPk(req.params.id, {
            attributes: [
                'id',
                'email',
                'vendor_name',
                'address',
                'description',
                'phone_number',
                'profile_picture',
                'url'
            ]
        })
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found",
            });
        }
        return res.status(200).json({
            success: true,
            data: vendor,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}


module.exports.register = async function (req, res) {
    const {
        email,
        password,
        confirm_password,
        vendor_name,
        address,
        phone_number,
        description
    } = req.body;
    try {
        if (password !== confirm_password) {
            return res.status(200).json({
                success: false,
                message: "Password and confirm password is not the same"
            });
        }
        const findEmailUser = await db.User.findOne({ where: { email: email } });
        const findEmailVendor = await db.Vendor.findOne({ where: { email: email } });
        if (findEmailUser || findEmailVendor) {
            return res.status(200).json({
                success: false,
                message: "Email has been used"
            });
        }
        const vendor = await db.Vendor.create({
            email,
            password,
            vendor_name,
            address,
            phone_number,
            description
        });
        oauth2Client.setCredentials({
            refresh_token: process.env.REFRESH_TOKEN
        });
        const accessToken = oauth2Client.getAccessToken()
        const smtpTransport = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: process.env.EMAIL,
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                refreshToken: process.env.REFRESH_TOKEN,
                accessToken: accessToken
            }
        });
        const token = uuid.v4();
        const host = req.get("host");
        const link = "http://" + host + "/api/vendor/verify?token=" + token;
        mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: "Please confirm your Email account",
            html:
                "Hello,<br> Please Click on the link to verify your email.<br><a href=" +
                link +
                ">Click here to verify</a>",
        };
        smtpTransport.sendMail(mailOptions, (error, response) => {
            error ? console.log(error) : console.log(response);
            smtpTransport.close();
        });
        await db.Activation.create({
            id_vendor: vendor.id,
            token: token,
        });
        return res.status(201).json({
            success: true,
            message: "Register Success!",
            data: vendor
        });
    } catch (error) {
        console.log(error);
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.verification = async function (req, res) {
    const token = req.query.token;
    try {
        const findActivation = await db.Activation.findOne({ where: { token: token } });
        if (findActivation) {
            const vendor = await db.Vendor.findByPk(findActivation.id_vendor);
            await vendor.update({ is_verified: true });
            await db.Activation.destroy({ where: { id: findActivation.id } });
            const VendorId = findActivation.id_vendor;
            const UserId = null;
            await db.Wallet.create({
                VendorId,
                UserId
            })
            res.redirect('https://rentvenue-pi.vercel.app/vendor/login');
        }
        return res.status(200).json({
            success: false,
            message: "Token not found",
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}

module.exports.login = async function (req, res) {
    try {
        const vendor = await db.Vendor.findOne({ where: { email: req.body.email } });
        if (vendor) {
            if (vendor.is_verified == false) {
                return res.status(200).json({
                    success: false,
                    message: "Please activate your email first"
                });
            }
            const passwordAuth = bcrypt.compareSync(req.body.password, vendor.password);
            if (passwordAuth) {
                const token = await jwt.sign({ VendorId: vendor.id }, process.env.SECRET_KEY, { expiresIn: tokenAge });
                res.cookie("jwt", token, { maxAge: 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'none', })
                return res.status(200).json({
                    success: true,
                    message: "Login Success",
                    data: {
                        VendorId: vendor.id,
                        vendor_name: vendor.vendor_name,
                        email: vendor.email,
                        token: token
                    }
                });
            }
            return res.status(200).json({
                success: false,
                message: "Email and password didn't match",
            });
        }
        res.status(200).json({
            success: false,
            message: "Email is not registered"
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}

module.exports.editVendor = async function (req, res) {
    const {
        password,
        vendor_name,
        address,
        phone_number,
        description
    } = req.body;
    console.log(req.file);
    const findVendor = await db.Vendor.findByPk(req.params.id);
    const token = req.cookies.jwt;
    if (!findVendor) {
        return res.status(404).json({
            success: false,
            message: "Vendor not found!",
        });
    }
    if (checkVendor(findVendor.id, token)) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }
    // Require password for edit profile
    if (password == null) {
        return res.status(200).json({
            success: false,
            message: "Please enter the password",
        });
    }
    // compare password
    const comparePassword = bcrypt.compareSync(password, findVendor.password);
    if (!comparePassword) {
        return res.status(200).json({
            success: false,
            message: "Wrong Password!",
        });
    }
    // See if user changing profile picture
    let profile_picture = '';
    let url = '';
    if (req.file) {
        if (findVendor.profile_picture != 'profile_pict.jpg') {
            await cloudinary.uploader.destroy(findVendor.profile_picture, { resource_type: "image" }, function (error, result) {
                console.log(result, error)
            });
        }
        profile_picture = req.file.filename;
        url = req.file.path
    }
    try {
        await findVendor.update({
            vendor_name: vendor_name,
            address: address,
            phone_number: phone_number,
            description: description,
            profile_picture: profile_picture,
            url: url
        });
        return res.status(200).json({
            success: true,
            message: "Profile updated!",
            data: {
                vendor_name: findVendor.vendor_name,
                email: findVendor.email
            }
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}

module.exports.logout = (req, res) => {
    res.cookie("jwt", "", { maxAge: 1 });
    res.status(201).json({
        success: true,
        message: "Logout Success",
    });
};

// Venue for Vendor

module.exports.getVenueVerified = async function (req, res) {
    try {
        const token = req.cookies.jwt;
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (decoded.VendorId != req.params.id) {
            return res.status(401).json({
                success: false,
                message: "You don't have authorization"
            })
        }
        const verifiedVenue = await db.Venue.findAll({
            where: {
                VendorId: req.params.id,
                is_verified: true
            }, include: [
                {
                    model: db.Venue_Photo,
                    attributes: {
                        exclude: ['VenueId', 'createdAt', 'updatedAt']
                    }
                }
            ]
        })
        return res.status(200).json({
            success: true,
            data: verifiedVenue
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

module.exports.getVenueNotVerified = async function (req, res) {
    try {
        const token = req.cookies.jwt;
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (decoded.VendorId != req.params.id) {
            return res.status(401).json({
                success: false,
                message: "You don't have authorization"
            })
        }
        const notVerifiedVenue = await db.Venue.findAll({
            where: {
                VendorId: req.params.id,
                is_verified: false
            }, include: [
                {
                    model: db.Venue_Photo,
                    attributes: {
                        exclude: ['VenueId', 'createdAt', 'updatedAt']
                    }
                }
            ]
        })
        return res.status(200).json({
            success: true,
            data: notVerifiedVenue
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

// transaction
module.exports.getVendorTransactionPending = async function (req, res) {
    try {
        const token = req.cookies.jwt;
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (decoded.VendorId != req.params.id) {
            return res.status(401).json({
                success: false,
                message: "You don't have authorization"
            })
        }
        const pendingTransaction = await db.Transaction.findAll({
            where: {
                payment_status: 'pending'
            }, include: [
                {
                    model: db.Venue,
                    where: { VendorId: req.params.id },
                    include: [
                        {
                            model: db.Venue_Photo,
                            attributes: ['id', 'url']
                        }
                    ]
                }
            ]
        })
        return res.status(200).json({
            success: true,
            data: pendingTransaction
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

module.exports.getVendorTransactionSuccess = async function (req, res) {
    try {
        const token = req.cookies.jwt;
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (decoded.VendorId != req.params.id) {
            return res.status(401).json({
                success: false,
                message: "You don't have authorization"
            })
        }
        const successTransaction = await db.Transaction.findAll({
            where: {
                payment_status: {
                    [Op.or]: ['settlement', 'capture']
                }
            }, include: [
                {
                    model: db.Checkin_Status,
                    attributes: {
                        exclude: ['checkin_code', 'checkout_code', 'TransactionId', 'createdAt', 'updatedAt']
                    }
                },
                {
                    model: db.Venue,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt']
                    },
                    include: [
                        {
                            model: db.Venue_Photo,
                            attributes: ['id', 'url']
                        }
                    ]
                },
                {
                    model: db.User,
                    attributes: {
                        exclude: ['password', 'is_verified', 'createdAt', 'updatedAt']
                    }
                }
            ]
        })
        return res.status(200).json({
            success: true,
            data: successTransaction
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

module.exports.getVendorTransactionFinished = async function (req, res) {
    try {
        const token = req.cookies.jwt;
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (decoded.VendorId != req.params.id) {
            return res.status(401).json({
                success: false,
                message: "You don't have authorization"
            })
        }
        const finishedTransaction = await db.Transaction.findAll({
            where: {
                payment_status: 'finished'
            }, include: [
                {
                    model: db.Checkin_Status,
                    attributes: {
                        exclude: ['checkin_code', 'checkout_code', 'TransactionId', 'createdAt', 'updatedAt']
                    }
                },
                {
                    model: db.Venue,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt']
                    },
                    include: [
                        {
                            model: db.Venue_Photo,
                            attributes: ['id', 'url']
                        }
                    ]
                },
                {
                    model: db.User,
                    attributes: {
                        exclude: ['password', 'is_verified', 'createdAt', 'updatedAt']
                    }
                }
            ]
        })
        return res.status(200).json({
            success: true,
            data: finishedTransaction
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

module.exports.vendorAnalytics = async function (req, res) {
    try {
        const token = req.cookies.jwt;
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (decoded.VendorId != req.params.id) {
            return res.status(401).json({
                success: false,
                message: "You don't have authorization"
            })
        }
        const feedback = await db.Feedback.findAll({
            include: [
                {
                    model: db.Transaction,
                    attributes: ['id'],
                    required: true,
                    include: [
                        {
                            model: db.Venue,
                            attributes: ['id', 'VendorId'],
                            where: {
                                VendorId: req.params.id
                            }
                        }
                    ]
                }
            ]
        })
        const transaction = await db.Transaction.findAll({
            where: {
                payment_status: 'finished'
            },
            attributes: ['id', 'VenueId', 'total_payment'],
            include: [
                {
                    model: db.Venue,
                    attributes: ['id', 'VendorId'],
                    where: {
                        VendorId: req.params.id
                    }
                }
            ]
        });
        const transactionPerVenue = await db.Transaction.findAll({
            where: {
                payment_status: 'finished'
            },
            attributes: ['VenueId', [sequelize.fn('count', '*'), 'count']],
            group: ['VenueId']
        });
        let totalIncome = 0;
        transaction.forEach(async function (trans) {
            totalIncome += trans.total_payment;
        })
        const totalFeedback = feedback.length;
        const totalTransaction = transaction.length;

        return res.status(200).json({
            success: true,
            data: {
                totalFeedback: totalFeedback,
                totalTransaction: totalTransaction,
                totalIncome: totalIncome,
                transactionPerVenue: transactionPerVenue
            }

        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}