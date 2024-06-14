var express = require("express");
var router = express.Router();
//setting midtrans client
const midtransClient = require("midtrans-client");
//variabel config midtrans
var configIsProduction = false;
var configServerKey = "SB-Mid-server-UI-mWQCrAxIBGuWMcm1oYz1v";
var configClientKey = "SB-Mid-client-b1Rl48Y7UP4LjRpV";
//membuat objek snap
let snap = new midtransClient.Snap({
  isProduction: configIsProduction,
  serverKey: configServerKey,
  clientKey: configClientKey,
});
//membuat objek core api
let coreApi = new midtransClient.CoreApi({
  isProduction: configIsProduction,
  serverKey: configServerKey,
  clientKey: configClientKey,
});
//panggil Model
var Billing = require("../models/Billing");
var BillingDetail = require("../models/BillingDetail");
var Biaya = require("../models/Biaya");
var Transaksi = require("../models/Transaksi");
var TransaksiDetail = require("../models/TransaksiDetail");
var koneksi = require("../koneksi");

const Sequelize = require("sequelize");
const Op = Sequelize.Op;

/* INQUIRY Langkah1 : ambil data billing*/
router.get("/inquiry/:id", function (req, res, next) {
  //ambil data billing
  Billing.findByPk(req.params.id, {
    include: {
      model: BillingDetail,
      as: "billing_detail",
    },
  })
    .then((data) => {
      if (data) {
        req.billing = data;
        next();
      } else {
        res.json({
          status: false,
          pesan: "Billing dengan id: " + req.params.id + " tidak ditemukan",
          data: data,
        });
      }
    })
    .catch((err) => {
      res.json({
        status: false,
        pesan: "Gagal Tampil: " + err.message,
        data: [],
      });
    });
});
/* INQUIRY Langkah2 : buat transaksi di midtrans*/
router.get("/inquiry/:id", function (req, res, next) {
  var billing = req.billing;
  var parameter = {
    transaction_details: {
      order_id: billing.id,
      gross_amount: 0,
    },
    customer_details: {
      first_name: billing.nama,
      email: billing.email,
    },
    item_details: [],
  };
  var total_jumlah = 0;
  Promise.all(
    billing.billing_detail.map(async (item) => {
      var detail = {
        id: item.id,
        name: item.nama_biaya,
        price: item.jumlah,
        quantity: 1,
      };
      total_jumlah += item.jumlah;
      parameter.transaction_details.gross_amount = total_jumlah;
      parameter.item_details.push(detail);
    }),
  );
  snap
    .createTransaction(parameter)
    .then((transaction) => {
      Billing.update(
        { snap_token: transaction.token, status_code: 1 },
        { where: { id: req.params.id } },
      );
      var kodeHtml =
        `
    <script src="https://app.sandbox.midtrans.com/snap/snap.js"
    data-client-key="` +
        configClientKey +
        `"></script>
    <script type="text/javascript">
    snap.pay('` +
        transaction.token +
        `');
    </script>
    `;
      res.send(kodeHtml);
    })
    .catch((e) => {
      res.json({
        status: false,
        pesan: "Error request ke midtrans",
        data: e.ApiResponse,
      });
    });
});

/* cek status pembayaran di midtrans Langkah ke 1 */
router.get("/status/:id", function (req, res, next) {
  var id_billing = req.params.id;
  coreApi.transaction.status(id_billing).then((data) => {
    Billing.update(
      {
        status_code: data.status_code,
        transaction_status: data.transaction_status,
      },
      {
        where: {
          id: id_billing,
          transaction_status: { [Op.not]: "Terbayar" },
        },
      },
    )
      .then(() => {
        req.dataMidtrans = data;
        next();
      })
      .catch((err) => {
        res.json({
          status: false,
          pesan: "Gagal Update Billing: " + err.message,
          data: [],
        });
      });
  });
});

//cek status pembayaran di midtrans ke 2
router.get("/status/:id", function (req, res, next) {
  var id_billing = req.params.id;
  var dataMidtrans = req.dataMidtrans;

  if (
    dataMidtrans.transaction_status == "settlement" ||
    dataMidtrans.transaction_status == "capture"
  ) {
    Billing.findByPk(id_billing, {
      include: {
        model: BillingDetail,
        as: "billing_detail",
        include: {
          model: Biaya,
          as: "biaya",
        },
      },
    })
      .then((dataBilling) => {
        if (dataBilling) {
          req.dataBilling = dataBilling;
          next();
        } else {
          res.json({
            status: false,
            pesan: "BIlling Dengan ID: " + id_billing + " Tidak Ditemukan",
            data: dataMidtrans,
          });
        }
      })
      .catch((err) => {
        res.json({
          status: false,
          pesan: "Gagal Ambil Billing: " + err.message,
          data: dataMidtrans,
        });
      });
  } else {
    res.json({
      status: false,
      pesan: "Status Pembayaran : " + dataMidtrans.transaction_status,
      data: dataMidtrans,
    });
  }
});

