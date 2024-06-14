var koneksi = require("../koneksi");
const { Sequelize, DataTypes } = require("sequelize");

const User = koneksi.define(
  "user",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },

    nama: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
  },
);

module.exports = User;
