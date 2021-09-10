export const environment = {
  /**
   * Identify itself. Current MicroService Name and ID in Database
   */
  service: {
    _id: 'BILLING_MANAGER',
    name: 'billing-manager',
    url: '/billing-manager',
    description: 'billing-manager',
    serviceType: 'any',
    envStatus: 'ALPHA',
    iconClass: 'fa fa-comments'
  },
  /**
   * App running port
   */
  port: process.env.PORT || 3000,
  /**
   * App environment
   */
  production: false,
  /**
   * Logger
   */
  log: {
    format: process.env.LOG_FORMAT || 'combined',
    fileLogger: {
      level: 'debug',
      directoryPath: process.env.LOG_DIR_PATH || (process.cwd() + '/logs/'),
      fileName: process.env.LOG_FILE || 'app.log',
      maxsize: 10485760,
      maxFiles: 2,
      json: false
    }
  },
  /**
   * Database connection information
   */
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost/isabel'
  },
  mailer: {
    host: 'localhost',
    port: '2525',
    from: '"DEV Isabel - FedoraLabs" <no-reply@testingdomain.io>',
    auth: {
      user: process.env.MAILER_EMAIL_ID || 'testuser',
      pass: process.env.MAILER_PASSWORD || '9j8js7pi37a4'
    },
    tls: {
      rejectUnauthorized: false
    }
  },
  authURI: `https://dev.aitheon.com/auth`,
  rabbitmq: {
    uri: process.env.RABBITMQ_URI || `amqp://ai-rabbit:Ne&ZTeFeYCqqQRK3s7qF@localhost:5672`
  },
  billingIntervalSeconds: 900,
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379
  }
};
