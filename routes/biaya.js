var express = require("express");
var router = express.Router();
var cekTokenSpmb = require("../middleware_spmb");
//panggil Model Biaya
const Biaya = require("../models/Biaya.js");

/* TAMPIL DATA */
router.get("/", function (req, res, next) {
  Biaya.findAll()
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
router.post("/", function (req, res, next) {
  Biaya.create(req.body)
    .then((data) => {
      res.json({
        status: true,
        pesan: "Berhasil Tambah",
        data: data,
      });
    })
    .catch((err) => {
      res.json({
        status: false,
        pesan: "Gagal Tambah: " + err.message,
        data: [],
      });
    });
});

/* UBAH DATA */
router.put("/", function (req, res, next) {
  Biaya.update(req.body, {
    where: { id: req.body.id },
  })
    .then(() => {
      res.json({
        status: true,
        pesan: "Berhasil Ubah",
        data: [],
      });
    })
    .catch((err) => {
      res.json({
        status: false,
        pesan: "Gagal Ubah: " + err.message,
        data: [],
      });
    });
});

/* HAPUS DATA */
router.delete("/", function (req, res, next) {
  Biaya.destroy({
    where: { id: req.body.id },
  })
    .then(() => {
      res.json({
        status: true,
        pesan: "Berhasil Hapus",
        data: [],
      });
    })
    .catch((err) => {
      res.json({
        status: false,
        pesan: "Gagal Hapus: " + err.message,
        data: [],
      });
    });
});

/* TAMPIL DATA BIAYA PENDAFTARAN UNTUK SPMB*/
router.get("/spmb/:prodi/:angkatan", cekTokenSpmb, function (req, res, next) {
  var prodi = req.params.prodi;
  var angkatan = req.params.angkatan;
  Biaya.findOne({
    where: {
      id_prodi: prodi,
      id_angkatan: angkatan,
      nama_biaya: "PENDAFTARAN",
    },
  })
    .then((data) => {
      res.json({
        status: true,
        pesan: "Berhasil Tampil",
        data: data,
        snap_js: `<script src="https://app.sandbox.midtrans.com/snap/snap.js"
  data-client-key="SB-Mid-client-b1Rl48Y7UP4LjRpV"></script>`,
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
module.exports = router;
