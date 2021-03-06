var md5 = require("md5")
var fs = require("fs").promises
var multer = require("multer")
var express = require("express")
var router = express.Router()
var ObjectId = require("mongodb").ObjectID
var common = require("../common")
var upload = multer({ dest: 'uploads/' })
const sharp = require('sharp')

router.get("/signin", function (req, res) {
	(async function() {
		let p = {usr_value: "", usr_err: "", pwd_err: ""}
		res.parts = {...res.parts, ...p}
		res.viewpath = './views/signin.html'
		await common.render(res)
	})()
})

router.post("/signin", function (req, res) {
	(async function() {
		let p = {usr_value: req.body.username, usr_err: "", pwd_err: ""}
		var query = {"username": req.body.username}
		var send_html = true, result = null
		try {
			result = await common.getDb().collection("users").findOne(query)
		} catch (err) {
			console.log("error")
		}
		if (result == null) {
			p["usr_err"] = "<span style='color:red'>Username not found</span>"
		} else {
			var dbhash = result["password"]
			var salt = dbhash.substring(0, 6)
			dbhash = dbhash.substring(6)
			var usrhash = md5(req.body.password + salt)
			if (dbhash == usrhash) {
				res.cookie('login', result["_id"], {maxAge: 3600000})
				if(result["role"]== "Admin"){
					res.redirect(302, '/admin')
				} else {
					res.redirect(302, '/teacher')
				}
				
				send_html = false
			} else {
				p["pwd_err"] = "<span style='color:red'>Password not correct</span>"
			}
		}
		if (send_html) {
			res.parts = {...res.parts, ...p}
			res.viewpath = './views/signin.html'
			await common.render(res)
		}
	})()
})

router.get("/homepage", function (req, res) {
	(async function() {		
		let tbtext = "", totalteacher="", totalClass="", totalRoom="";
		const result = await common.getDb().collection("schedules").find().toArray()
		totalTeacher = await common.getDb().collection("users").countDocuments()
		totalClass = await common.getDb().collection("classes").countDocuments()
		totalRoom = await common.getDb().collection("rooms").countDocuments()
		schoolSchedule = await common.getDb().collection("schedules").countDocuments()
		let stt = 1
		result.forEach(function (schedule) {
				tbtext = tbtext + "<tr>"
						+ "<td>" + schedule["teacher"] + "</td>"
						+ "<td>" + schedule["class"] + "</td>"
						+ "<td>" + schedule["room"] + "</td>"
						+ "<td>" + schedule["time"] + "</td>"
						+ "<td>" + schedule["date"] + "</td>"	
						+ "<td>" + schedule["status"] + "</td>"						
					+ "</tr>"
				stt++
		})
		let parts = {tb: tbtext, tt: totalTeacher, tc: totalClass, tr: totalRoom, ss: schoolSchedule}
		res.parts = {...res.parts, ...parts}
		res.viewpath = './views/index.html'
		await common.render(res)
	})()
})

router.get("/profile", function (req, res) {
	(async function() {
		let success = true
		var objUser
		if (req.user == undefined) {
			res.send("Cannot get user data!")
			return;
		} else {
			objUser = req.user
		}

		let p = {msg_style: "display:none;", userId: objUser["_id"], usr_value: objUser.username, phone_value: objUser.phone, email_value: objUser.email, usr_err: "Username must be from 4 - 32 characters", pwd_err: "Password must be 6 - 32 characters"}
		res.parts = {...res.parts, ...p}

		res.viewpath = './views/profile.html'
		
		await common.render(res)
	})()
})

