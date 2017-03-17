# sqs-queue-processor
Event based SQS Queue processor. This library allows you to easily control the flow of data out of your SQS Queues based on your expected requirements. Will perform 'Long Polling' on the SQS queue.

## Installation

```bash
npm install sqs-queue-processor --save
```

## Usage

```js
const QueueProcessor = require('sqs-queue-processor');

const options = {
  // REQUIRED: sqs queue endpoint url
  queueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MyQueueUrl"
};

const processor = new QueueProcessor(options);

// Event Fired on each message received from SQS Polling
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



// Example of all the available options to pass to the Queue Processor
const fullOptionsExample = {
  // REQUIRED: sqs queue endpoint url
  queueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MyQueueUrl",
  // OPTIONAL: default region
  awsRegion: "us-east-1",
  // OPTIONAL: if awsAccessKeyId and awsSecretAccessKey are not supplied IAM role / credentials file is used
  awsAccessKeyId: null,
  awsSecretAccessKey: null,

  // OPTIONAL: parameters to add to the sqs.receiveMessage call
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
  // OPTIONAL: Function onMessageParse(message) to parse an SQS message before
  // sending to "message" event. Ideal for doing JSON.parse on the message.Body for example.
  onMessageParse: null
};

```

## API

### `new QueueProcessor(options)`

Creates a new SQS Queue Processor.

### `queueProcessor.start()`

Start polling the configured queue for new messages.

### `queueProcessor.stop()`

Stop polling for new message


## Options

```js
// Example of all the available options to pass to the Queue Processor
const fullOptionsExample = {
  // REQUIRED: sqs queue endpoint url
  queueUrl: "https://sqs.us-east-1.amazonaws.com/12345678910/MyQueueUrl",
  // OPTIONAL: default region
  awsRegion: "us-east-1",
  // OPTIONAL: if awsAccessKeyId and awsSecretAccessKey are not supplied IAM role / credentials file is used
  awsAccessKeyId: null,
  awsSecretAccessKey: null,

  // OPTIONAL: parameters to add to the sqs.receiveMessage call
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
  // OPTIONAL: Function onMessageParse(message) to parse an SQS message before
  // sending to "message" event. Ideal for doing JSON.parse on the message.Body for example.
  onMessageParse: function(message){
      // Example of how you can parse message body data as JSON before returning.
      // Assumes your body is always a valid JSON object
      var parsedMessage = message;
      parsedMessage.BodyJSON = JSON.parse(message.Body);
      return parsedMessage;
  }
};

```

### Events

|Event|Params|Description|
|-----|------|-----------|
|`message`|`message`|Fired on each message received from SQS Polling. If a onMessageParse function is defined the message will be processed by that function before this event is fired.|
|`start`|None|Fired each time polling starts by calling start().|
|`stopped`|None|Fired each time polling is stopped by calling stop().|
|`before_poll`|None|Fired before each polling operation is sent to SQS.|
|`after_poll`|None|Fired after the polling operation is complete.|
|`messages_received_count`|`count`|Fired after poll is complete with the total number of messages received.|
|`error`|`err`|Fired when an error occurs in the processor. Contains the error object received.|
|`messages_deleted`|`data`|Fired after completion of a batch delete messages call from SQS.|