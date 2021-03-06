const db = require("../models/index.js");
const { Op, Transaction } = require("sequelize");
const jwt = require('jsonwebtoken');
const fs = require('fs');
const moment = require('moment');
const { sequelize } = require("../models/index.js");
const { url } = require("inspector");
require("dotenv").config({ path: "./.env" });
const { cloudinary } = require("../config/cloudinary.js");


module.exports.getAll = async function (req, res) {
    try {
        const findVenue = await db.Venue.findAll({
            where: { is_verified: true },
            include: [
                {
                    model: db.Venue_Photo,
                    attributes: ['id', 'url']
                }
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

module.exports.getAllPriceDesc = async function (req, res) {
    try {
        const findVenue = await db.Venue.findAll({
            where: {
                is_verified: true
            },
            include: [
                {
                    model: db.Venue_Photo,
                    attributes: ['id', 'url']
                }
            ],
            order: [
                ['price', 'DESC'],
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

module.exports.getAllPriceAsc = async function (req, res) {
    try {
        const findVenue = await db.Venue.findAll({
            where: {
                is_verified: true
            },
            include: [
                {
                    model: db.Venue_Photo,
                    attributes: ['id', 'url']
                }
            ],
            order: [
                ['price', 'ASC'],
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

module.exports.getAllPriceDescCity = async function (req, res) {
    try {
        const findVenue = await db.Venue.findAll({
            where: {
                city: { [Op.iLike]: `%${req.params.city}%` },
                is_verified: true
            },
            include: [
                {
                    model: db.Venue_Photo,
                    attributes: ['id', 'url']
                }
            ],
            order: [
                ['price', 'DESC'],
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

module.exports.getAllPriceAscCity = async function (req, res) {
    try {
        const findVenue = await db.Venue.findAll({
            where: {
                city: { [Op.iLike]: `%${req.params.city}%` },
                is_verified: true
            },
            include: [
                {
                    model: db.Venue_Photo,
                    attributes: ['id', 'url']
                }
            ],
            order: [
                ['price', 'ASC'],
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

module.exports.getDetailVenue = async function (req, res) {
    try {
        const findVenue = await db.Venue.findOne({
            where: { id: req.params.id },
            include: [
                {
                    model: db.Vendor,
                    attributes: ['vendor_name', 'address', 'phone_number']
                },
                {
                    model: db.Venue_Photo,
                    attributes: ['id', 'url']
                }
            ]
        })
        if (!findVenue) {
            return res.status(404).json({
                success: false,
                message: "Venue not found",
            });
        }
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

module.exports.getVenueDate = async function (req, res) {
    try {
        const findDate = await db.Transaction.findAll({
            where: {
                VenueId: req.params.id,
                payment_status: {
                    [Op.or]: ['settlement', 'capture', 'finished', 'pending']
                }
            },
            attributes: ['start_book', 'finish_book']
        })
        function getDates(startDate, finishDate, dateArray) {
            let currentDate = moment(startDate);
            while (currentDate <= finishDate) {
                dateArray.push(new Date(currentDate));
                currentDate.add(1, 'days');
            }
            return dateArray;
        }
        let dates = []
        findDate.forEach(async function (date) {
            getDates(date.start_book, date.finish_book, dates)
        })
        return res.status(200).json({
            success: true,
            data: dates
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.searchVenue = async function (req, res) {
    try {
        const findVenue = await db.Venue.findAll({
            where: {
                [Op.and]: [
                    { capacity: { [Op.gte]: req.query.capacity } },
                    { city: { [Op.iLike]: `%${req.query.city}%` } },
                ],
                is_verified: true
            },
            include: [
                {
                    model: db.Venue_Photo,
                    attributes: ['id', 'url']
                },
                {
                    model: db.Transaction,
                    attributes: [
                        'start_book', 'finish_book'
                    ]
                }
            ]
        })
        console.log(findVenue)
        function filterDate(array) {
            for (let i = 0; i < array.length; i++) {
                console.log("Function")
                array[i].Transactions.map(transaction => {
                    console.log(transaction.start_book);
                    if (moment(req.query.start_book).isBetween(transaction.start_book, transaction.finish_book) ||
                        moment(req.query.start_book).isSame(transaction.start_book) ||
                        moment(req.query.start_book).isSame(transaction.finish_book) ||
                        moment(req.query.finish_book).isSame(transaction.start_book) ||
                        moment(req.query.finish_book).isSame(transaction.finish_book) ||
                        moment(req.query.finish_book).isBetween(transaction.start_book, transaction.finish_book) ||
                        (moment(req.query.start_book).isSameOrBefore(transaction.start_book) && moment(req.query.finish_book).isSameOrAfter(transaction.finish_book))) {
                        array.splice(i, 1);
                        console.log("Object deleted")
                    }
                })
            }

        }
        filterDate(findVenue);
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

module.exports.getCity = async function (req, res) {
    try {
        const venue = await db.Venue.findAll({
            where: { is_verified: true },
            attributes: ['city', 'Venue.city', [sequelize.fn('count', sequelize.col('Venue.id')), 'venueCount']],
            group: ['Venue.city'],
            order: [[sequelize.col('venueCount'), 'DESC']]

        });
        return res.status(200).json({
            success: true,
            data: venue
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.getVenueByCityPost = async function (req, res) {
    try {
        const {
            city
        } = req.body
        if (!city) {
            return res.status(200).json({
                success: false,
                message: "Please insert the city"
            })
        }
        const venue = await db.Venue.findAll({
            where: { city: { [Op.iLike]: city }, is_verified: true },
            attributes: {
                exclude: ['is_verified', 'status', 'updatedAt']
            },
            include: [
                {
                    model: db.Venue_Photo,
                    attributes: ['id', 'url']
                }
            ]
        });
        return res.status(200).json({
            success: true,
            data: venue
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.getVenueByCityGet = async function (req, res) {
    try {
        const venue = await db.Venue.findAll({
            where: { city: { [Op.iLike]: req.params.city }, is_verified: true },
            attributes: {
                exclude: ['is_verified', 'status', 'updatedAt']
            },
            include: [
                {
                    model: db.Venue_Photo,
                    attributes: ['id', 'url']
                }
            ]
        });
        return res.status(200).json({
            success: true,
            data: venue
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.Create = async function (req, res) {
    const {
        name,
        capacity,
        description,
        price,
        city,
        address,
        longitude,
        latitude
    } = req.body
    try {
        const token = req.cookies.jwt;
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        const VendorId = decoded.VendorId;
        if (VendorId == null) {
            return res.status(200).json({
                succes: false,
                message: "You are not a vendor"
            });
        }
        const venue = await db.Venue.create({
            VendorId,
            name,
            capacity,
            description,
            price,
            city,
            address,
            longitude,
            latitude
        });
        const VenueId = venue.id;
        let filename
        let type
        let url
        // Upload KTP
        try {
            type = 'ktp'
            filename = req.files['ktp'][0].filename;
            url = req.files['ktp'][0].path;
            await db.Document.create({
                VenueId,
                filename,
                type,
                url
            })
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            })
        }

        // Upload Surat Tanah
        try {
            type = 'surat_tanah'
            filename = req.files['surat_tanah'][0].filename;
            url = req.files['surat_tanah'][0].path;
            await db.Document.create({
                VenueId,
                filename,
                type,
                url
            })
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            })
        }

        req.files['venue_photos'].forEach(async function (file) {
            filename = file.filename;
            url = file.path;
            try {
                await db.Venue_Photo.create({
                    VenueId,
                    filename,
                    url
                })
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                })
            }
        })
        return res.status(201).json({
            success: true,
            data: venue
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.EditVenue = async function (req, res) {
    const {
        name,
        capacity,
        description,
        address,
        price
    } = req.body
    try {
        const venue = await db.Venue.findByPk(req.params.id);
        const token = req.cookies.jwt;
        const decoded = await jwt.verify(token, process.env.SECRET_KEY);
        if (decoded.VendorId != venue.VendorId) {
            return res.status(401).json({
                success: false,
                message: "You don't have authorization"
            })
        }
        if (!venue) {
            if (req.files['venue_photos']) {
                req.files['venue_photos'].forEach(async function (file) {
                    filename = file.filename;
                    await cloudinary.uploader.destroy(filename, { resource_type: "image" }, function (error, result) {
                        console.log(result, error)
                    });
                })
            }
            return res.status(404).json({
                success: false,
                message: "Venue not found"
            })
        }
        const VenueId = venue.id;
        if (req.files['venue_photos']) {
            const PhotoCount = await db.Venue_Photo.findAll({ where: { VenueId: VenueId } })
            let filename = ""
            let url = ""
            if (PhotoCount.length + req.files['venue_photos'].length > 5) {
                req.files['venue_photos'].forEach(async function (file) {
                    filename = file.filename;
                    await cloudinary.uploader.destroy(filename, { resource_type: "image" }, function (error, result) {
                        console.log(result, error)
                    });
                })
                return res.status(200).json({
                    success: false,
                    message: "Max photo reached (5)"
                })
            }
            req.files['venue_photos'].forEach(async function (file) {
                filename = file.filename;
                url = file.path;
                try {
                    await db.Venue_Photo.create({
                        VenueId,
                        filename,
                        url
                    })
                } catch (error) {
                    console.log(error)
                    return res.status(400).json({
                        success: false,
                        message: error.message
                    })
                }
            })
        }
        await venue.update({
            name: name,
            capacity: capacity,
            description: description,
            address: address,
            price: price
        });
        return res.status(200).json({
            message: "Venue updated!",
            data: venue
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.deleteVenuePhotos = async function (req, res) {
    try {
        const venuePhotos = await db.Venue_Photo.findByPk(req.params.photoId)
        if (!venuePhotos) {
            return res.status(200).json({
                success: false,
                message: "Photo not found"
            })
        }
        const venue = await db.Venue.findByPk(venuePhotos.VenueId);
        const token = req.cookies.jwt;
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (decoded.VendorId != venue.VendorId) {
            return res.status(401).json({
                success: false,
                message: "You don't have authorization"
            })
        }
        await db.Venue_Photo.destroy({ where: { id: req.params.photoId } })
        await cloudinary.uploader.destroy(venuePhotos.filename, { resource_type: "image" }, function (error, result) {
            console.log(result, error)
        });
        return res.status(200).json({
            success: true,
            message: "Delete success!"
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

module.exports.deleteVenue = async function (req, res) {
    try {
        const token = req.cookies.jwt;
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        const venue = await db.Venue.findByPk(req.params.id);
        const venuePhotos = await db.Venue_Photo.findAll({
            where: {
                VenueId: venue.id
            }
        })
        const documents = await db.Document.findAll({
            where: {
                VenueId: venue.id
            }
        })
        if (decoded.VendorId != venue.VendorId) {
            return res.status(401).json({
                success: false,
                message: "You don't have authorization"
            })
        }
        await db.Venue.destroy({ where: { id: req.params.id } })
        venuePhotos.forEach(async function (photo) {
            await cloudinary.uploader.destroy(photo.filename, { resource_type: "image" }, function (error, result) {
                console.log(result, error)
            });
        })
        documents.forEach(async function (document) {
            await cloudinary.uploader.destroy(document.filename, { resource_type: "image" }, function (error, result) {
                console.log(result, error)
            });
        })
        return res.status(200).json({
            success: true,
            message: "Delete success!"
        })
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        })
    }
}