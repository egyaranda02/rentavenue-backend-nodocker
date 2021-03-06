require("dotenv").config({ path: "./.env" });
const db = require("../models/index.js");
const uuid = require("uuid");
const fs = require('fs');
const { use } = require("../routes/index.js");
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const tokenAge = 60 * 5;

module.exports.login = async function (req, res) {
    try {
        const admin = await db.Admin.findOne({ where: { email: req.body.email } });
        if (admin) {
            const passwordAuth = bcrypt.compareSync(req.body.password, admin.password);
            if (passwordAuth) {
                const token = await jwt.sign({ AdminId: admin.id }, process.env.SECRET_KEY, { expiresIn: '1h' });
                res.cookie('jwt', token, { maxAge: 60 * 60 * 1000, httpOnly: true, secure: true, sameSite: 'none', });
                return res.status(200).json({
                    success: true,
                    message: "Login Success",
                    data: {
                        AdminId: admin.id,
                        email: admin.email,
                        token: token
                    }
                });
            }
            return res.status(200).json({
                success: false,
                message: "Email and password didn't match",
            });
        }
        return res.status(200).json({
            success: false,
            message: "Email is not registered"
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

module.exports.getVenue = async function (req, res) {
    try {
        const findVenue = await db.Venue.findAll({
            where: {
                status: {
                    [Op.not]: ["rejected"]
                }
            },
            include: [
                {
                    model: db.Vendor,
                    attributes: ['vendor_name', 'address', 'phone_number']
                },
            ],
            order: [
                ['is_verified', 'ASC'],
                ['id', 'ASC']
            ]
        });
        return res.status(200).json({
            success: true,
            data: findVenue
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.getDocumentVenue = async function (req, res) {
    try {
        if (!req.params.id) {
            return res.status(200).json({
                success: false,
                message: "Please enter Id"
            })
        }
        const findKTP = await db.Document.findOne({
            where: {
                type: "ktp",
                VenueId: req.params.id
            },
            attributes: {
                exclude: ['createdAt', 'updatedAt', 'filename']
            },
            raw: true
        });
        const findSurat = await db.Document.findOne({
            where: {
                type: "surat_tanah",
                VenueId: req.params.id
            },
            attributes: {
                exclude: ['createdAt', 'updatedAt', 'filename']
            },
            raw: true
        });
        if (!findKTP || !findSurat) {
            return res.status(200).json({
                success: false,
                message: "Document not found"
            })
        }
        return res.status(200).json({
            success: true,
            data: {
                urlKTP: findKTP.url,
                urlSurat: findSurat.url
            }
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.getVenueNotVerified = async function (req, res) {
    try {
        const findVenue = await db.Venue.findAll({ where: { is_verified: false } });
        return res.status(200).json({
            success: true,
            data: findVenue
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.getDetailVenue = async function (req, res) {
    try {
        const findVenue = await db.Venue.findOne({
            where: { id: req.params.id },
            include: [
                {
                    model: db.Document,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt']
                    }
                }, {
                    model: db.Venue_Photo,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt']
                    }
                }
            ]
        })
        return res.status(200).json({
            success: true,
            data: findVenue
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.getTransaction = async function (req, res) {
    try {
        const transaction = await db.Transaction.findAll();
        return res.status(200).json({
            success: true,
            data: transaction
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.venueVerification = async function (req, res) {
    const { respond } = req.body;
    try {
        const findVenue = await db.Venue.findByPk(req.params.id);
        if (!findVenue) {
            return res.status(404).json({
                success: false,
                message: "Venue not found"
            })
        }
        if (!respond) {
            return res.status(200).json({
                success: false,
                message: "please enter a respond"
            })
        }
        if (respond == "accept") {
            if (findVenue.is_verified == true) {
                return res.status(200).json({
                    success: false,
                    message: "This venue is already verified"
                })
            }
            findVenue.update({
                is_verified: true,
                status: "active"
            })
            return res.status(200).json({
                success: true,
                message: "Venue is verified"
            })
        }
        if (respond == "reject") {
            findVenue.update({
                status: "rejected"
            })
            return res.status(200).json({
                success: true,
                message: "Venue rejected"
            })
        }
        return res.status(200).json({
            success: false,
            message: "please enter a correct respond"
        })

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.blockVenue = async function (req, res) {
    try {
        const findVenue = db.Venue.findByPk(req.params.id);
        if (!findVenue) {
            return res.status(404).json({
                success: false,
                message: "Venue not found"
            })
        }
        findVenue.update({
            is_verified: false,
            status: "blocked"
        })
        return res.status(200).json({
            success: true,
            message: "Venue Blocked"
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.getUser = async function (req, res) {
    try {
        const findUser = await db.User.findAll({
            attributes: {
                exclude: ['password']
            }
        });
        return res.status(200).json({
            success: true,
            data: findUser
        })
    } catch (error) {
        return res.status(200).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.getVendor = async function (req, res) {
    try {
        const findVendor = await db.Vendor.findAll({
            attributes: {
                exclude: ['password']
            }
        });
        return res.status(200).json({
            success: true,
            data: findVendor
        })
    } catch (error) {
        return res.status(200).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.logout = (req, res) => {
    res.cookie("jwt", "", { maxAge: 1 });
    res.status(200).json({
        success: true,
        message: "Logout Success",
    });
};