router.post("/profile", upload.single('profile-pic'), function (req, res) {
	(async function() {
		let success = true
		var uid = req.cookies["login"]
		var oid = new ObjectId(uid)
		var query = {"_id": oid}
		objUser = null
		try {
			objUser = await common.getDb().collection("users").findOne(query)
		} catch (err) {
			console.log("error")
		}
		if (objUser == null) {
			res.send("User with id '" + uid + "' cannot be found!")
			return;
		}

		let parts = {msg_style: "display:none;", msg: "You successfully updated your profile", userId: uid, usr_value: req.body.username, phone_value: req.body.phone, email_value: req.body.email, usr_err: "Username must be from 4 - 32 characters", pwd_err: "Password must be 6 - 32 characters"}

		if (req.file != undefined) {
			var filename = objUser["username"] + ".jpg"
			await sharp(req.file.path)
			.resize(100, 100)
			.jpeg({ quality: 100, progressive: true })
			.toFile('public/profile_pics/' + filename)
			fs.unlink(req.file.path)
			objUser["avatar"] = 'profile_pics/' + filename
		}

		if (req.body.username.length < 4 || req.body.username.length > 32) {
			parts["usr_err"] = "<span style='color:red'>Username length is not valid</span>"
			success = false
		} else {
			var query = {"_id": {$ne: oid}, username: req.body.username}
			result = null
			try {
				result = await common.getDb().collection("users").findOne(query)
			} catch (err) {
				console.log("error")
			}
			if (result != null) {
				parts["usr_err"] = "<span style='color:red'>Username '" + req.body.username + "' has been used already</span>"
				success = false
			}
		}
		objUser["username"] = req.body.username
		objUser["phone"] = req.body.phone
		objUser["email"] = req.body.email
		if (req.body["password"] != "") {
			if (req.body["password"].length < 6 || req.body["password"].length > 32) {
				parts["pwd_err"] = "<span style='color:red'>Password length is not valid</span>"
				success = false
			} else {
				let salt = common.randStr(6)
				let dbhash = salt + md5(req.body["password"] + salt)
				objUser["password"] = dbhash
				parts["msg"] = "You successfully updated your profile and password"
			}
		}

		if (success) {
			var query = {"_id": oid}
			try {
				const result = await common.getDb().collection("users").updateOne(query, {$set: objUser})
				parts["msg_style"] = ""
			} catch (err) {
				console.log(err)
				res.send("500 error updating db")
				return;
			}
		}

		res.parts = {...res.parts, ...parts}
		res.viewpath = './views/profile.html'
		await common.render(res)
	})()
})

router.get("/teacher/profile", function (req, res) {
	(async function() {
		let success = true
		var objUser
		if (req.user == undefined) {
			res.send("Cannot get user data!")
			return;
		} else {
			objUser = req.user
		}

		let p = {msg_style: "display:none;", userId: objUser["_id"], usr_value: objUser.username, phone_value: objUser.phone, email_value: objUser.email, usr_err: "Username must be from 4 - 32 characters", pwd_err: "Password must be 6 - 32 characters"}
		res.parts = {...res.parts, ...p}

		res.viewpath = './views/teacher_profile.html'
		
		await common.render(res)
	})()
})

router.post("/teacher/profile", upload.single('profile-pic'), function (req, res) {
	(async function() {
		let success = true
		var uid = req.cookies["login"]
		var oid = new ObjectId(uid)
		var query = {"_id": oid}
		objUser = null
		try {
			objUser = await common.getDb().collection("users").findOne(query)
		} catch (err) {
			console.log("error")
		}
		if (objUser == null) {
			res.send("User with id '" + uid + "' cannot be found!")
			return;
		}

		let parts = {msg_style: "display:none;", msg: "You successfully updated your profile", userId: uid, usr_value: req.body.username, phone_value: req.body.phone, email_value: req.body.email, usr_err: "Username must be from 4 - 32 characters", pwd_err: "Password must be 6 - 32 characters"}

		if (req.file != undefined) {
			var filename = objUser["username"] + ".jpg"
			await sharp(req.file.path)
			.resize(100, 100)
			.jpeg({ quality: 100, progressive: true })
			.toFile('public/profile_pics/' + filename)
			fs.unlink(req.file.path)
			objUser["avatar"] = 'profile_pics/' + filename
		}

		if (req.body.username.length < 4 || req.body.username.length > 32) {
			parts["usr_err"] = "<span style='color:red'>Username length is not valid</span>"
			success = false
		} else {
			var query = {"_id": {$ne: oid}, username: req.body.username}
			result = null
			try {
				result = await common.getDb().collection("users").findOne(query)
			} catch (err) {
				console.log("error")
			}
			if (result != null) {
				parts["usr_err"] = "<span style='color:red'>Username '" + req.body.username + "' has been used already</span>"
				success = false
			}
		}
		objUser["username"] = req.body.username
		objUser["phone"] = req.body.phone
		objUser["email"] = req.body.email
		if (req.body["password"] != "") {
			if (req.body["password"].length < 6 || req.body["password"].length > 32) {
				parts["pwd_err"] = "<span style='color:red'>Password length is not valid</span>"
				success = false
			} else {
				let salt = common.randStr(6)
				let dbhash = salt + md5(req.body["password"] + salt)
				objUser["password"] = dbhash
				parts["msg"] = "You successfully updated your profile and password"
			}
		}

		if (success) {
			var query = {"_id": oid}
			try {
				const result = await common.getDb().collection("users").updateOne(query, {$set: objUser})
				parts["msg_style"] = ""
			} catch (err) {
				console.log(err)
				res.send("500 error updating db")
				return;
			}
		}

		res.parts = {...res.parts, ...parts}
		res.viewpath = './views/teacher_profile.html'
		await common.render(res)
	})()
})

router.get("/signout", function (req, res) {
	res.clearCookie('login')
	res.redirect(302, "/signin")
})

module.exports = router