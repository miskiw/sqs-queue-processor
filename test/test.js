"use strict";

const QueueProcessor = require("..");
const describe = require("mocha").describe;
const beforeEach = require("mocha").beforeEach;
const it = require("mocha").it;

const assert = require("assert");
const sinon = require("sinon");
const should = require("should");

describe("Queue Processor", () => {
  let queueProcessor;
  let sqs;
  const response = {
    Messages: [{
      ReceiptHandle: `receipt-handle-${new Date().getTime()}`,
      MessageId: new Date().getTime().toString(),
      Body: "{\"message\": \"Message Body\"}",
    }],
  };

  beforeEach(() => {
    sqs = sinon.mock();
    sqs.receiveMessage = sinon.stub().yieldsAsync(null, response);
    sqs.receiveMessage.onSecondCall().returns();
    sqs.deleteMessageBatch = sinon.stub().yieldsAsync(null);
    sqs._deleteMessageBatch = sinon.stub().yieldsAsync(null);
    queueProcessor = new QueueProcessor({
      queueUrl: "http://sqs.something.com",
      sqs,
    });
  });

  it("requires a queueUrl to be set", () => {
    assert.throws(() => {
      new QueueProcessor({});
    });
  });

  it("requires a region to be set", () => {
    assert.throws(() => {
      new QueueProcessor({ queueUrl: "testurl", awsRegion: null });
    });
  });

  it("test aws access key configuration", () => {
    const accessKey = "accessKey";
    const secretKey = "secretKey";
    const processor = new QueueProcessor({ queueUrl: "testurl", awsRegion: "us-east-1", awsAccessKeyId: accessKey, awsSecretAccessKey: secretKey });

    processor.should.have.property("options");
    processor.options.should.have.property("awsAccessKeyId").eql(accessKey);
    processor.options.should.have.property("awsSecretAccessKey").eql(secretKey);
  });

  it("requires a WaitTimeSeconds between 0 - 20", () => {
    assert.throws(() => {
      new QueueProcessor({
        queueUrl: "testurl",
        sqsReceiveSettings: {
          WaitTimeSeconds: 21,
        },
      });
    });
  });

  it("requires a MaxNumberOfMessages between 1-10 - upper", () => {
    assert.throws(() => {
      new QueueProcessor({
        queueUrl: "testurl",
        sqsReceiveSettings: {
          MaxNumberOfMessages: 11,
        },
      });
    });
  });

  it("requires a MaxNumberOfMessages between 1-10 - lower", () => {
    assert.throws(() => {
      new QueueProcessor({
        queueUrl: "testurl",
        sqsReceiveSettings: {
          MaxNumberOfMessages: 0,
        },
      });
    });
  });

  describe("Create", () => {
    it("creates a new instance of a QueueProcessor object", () => {
      const processor = new QueueProcessor({
        queueUrl: "some-queue-url",
      });

      assert(processor instanceof QueueProcessor);
    });
  });

  describe("Events", () => {
    it("fire start event", (done) => {
      queueProcessor.on("start", () => {
        done();
      });

      queueProcessor.start();
    });

    it("fire stopped event", (done) => {
      queueProcessor.on("stopped", () => {
        done();
      });

      queueProcessor.start();
      queueProcessor.stop();
    });

    it("SQS receives an error", (done) => {
      const receiveErr = new Error("Receive error");

      sqs.receiveMessage.yields(receiveErr);

      queueProcessor.on("error", (err) => {
        should.exist(err);
        err.should.eql(receiveErr);

        done();
      });

      queueProcessor.start();
    });

    it("fire message event", (done) => {
      queueProcessor.on("message", (msg) => {
        msg.should.have.property("Body");
        done();
      });

      queueProcessor.start();
    });

    it("fire before_poll event", (done) => {
      queueProcessor.on("before_poll", () => {
        queueProcessor.stop();
        done();
      });

      queueProcessor.start();
    });

    it("fire after_poll event", (done) => {
      let tester = false;
      queueProcessor.on("before_poll", () => {
        tester = true;
      });

      queueProcessor.on("after_poll", () => {
        tester.should.eql(true);
        queueProcessor.stop();
        done();
      });

      queueProcessor.start();
    });

    it("fire messages_received_count event", (done) => {
      queueProcessor.on("messages_received_count", (count) => {
        count.should.eql(1);
        done();
      });

      queueProcessor.start();
    });

    it("fire messages_deleted event", (done) => {
      queueProcessor.on("messages_deleted", () => {
        done();
      });

      queueProcessor.start();
    });

    it("fire message event", (done) => {
      queueProcessor = new QueueProcessor({
        queueUrl: "http://sqs.something.com",
        sqs,
        onMessageParse(message) {
          message.JSONBody = JSON.parse(message.Body);
          return message;
        },
      });


      queueProcessor.on("message", (msg) => {
        msg.should.have.property("Body");
        msg.should.have.property("JSONBody");
        (typeof msg.JSONBody).should.eql("object");
        msg.JSONBody.should.have.property("message").eql("Message Body");


        done();
      });

      queueProcessor.start();
    });
  });

  describe("Error states", () => {
    it("delete message error", (done) => {
      const deleteErr = new Error("Delete error");

      sqs.deleteMessageBatch.yields(deleteErr);

      queueProcessor.on("error", (err) => {
        should.exist(err);
        err.should.have.property("message").eql("Delete error");
        done();
      });

      queueProcessor.start();
    });

    it("No Message Result", (done) => {
      const responseNoMessages = {
        Messages: [],
      };
      sqs.receiveMessage = sinon.stub().yieldsAsync(null, responseNoMessages);

      queueProcessor.on("message", (msg) => {
        // should not get a response here
        assert.fail(msg, "null");
        done();
      });

      queueProcessor.on("after_poll", () => {
        queueProcessor.stop();
        done();
      });

      queueProcessor.start();
    });

    it("Call start() multiple times", (done) => {
      let startEventCounter = 0;
      queueProcessor.on("start", (err) => {
        startEventCounter += 1;
      });
      queueProcessor.on("stopped", (err) => {
        startEventCounter.should.eql(1);
        done();
      });

      queueProcessor.start();
      queueProcessor.start();
      queueProcessor.stop();
    });
  });
});
