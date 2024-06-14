var cekTokenSpmb = function (req, res, next) {
  var token = req.header("spmb_token");
  if (token) {
    if (token == "1a69967a-0ce2-4119-97d6-a793183f8dff") {
      next();
    } else {
      res.json({
        status: false,
        pesan: "Token spmb Tidak Valid",
        data: [],
      });
    }
  } else {
    res.json({
      status: false,
      pesan: "Maaf tidak membawa token spmb",
      data: [],
    });
  }
};
module.exports = cekTokenSpmb;
