var express = require("express");
var router = express.Router();
//panggil Model
var Transaksi = require("../models/Transaksi");
var TransaksiDetail = require("../models/TransaksiDetail");
var Biaya = require("../models/Biaya");
var Coa = require("../models/Coa");
//panggil koneksi utk proses transaction
var koneksi = require("../koneksi");
//panggil middleware JWT
var cekToken = require("../middleware");
/* TAMPIL DATA */
router.get("/", cekToken, function (req, res, next) {
  Transaksi.findAll({
    include: {
      model: TransaksiDetail,
      as: "transaksi_detail",

      include: [
        { model: Biaya, as: "biaya" },
        { model: Coa, as: "coa_debit" },
        { model: Coa, as: "coa_kredit" },
      ],
    },
  })
    .then((data) => {
      res.json({
        status: true,
        pesan: "Berhasil Tampil",
        data: data,
      });
    })
    .catch((err) => {
      res.json({
        status: false,
        pesan: "Gagal Tampil: " + err.message,
        data: [],
      });
    });
});


/* TAMBAH DATA */
router.post("/", cekToken, function (req, res, next) {
  //mulai transaction
  koneksi.transaction().then(function (t) {
    Transaksi.create(req.body, { transaction: t })
      .then((data) => {
        //update id_transaksi di req.body.transaksi_detail
        //promise all : digunakan untuk menunggu proses selesai

        Promise.all(
          req.body.transaksi_detail.map(async (item) => {
            item.id_transaksi = data.id;
          }),
        );

        TransaksiDetail.bulkCreate(req.body.transaksi_detail, {
          transaction: t,
        })
          .then((dataDetail) => {
            t.commit(); //simpan permanen
            res.json({
              status: true,
              pesan: "Berhasil Transaksi",
              data: data,
              detail: dataDetail,
            });
          })
          .catch((err) => {
            t.rollback(); //batalkan simpan
            res.json({
              status: false,
              pesan: "Gagal Transaksi Detail: " + err.message,
              data: [],
            });
          });
      })
      .catch((err) => {
        t.rollback(); //batalkan simpan
        res.json({
          status: false,

          pesan: "Gagal Transaksi: " + err.message,
          data: [],
        });
      });
  }); //akhir transaction
});

/* HAPUS DATA */
router.delete("/", cekToken, function (req, res, next) {
  koneksi.transaction().then(function (t) {
    Transaksi.destroy({ where: { id: req.body.id } }, { transaction: t })
      .then(() => {
        TransaksiDetail.destroy(
          { where: { id_transaksi: req.body.id } },
          { transaction: t },
        )
          .then(() => {
            t.commit(); //hapus berpanen
            res.json({
              status: true,
              pesan: "Berhasil menghapus data transaksi",
            });
          })
          .catch((err) => {
            t.rollback(); //batalkan hapus
            res.json({
              status: true,
              pesan: err.message,
            });
          });
      })
      .catch((err) => {
        t.rollback(); //batalkan hapus
        res.json({
          status: false,
          pesan: "Gagal Hapus: " + err.message,
          data: [],
        });
      });
  });
});
module.exports = router;
