"use strict";

const AWS = require("aws-sdk");
const async = require("async");
const EventEmitter = require("events").EventEmitter;

let SQS = null;
const defaultOptions = {
  queueUrl: null,
  awsRegion: "us-east-1",
  // if awsAccessKeyId and awsSecretAccessKey are not supplied IAM role / credentials file is used
  awsAccessKeyId: null,
  awsSecretAccessKey: null,

  // parameters to add to the sqs.receiveMessage call
  sqsReceiveSettings: {
    // The maximum number of messages to return. Amazon SQS never returns more messages
    // than this value (however, fewer messages might be returned). Valid values are 1 to 10.
    MaxNumberOfMessages: 10,
    // The duration (in seconds) that the received messages are hidden from subsequent
    // retrieve requests after being retrieved by a ReceiveMessage request.
    VisibilityTimeout: 30,
    // The duration (in seconds) for which the call waits for a message to arrive in
    // the queue before returning. If a message is available, the call returns sooner than
    WaitTimeSeconds: 20,
    // (Array<String>) List of message attribute names to retrieve
    MessageAttributeNames: null,
    // (Array<String>) A list of attributes that need to be returned along with each message.
    AttributeNames: null
  },
  // optional Function onMessageParse(message) to parse an SQS message before
  // sending to "message" event
  onMessageParse: null
};

/**
 * Ensures the options passed into the constructor are valid
 * This function will throw errors in { messsage: "error"} format
 * @param {any} opts
 */
function validateOptions(opts) {
  if (!opts.queueUrl) {
    const error = { message: "queueUrl is required" };
    throw error;
  }

  if (!opts.awsRegion) {
    const error = { message: "awsRegion is required. Default is us-east-1" };
    throw error;
  }

  if (opts.sqsReceiveSettings.MaxNumberOfMessages < 1 || opts.sqsReceiveSettings.MaxNumberOfMessages > 10) {
    const error = { message: "sqsReceiveSettings.MaxNumberOfMessages is required. Must be between 1 and 10. Default 10." };
    throw error;
  }

  if (opts.sqsReceiveSettings.WaitTimeSeconds > 20) {
    const error = { message: "sqsReceiveSettings.WaitTimeSeconds. Must be less <= 20. Default 20." };
    throw error;
  }
}

/**
 * This function will configure the AWS node module if AWS credentials are provided
 *
 * @param {any} opts
 */
function configureAWS(opts) {
  if (opts.awsAccessKeyId != null && opts.awsSecretAccessKey != null) {
    // if access key and secret are provided assume we are not using IAM credentials
    AWS.config.update({
      region: opts.awsRegion,
      accessKeyId: opts.awsAccessKeyId,
      secretAccessKey: opts.awsSecretAccessKey
    });
  }

  if (opts.sqs) {
    SQS = opts.sqs;
  } else {
    SQS = new AWS.SQS({ region: opts.awsRegion });
  }
}

/**
 * Will perform a receive message operation on SQS Queue given the given params
 *
 * @param {any} params - sqs receive message parameters
 * @returns SQS Response from receive message
 */
function getSQSMessages(params) {
  return new Promise((resolve, reject) => {
    SQS.receiveMessage(params, (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
}

/**
 * SQS Queue Poller class
 *
 * @class Poller
 * @extends {EventEmitter}
 */
class Poller extends EventEmitter {
  constructor(params) {
    super();

    const options = Object.assign({}, defaultOptions, params);
    this.pollingActive = false;

    validateOptions(options);
    configureAWS(options);

    this._pollParameters = Object.assign({
      QueueUrl: options.queueUrl
    }, options.sqsReceiveSettings);

    this._options = options;
  }

  /**
   * The parameters to use when polling SQS
   *
   * @readonly
   *
   * @memberOf Poller
   */
  get pollParameters() {
    return this._pollParameters;
  }

  /**
   * Current SQS Queue Processor Settings
   *
   * @readonly
   *
   * @memberOf Poller
   */
  get options() {
    return this._options;
  }

  /**
   * Initialize the SQS queue processor and begin polling
   *
   *
   * @memberOf Poller
   */
  start() {
    if (!this.pollingActive) {
      this.pollingActive = true;
      this.emit("start");
      this._poll();
    }
  }

  stop() {
    this.pollingActive = false;
    this.emit("stopped");
  }

  /**
   * Poll for new SQS queue data if possible
   *
   *
   * @memberOf Poller
   */
  _poll() {
    this.emit("before_poll");
    getSQSMessages(this.pollParameters)
      .then(data => this._processMessages(data))
      .catch((err) => {
        this.emit("error", err);
      })
      .then(() => {
        // Finally
        this.emit("after_poll");

        // check if we continue to poll or not
        if (this.pollingActive) {
          this._poll();
        }
      });
  }


  /**
   * process the incoming sqs data
   *
   * @param {any} data
   *
   * @memberOf Poller
   */
  _processMessages(data) {
    return new Promise((resolve, reject) => {
      if (data && data.Messages && data.Messages.length > 0) {
        async.each(data.Messages, (message, done) => {
          this._emitMessage(message);
          done();
        }, () => {
          this._deleteMessages(data.Messages).then(() => {
            this.emit("messages_received_count", data.Messages.length);
            resolve();
          }).catch((deleteErr) => {
            reject(deleteErr);
          });
        });
      } else {
        // no messages
        resolve();
      }
    });
  }

  /**
   * emit the message to the event emitter
   *
   * @param {any} message
   *
   * @memberOf Poller
   */
  _emitMessage(message) {
    if (typeof this.options.onMessageParse === "function") {
      // call the supplied onMessageParse function to do preprocessing of the message.
      // for example: JSON.parse() message.Body
      this.emit("message", this.options.onMessageParse(message));
    } else {
      this.emit("message", message);
    }
  }

  /**
   * Batch Delete Messages in SQS
   *
   * @param {any} receiptHandleArray
   * @returns Promise
   *
   * @memberOf Poller
   */
  _deleteMessages(messages) {
    return new Promise((resolve, reject) => {
      if (!messages || messages.length === 0) {
        resolve(null);
      }

      const params = {
        Entries: [],
        QueueUrl: this.options.queueUrl
      };

      // build the batch delete params
      messages.forEach((msg) => {
        params.Entries.push({ Id: msg.MessageId, ReceiptHandle: msg.ReceiptHandle });
      });

      // Batch delete the messages from the sqs queue
      SQS.deleteMessageBatch(params, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);

        this.emit("messages_deleted", data);
      });
    });
  }
}

module.exports = Poller;
