var express = require('express');
var bcrypt = require('bcrypt');
var jsonwebtoken = require('jsonwebtoken');
var CONFIG = require('../config.json');
var TOKEN_SECRET = CONFIG.token.secret;
var TOKEN_EXPIRES = parseInt(CONFIG.token.expiresInSeconds, 10);
var Payload = require('../models/payload');
var User = require('../models/user');
var tokenMiddleware = require('../middleware/token');
var router = express.Router();
var requestpromise = require('request-promise');
var shortid = require('shortid');


var optionsauth = {
    url: 'https://ibm-watson-ml.mybluemix.net/v3/identity/token',
    auth: {
        'user': '',
        'pass': ''
    }
};

router.post('/prediction', function(req, res){

  var predbody = {"values":req.body.location};

  requestpromise(optionsauth).then(function (parsedBody) {
    var token = JSON.parse(parsedBody).token;

    var option = {
        url: "https://ibm-watson-ml.mybluemix.net/v3/wml_instances/00195eb4-c665-4384-9e21-57e59ac66f5f/published_models/e971988d-5ca7-4f1e-bf91-5d7050d229a9/deployments/12a00fb6-1acc-4bd7-bd76-b6b5335001a5/online",
        method: "POST", json: true,
        headers: {"Content-Type":"application/json","Authorization":"Bearer " + token },
        body: predbody
    };

    requestpromise(option).then(function (parsedBody) {
      console.log(parsedBody);
      res.json({ success: true, prediction:parsedBody });
    }).catch(function (err) {
      res.json({ success: false });
    });
  }).catch(function (err) {
    res.json({ success: false });
  });

});

router.get('/allspots',tokenMiddleware.verifyToken, function(req, res){

  var reqdata = req.body;
  var options = {
    method: 'GET',
    uri: 'https://api.thespot.exchange:3000/api/io.ethventures.thespot.ParkingSpot',
    body: { },
    json: true
  };

  requestpromise(options).then(function (parsedBody) {
    res.json({ success: true, spots:parsedBody });
  }).catch(function (err) {
    res.json({ success: false });
  });

});
router.post('/spot',tokenMiddleware.verifyToken, function(req, res){
  //console.log(req.body);
  var reqdata = req.body;
  var options = {
    method: 'POST',
    uri: 'https://api.thespot.exchange:3000/api/io.ethventures.thespot.ParkingSpot',
    body: {
        "$class": "io.ethventures.thespot.ParkingSpot",
        "parkingSpotID": shortid.generate(),
        "address": {
          "$class": "io.ethventures.thespot.Address",
          "street": reqdata.placedetails.components.street_number.long + ' ' + reqdata.placedetails.components.route.long,
          "city": reqdata.placedetails.components.locality.long,
          "state": reqdata.placedetails.components.administrative_area_level_1.short,
          "country": reqdata.placedetails.components.country.long,
          "zip": reqdata.placedetails.components.postal_code.long,
          "id": shortid.generate()
        },
        "coordinates": JSON.stringify({lat: reqdata.placedetails.lat, lng:reqdata.placedetails.lng}),
        "ratePerHour": parseInt(reqdata.rate),
        "spotRating": "POOR",
        "features": {
          "$class": "io.ethventures.thespot.SpotFeatures",
          "covered": reqdata.covered,
          "valet": reqdata.valet,
          "selfPark": reqdata.self,
          "inOutAllowed": reqdata.inout,
          "handicapAccessible": req.handicap,
          "id": shortid.generate()
        },
        "owner": reqdata.user.id
      },
      json: true
    };
    requestpromise(options).then(function (parsedBody) {
      res.json({ success: true, spot:options.body });
    }).catch(function (err) {
      res.json({ success: false });
    });
});

router.post('/find', tokenMiddleware.verifyToken, function(req, res){
  if (req.body.start === undefined || req.body.end === undefined) {
    res.json({success: false, message:'Time Frame Required'});
  }
  if (req.body.types === undefined) {
    Payload.find({ "datetime" : { $lt: new Date(req.body.end), $gte: new Date(req.body.start) } }, function (err, data) {
      if (data !== undefined) {
        res.json({success: true, size:data.length, data :data});
      } else {
        res.json({success: true, size :0, data:[]});
      }
    });
  } else {
    var types = req.body.types.split(',');
    var selectquery = '';
    for (i = 0; i < types.length; i++) {
      if (i === types.length - 1) {
        selectquery += types[i];
        selectquery += " ";
        selectquery += "datetime";
      } else {
        selectquery += types[i];
        selectquery += " ";
      }
    }
    Payload.find({ "datetime" : { $lt: new Date(req.body.end), $gte: new Date(req.body.start) }}).select(selectquery).exec(function (err, data) {
      if (data !== undefined) {
        res.json({success: true, size:data.length, data:data});
      } else {
        res.json({success: true, size:0, data:[]});
      }
    });
  }
});

router.post('/connection_test', function(req, res){ res.json({'status':true}); });
router.get('/ping', function(req, res){ res.json({'response':'pong'}); });

router.post('/', function(req, res){
  var temp_load = new Payload(req.body);
  temp_load['datetime'] = new Date();
  temp_load.save(function(err) {
    if (err) throw err;
    res.json(temp_load);
  });
});

module.exports = router;