//cek pembayaran ke 3
router.get("/status/:id", function (req, res, next) {
  var id_billing = req.params.id;
  var dataBilling = req.dataBilling;
  var dataMidtrans = req.dataMidtrans;

  if (dataBilling.transaction_status != "Terbayar") {
    var dataTrans = {
      jenis: "Bayar",
      tanggal: new Date(),
      no_daftar: dataBilling.no_daftar,
      diterima_dari: dataBilling.nama,
      transaksi_detail: [],
    };

    Promise.all(
      dataBilling.billing_detail.map(async (item) => {
        dataTrans.transaksi_detail.push({
          id_biaya: item.biaya.id,
          id_coa_debit: item.biaya.id_coa,
          id_coa_kredit: 1,
          jumlah: item.jumlah,
          keterangan: "Online",
        });
      }),
    );
    koneksi.transaction().then(function (t) {
      Transaksi.create(dataTrans, { transaction: t }).then((data) => {
        Promise.all(
          dataTrans.transaksi_detail.map(async (item) => {
            item.id_transaksi = data.id;
          }),
        );
        TransaksiDetail.bulkCreate(dataTrans.transaksi_detail, {
          transaction: t,
        })
          .then((dataDetail) => {
            Billing.update(
              { transaction_status: "Terbayar" },
              {
                where: { id: id_billing },
              },
              { transaction: t },
            )
              .then(() => {
                t.commit();
                res.json({
                  status: true,
                  pesan: "Berasil Transaksi",
                  data: dataMidtrans,
                });
              })
              .catch((err) => {
                t.rollback();
                res.json({
                  status: false,
                  pesan: "Gagal Transaksi Detail: " + err.message,
                });
              });
          })
          .catch((err) => {
            t.rollback();
            res.json({
              status: false,
              pesan: "Gagal Transaksi: " + err.message,
              data: dataMidtrans,
            });
          });
      });
    });
  } else {
    res.json({
      status: true,
      pesan: "Status Pembayaran:" + dataMidtrans.transaction_status,
      data: dataMidtrans,
    });
  }
});

//post notif langkah ke 1
router.post("/notif", function (req, res, next) {
  var id_billing = req.body.order_id;
  coreApi.transaction.status(id_billing).then((data) => {
    //update status billing
    Billing.update(
      {
        status_code: data.status_code,
        transaction_status: data.taransaction_status,
      },
      {
        where: { id: id_billing, transaction_status: { [Op.not]: "Terbayar" } },
      },
    )
      .then(() => {
        req.dataMidtrans = data;
        next();
      })
      .catch((err) => {
        res.json({
          status: false,
          pesan: "Gagal Update Billing: " + err.message,
          ddata: [],
        });
      });
  });

  //post notif ke 2
  router.post("/notif", function (req, res, next) {
    var id_billing = req.body.order_id;
    var dataMidtrans = req.dataMidtrans;

    if (
      dataMidtrans.transaction_status != "Settlement" ||
      dataMidtrans.transaction_status != "Capture"
    ) {
      Billing.findByPk(id_billing, {
        include: {
          model: BillingDetail,
          as: "billing_detail",
          include: { model: Biaya, as: "biaya" },
        },
      })
        .then((dataBilling) => {
          if (dataBilling) {
            req.dataBilling = dataBilling;
            next();
          } else {
            res.json({
              status: false,
              pesan: "Billing dengan id:" + id_billing + " tidak ditemukan",
              data: dataMidtrans,
            });
          }
        })
        .catch((err) => {
          res.json({
            status: false,
            pesan: "Gagal Ambil Billing: " + err.message,
            data: dataMidtrans,
          });
        });
    } else {
      res.json({
        status: false,
        pesan: "Status Pemabayaran:" + dataMidtrans.transaction_status,
        data: dataMidtrans,
      });
    }
  });

  //post notif ke 3
  router.post("/notif", function (req, res, next) {
    var id_billing = req.body.order_id;
    var dataBilling = req.dataBilling;
    var dataMidtrans = req.dataMidtrans;

    if (dataBilling.transaction_status !== "Terbayar") {
      //buat data taransaksi
      var dataTrans = {
        jenis: "Bayar",
        tanggal: new Date(),
        no_daftar: dataBilling.no_daftar,
        diterima_dari: dataBilling.nama,
        transaksi_detail: [],
      };

      promise.all(
        dataBilling.billing_detail.map(async (item) => {
          dataTrans.transaksi_detail.push({
            id_biaya: item.biaya.id,
            id_coa_debit: item.biaya.id_coa,
            id_coa_kredit: 1,
            jumlah: item.jumlah,
            keterangan: "Online",
          });
        }),
      );

      koneksi.transaction().then(function (t) {
        Transaksi.create(dataTrans, { transaction: t }).then((data) => {
          Promise.all(
            dataTrans.transaksi_detail.map(async (item) => {
              item.id_transaksi = data.id;
            }),
          );

          TransaksiDetail.bulkCreate(dataTrans.transaksi_detail, {
            transaction: t,
          }).then( dataDetail => {
            Billing.update(
            {transaction_status: "Terbayar"},
            {
              where: { id: id_billing },
            },
            { transaction: t }
            ).then(() => {
              t.commit();
              res.json({
                status: true,
                pesan: "Berhasil Transaksi",
                data: data,
                detail: dataMidtrans,
              });
            }).catch(err => {
              t.rollback();
              res.json({
                status: false,
                pesan: "Gagal Transaksi Deatail: " + err.message,
                data: dataMidtrans,
              });
            })
          }).catch(err => {
            t.rollback();
            res.json({
              status: false,
              pesan: "Gagal Transaksi Detail: " + err.message,
              data: dataMidtrans,
            });
          })
        }).catch(err => {
          t.rollback();
          res.json({
            status: false,
            pesan: "Gagal Transaksi: " + err.message,
            data: dataMidtrans,
          });
        })
      });
    }else {
      res.json({
        status: false,
        pesan: "Status Pemabayaran:" + dataMidtrans.transaction_status,
        data: dataMidtrans,
      });
    }
  });
});

module.exports = router;
