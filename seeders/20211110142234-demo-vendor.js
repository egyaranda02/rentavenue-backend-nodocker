'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('Admins', [
      {
        email: 'vendor1@gmail.com',
        password: '$2b$10$87TVRADaSSJuE4s2RVMB0uvWproCG3eZ5PJfdy526pHWmNYfIwJ5u',
        vendor_name: '',
        address: '',
        phone_number: '',
        description: '',
        profile_picture: 'profile_pict.jpg',
        is_verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://i.stack.imgur.com/34AD2.jpg'
      },
      {
        email: 'vendor2@gmail.com',
        password: '$2b$10$87TVRADaSSJuE4s2RVMB0uvWproCG3eZ5PJfdy526pHWmNYfIwJ5u',
        vendor_name: '',
        address: '',
        phone_number: '',
        description: '',
        profile_picture: 'profile_pict.jpg',
        is_verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://i.stack.imgur.com/34AD2.jpg'
      },
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
