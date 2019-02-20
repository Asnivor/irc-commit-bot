const log4js = require("log4js");
const log = log4js.getLogger();

function logger() {

    log.info("Logger Initialized");
}

logger.prototype.info = function(text, message) {
    if (message) {
        log.info(text, message);
    }
    else {
        log.info(text);
    }
};

logger.prototype.debug = function(text, message) {
    if (message) {
        log.debug(text, message);
    }
    else {
        log.debug(text);
    }
};

logger.prototype.warn = function(text, message) {
    if (message) {
        log.warn(text, message);
    }
    else {
        log.warn(text);
    }
};

module.exports = new logger();