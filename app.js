require('dotenv').config();
const express = require('express');
const { body, validationResult } = require('express-validator');
const app = express();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { MongoClient, ObjectID } = require('mongodb');

const uri = `mongodb+srv://ninjavin:${process.env.DB_PASSWORD}@cluster0.mueth.mongodb.net/<dbname>?retryWrites=true&w=majority`;
const databaseName = "tif";

let userCollection;
let schoolCollection;

MongoClient.connect(uri, {useNewUrlParser: true, useUnifiedTopology: true}, (error, client) => {
	if (error)
		throw error;

	const database = client.db(databaseName);

	userCollection = database.collection('users');
	schoolCollection = database.collection('schools');
	console.log(`Connected to MongoDB Successfully!`);

})

// Random Id Generation function for the School Public Id Field
generatePublicId = () => {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const string_length = 4;
	let randomstring = "SCH-";
	for (let i=0; i<string_length; i++) {
		let rnum = Math.floor(Math.random() * chars.length);
		randomstring += chars.substring(rnum,rnum+1);
	}
	return randomstring;
}

app.use(express.json());

// User Signup Endpoint. Works fine.
app.post('/user/signup',
	body('first_name').exists().trim().escape().notEmpty(),
	body('last_name').exists().trim().escape().notEmpty(),
	body('mobile').notEmpty(),
	body('email').isEmail().notEmpty(), 
	body('password').isLength({ min: 5 }).notEmpty(), 
	
	(req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ 
				"status": false,
				"errors":[
					{
						"message": "Something went wrong.",
						"errors": errors
					}
				]
			});
		} else {
			userCollection.findOne({ email: req.body.email }).then(result => {
				if (result) {
					return res.status(400).json({
						message: "User already exists"
					})
				} else {
					bcrypt.hash(req.body.password, 5, (err, hash) => {
						if (err) {
							return res.status(501).json({
								error: err
							})
						} else {
							const userDocument = {
								_id: new ObjectID,
								first_name: req.body.first_name,
								last_name: req.body.last_name,
								email: req.body.email,
								mobile: req.body.mobile,
								password: hash,
								created: Date.now(),
								schoolId: new ObjectID,
								updated: null
							}
							userCollection.insertOne(userDocument).then(result => {
								const payload = {
									"user":{
										"_id": userDocument._id,
										"first_name": userDocument.first_name,
										"last_name": userDocument.last_name,
										"email": userDocument.email,
										"mobile": userDocument.mobile,
										"created": userDocument.created,
										"updated": null
									}
								}
								
								const token = jwt.sign(payload, "secret", {
									expiresIn: "1h"
								});
				
								return res.status(201).json({
									"status": "true",
									"token" : token
								})
							}).catch(err => {
								return res.status(501).json({
									"status":false,
									"errors":[
										{
											"message": `Something went wrong.`
										}
									]
								})
							});
						}
					})
				}
			});
		}
})

// User Signin Endpoint. Works fine.
app.post('/user/signin', 
	body('email').isEmail().notEmpty(),
	body('password').notEmpty(),
	(req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	} else {
		const email = req.body.email;
		userCollection.findOne({ email: email}).then(result => {
			if (!result) {
				return res.status(409).json({
					message: "User doesn't exist"
				})
			} else {
				bcrypt.compare(req.body.password, result.password, (error, result2) => {
					if (error) {
						return res.status(401).json({
							"status":false,
							"errors":[
								{
									"message": `Something went wrong.`
								}
							]
						})
					} else if (result2) {
						const token = jwt.sign({ email: result.email }, "secret", { expiresIn: "1h" });
						return res.status(200).json({
							"status": "false",
							"content": {
								"data": {
									"_id": result._id,
									"first_name": result.first_name,
									"last_name": result.last_name,
									"email": result.email,
									"mobile": result.mobile,
									"created": result.created,
									"updated": result.updated
								},
								"token": token
							}
						})
					} else {
						return res.status(401).json({
							message: "Password Incorrect",
							"status":false,
							"errors":[
								{
									"message": `Something went wrong.`
								}
							]
						})
					}
				})
			}
		}).catch(err => {
				return res.status(500).json({
					"status":false,
					"errors":[
						{
							"message": `Something went wrong.`
						}
					]
				})
			}
		)
	}
})

// Get list of users endpoint. Works fine.
app.get('/user/get', (req, res) => {
	userCollection.find().toArray().then(users => {
		return res.status(200).json({
			"status": true,
			"content" : {
				"data": users.map(user => {
					return {
						"_id": user._id,
						"first_name": user.first_name,
						"last_name": user.last_name,
						"email": user.email,
						"mobile": user.mobile,
						"created": user.created,
						"updated": user.updated
					}
				})
			}
		})
	}).catch(err => {
		return res.status(501).json({
			"status":false,
			"errors":[
				{
					"message": `Something went wrong.`
				}
			]
		})
	})
})

// Update user endpoint. Works fine.
app.patch('/user/:id', (req, res) => {
	const schoolId = req.body.schoolId;
	userCollection.updateOne({_id: req.params._id}, {"$set": {"schoolId": schoolId, "updated": Date.now() }}).then(result => {
		return res.status(201).json({
			"status": "true"
		})
	}).catch(err => {
		return res.status(501).json({
			"status":false,
    	"errors":[
				{
					"message": "Something went wrong."
				}
			]
		})
	})
})

// Get Schools Endpoint. Works fine.
app.get('/school/get', (req, res) => {
	schoolCollection.find().toArray().then(schools => {
		return res.status(200).json({
			"status": true,
			"content" : {
				"data": schools.map(school => {
					return {
						"_id": school._id,
						"public_id": school.public_id,
						"name": school.name,
						"city": school.city,
						"state": school.state,
						"country": school.country,
						"created": school.created,
						"updated": school.updated
					}
				})
			}
		})
	}).catch(err => {
		return res.status(501).json({
			"status":false,
			"errors":[
				{
					"message": `Something went wrong.`
				}
			]
		})
	})
})

// Get students by school id. :(
app.get('/school/:_id/students', (req, res) => {
	userCollection.find({"schoolId": req.params._id}).toArray().then(users => {
		return res.status(200).json({
			"status": "true",
			"content" : {
				"data": users.map(user => {
					return {
						"_id": user._id,
						"first_name": user.first_name,
						"last_name": user.last_name,
						"email": user.email,
						"mobile": user.mobile,
						"created": user.created,
						"updated": user.updated
					}
				})
			}
		})
	}).catch(err => {
		return res.status(501).json({
			"status":false,
			"errors":[
				{
					"message": `Something went wrong.`
				}
			]
		})		
	})
})

// Post School endpoint. Works fine.
app.post('/school/:_id',
	body('name').trim().escape().notEmpty(),
	body('city').trim().escape().notEmpty(),
	body('state').trim().escape().notEmpty(),
	body('country').trim().escape().notEmpty(),
(req, res) => {
	const schoolDocument = {
		_id: new ObjectID(req.params._id),
		public_id: generatePublicId(),
		name: req.body.name,
		city: req.body.city,
		state: req.body.state,
		country: req.body.country,
		created: Date.now(),
		updated: null
	}

	console.log(schoolDocument._id);

	schoolCollection.insertOne(schoolDocument).then(result => {
		return res.status(201).json({
			"status": "true"
		})
	}).catch(err => {
		return res.status(501).json({
			"status":false,
			"errors":[
				{
					"message": "Something went wrong."
				}
			]
		})
	})
})

// Default Route
app.use('/', (req, res) => {
	res.status(201).json({
		"message": "Server is up and running!"
	})
})

module.exports = app;
