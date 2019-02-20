const express = require("express");
const body_parser = require("body-parser");
const sha1 = require('js-sha1');
const github_api_parser = require('./modules/github_api_parser');
const gitlab_api_parser = require('./modules/gitlab_api_parser');
const config = require('./modules/configuration');
const logger = require('./modules/logger');
const bot = require('./modules/bot');

logger.info("GitBot is starting....");

// allow integration with third-party port services
if (process.env.PORT) {
    config.set('port', process.env.PORT);
    logger.info(config.get('port'));
}

const app = express();
const jp = body_parser.json()

// ----------------------------------
// ROUTES
// ----------------------------------

// default route
app.get("/", function(req, res){
    res.send("ww");
});

// github/gitlap API endpoint route
app.post("/git.json", jp, function (req, res) {

    if (!req.body) return res.sendStatus(400)

    if (req.headers["x-github-event"]) {
        logger.info("Incoming WebHook from GitHub");
    }
    else if (req.headers["x-gitlab-event"]) {
        logger.info("Incoming WebHook from GitLab");
    }
    else {
        logger.info("Unidentified POST received - dropping");
        return res.sendStatus(400)
    }

    if (bot.BotStatus() == true) {
		logger.info("Calling handleAPI - bot already joined");
        handleAPI(req, res);
    } else {
		logger.info("Doing callbacks - bot not joined");
        bot.joinCallbacks.push(function() {
            handleAPI(req, res);
        });	
    }

    res.sendStatus(200);
    res.end();
});


function handleAPI(req, res) {
    logger.info("API Handler Running");

    // debug
    for (var channel of bot.Channels()) {
        //bot.say(channel, "DEBUG: " + req.headers["x-github-event"] + " : " + req.body["action"] + " : " + req.body["ref_type"] + " : " + req.body["ref"]);
    }

    if (req.headers["x-gitlab-event"] != null) {
        gitlab_api_parser(req, res);
    }
    else if (req.headers["x-github-event"]) {
        var resArr = github_api_parser.handle_github(req);
        if (resArr) {
            for (var channel of bot.Channels()) {
                for (var r of resArr) {
                    bot.say(channel, r);
                }
            }

            for (var r of resArr) {
                logger.info(r);
            }
        }
    }
};

app.listen(config.get('port'));
logger.info("listening on port " + config.get('port'));
