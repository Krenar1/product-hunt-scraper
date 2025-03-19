const winston = require("winston")
const { format, transports } = winston

// Configure custom format
const customFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.printf((info) => `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`),
)

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: customFormat,
  transports: [
    // Write logs to console
    new transports.Console({
      format: format.combine(format.colorize(), customFormat),
    }),
    // Write logs to file
    new transports.File({
      filename: "error.log",
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: "combined.log",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [new transports.File({ filename: "exceptions.log" })],
})

// If we're not in production, also log to the console with simple format
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  )
}

module.exports = { logger }

