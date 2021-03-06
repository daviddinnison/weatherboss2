"use strict";
const express = require("express");
const bodyParser = require("body-parser");

const { User } = require("./models");

const router = express.Router();

const jsonParser = bodyParser.json();

// Post to register a new user
router.post("/", jsonParser, (req, res) => {
  const requiredFields = ["username", "password"];
  const missingField = requiredFields.find(field => !(field in req.body));

  if (missingField) {
    return res.status(422).json({
      code: 422,
      reason: "ValidationError",
      message: "Missing field",
      location: missingField
    });
  }

  const stringFields = ["username", "password"];
  const nonStringField = stringFields.find(
    field => field in req.body && typeof req.body[field] !== "string"
  );

  if (nonStringField) {
    return res.status(422).json({
      code: 422,
      reason: "ValidationError",
      message: "Incorrect field type: expected string",
      location: nonStringField
    });
  }

  // If the username and password aren't trimmed we give an error.  Users might
  // expect that these will work without trimming (i.e. they want the password
  // "foobar ", including the space at the end).  We need to reject such values
  // explicitly so the users know what's happening, rather than silently
  // trimming them and expecting the user to understand.
  // We'll silently trim the other fields, because they aren't credentials used
  // to log in, so it's less of a problem.
  const explicityTrimmedFields = ["username", "password"];
  const nonTrimmedField = explicityTrimmedFields.find(
    field => req.body[field].trim() !== req.body[field]
  );

  if (nonTrimmedField) {
    return res.status(422).json({
      code: 422,
      reason: "ValidationError",
      message: "Cannot start or end with whitespace",
      location: nonTrimmedField
    });
  }

  const sizedFields = {
    username: {
      min: 1
    },
    password: {
      min: 4,
      // bcrypt truncates after 72 characters, so let's not give the illusion
      // of security by storing extra (unused) info
      max: 72
    }
  };
  const tooSmallField = Object.keys(sizedFields).find(
    field =>
      "min" in sizedFields[field] &&
      req.body[field].trim().length < sizedFields[field].min
  );
  const tooLargeField = Object.keys(sizedFields).find(
    field =>
      "max" in sizedFields[field] &&
      req.body[field].trim().length > sizedFields[field].max
  );

  if (tooSmallField || tooLargeField) {
    return res.status(422).json({
      code: 422,
      reason: "ValidationError",
      message: tooSmallField
        ? `Must be at least ${sizedFields[tooSmallField].min} characters long`
        : `Must be at most ${sizedFields[tooLargeField].max} characters long`,
      location: tooSmallField || tooLargeField
    });
  }

  let { username, password } = req.body;
  // Username and password come in pre-trimmed, otherwise we throw an error
  // before this

  return User.find({ username })
    .count()
    .then(count => {
      if (count > 0) {
        // There is an existing user with the same username
        return Promise.reject({
          code: 422,
          reason: "ValidationError",
          message: "Username already taken",
          location: "username"
        });
      }
      // If there is no existing user, hash the password
      return User.hashPassword(password);
    })
    .then(hash => {
      return User.create({
        username,
        password: hash
      });
    })
    .then(user => {
      return res.status(201).json(user.serialize());
    })
    .catch(err => {
      // Forward validation errors on to the client, otherwise give a 500
      // error because something unexpected has happened
      if (err.reason === "ValidationError") {
        return res.status(err.code).json(err);
      }
      res.status(500).json({ code: 500, message: "Internal server error" });
    });
});

//single user
router.get("/:id", jsonParser, (req, res) => {
  User.findById(req.params.id)
    .then(user => {
      if (!user) {
        return res.status(404).end();
      }
      return res.status(200).json(user);
    })
    .catch(err => next(err));
});

//get user locations
router.get("/locations/:id", jsonParser, (req, res) => {
  User.findById(req.params.id)
    .then(user => {
      if (!user) {
        return res.status(404).end();
      }
      return res.status(200).json(user.locations);
    })
    .catch(err => next(err));
});

//add location
router.post("/newlocation/:id", jsonParser, (req, res) => {
  User.findByIdAndUpdate(
    req.params.id,
    { $push: { locations: { name: req.body.name } } },
    { new: true },
    function(err, newData) {
      if (err) {
        console.err(err);
      } else {
        res.send(newData);
      }
    }
  );
});

//delete location
router.delete("/deletelocation/:id", jsonParser, (req, res) => {
  User.findByIdAndUpdate(
    req.params.id,
    { $pull: { locations: { _id: req.body.locationId } } },
    { new: true },
    function(err, newData) {
      if (err) {
        console.log(err);
      } else {
        res.send(newData);
      }
    }
  );
});
//retrieve user preferences for imperial or metric
router.get("/metric/:id", jsonParser, (req, res) => {
  User.findById(req.params.id)
    .then(user => {
      if (!user) {
        return res.status(404).end();
      }
      return res.status(200).json(user.metric);
    })
    .catch(err => next(err));
});

//set user preferences for imperial or metric
router.put("/metric/:id", jsonParser, (req, res) => {
  User.findByIdAndUpdate(
    req.params.id,
    { $set: { metric: req.body.metric } },
    { new: true },
    function(err, newData) {
      if (err) {
        console.log(err);
      } else {
        res.send(newData);
      }
    }
  );
});

module.exports = { router };
