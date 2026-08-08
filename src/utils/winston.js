import winston from 'winston';
const { combine, timestamp, printf, json, prettyPrint, errors } = winston.format;
import winstonRotate from 'winston-daily-rotate-file';

export const consoleLogger = winston.createLogger({
    level: 'info',
    format: winston.format.cli(),
    transports: [
        new winston.transports.Console(),
    ]
});

export const logger = winston.createLogger({       
    level: 'info', 
    format: combine(
        errors({stack:true}),
        timestamp(),
        json(),
        prettyPrint()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Add file transport ONLY in production
if (process.env.NODE_ENV === 'production') {
    logger.add(new winstonRotate({
        filename: "logger-%DATE%.log",
        frequency: "1d",
        datePattern: "YYYY-MM-DD",
        maxFiles: "14d", // Keep logs for 14 days
        dirname : "loggers"
    }));
}
