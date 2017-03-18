"use strict";

const QueueProcessor = require("../index");

const options = {
  // sqs queue endpoint url
  queueUrl: "****SQS-QUEUE-URL-HERE*****",
  // default region
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
    AttributeNames: null,
  },
  // optional Function onMessageParse(message) to parse an SQS message before
  // sending to "message" event
  onMessageParse: null,
};


const processor = new QueueProcessor(options);

// Event Fired on each message received
processor.on("message", (msg) => {
  // single SQS Message object
  console.log(msg.Body);
});

// Event fired when polling starts
processor.on("start", () => {
  console.log("Polling STARTED");
});

// Event fired when polling is halted
processor.on("stopped", () => {
  console.log("Polling has been stopped... lets wait 5 seconds");

  setTimeout(() => {
    // start the polling requests up again
    processor.start();
  }, 5000);
});

// Event fired before each polling request to SQS
processor.on("before_poll", () => {
  console.log("Polling for new data: ", new Date());
});

// Event fired on the completion of each polling response from SQS
processor.on("after_poll", () => {
  console.log("poll operation completed");

  // we can build custom logic to determine if we need to continue to poll
  // or stop the polling operation for a bit.
  processor.stop();
});

// Event fired with the number of messages received on last poll request (max 10)
// good event to keep a running total of messages processed
processor.on("messages_received_count", (count) => {
  console.log(`Total Messages Received on last poll: ${count}`);
});

// Event fired when an error occurs in the processor
processor.on("error", (err) => {
  console.log("Error Has Occurred: %j", err);
});


processor.start();
