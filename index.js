const express      = require("express");
const fs           = require("fs");
const scheduler    = require('node-schedule');
const opn          = require('opn');
const puppeteer    = require('puppeteer');
const bodyParser   = require('body-parser');
const querystring  = require('querystring');
const path         = require('path');
const usersDetails = require("./userDetails");
const port         = process.env.PORT || 3128 || 8080;
app = express();

var userConfig  = {
	details : {}
};
var logEntries = [];

const gotoQuikChex = async (_isCheckIn) => {
	try{
		const browser = await puppeteer.launch(	{headless: false});
		const page = await browser.newPage();
		await _isCheckIn ? console.log("Opening quickchex for checkin...") : console.log("Opening quickchex for checkout...");
		await page.goto('https://secure.quikchex.in/users/sign_in', { waitUntil: 'networkidle0' }); // wait until page load
		await page.type('#user_email', userConfig.details.email);
		await page.type('#user_password', userConfig.details.password);
		await page.click('.btn.btn-primary.pull-right');
		await page.waitForNavigation({ waitUntil: 'networkidle0' });
		await page.click('a#checkin');	
		await browser.close();
		await _isCheckIn ? console.log("CheckIn Done Successfully...") : console.log("CheckIOut Done Successfully...");
	}
	catch(ex){
		console.log(ex);
		makeLogEntry(ex);
	}
};

function validateEmail(email) { 
	var isValid = false;
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(re.test(email)){
        if(email.indexOf("@codifyd.com", email.length - "@codifyd.com".length) !== -1){
            isValid = true;
        }
    }
    return isValid;
}

function validateHhMm(_field) {
    var isValid = /^([0-1]?[0-9]|2[0-4]):([0-5][0-9])(:[0-5][0-9])?$/.test(_field);
    return isValid;
}

function isNotBlank(_field){
	return _field != '';
}

function verifyAllFields(){
	var isValid = true;

	// validate email
	if(isNotBlank(userConfig.details.email)){
		if(userConfig.details.email == "YOUR_CODIFYD_EMAIL"){
			makeLogEntry("Provide a valid email address...");
			isValid = false;
		}else{
			if(!validateEmail(userConfig.details.email)){
				makeLogEntry("Provided Email is not a valid codifyd email address...");
				isValid = false;
			}
		}
	}else{
		makeLogEntry("Provide a valid email address...");
		isValid = false;
	}

	// validate password
	if(isNotBlank(userConfig.details.password)){
		if(userConfig.details.password == "YOUR_QUIKCHEX_PASSWORD"){
			makeLogEntry("Provide a quickchex account password...");
			isValid = false;
		}
	}else{
		makeLogEntry("Provide a quickchex account password...");
		isValid = false;
	}

	// validate checkInTime
	if(isNotBlank(userConfig.details.checkInTime)){
		if(userConfig.details.checkInTime == "CHECK_IN_TIME"){
			makeLogEntry("Provide a valid check in time in format HH:MM ...");
			isValid = false;
		}else{
			if(!validateHhMm(userConfig.details.checkInTime)){
				makeLogEntry("Provide a valid check in time in format HH:MM ...");
				isValid = false;
			}
		}
	}else{
		makeLogEntry("Provide a valid check in time in format HH:MM ...");
		isValid = false;
	}

	// validate checkOutTime
	if(isNotBlank(userConfig.details.checkOutTime)){
		if(userConfig.details.password == "CHECK_OUT_TIME"){
			makeLogEntry("Provide a valid check out time in format HH:MM ...");
			isValid = false;
		}else{
			if(!validateHhMm(userConfig.details.checkOutTime)){
				makeLogEntry("Provide a valid check out time in format HH:MM ...");
				isValid = false;
			}
		}
	}else{
		makeLogEntry("Provide a valid check out time in format HH:MM ...");
		isValid = false;
	}
	return isValid;
}

var getUserDetails = function(){
	userConfig.details = usersDetails;
    if(verifyAllFields()){
    	makeLogEntry("User Details Fetched....");
	    if(isNotBlank(userConfig.details.email) && isNotBlank(userConfig.details.password)){
	    	if(validateEmail(userConfig.details.email)){
	    		startSchedulers();
	    	}else{
	    		makeLogEntry("Provided Email is not a valid codifyd email");
	    	}
	    }else{
	    	makeLogEntry("User Email / Password details is missing");
	    }
    }
};

var startSchedulers = function(){
	var rule    = new scheduler.RecurrenceRule();
		rule.hour      = 9;
		rule.minute    = 0;
		rule.dayOfWeek = [1, 2, 3, 4, 5];
	if(isNotBlank(userConfig.details.checkInTime)){
		rule.hour      = userConfig.details.checkInTime.split(':')[0];
		rule.minute    = userConfig.details.checkInTime.split(':')[1];
		// scheduler.scheduleJob(rule, function(){
		// 	gotoQuikChex(true);
		// });
		scheduler.scheduleJob("*/1 * * * *", function(){
		 	gotoQuikChex(true);
		});
	}
	if(isNotBlank(userConfig.details.checkOutTime)){
		rule.hour      = userConfig.details.checkOutTime.split(':')[0];
		rule.minute    = userConfig.details.checkOutTime.split(':')[1];
		scheduler.scheduleJob(rule, function(){
			gotoQuikChex(false);
		});
	}
	scheduler.scheduleJob("00 00 24 * * 1-5", function(){
		makeLogsDayWise();
	});
};

var makeLogEntry = function(_msg){
	logEntries.push({
		time  : new Date().toString(),
		entry : _msg.toString()
	});
};

var writeLogEntry = function(_msg){
	fs.readFile('logs.json', function readFileCallback(err, data){
	    if (err){
	        console.log(err);
	    } else {
		    obj = JSON.parse(data);
		    obj.table.push({
	    		time  : new Date().toString(),
	    		entry : _msg.toString()
	    	});
		    fs.writeFile('logs.json', JSON.stringify(obj, null, 4), function(){

		    });
		}
	});
};

var makeLogsDayWise = function(){
	fs.readFile('logs.json', function readFileCallback(err, data){
	    if (err){
	        console.log(err);
	    } else {
		    obj = JSON.parse(data);
		    for(var i = 0; i < logEntries.length - 1; i++){
		    	obj.table.push({
		    		time  : logEntries['time'],
		    		entry : logEntries['entry']
		    	});
		    }
		    fs.writeFile('logs.json', JSON.stringify(obj, null, 4), function(){

		    });
		}
	});
};

app.listen(port, function (){
	writeLogEntry("App Started....");
	getUserDetails();
});